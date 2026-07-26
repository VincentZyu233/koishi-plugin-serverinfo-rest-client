import { randomUUID } from 'node:crypto'
import type { PlayerActivityResponse } from '../api/types'
import {
  ActivityDateError,
  aggregatePlayerActivity,
  aggregatePlayerActivityHourly,
  createPlayerActivityDryrunResponse,
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
import { renderTypstTemplate, resolveOutputModes } from '../typst'
import {
  aliasCommand,
  COMMAND_NAMES,
  commandDescription,
  PLAYER_ACTIVITY_ADDITIONAL_ALIASES,
  primaryCommand,
} from './command-names'
import type { CommandRegistrationContext } from './types'

export function registerPlayerActivityCommand({
  ctx,
  config,
  apiClient,
  prefix,
}: CommandRegistrationContext) {
  const activityCommand = primaryCommand(prefix, COMMAND_NAMES.playerActivity)
  const command = ctx.command(
    `${activityCommand} [date:string]`,
    commandDescription(COMMAND_NAMES.playerActivity, '查询单日在线人数与玩家进入次数趋势'),
  )
  command.alias(aliasCommand(prefix, COMMAND_NAMES.playerActivity))
  for (const alias of PLAYER_ACTIVITY_ADDITIONAL_ALIASES) {
    command.alias(aliasCommand(prefix, alias))
  }
  command
    .option('mode', '-m <mode:string> 输出模式 (text/image)')
    .option('dryrun', '-d, --dryrun, --dry-run 使用内置演示数据，不请求服务端 API')
    .action(async ({ session, options }, rawDate) => {
      let requestedDate: ReturnType<typeof resolveActivityDate>
      try {
        requestedDate = resolveActivityDate(rawDate)
      } catch (error) {
        if (error instanceof ActivityDateError && error.code === 'future_date') {
          return withQuote(session, config, '🔮 暂不支持预知未来哦~ 请换一个今天或更早的日期。')
        }
        return withQuote(session, config, '❌ 日期格式不正确，请使用 yyyyMMdd，例如：20260725。')
      }

      const modes = resolveOutputModes(options.mode, config)
      const wantsImage = modes.includes('typst-image')
      const wantsText = modes.includes('text') || !wantsImage
      const dryrun = Boolean(options.dryrun)
      const explicitMode = options.mode === 'text' || options.mode === 'image'
        ? options.mode
        : undefined
      const operation = async () => {
        try {
          const data = dryrun
            ? createPlayerActivityDryrunResponse(requestedDate)
            : await apiClient.get<PlayerActivityResponse>('/players/activity-history', {
                date: requestedDate.date,
              })
          const text = formatActivityText(config.serverLabel, data, dryrun)
          const title = dryrun
            ? `${config.serverLabel} ${COMMAND_NAMES.playerActivity.emoji} 玩家活动 · DRY RUN · 内置演示数据`
            : `${config.serverLabel} ${COMMAND_NAMES.playerActivity.emoji} 玩家活动`
          const keyboard = buildDateKeyboard(config, activityCommand, data.date, {
            dryrun,
            mode: explicitMode,
          })
          if (!wantsImage) {
            return sendRenderedReply(ctx, session, config, {
              text,
              title,
              markdownBody: formatActivityMarkdown(data, dryrun),
              keyboard,
            })
          }

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
            label: dryrun ? `${config.serverLabel} [DRY RUN]` : config.serverLabel,
            date_display: dryrun
              ? `${formatActivityDateDisplay(data.date)} · 内置演示数据`
              : formatActivityDateDisplay(data.date),
            chart_available: Boolean(chartPng),
            chart_path: chartPng ? `../${shadowPath}` : '',
            chart_message: chartMessage,
            stats: createStats(data),
            coverage_text: formatCoverage(data),
            generated_at: formatShanghaiTime(data.generatedAtMs),
          }, chartPng ? [{ path: shadowPath, content: chartPng }] : [])
          return sendRenderedReply(ctx, session, config, {
            image,
            text,
            title,
            markdownBody: formatActivityMarkdown(data, dryrun),
            keyboard,
            includeText: wantsText,
          })
        } catch (error) {
          logInfo(ctx, config, '[ERROR] 查询玩家活动失败', formatErrorForLog(error))
          return withQuote(session, config, `查询玩家活动失败：${error instanceof Error ? error.message : String(error)}`)
        }
      }
      if (dryrun && !wantsImage) return operation()
      return runWithWaitingHint(ctx, session, config, operation)
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

function formatActivityText(label: string, data: PlayerActivityResponse, dryrun: boolean): string {
  const summary = data.summary
  const title = `${label} 📈 玩家活动（${formatActivityDateDisplay(data.date)}）`
  const dryrunNotice = dryrun ? 'DRY RUN · 内置演示数据' : ''
  if (!data.hasData) {
    return [title, dryrunNotice, '该日期暂无玩家活动数据。'].filter(Boolean).join('\n')
  }
  const hourlyLines = aggregatePlayerActivityHourly(data).map(bucket => {
    if (bucket.validHeartbeatCount === 0) {
      return `${bucket.label}  在线暂无有效采样 / 进入 ${bucket.joinCount} 次`
    }
    return `${bucket.label}  平均 ${bucket.averageOnlineCount!.toFixed(1)} / 峰值 ${bucket.peakOnlineCount} / 进入 ${bucket.joinCount} 次`
  })
  return [
    title,
    dryrunNotice,
    '',
    `末次在线：${summary.latestOnlineCount === null ? '未知' : `${summary.latestOnlineCount} 人`}`,
    `峰值在线：${summary.peakOnlineCount} 人`,
    `平均在线：${summary.validHeartbeatCount ? `${summary.averageOnlineCount.toFixed(1)} 人` : '未知'}`,
    `总进入次数：${summary.totalJoinCount} 次`,
    `独立玩家：${summary.uniquePlayerCount} 人`,
    '',
    '每小时趋势：',
    ...hourlyLines,
  ].join('\n')
}

function formatActivityMarkdown(data: PlayerActivityResponse, dryrun: boolean): string {
  const summary = data.summary
  const prefix = dryrun ? ['> **DRY RUN · 内置演示数据**', ''] : []
  if (!data.hasData) return [...prefix, '该日期暂无玩家活动数据。'].join('\n')
  return [
    ...prefix,
    `- 末次在线：**${summary.latestOnlineCount === null ? '未知' : `${summary.latestOnlineCount} 人`}**`,
    `- 峰值在线：**${summary.peakOnlineCount} 人**`,
    `- 平均在线：**${summary.validHeartbeatCount ? `${summary.averageOnlineCount.toFixed(1)} 人` : '未知'}**`,
    `- 总进入次数：**${summary.totalJoinCount} 次**`,
    `- 独立玩家：**${summary.uniquePlayerCount} 人**`,
  ].join('\n')
}

interface ActivityCommandState {
  dryrun: boolean
  mode?: 'text' | 'image'
}

function appendCommandState(command: string, state: ActivityCommandState): string {
  const options: string[] = []
  if (state.dryrun) options.push('--dryrun')
  if (state.mode) options.push(`--mode ${state.mode}`)
  return options.length ? `${command} ${options.join(' ')}` : command
}

function buildDateKeyboard(
  config: CommandRegistrationContext['config'],
  command: string,
  date: string,
  state: ActivityCommandState,
) {
  const today = formatShanghaiDate(Date.now())
  const previous = shiftActivityDate(date, -1)
  const next = shiftActivityDate(date, 1)
  const nextIsFuture = next > today
  const refreshKeyboard = buildCommandKeyboard(config, [{
    label: '🔄 刷新',
    command: appendCommandState(date === today ? command : `${command} ${date}`, state),
    style: 1,
  }], 1)
  const navigationKeyboard = buildCommandKeyboard(config, [
    { label: '◀️ 前一天', command: appendCommandState(`${command} ${previous}`, state), style: 1 },
    {
      label: nextIsFuture ? '❌ 后一天' : '后一天 ▶️',
      command: appendCommandState(`${command} ${next}`, state),
      style: nextIsFuture ? 0 : 1,
    },
  ], 2)
  if (!refreshKeyboard || !navigationKeyboard) return null
  return { rows: [...refreshKeyboard.rows, ...navigationKeyboard.rows] }
}
