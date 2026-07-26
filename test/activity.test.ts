import { describe, expect, it } from 'vitest'
import type { PlayerActivityResponse } from '../src/api/types'
import {
  ActivityDateError,
  aggregatePlayerActivity,
  aggregatePlayerActivityHourly,
  createPlayerActivityDryrunResponse,
  formatShanghaiDate,
  renderPlayerActivityChart,
  resolveActivityDate,
  shiftActivityDate,
} from '../src/activity'

function createResponse(): PlayerActivityResponse {
  const startAtMs = resolveActivityDate('20260725', Date.UTC(2026, 6, 25, 12)).startAtMs
  return {
    date: '20260725',
    timezone: 'Asia/Shanghai',
    startAtMs,
    endAtMs: startAtMs + 20 * 60_000,
    dayEndAtMs: startAtMs + 86_400_000,
    generatedAtMs: startAtMs + 20 * 60_000,
    sampleIntervalSeconds: 60,
    complete: false,
    hasData: true,
    discardedRecordCount: 0,
    summary: {
      latestOnlineCount: 4,
      peakOnlineCount: 4,
      averageOnlineCount: 2.5,
      totalJoinCount: 3,
      uniquePlayerCount: 2,
      peakJoinCount: 2,
      peakJoinMinuteMs: startAtMs + 60_000,
      validHeartbeatCount: 4,
      coverageStartMs: startAtMs,
      coverageEndMs: startAtMs + 15 * 60_000,
    },
    minutes: [
      { timestampMs: startAtMs, onlineCount: 1, joinCount: 1 },
      { timestampMs: startAtMs + 60_000, onlineCount: 3, joinCount: 2 },
      { timestampMs: startAtMs + 10 * 60_000, onlineCount: null, joinCount: 0 },
      { timestampMs: startAtMs + 15 * 60_000, onlineCount: 4, joinCount: 0 },
    ],
  }
}

describe('player activity data', () => {
  it('parses strict Shanghai dates and rejects future dates', () => {
    const now = Date.UTC(2026, 6, 25, 12)
    expect(resolveActivityDate('', now).date).toBe('20260725')
    expect(resolveActivityDate('20260724', now).endAtMs).toBe(resolveActivityDate('20260725', now).startAtMs)
    expect(() => resolveActivityDate('20260229', now)).toThrow(ActivityDateError)
    expect(() => resolveActivityDate('2026-07-25', now)).toThrow(ActivityDateError)
    expect(() => resolveActivityDate('20260726', now)).toThrowError(expect.objectContaining({ code: 'future_date' }))
    expect(formatShanghaiDate(resolveActivityDate('20260725', now).startAtMs)).toBe('20260725')
    expect(shiftActivityDate('20260725', -1)).toBe('20260724')
  })

  it('aggregates five-minute averages and preserves missing heartbeat gaps', () => {
    const buckets = aggregatePlayerActivity(createResponse())
    expect(buckets).toHaveLength(4)
    expect(buckets[0]).toMatchObject({ label: '00:00', onlineCount: 2, joinCount: 3 })
    expect(buckets[1]).toMatchObject({ label: '00:05', onlineCount: null, joinCount: null })
    expect(buckets[2]).toMatchObject({ label: '00:10', onlineCount: null, joinCount: null })
    expect(buckets[3]).toMatchObject({ label: '00:15', onlineCount: 4, joinCount: 0 })
  })

  it('aggregates bounded hourly text statistics from raw minute samples', () => {
    const data = createResponse()
    data.endAtMs = data.startAtMs + 2 * 60 * 60_000
    data.minutes = [
      { timestampMs: data.startAtMs, onlineCount: 1, joinCount: 1 },
      { timestampMs: data.startAtMs + 30 * 60_000, onlineCount: 3, joinCount: 2 },
      { timestampMs: data.startAtMs + 60 * 60_000, onlineCount: 4, joinCount: 0 },
      { timestampMs: data.startAtMs + 90 * 60_000, onlineCount: null, joinCount: 2 },
    ]

    const buckets = aggregatePlayerActivityHourly(data)
    expect(buckets).toHaveLength(2)
    expect(buckets[0]).toMatchObject({
      label: '00:00-00:59', averageOnlineCount: 2, peakOnlineCount: 3,
      joinCount: 3, validHeartbeatCount: 2,
    })
    expect(buckets[1]).toMatchObject({
      label: '01:00-01:59', averageOnlineCount: 4, peakOnlineCount: 4,
      joinCount: 2, validHeartbeatCount: 1,
    })
  })

  it('creates deterministic full-day dryrun data with heartbeat gaps', () => {
    const day = resolveActivityDate('20260725', Date.UTC(2026, 6, 26, 12))
    const generatedAtMs = Date.UTC(2026, 6, 26, 12)
    const first = createPlayerActivityDryrunResponse(day, generatedAtMs)
    const second = createPlayerActivityDryrunResponse(day, generatedAtMs)

    expect(second).toEqual(first)
    expect(first.endAtMs).toBe(day.endAtMs)
    expect(first.complete).toBe(true)
    expect(first.minutes.length).toBeGreaterThan(1_300)
    expect(first.minutes.some(minute => minute.onlineCount === null)).toBe(true)
    expect(first.summary.validHeartbeatCount).toBeLessThan(1_440)
    expect(first.summary.totalJoinCount).toBeGreaterThan(0)
    expect(aggregatePlayerActivityHourly(first)).toHaveLength(24)
  })

  it('renders a deterministic SVG with line and bar series', () => {
    const svg = renderPlayerActivityChart(aggregatePlayerActivity(createResponse()), {
      typstFontFamily: 'Arial',
      typstTextColor: '#26332b',
      typstPanelStrokeColor: '#cbd9ce',
      typstSectionTitleColor: '#2c5e3b',
      typstStatsTextColor: '#66746b',
    } as any)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('在线人数')
    expect(svg).toContain('进入次数')
  })
})
