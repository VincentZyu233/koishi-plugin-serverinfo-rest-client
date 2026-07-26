import { randomUUID } from 'node:crypto'
import type { PlayerActivityResponse } from '../api/types'
import {
  ActivityDateError,
  aggregatePlayerActivity,
  formatActivityDateDisplay,
  formatShanghaiDate,
  formatShanghaiTime,
  renderPlayerActivityChartPng,
  resolveActivityDate,
  shiftActivityDate,
} from '../activity'
import { runWithWaitingHint, withQuote } from '../feedback'
import { getTypstFontPaths } from '../font'
import { formatErrorForLog, logInfo } from '../logger'
import { buildCommandKeyboard, sendRenderedReply } from '../qq'
import { renderTypstTemplate } from '../typst'
import { aliasCommand, COMMAND_NAMES, commandDescription, primaryCommand } from './command-names'
import type { CommandRegistrationContext } from './types'

export function registerPlayerActivityCommand({
  ctx,
  config,
  apiClient,
  prefix,
}: CommandRegistrationContext) {
  const activityCommand = primaryCommand(prefix, COMMAND_NAMES.playerActivity)
  ctx.command(
    `${activityCommand} [date:string]`,
    commandDescription(COMMAND_NAMES.playerActivity, '查询单日在线人数与玩家进入次数趋势'),
  )
    .alias(aliasCommand(prefix, COMMAND_NAMES.playerActivity))
    .action(async ({ session }, rawDate) => {
      let requestedDate: ReturnType<typeof resolveActivityDate>
      try {
        requestedDate = resolveActivityDate(rawDate)
      } catch (error) {
        if (error instanceof ActivityDateError && error.code === 'future_date') {
          return withQuote(session, config, '🔮 暂不支持预知未来哦~ 请换一个今天或更早的日期。')
        }
        return withQuote(session, config, '❌ 日期格式不正确，请使用 yyyyMMdd，例如：20260725。')
      }

      return runWithWaitingHint(ctx, session, config, async () => {
        try {
          const data = await apiClient.get<PlayerActivityResponse>('/players/activity-history', {
            date: requestedDate.date,
          })
          const buckets = aggregatePlayerActivity(data)
          let chartPng: Buffer | null = null
          let chartMessage = '📭 该日期暂无玩家活动数据，可能当日服务器未运行，或统计功能当时尚未启用。'
          if (data.hasData) {
            try {
              chartPng = renderPlayerActivityChartPng(buckets, config, getTypstFontPaths(ctx, config))
            } catch (error) {
              chartMessage = '⚠️ 活动图表暂时无法生成，请稍后重试。'
              logInfo(ctx, config, '[WARN] 玩家活动 ECharts SVG 生成失败', formatErrorForLog(error))
            }
          }

          const shadowPath = chartPng ? `charts/player-activity-${randomUUID()}.png` : ''
          const image = await renderTypstTemplate(ctx, config, 'playerActivity', {
            label: config.serverLabel,
            date_display: formatActivityDateDisplay(data.date),
            chart_available: Boolean(chartPng),
            chart_path: chartPng ? `../${shadowPath}` : '',
            chart_message: chartMessage,
            stats: createStats(data),
            coverage_text: formatCoverage(data),
            generated_at: formatShanghaiTime(data.generatedAtMs),
          }, chartPng ? [{ path: shadowPath, content: chartPng }] : [])
          const text = formatActivityText(config.serverLabel, data)
          const keyboard = buildDateKeyboard(config, activityCommand, data.date)
          return sendRenderedReply(ctx, session, config, {
            image,
            text,
            title: `${config.serverLabel} ${COMMAND_NAMES.playerActivity.emoji} 玩家活动`,
            markdownBody: formatActivityMarkdown(data),
            keyboard,
          })
        } catch (error) {
          logInfo(ctx, config, '[ERROR] 查询玩家活动失败', formatErrorForLog(error))
          return withQuote(session, config, `查询玩家活动失败：${error instanceof Error ? error.message : String(error)}`)
        }
      })
    })
}

function createStats(data: PlayerActivityResponse) {
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

function formatCoverage(data: PlayerActivityResponse): string {
  const { coverageStartMs, coverageEndMs } = data.summary
  if (coverageStartMs === null || coverageEndMs === null) return '暂无有效数据'
  return `数据覆盖 ${formatShanghaiTime(coverageStartMs)} - ${formatShanghaiTime(coverageEndMs)}`
}

function formatActivityText(label: string, data: PlayerActivityResponse): string {
  const summary = data.summary
  if (!data.hasData) {
    return `${label} 📈 玩家活动（${formatActivityDateDisplay(data.date)}）\n该日期暂无玩家活动数据。`
  }
  return [
    `${label} 📈 玩家活动（${formatActivityDateDisplay(data.date)}）`,
    `末次在线：${summary.latestOnlineCount === null ? '未知' : `${summary.latestOnlineCount} 人`}`,
    `峰值在线：${summary.peakOnlineCount} 人`,
    `平均在线：${summary.validHeartbeatCount ? `${summary.averageOnlineCount.toFixed(1)} 人` : '未知'}`,
    `总进入次数：${summary.totalJoinCount} 次`,
    `独立玩家：${summary.uniquePlayerCount} 人`,
  ].join('\n')
}

function formatActivityMarkdown(data: PlayerActivityResponse): string {
  const summary = data.summary
  if (!data.hasData) return '该日期暂无玩家活动数据。'
  return [
    `- 末次在线：**${summary.latestOnlineCount === null ? '未知' : `${summary.latestOnlineCount} 人`}**`,
    `- 峰值在线：**${summary.peakOnlineCount} 人**`,
    `- 平均在线：**${summary.validHeartbeatCount ? `${summary.averageOnlineCount.toFixed(1)} 人` : '未知'}**`,
    `- 总进入次数：**${summary.totalJoinCount} 次**`,
    `- 独立玩家：**${summary.uniquePlayerCount} 人**`,
  ].join('\n')
}

function buildDateKeyboard(config: CommandRegistrationContext['config'], command: string, date: string) {
  const today = formatShanghaiDate(Date.now())
  const previous = shiftActivityDate(date, -1)
  const next = shiftActivityDate(date, 1)
  const nextIsFuture = next > today
  return buildCommandKeyboard(config, [
    { label: '◀️ 前一天', command: `${command} ${previous}`, style: 1 },
    {
      label: date === today ? '🔄 刷新' : '📅 今天',
      command: date === today ? command : `${command} ${today}`,
      style: 1,
    },
    {
      label: nextIsFuture ? '❌ 后一天' : '后一天 ▶️',
      command: `${command} ${next}`,
      style: nextIsFuture ? 0 : 1,
    },
  ], 3)
}
