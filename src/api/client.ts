import type { Context } from 'koishi'
import type { Config, ServerUrlSelectionStrategy, TokenSendMode } from '../config'
import { formatErrorForLog, logInfo, stringifyForLog } from '../logger'

export interface ApiPostOptions {
  admin?: boolean
  retryable?: boolean
}

export interface ApiClient {
  get<T>(endpoint: string, params?: Record<string, string>): Promise<T>
  post<T>(endpoint: string, body: unknown, options?: ApiPostOptions | boolean): Promise<T>
  getBaseUrl(): string
  getBaseUrls(): readonly string[]
  getApiBase(): string
}

export class ApiRequestError extends Error {
  readonly name = 'ApiRequestError'
  readonly code?: string

  constructor(
    readonly status: number,
    readonly detail: string,
    readonly responseData: unknown,
  ) {
    super(`HTTP ${status}: ${detail}`)
    this.code = typeof responseData === 'object' && responseData
      && typeof (responseData as Record<string, unknown>).code === 'string'
      ? (responseData as Record<string, string>).code
      : undefined
  }
}

export class ApiRetryError extends Error {
  readonly name = 'ApiRetryError'

  constructor(
    readonly attempts: number,
    readonly elapsedMs: number,
    readonly lastError: unknown,
  ) {
    super(
      `请求失败，已尝试 ${attempts} 次（${elapsedMs}ms）：${errorSummary(lastError)}`,
      { cause: lastError },
    )
  }
}

class ApiAttemptTimeoutError extends Error {
  readonly name = 'ApiAttemptTimeoutError'
  readonly code = 'ETIMEDOUT'

  constructor(timeoutMs: number, cause?: unknown) {
    super(`单次请求超时 (${timeoutMs}ms)`, cause === undefined ? undefined : { cause })
  }
}

const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429])
const STRATEGIES = new Set<ServerUrlSelectionStrategy>([
  'forward',
  'reverse',
  'last-success',
  'round-robin',
  'random',
])

export function createApiClient(ctx: Context, config: Config): ApiClient {
  const baseUrls = normalizeBaseUrls(config.serverUrl, config.fallbackServerUrlList)
  if (!baseUrls.length) throw new Error('未配置有效的 HTTP REST 服务地址')

  const primaryBaseUrl = baseUrls[0]
  const apiPrefix = config.apiPrefix.startsWith('/') ? config.apiPrefix : `/${config.apiPrefix}`
  const normalizedApiPrefix = apiPrefix.replace(/\/+$/, '')
  const strategy = normalizeStrategy(config.serverUrlSelectionStrategy)
  const maxAttempts = normalizeInteger(config.requestMaxAttempts, 5, 1, 10)
  const retryDelayMs = normalizeInteger(config.requestRetryDelayMs, 333, 0, 10000)
  const totalTimeoutMs = normalizeInteger(config.requestTotalTimeoutMs, 25000, 1, 300000)
  const attemptTimeoutMs = normalizeInteger(config.timeout, 10000, 1, 60000)
  let lastSuccessfulBaseUrl: string | undefined
  let roundRobinCursor = 0

  function buildUrl(baseUrl: string, endpoint: string, params?: Record<string, string>): string {
    const queryString = Object.entries(params ?? {})
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
    const url = `${baseUrl}${normalizedApiPrefix}${endpoint}`
    return queryString ? `${url}?${queryString}` : url
  }

  async function request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    params?: Record<string, string>,
    body?: unknown,
    admin = false,
    retryable = method === 'GET',
  ): Promise<T> {
    const authToken = admin ? config.adminToken : config.token
    const sendMode = normalizeSendMode(admin ? config.adminTokenSendMode : config.tokenSendMode)
    const queryParams = { ...(params ?? {}) }
    if (authToken && includesParam(sendMode)) queryParams.token = authToken

    const allowedAttempts = retryable ? maxAttempts : 1
    const requestBudgetMs = retryable ? totalTimeoutMs : attemptTimeoutMs
    const attemptOrder = createAttemptOrder(allowedAttempts)
    const startedAt = Date.now()
    let completedAttempts = 0
    let lastError: unknown

    for (const baseUrl of attemptOrder) {
      const remainingMs = requestBudgetMs - (Date.now() - startedAt)
      if (remainingMs <= 0) break

      completedAttempts += 1
      const currentAttemptTimeoutMs = Math.max(1, Math.min(attemptTimeoutMs, remainingMs))
      try {
        const result = await requestOnce<T>(
          baseUrl,
          method,
          endpoint,
          queryParams,
          body,
          authToken,
          sendMode,
          currentAttemptTimeoutMs,
        )
        lastSuccessfulBaseUrl = baseUrl
        if (completedAttempts > 1) {
          logInfo(
            ctx,
            config,
            `[API] ${method} ${endpoint} 在第 ${completedAttempts} 次尝试成功，当前地址: ${formatTarget(baseUrl)}`,
          )
        }
        return result
      } catch (error) {
        lastError = error
        const canRetry = retryable
          && isRetryableError(error)
          && completedAttempts < allowedAttempts
        if (!canRetry) {
          if (!retryable || !isRetryableError(error)) throw error
          break
        }

        const remainingAfterAttemptMs = requestBudgetMs - (Date.now() - startedAt)
        if (remainingAfterAttemptMs <= retryDelayMs) break
        const nextBaseUrl = attemptOrder[completedAttempts]
        const nextAction = nextBaseUrl === baseUrl
          ? `重试当前地址 ${formatTarget(baseUrl)}`
          : `切换至 ${formatTarget(nextBaseUrl)}`
        logInfo(
          ctx,
          config,
          `[API] ${method} ${endpoint} 第 ${completedAttempts}/${allowedAttempts} 次尝试失败（${errorSummary(error)}），${retryDelayMs}ms 后${nextAction}`,
          formatErrorForLog(error),
        )
        if (retryDelayMs > 0) await delay(retryDelayMs)
      }
    }

    const retryError = new ApiRetryError(
      completedAttempts,
      Date.now() - startedAt,
      lastError ?? new ApiAttemptTimeoutError(requestBudgetMs),
    )
    logInfo(
      ctx,
      config,
      `[API] ${method} ${endpoint} 最终失败：${retryError.message}`,
      formatErrorForLog(retryError),
    )
    throw retryError
  }

  async function requestOnce<T>(
    baseUrl: string,
    method: 'GET' | 'POST',
    endpoint: string,
    params: Record<string, string>,
    body: unknown,
    authToken: string,
    sendMode: TokenSendMode,
    timeoutMs: number,
  ): Promise<T> {
    const url = buildUrl(baseUrl, endpoint, params)
    if (config.verboseConsoleLog) {
      logInfo(ctx, config, `[API] ${method} 请求`, `URL: ${redactUrl(url)}`)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'User-Agent': 'koishi-plugin-serverinfo-rest-client/1.0',
          'Accept': 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(authToken && includesHeader(sendMode)
            ? { 'Authorization': `Bearer ${authToken}` }
            : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      })

      const responseText = await response.text()
      let data: any = null
      try {
        data = responseText ? JSON.parse(responseText) : null
      } catch {
        data = responseText
      }
      if (!response.ok) {
        const detail = typeof data === 'object' && data
          ? data.error || data.warning || data.commandOutput || data.output
          : data
        throw new ApiRequestError(
          response.status,
          String(detail || response.statusText),
          data,
        )
      }

      if (config.verboseConsoleLog) {
        logInfo(
          ctx,
          config,
          `[API] ${method} 响应成功`,
          `URL: ${redactUrl(url)}\n状态码: ${response.status}\n响应: ${stringifyForLog(data).substring(0, 1000)}`,
        )
      }
      return data as T
    } catch (error) {
      if (controller.signal.aborted) throw new ApiAttemptTimeoutError(timeoutMs, error)
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  function createAttemptOrder(allowedAttempts: number): string[] {
    const result: string[] = []
    const orderedCycle = strategy === 'random' ? undefined : selectOrderedCycle()
    while (result.length < allowedAttempts) {
      const cycle = strategy === 'random' ? shuffle(baseUrls) : orderedCycle!
      result.push(...cycle.slice(0, allowedAttempts - result.length))
    }
    return result
  }

  function selectOrderedCycle(): string[] {
    if (strategy === 'reverse') return [...baseUrls].reverse()
    if (strategy === 'last-success' && lastSuccessfulBaseUrl) {
      return rotate(baseUrls, baseUrls.indexOf(lastSuccessfulBaseUrl))
    }
    if (strategy === 'round-robin') {
      const result = rotate(baseUrls, roundRobinCursor)
      roundRobinCursor = (roundRobinCursor + 1) % baseUrls.length
      return result
    }
    return [...baseUrls]
  }

  function get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    return request<T>('GET', endpoint, params)
  }

  function post<T>(
    endpoint: string,
    body: unknown,
    rawOptions: ApiPostOptions | boolean = {},
  ): Promise<T> {
    const options = typeof rawOptions === 'boolean' ? { admin: rawOptions } : rawOptions
    return request<T>('POST', endpoint, undefined, body, options.admin, options.retryable)
  }

  return {
    get,
    post,
    getBaseUrl: () => primaryBaseUrl,
    getBaseUrls: () => [...baseUrls],
    getApiBase: () => `${primaryBaseUrl}${normalizedApiPrefix}`,
  }
}

function normalizeBaseUrls(primary: string, fallbacks: string[] | undefined): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const rawValue of [primary, ...(fallbacks ?? [])]) {
    const value = String(rawValue ?? '').trim().replace(/\/+$/, '')
    if (!value || seen.has(value)) continue
    try {
      const parsed = new URL(value)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue
    } catch {
      continue
    }
    seen.add(value)
    result.push(value)
  }
  return result
}

function normalizeStrategy(value: ServerUrlSelectionStrategy | undefined): ServerUrlSelectionStrategy {
  return value && STRATEGIES.has(value) ? value : 'last-success'
}

function normalizeSendMode(value: TokenSendMode | undefined): TokenSendMode {
  return value === 'param' || value === 'both' ? value : 'header'
}

function includesParam(mode: TokenSendMode): boolean {
  return mode === 'param' || mode === 'both'
}

function includesHeader(mode: TokenSendMode): boolean {
  return mode === 'header' || mode === 'both'
}

function normalizeInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const normalized = Number.isFinite(value) ? Math.trunc(value as number) : fallback
  return Math.min(max, Math.max(min, normalized))
}

function rotate<T>(values: readonly T[], rawIndex: number): T[] {
  if (!values.length) return []
  const index = rawIndex >= 0 ? rawIndex % values.length : 0
  return [...values.slice(index), ...values.slice(0, index)]
}

function shuffle<T>(values: readonly T[]): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return true
  return RETRYABLE_HTTP_STATUSES.has(error.status) || error.status >= 500
}

function errorSummary(error: unknown): string {
  let current = error
  const visited = new Set<unknown>()
  let summary = error instanceof Error ? error.message : String(error)
  let codedSummary = ''
  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current)
    const record = current as { cause?: unknown; code?: unknown; message?: unknown }
    const code = typeof record.code === 'string' ? record.code : ''
    const message = typeof record.message === 'string' ? record.message : ''
    if (code) codedSummary = [code, message].filter(Boolean).join(': ')
    else if (!codedSummary && message) summary = message
    current = record.cause
  }
  return (codedSummary || summary)
    .replace(/https?:\/\/\S+/gi, '服务器接口')
    .replace(/([?&]token=)[^&\s]+/gi, '$1***')
    .slice(0, 240)
}

function redactUrl(url: string): string {
  return url.replace(/([?&]token=)[^&]*/gi, '$1***')
}

function formatTarget(baseUrl: string): string {
  try {
    const url = new URL(baseUrl)
    return `${url.protocol}//${url.host}`
  } catch {
    return baseUrl
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
