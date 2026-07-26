import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerActivityResponse } from '../src/api/types'
import { registerPlayerActivityCommand } from '../src/commands/player-activity'
import { renderTypstTemplate } from '../src/typst'
import { buildCommandKeyboard, sendRenderedReply } from '../src/qq'

vi.mock('../src/typst', () => ({
  buildTypstTemplateTheme: () => ({
    text: '#26332b', panel_stroke: '#cbd9ce', section_title: '#2c5e3b', stats_text: '#66746b',
  }),
  renderTypstTemplate: vi.fn().mockResolvedValue(Buffer.from('png')),
}))

vi.mock('../src/qq', () => ({
  buildCommandKeyboard: vi.fn().mockReturnValue({ rows: [] }),
  sendRenderedReply: vi.fn().mockResolvedValue('sent'),
}))

function createResponse(hasData = true): PlayerActivityResponse {
  const startAtMs = Date.UTC(2026, 6, 24, 16)
  return {
    date: '20260725', timezone: 'Asia/Shanghai', startAtMs,
    endAtMs: startAtMs + 20 * 60_000, dayEndAtMs: startAtMs + 86_400_000,
    generatedAtMs: startAtMs + 20 * 60_000, sampleIntervalSeconds: 60,
    complete: false, hasData, discardedRecordCount: 0,
    summary: {
      latestOnlineCount: hasData ? 2 : null,
      peakOnlineCount: hasData ? 3 : 0,
      averageOnlineCount: hasData ? 1.5 : 0,
      totalJoinCount: hasData ? 4 : 0,
      uniquePlayerCount: hasData ? 2 : 0,
      peakJoinCount: hasData ? 2 : 0,
      peakJoinMinuteMs: hasData ? startAtMs + 60_000 : null,
      validHeartbeatCount: hasData ? 2 : 0,
      coverageStartMs: hasData ? startAtMs : null,
      coverageEndMs: hasData ? startAtMs + 60_000 : null,
    },
    minutes: hasData ? [
      { timestampMs: startAtMs, onlineCount: 1, joinCount: 2 },
      { timestampMs: startAtMs + 60_000, onlineCount: 2, joinCount: 2 },
    ] : [],
  }
}

function createHarness(response = createResponse()) {
  let action: Function | undefined
  const chain: any = {
    alias: vi.fn(() => chain),
    action: vi.fn((handler: Function) => {
      action = handler
      return chain
    }),
  }
  const ctx = {
    baseDir: process.cwd(),
    command: vi.fn(() => chain),
    logger: { info: vi.fn() },
  } as any
  const apiClient = { get: vi.fn().mockResolvedValue(response) } as any
  const config = {
    serverLabel: '测试服', enableQuote: false, enableWaitingHint: false,
    qqKeyboardEnabled: true, qqMarkdownEnabled: false, typstFontFamily: 'Arial',
    typstFontPath: '', typstEmojiFontPath: '',
    typstTextColor: '#26332b', typstPanelStrokeColor: '#cbd9ce',
    typstSectionTitleColor: '#2c5e3b', typstStatsTextColor: '#66746b',
  } as any
  registerPlayerActivityCommand({
    ctx, config, apiClient, rootCommand: 'mcinfo1', prefix: 'mcinfo1', label: '测试服',
  })
  return { action: action!, ctx, config, apiClient }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('player activity command', () => {
  it('renders ECharts through Resvg and passes the PNG as a Typst shadow asset', async () => {
    const { action, apiClient } = createHarness()
    const session = { messageId: 'message-1' } as any

    await expect(action({ session }, '20260725')).resolves.toBe('sent')

    expect(apiClient.get).toHaveBeenCalledWith('/players/activity-history', { date: '20260725' })
    expect(renderTypstTemplate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'playerActivity',
      expect.objectContaining({ chart_available: true, date_display: '2026年07月25日' }),
      [expect.objectContaining({
        path: expect.stringMatching(/^charts\/player-activity-.+\.png$/),
        content: expect.any(Buffer),
      })],
    )
    const shadow = vi.mocked(renderTypstTemplate).mock.calls[0][4][0]
    expect(shadow.content.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(shadow.content.length).toBeGreaterThan(1_000)
    expect(sendRenderedReply).toHaveBeenCalledWith(
      expect.anything(), session, expect.anything(), expect.objectContaining({ title: '测试服 📈 玩家活动' }),
    )
    expect(buildCommandKeyboard).toHaveBeenCalledWith(expect.anything(), expect.any(Array), 3)
  })

  it('builds previous, refresh, and blocked-future date buttons for today', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T04:00:00.000Z'))
    try {
      const { action } = createHarness(createResponse(false))
      await expect(action({ session: {} }, '20260725')).resolves.toBe('sent')

      const buttons = vi.mocked(buildCommandKeyboard).mock.calls[0][1]
      expect(buttons).toEqual([
        { label: '◀️ 前一天', command: 'mcinfo1.玩家活动 20260724', style: 1 },
        { label: '🔄 刷新', command: 'mcinfo1.玩家活动', style: 1 },
        { label: '❌ 后一天', command: 'mcinfo1.玩家活动 20260726', style: 0 },
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps rendering the empty-state Typst image when the date has no data', async () => {
    const { action } = createHarness(createResponse(false))

    await expect(action({ session: {} }, '20260725')).resolves.toBe('sent')

    expect(renderTypstTemplate).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'playerActivity',
      expect.objectContaining({ chart_available: false, chart_message: expect.stringContaining('暂无玩家活动数据') }),
      [],
    )
  })

  it('rejects invalid and future dates before calling the API', async () => {
    const invalid = createHarness()
    await expect(invalid.action({ session: {} }, '2026-07-25')).resolves.toContain('日期格式不正确')
    expect(invalid.apiClient.get).not.toHaveBeenCalled()

    const future = createHarness()
    await expect(future.action({ session: {} }, '99991231')).resolves.toContain('暂不支持预知未来')
    expect(future.apiClient.get).not.toHaveBeenCalled()
  })
})
