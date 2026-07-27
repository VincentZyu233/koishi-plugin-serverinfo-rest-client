import { randomUUID } from 'node:crypto'
import type { Context } from 'koishi'
import {
  aggregatePlayerActivity,
  formatActivityDateDisplay,
  formatShanghaiTime,
  renderPlayerActivityChartPng,
} from '../activity'
import type { PlayerActivityResponse, PlayerStatsResponse } from '../api/types'
import { formatTimestamp } from '../commands/command-formatters'
import { createPlayerDetailSections } from '../commands/player-details'
import type { Config } from '../config'
import { getTypstFontPaths } from '../font'
import type { TypstTemplateName } from '../template'
import type { OnlineStatusResult } from '../types'
import { renderTypstTemplate } from '../typst'
import { CLIENT_VERSION } from '../version'
import { PreviewDataProvider, sanitizePreviewError } from './data-provider'

export interface RenderedPreview {
  image: Buffer
  selectedPlayer?: string
}

export async function renderPreview(
  ctx: Context,
  config: Config,
  serverLabel: string,
  id: TypstTemplateName,
  provider: PreviewDataProvider,
): Promise<RenderedPreview> {
  const label = provider.dryrun
    ? `${serverLabel} [DRY RUN · 内置演示数据]`
    : serverLabel
  switch (id) {
    case 'healthStatus': {
      const data = await provider.health()
      return { image: await renderTypstTemplate(ctx, config, id, {
        label,
        status_emoji: data.status === 'healthy' ? '✅' : '❌',
        status_text: data.status === 'healthy' ? '健康' : '异常',
        timestamp: formatTimestamp(data.timestamp),
        uptime: formatUptime(data.uptime),
        generated_at: new Date().toLocaleString('zh-CN'),
      }) }
    }
    case 'onlineStatus': {
      const result = await provider.overviewResult()
      return { image: await renderTypstTemplate(ctx, config, id, createOverviewPayload(label, result)) }
    }
    case 'playerHistory': {
      const data = await provider.history()
      return { image: await renderTypstTemplate(ctx, config, id, {
        label,
        total: data.total,
        page: data.page,
        page_count: data.pageCount,
        players: data.players.map((player, index) => ({
          number: (data.page - 1) * data.pageSize + index + 1,
          name: player.name,
          total_play: formatHistoryDuration(player.totalPlayMs),
          last_seen: formatHistoryDate(player.lastSeenMs),
        })),
      }) }
    }
    case 'playerActivity': {
      const data = await provider.activity()
      return { image: await renderActivityPreview(ctx, config, label, data, provider.dryrun) }
    }
    case 'playerStats': {
      const data = await provider.playerStats()
      return {
        image: await renderTypstTemplate(ctx, config, id, createPlayerStatsPayload(label, data)),
        selectedPlayer: data.name,
      }
    }
    case 'playerDetail': {
      const data = await provider.playerDetail()
      return {
        image: await renderTypstTemplate(ctx, config, id, {
          label,
          name: data.name,
          sections: createPlayerDetailSections(data, config),
        }),
        selectedPlayer: data.name,
      }
    }
    case 'playersList': {
      const data = await provider.players()
      return { image: await renderTypstTemplate(ctx, config, id, {
        label,
        count: data.count,
        players: data.players.map(player => ({ name: player.name })),
      }) }
    }
    case 'playersCount': {
      const data = await provider.playerCount()
      return { image: await renderTypstTemplate(ctx, config, id, {
        label,
        count: data.count,
        generated_at: new Date().toLocaleString('zh-CN'),
      }) }
    }
    case 'playerNames': {
      const data = await provider.playerNames()
      return { image: await renderTypstTemplate(ctx, config, id, {
        label,
        names: data.names,
        count: data.count,
        generated_at: new Date().toLocaleString('zh-CN'),
      }) }
    }
    case 'serverInfo': {
      const data = await provider.server()
      return { image: await renderTypstTemplate(ctx, config, id, {
        label,
        status: data.status,
        level_name: data.levelName,
        online_players: data.onlinePlayers,
        max_players: data.maxPlayers,
        bds_version: data.bdsVersion,
        protocol_version: data.protocolVersion,
        levilamina_version: data.levilaminaVersion,
        plugin_version: data.pluginVersion,
      }) }
    }
    case 'serverStatus': {
      const data = await provider.status()
      return { image: await renderTypstTemplate(ctx, config, id, {
        label,
        status_emoji: data.status === 'online' ? '🟢' : '🔴',
        status: data.status,
        plugin: data.plugin,
        plugin_version: data.version,
        client_version: CLIENT_VERSION,
        player_count: data.playerCount,
        bds_version: data.bdsVersion,
        protocol_version: data.protocolVersion,
        generated_at: new Date().toLocaleString('zh-CN'),
      }) }
    }
  }
}

function createOverviewPayload(label: string, result: OnlineStatusResult) {
  const overview = result.overview
  const tps = overview?.tps
  return {
    label,
    online: result.online && Boolean(overview),
    error: result.error || '服务器接口暂时不可用',
    latency_ms: result.latencyMs,
    checked_at: new Date(result.checkedAt).toLocaleString('zh-CN'),
    online_players: overview?.players.online ?? 0,
    max_players: overview?.players.max ?? 0,
    tps_color: !tps ? '#c53030' : tps.avg10s >= 18 ? '#2f855a' : tps.avg10s >= 15 ? '#b7791f' : '#c53030',
    tps: {
      realtime: tps?.realtime.toFixed(2) ?? '0.00',
      avg10s: tps?.avg10s.toFixed(2) ?? '0.00',
      avg60s: tps?.avg60s.toFixed(2) ?? '0.00',
      avg300s: tps?.avg300s.toFixed(2) ?? '0.00',
      sampled_seconds: tps?.sampledSeconds ?? 0,
    },
    versions: {
      bds: overview?.versions.bds ?? '未知',
      protocol: overview?.versions.protocol ?? 0,
      levilamina: overview?.versions.levilamina ?? '未知',
      plugin: overview?.versions.plugin ?? '未知',
    },
  }
}

async function renderActivityPreview(
  ctx: Context,
  config: Config,
  label: string,
  data: PlayerActivityResponse,
  dryrun: boolean,
): Promise<Buffer> {
  const buckets = aggregatePlayerActivity(data)
  let chartPng: Buffer | null = null
  let chartMessage = '📭 该日期暂无玩家活动数据，可能当日服务器未运行，或统计功能当时尚未启用。'
  if (data.hasData) {
    try {
      chartPng = renderPlayerActivityChartPng(buckets, config, getTypstFontPaths(ctx, config))
    } catch (error) {
      chartMessage = `⚠️ 活动图表暂时无法生成：${sanitizePreviewError(error)}`
    }
  }
  const shadowPath = chartPng ? `charts/player-activity-preview-${randomUUID()}.png` : ''
  return renderTypstTemplate(ctx, config, 'playerActivity', {
    label,
    date_display: dryrun
      ? `${formatActivityDateDisplay(data.date)} · 内置演示数据`
      : formatActivityDateDisplay(data.date),
    chart_available: Boolean(chartPng),
    chart_path: chartPng ? `../${shadowPath}` : '',
    chart_message: chartMessage,
    stats: createActivityStats(data),
    coverage_text: formatActivityCoverage(data),
    generated_at: formatShanghaiTime(data.generatedAtMs),
  }, chartPng ? [{ path: shadowPath, content: chartPng }] : [])
}

function createActivityStats(data: PlayerActivityResponse) {
  const summary = data.summary
  return [
    { label: '末次在线', value: summary.latestOnlineCount === null ? '--' : `${summary.latestOnlineCount} 人` },
    { label: '峰值在线', value: `${summary.peakOnlineCount} 人` },
    { label: '平均在线', value: summary.validHeartbeatCount ? `${summary.averageOnlineCount.toFixed(1)} 人` : '--' },
    { label: '总进入次数', value: `${summary.totalJoinCount} 次` },
    { label: '独立玩家', value: `${summary.uniquePlayerCount} 人` },
    {
      label: '峰值进入分钟',
      value: summary.peakJoinMinuteMs === null
        ? '--'
        : `${formatShanghaiTime(summary.peakJoinMinuteMs)} · ${summary.peakJoinCount} 次`,
    },
  ]
}

function formatActivityCoverage(data: PlayerActivityResponse): string {
  const { coverageStartMs, coverageEndMs } = data.summary
  if (coverageStartMs === null || coverageEndMs === null) return '暂无有效数据'
  return `数据覆盖 ${formatShanghaiTime(coverageStartMs)} - ${formatShanghaiTime(coverageEndMs)}`
}

function createPlayerStatsPayload(label: string, data: PlayerStatsResponse) {
  return {
    label,
    name: data.name,
    xuid: data.xuid,
    total_play: formatStatsDuration(data.totalPlayMs),
    blocks_mined: formatInteger(data.blocksMined),
    mobs_killed: formatInteger(data.mobsKilled),
    join_count: formatInteger(data.joinCount),
    first_seen: formatDate(data.firstSeenMs),
    last_seen: formatDate(data.lastSeenMs),
  }
}

function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟`
  if (hours > 0) return `${hours}小时 ${minutes % 60}分钟`
  if (minutes > 0) return `${minutes}分钟 ${seconds % 60}秒`
  return `${seconds}秒`
}

function formatHistoryDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days) return `${days}天 ${hours}小时`
  if (hours) return `${hours}小时 ${minutes}分钟`
  return `${minutes}分钟`
}

function formatHistoryDate(timestamp: number): string {
  if (!timestamp) return '未知'
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatStatsDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days) return `${days}天 ${hours}小时 ${minutes}分钟`
  if (hours) return `${hours}小时 ${minutes}分钟`
  return `${minutes}分钟`
}

function formatDate(timestamp: number): string {
  return timestamp ? new Date(timestamp).toLocaleString('zh-CN') : '未知'
}

function formatInteger(value: number): string {
  return Math.max(0, Number(value) || 0).toLocaleString('zh-CN')
}
