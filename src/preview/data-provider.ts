import { createPlayerActivityDryrunResponse, resolveActivityDate } from '../activity'
import type { ApiClient } from '../api/client'
import type {
  HealthResponse,
  OverviewResponse,
  PlayerActivityResponse,
  PlayerHistoryResponse,
  PlayerResponse,
  PlayersCountResponse,
  PlayersNamesResponse,
  PlayersResponse,
  PlayerStatsResponse,
  ServerResponse,
  StatusResponse,
} from '../api/types'
import type { Config } from '../config'
import type { OnlineStatusResult } from '../types'
import { CLIENT_VERSION } from '../version'
import {
  createDryrunHistory,
  createDryrunOverview,
  createDryrunPlayer,
  createDryrunPlayers,
  createDryrunStats,
} from './fixtures'
import type { TypstPreviewMode } from './types'

export class TypstPreviewSkippedError extends Error {}

export class PreviewDataProvider {
  private readonly cache = new Map<string, Promise<unknown>>()
  private readonly now = Date.now()

  constructor(
    private readonly apiClient: ApiClient,
    private readonly config: Config,
    readonly mode: TypstPreviewMode,
  ) {}

  get dryrun(): boolean {
    return this.mode === 'dryrun'
  }

  private memo<T>(key: string, load: () => Promise<T> | T): Promise<T> {
    let task = this.cache.get(key) as Promise<T> | undefined
    if (!task) {
      task = Promise.resolve().then(load)
      this.cache.set(key, task)
    }
    return task
  }

  health(): Promise<HealthResponse> {
    return this.memo('health', () => this.dryrun
      ? { status: 'healthy', timestamp: this.now, uptime: 9 * 86_400_000 + 4 * 3_600_000 + 32 * 60_000 }
      : this.apiClient.get('/health'))
  }

  overviewResult(): Promise<OnlineStatusResult> {
    return this.memo('overview-result', async () => {
      const startedAt = Date.now()
      if (this.dryrun) {
        return {
          online: true,
          checkedAt: this.now,
          latencyMs: 42,
          overview: createDryrunOverview(this.now),
        }
      }
      try {
        const overview = await this.apiClient.get<OverviewResponse>('/overview')
        return {
          online: true,
          checkedAt: Date.now(),
          latencyMs: Date.now() - startedAt,
          overview,
        }
      } catch (error) {
        return {
          online: false,
          checkedAt: Date.now(),
          latencyMs: Date.now() - startedAt,
          error: sanitizePreviewError(error),
        }
      }
    })
  }

  history(): Promise<PlayerHistoryResponse> {
    return this.memo('history', () => this.dryrun
      ? createDryrunHistory(this.now)
      : this.apiClient.get('/players/history', {
          page: '1',
          pageSize: String(this.config.historyPageSize),
        }))
  }

  activity(): Promise<PlayerActivityResponse> {
    return this.memo('activity', () => {
      const date = resolveActivityDate(undefined, this.now)
      return this.dryrun
        ? createPlayerActivityDryrunResponse(date, this.now)
        : this.apiClient.get('/players/activity-history', { date: date.date })
    })
  }

  players(): Promise<PlayersResponse> {
    return this.memo('players', () => this.dryrun
      ? createDryrunPlayers()
      : this.apiClient.get('/players'))
  }

  playerCount(): Promise<PlayersCountResponse> {
    return this.memo('player-count', () => this.dryrun
      ? { count: createDryrunPlayers().count }
      : this.apiClient.get('/players/count'))
  }

  playerNames(): Promise<PlayersNamesResponse> {
    return this.memo('player-names', () => this.dryrun
      ? { names: createDryrunPlayers().players.map(player => player.name), count: createDryrunPlayers().count }
      : this.apiClient.get('/players/names'))
  }

  server(): Promise<ServerResponse> {
    return this.memo('server', () => this.dryrun
      ? {
          status: 'online',
          levelName: 'Codex Preview World',
          bdsVersion: '1.26.10.4',
          protocolVersion: 944,
          levilaminaVersion: '26.10.14',
          pluginVersion: CLIENT_VERSION,
          onlinePlayers: 4,
          maxPlayers: 30,
        }
      : this.apiClient.get('/server'))
  }

  status(): Promise<StatusResponse> {
    return this.memo('status', () => this.dryrun
      ? {
          status: 'online',
          plugin: 'serverinfo-rest',
          version: CLIENT_VERSION,
          playerCount: 4,
          bdsVersion: '1.26.10.4',
          protocolVersion: 944,
        }
      : this.apiClient.get('/status'))
  }

  async playerDetail(): Promise<PlayerResponse> {
    if (this.dryrun) return createDryrunPlayer(this.now)
    const players = await this.players()
    const selected = players.players[0]?.name
    if (!selected) throw new TypstPreviewSkippedError('当前没有在线玩家，已跳过玩家在线详情')
    return this.apiClient.get('/player', { name: selected })
  }

  async playerStats(): Promise<PlayerStatsResponse> {
    if (this.dryrun) return createDryrunStats(this.now)
    const candidates: string[] = []
    const selectionErrors: unknown[] = []
    try {
      const onlineName = (await this.players()).players[0]?.name
      if (onlineName) candidates.push(onlineName)
    } catch (error) {
      selectionErrors.push(error)
    }
    try {
      const historyName = (await this.history()).players[0]?.name
      if (historyName && !candidates.includes(historyName)) candidates.push(historyName)
    } catch (error) {
      selectionErrors.push(error)
    }
    if (!candidates.length) {
      if (selectionErrors.length) throw selectionErrors[0]
      throw new TypstPreviewSkippedError('没有在线玩家或历史玩家，已跳过玩家数据统计')
    }

    let lastError: unknown
    for (const name of candidates) {
      try {
        return await this.apiClient.get('/players/stats', { name })
      } catch (error) {
        lastError = error
      }
    }
    throw lastError || new Error('没有可用于玩家数据统计的玩家')
  }
}

export function sanitizePreviewError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/https?:\/\/\S+/gi, '服务器接口')
    .replace(/([?&]token=)[^&\s]+/gi, '$1***')
    .replace(/(Bearer\s+)[^\s]+/gi, '$1***')
    .slice(0, 240)
}
