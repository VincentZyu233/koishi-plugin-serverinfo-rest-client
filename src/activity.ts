import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { Resvg } from '@resvg/resvg-js'
import type { PlayerActivityResponse } from './api/types'
import type { Config } from './config'
import { buildTypstTemplateTheme } from './typst'

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  LegendComponent,
  SVGRenderer,
])

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const CHART_BUCKET_MINUTES = 5

export type ActivityDateErrorCode = 'invalid_date' | 'future_date'

export class ActivityDateError extends Error {
  constructor(readonly code: ActivityDateErrorCode) {
    super(code)
  }
}

export interface ResolvedActivityDate {
  date: string
  startAtMs: number
  endAtMs: number
}

export interface ActivityChartBucket {
  timestampMs: number
  label: string
  onlineCount: number | null
  joinCount: number | null
}

export function formatShanghaiDate(timestampMs: number): string {
  const shifted = new Date(timestampMs + SHANGHAI_OFFSET_MS)
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('')
}

export function formatShanghaiTime(timestampMs: number): string {
  const shifted = new Date(timestampMs + SHANGHAI_OFFSET_MS)
  return [
    String(shifted.getUTCHours()).padStart(2, '0'),
    String(shifted.getUTCMinutes()).padStart(2, '0'),
  ].join(':')
}

export function formatActivityDateDisplay(date: string): string {
  return `${date.slice(0, 4)}年${date.slice(4, 6)}月${date.slice(6, 8)}日`
}

export function resolveActivityDate(rawDate: unknown, nowMs = Date.now()): ResolvedActivityDate {
  const source = String(rawDate || '').trim() || formatShanghaiDate(nowMs)
  if (!/^\d{8}$/.test(source)) throw new ActivityDateError('invalid_date')

  const year = Number(source.slice(0, 4))
  const month = Number(source.slice(4, 6))
  const day = Number(source.slice(6, 8))
  if (year < 1970 || year > 9999) throw new ActivityDateError('invalid_date')
  const localMidnightAsUtc = Date.UTC(year, month - 1, day)
  const check = new Date(localMidnightAsUtc)
  if (check.getUTCFullYear() !== year
    || check.getUTCMonth() !== month - 1
    || check.getUTCDate() !== day) {
    throw new ActivityDateError('invalid_date')
  }

  const startAtMs = localMidnightAsUtc - SHANGHAI_OFFSET_MS
  const todayStartAtMs = resolveActivityDateUnchecked(formatShanghaiDate(nowMs)).startAtMs
  if (startAtMs > todayStartAtMs) throw new ActivityDateError('future_date')
  return { date: source, startAtMs, endAtMs: startAtMs + DAY_MS }
}

function resolveActivityDateUnchecked(date: string): ResolvedActivityDate {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(4, 6))
  const day = Number(date.slice(6, 8))
  const startAtMs = Date.UTC(year, month - 1, day) - SHANGHAI_OFFSET_MS
  return { date, startAtMs, endAtMs: startAtMs + DAY_MS }
}

export function shiftActivityDate(date: string, days: number): string {
  const resolved = resolveActivityDateUnchecked(date)
  return formatShanghaiDate(resolved.startAtMs + days * DAY_MS)
}

export function aggregatePlayerActivity(
  data: PlayerActivityResponse,
  bucketMinutes = CHART_BUCKET_MINUTES,
): ActivityChartBucket[] {
  const bucketMs = Math.max(1, Math.floor(bucketMinutes)) * 60 * 1000
  const rangeMs = Math.max(0, data.endAtMs - data.startAtMs)
  const bucketCount = Math.max(1, Math.ceil(rangeMs / bucketMs))
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    timestampMs: data.startAtMs + index * bucketMs,
    onlineTotal: 0,
    onlineSamples: 0,
    joinCount: 0,
    observed: false,
  }))

  for (const minute of data.minutes) {
    const index = Math.floor((minute.timestampMs - data.startAtMs) / bucketMs)
    if (index < 0 || index >= buckets.length) continue
    const bucket = buckets[index]
    if (minute.onlineCount !== null && Number.isFinite(minute.onlineCount)) {
      bucket.onlineTotal += minute.onlineCount
      bucket.onlineSamples += 1
      bucket.observed = true
    }
    if (minute.joinCount > 0) {
      bucket.joinCount += minute.joinCount
      bucket.observed = true
    }
  }

  return buckets.map(bucket => ({
    timestampMs: bucket.timestampMs,
    label: formatShanghaiTime(bucket.timestampMs),
    onlineCount: bucket.onlineSamples
      ? Math.round(bucket.onlineTotal / bucket.onlineSamples * 100) / 100
      : null,
    joinCount: bucket.observed ? bucket.joinCount : null,
  }))
}

export function renderPlayerActivityChart(
  buckets: ActivityChartBucket[],
  config: Config,
): string {
  const theme = buildTypstTemplateTheme(config)
  const chart = echarts.init(null, undefined, {
    renderer: 'svg',
    ssr: true,
    width: 1440,
    height: 500,
  })
  try {
    const axisLabelInterval = Math.max(0, Math.ceil(buckets.length / 9) - 1)
    chart.setOption({
      animation: false,
      backgroundColor: 'transparent',
      textStyle: {
        color: theme.text,
        fontFamily: config.typstFontFamily || 'LXGW WenKai Mono',
      },
      color: [theme.section_title, '#d97706'],
      legend: {
        top: 0,
        textStyle: { color: theme.text, fontSize: 21 },
        data: ['在线人数', '进入次数'],
      },
      grid: {
        top: 70,
        right: 92,
        bottom: 62,
        left: 92,
      },
      xAxis: {
        type: 'category',
        boundaryGap: true,
        data: buckets.map(bucket => bucket.label),
        axisLine: { lineStyle: { color: theme.panel_stroke } },
        axisTick: { show: false },
        axisLabel: {
          color: theme.stats_text,
          fontSize: 19,
          interval: axisLabelInterval,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: '在线人数',
          min: 0,
          minInterval: 1,
          nameTextStyle: { color: theme.section_title, fontSize: 19 },
          axisLabel: { color: theme.stats_text, fontSize: 18 },
          axisLine: { show: true, lineStyle: { color: theme.panel_stroke } },
          splitLine: { lineStyle: { color: theme.panel_stroke, opacity: 0.55 } },
        },
        {
          type: 'value',
          name: '进入次数',
          min: 0,
          minInterval: 1,
          nameTextStyle: { color: '#d97706', fontSize: 19 },
          axisLabel: { color: theme.stats_text, fontSize: 18 },
          axisLine: { show: true, lineStyle: { color: theme.panel_stroke } },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '在线人数',
          type: 'line',
          data: buckets.map(bucket => bucket.onlineCount),
          connectNulls: false,
          showSymbol: buckets.length <= 72,
          symbolSize: 6,
          lineStyle: { width: 3 },
          areaStyle: { opacity: 0.08 },
          emphasis: { disabled: true },
        },
        {
          name: '进入次数',
          type: 'bar',
          yAxisIndex: 1,
          data: buckets.map(bucket => bucket.joinCount),
          barMaxWidth: 12,
          itemStyle: { color: '#d97706', opacity: 0.68 },
          emphasis: { disabled: true },
        },
      ],
    })
    return chart.renderToSVGString()
  } finally {
    chart.dispose()
  }
}

export function renderPlayerActivityChartPng(
  buckets: ActivityChartBucket[],
  config: Config,
  fontFiles: string[] = [],
): Buffer {
  const svg = renderPlayerActivityChart(buckets, config)
  return new Resvg(svg, {
    font: {
      loadSystemFonts: true,
      fontFiles,
      defaultFontFamily: config.typstFontFamily || 'LXGW WenKai Mono',
    },
  }).render().asPng()
}
