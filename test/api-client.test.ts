import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../src/api/client'

const info = vi.fn()
const ctx = { logger: { info } } as any
const config = {
  serverUrl: 'https://example.test/', apiPrefix: '/api/v2/', timeout: 1000,
  fallbackServerUrlList: [], serverUrlSelectionStrategy: 'forward',
  requestMaxAttempts: 5, requestRetryDelayMs: 0, requestTotalTimeoutMs: 25000,
  token: 'read-token', tokenSendMode: 'header',
  adminToken: 'admin-token', adminTokenSendMode: 'header',
  verboseConsoleLog: true,
} as any

const poolConfig = {
  ...config,
  serverUrl: 'https://primary.test/',
  fallbackServerUrlList: ['https://fallback-1.test/', 'https://fallback-2.test/'],
}

function socketError() {
  const cause = Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' })
  return new TypeError('fetch failed', { cause })
}

function calledUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url))
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('createApiClient', () => {
  it('normalizes URLs and sends the read token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient(ctx, config)
    await client.get('/players/stats', { name: 'A B' })

    expect(client.getBaseUrl()).toBe('https://example.test')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/v2/players/stats?name=A%20B',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer read-token' }) }),
    )
  })

  it('sends JSON and the independent admin token for writes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"created":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient(ctx, config).post('/whitelist/add', { playerName: 'Steve' }, { admin: true })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/v2/whitelist/add',
      expect.objectContaining({
        method: 'POST',
        body: '{"playerName":"Steve"}',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    )
  })

  it('sends the read token as a URL parameter without leaking it to logs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient(ctx, { ...config, tokenSendMode: 'param' })
      .get('/players/stats', { name: 'A B' })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test/api/v2/players/stats?name=A%20B&token=read-token')
    expect(options.headers.Authorization).toBeUndefined()
    expect(info.mock.calls.flat().join(' ')).toContain('token=***')
    expect(info.mock.calls.flat().join(' ')).not.toContain('read-token')
  })

  it('sends the admin token in both supported locations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient(ctx, { ...config, adminTokenSendMode: 'both' })
      .post('/whitelist/add', { playerName: 'Steve' }, { admin: true })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test/api/v2/whitelist/add?token=admin-token')
    expect(options.headers.Authorization).toBe('Bearer admin-token')
    expect(info.mock.calls.flat().join(' ')).not.toContain('admin-token')
  })

  it('sends the read token in both supported locations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient(ctx, { ...config, tokenSendMode: 'both' }).get('/status')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test/api/v2/status?token=read-token')
    expect(options.headers.Authorization).toBe('Bearer read-token')
  })

  it('sends the admin token only as a URL parameter when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient(ctx, { ...config, adminTokenSendMode: 'param' })
      .post('/whitelist/remove', { playerName: 'Steve' }, { admin: true })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test/api/v2/whitelist/remove?token=admin-token')
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('does not send authentication fields when the selected token is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await createApiClient(ctx, { ...config, token: '', tokenSendMode: 'both' }).get('/status')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://example.test/api/v2/status')
    expect(options.headers.Authorization).toBeUndefined()
  })

  it('surfaces structured HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"code":"binding_not_found","error":"denied"}', {
      status: 403, statusText: 'Forbidden',
    }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createApiClient(ctx, config).get('/status')).rejects.toMatchObject({
      status: 403,
      code: 'binding_not_found',
      detail: 'denied',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('normalizes, filters, and deduplicates the server URL pool', () => {
    const client = createApiClient(ctx, {
      ...config,
      fallbackServerUrlList: [
        '',
        'https://example.test',
        'ftp://invalid.test',
        'not-a-url',
        'https://fallback.test///',
      ],
    })

    expect(client.getBaseUrl()).toBe('https://example.test')
    expect(client.getBaseUrls()).toEqual([
      'https://example.test',
      'https://fallback.test',
    ])
    expect(client.getApiBase()).toBe('https://example.test/api/v2')
  })

  it.each([
    ['forward', [
      'https://primary.test/api/v2/status',
      'https://fallback-1.test/api/v2/status',
      'https://fallback-2.test/api/v2/status',
      'https://primary.test/api/v2/status',
      'https://fallback-1.test/api/v2/status',
    ]],
    ['reverse', [
      'https://fallback-2.test/api/v2/status',
      'https://fallback-1.test/api/v2/status',
      'https://primary.test/api/v2/status',
      'https://fallback-2.test/api/v2/status',
      'https://fallback-1.test/api/v2/status',
    ]],
  ])('uses the %s retry order', async (serverUrlSelectionStrategy, expectedUrls) => {
    const fetchMock = vi.fn().mockRejectedValue(socketError())
    vi.stubGlobal('fetch', fetchMock)

    await expect(createApiClient(ctx, {
      ...poolConfig,
      serverUrlSelectionStrategy,
    } as any).get('/status')).rejects.toMatchObject({
      name: 'ApiRetryError',
      attempts: 5,
    })
    expect(calledUrls(fetchMock)).toEqual(expectedUrls)
    expect(info.mock.calls.flat().join(' ')).toContain('UND_ERR_SOCKET: other side closed')
  })

  it('starts future requests from the most recently successful address', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(socketError())
      .mockImplementation(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient(ctx, {
      ...poolConfig,
      serverUrlSelectionStrategy: 'last-success',
    } as any)

    await client.get('/status')
    await client.get('/players')

    expect(calledUrls(fetchMock)).toEqual([
      'https://primary.test/api/v2/status',
      'https://fallback-1.test/api/v2/status',
      'https://fallback-1.test/api/v2/players',
    ])
  })

  it('rotates the starting address once per logical request', async () => {
    const fetchMock = vi.fn()
      .mockImplementation(() => Promise.resolve(new Response('{"ok":true}', { status: 200 })))
    vi.stubGlobal('fetch', fetchMock)
    const client = createApiClient(ctx, {
      ...poolConfig,
      serverUrlSelectionStrategy: 'round-robin',
    } as any)

    await client.get('/status')
    await client.get('/status')
    await client.get('/status')
    await client.get('/status')

    expect(calledUrls(fetchMock)).toEqual([
      'https://primary.test/api/v2/status',
      'https://fallback-1.test/api/v2/status',
      'https://fallback-2.test/api/v2/status',
      'https://primary.test/api/v2/status',
    ])
  })

  it('visits every address once per random cycle', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const fetchMock = vi.fn().mockRejectedValue(socketError())
    vi.stubGlobal('fetch', fetchMock)

    await expect(createApiClient(ctx, {
      ...poolConfig,
      serverUrlSelectionStrategy: 'random',
      requestMaxAttempts: 3,
    } as any).get('/status')).rejects.toMatchObject({ attempts: 3 })

    expect(calledUrls(fetchMock)).toEqual([
      'https://fallback-1.test/api/v2/status',
      'https://fallback-2.test/api/v2/status',
      'https://primary.test/api/v2/status',
    ])
    expect(new Set(calledUrls(fetchMock))).toHaveLength(3)
  })

  it('retries transient HTTP failures but not authentication failures', async () => {
    const transientFetch = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":"busy"}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', transientFetch)
    await createApiClient(ctx, poolConfig as any).get('/status')
    expect(transientFetch).toHaveBeenCalledTimes(2)

    const authFetch = vi.fn().mockResolvedValue(new Response('{"error":"denied"}', { status: 401 }))
    vi.stubGlobal('fetch', authFetch)
    await expect(createApiClient(ctx, poolConfig as any).get('/status')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
    })
    expect(authFetch).toHaveBeenCalledOnce()
  })

  it('retries explicitly safe POST requests with the admin token', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(socketError())
      .mockResolvedValueOnce(new Response('{"name":"Steve"}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createApiClient(ctx, poolConfig as any).post(
      '/players/stats/bound',
      { userId: '123' },
      { admin: true, retryable: true },
    )

    expect(calledUrls(fetchMock)).toEqual([
      'https://primary.test/api/v2/players/stats/bound',
      'https://fallback-1.test/api/v2/players/stats/bound',
    ])
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      method: 'POST',
      body: '{"userId":"123"}',
      headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
    }))
  })

  it('never retries mutating POST requests after an ambiguous network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(socketError())
    vi.stubGlobal('fetch', fetchMock)

    await expect(createApiClient(ctx, poolConfig as any).post(
      '/admin/command',
      { command: 'say hello' },
      { admin: true },
    )).rejects.toThrow('fetch failed')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('waits 333ms between attempts', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn().mockRejectedValue(socketError())
    vi.stubGlobal('fetch', fetchMock)
    const request = createApiClient(ctx, {
      ...poolConfig,
      requestMaxAttempts: 3,
      requestRetryDelayMs: 333,
    } as any).get('/status')
    const rejection = expect(request).rejects.toMatchObject({ attempts: 3 })

    await vi.advanceTimersByTimeAsync(665)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await rejection
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stops retries when the 25 second total budget is exhausted', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(options.signal?.reason))
    }))
    vi.stubGlobal('fetch', fetchMock)
    const request = createApiClient(ctx, {
      ...poolConfig,
      timeout: 10000,
      requestMaxAttempts: 10,
      requestRetryDelayMs: 333,
      requestTotalTimeoutMs: 25000,
    } as any).get('/status')
    const rejection = expect(request).rejects.toMatchObject({
      name: 'ApiRetryError',
      attempts: 3,
      elapsedMs: 25000,
    })

    await vi.advanceTimersByTimeAsync(25000)
    await rejection
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
