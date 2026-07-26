import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerActivityResponse } from '../src/api/types'
import { registerPlayerActivityCommand } from '../src/commands/player-activity'
import { renderTypstTemplate } from '../src/typst'
import { buildCommandKeyboard, sendRenderedReply } from '../src/qq'

vi.mock('../src/typst', () => ({
  buildTypstTemplateTheme: () => ({
    text: '#26332b', panel_stroke: '#cbd9ce', section_title: '#2c5e3b', stats_text: '#66746b',
  }),
  resolveOutputModes: (mode: string | undefined, config: any) => {
    if (mode === 'text') return ['text']
    if (mode === 'image') return ['typst-image']
    return config.defaultOutputModes
  },
  renderTypstTemplate: vi.fn().mockResolvedValue(Buffer.from('png')),
}))

vi.mock('../src/qq', () => ({
  buildCommandKeyboard: vi.fn((_config, buttons) => ({ rows: [{ buttons }] })),
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

function createHarness(response = createResponse(), configOverrides: Record<string, unknown> = {}) {
  let action: Function | undefined
  const chain: any = {
    alias: vi.fn(() => chain),
    option: vi.fn(() => chain),
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
    defaultOutputModes: ['typst-image'],
    qqKeyboardEnabled: true, qqMarkdownEnabled: false, qqMarkdownEmbedImage: false,
    typstFontFamily: 'Arial',
    typstFontPath: '', typstEmojiFontPath: '',
    typstTextColor: '#26332b', typstPanelStrokeColor: '#cbd9ce',
    typstSectionTitleColor: '#2c5e3b', typstStatsTextColor: '#66746b',
    ...configOverrides,
  } as any
  registerPlayerActivityCommand({
    ctx, config, apiClient, rootCommand: 'mcinfo1', prefix: 'mcinfo1', label: '测试服',
  })
  return { action: action!, ctx, config, apiClient, chain }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('player activity command', () => {
  it('registers mode and all dryrun option aliases', () => {
    const { chain } = createHarness()

    expect(chain.alias.mock.calls.map(([alias]: [string]) => alias)).toEqual([
      'mcinfo1.online-chart',
      'mcinfo1.在线折线图',
      'mcinfo1.在线柱形图',
      'mcinfo1.玩家活动',
      'mcinfo1.player-activity',
    ])
    expect(chain.option).toHaveBeenCalledWith('mode', '-m <mode:string> 输出模式 (text/image)')
    expect(chain.option).toHaveBeenCalledWith(
      'dryrun',
      '-d, --dryrun, --dry-run 使用内置演示数据，不请求服务端 API',
    )
  })

  it('renders ECharts through Resvg and passes the PNG as a Typst shadow asset', async () => {
    const { action, apiClient } = createHarness()
    const session = { messageId: 'message-1' } as any

    await expect(action({ session, options: {} }, '20260725')).resolves.toBe('sent')

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
      expect.anything(), session, expect.anything(), expect.objectContaining({
        title: '测试服 📈 玩家活动', includeText: false,
      }),
    )
    expect(buildCommandKeyboard).toHaveBeenNthCalledWith(1, expect.anything(), expect.any(Array), 1)
    expect(buildCommandKeyboard).toHaveBeenNthCalledWith(2, expect.anything(), expect.any(Array), 2)
  }, 30_000)

  it('builds previous, refresh, and blocked-future date buttons for today', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-25T04:00:00.000Z'))
    try {
      const { action } = createHarness(createResponse(false))
      await expect(action({ session: {}, options: {} }, '20260725')).resolves.toBe('sent')

      const refreshButtons = vi.mocked(buildCommandKeyboard).mock.calls[0][1]
      const navigationButtons = vi.mocked(buildCommandKeyboard).mock.calls[1][1]
      expect(refreshButtons).toEqual([
        { label: '🔄 刷新', command: 'mcinfo1.在线图', style: 1 },
      ])
      expect(navigationButtons).toEqual([
        { label: '◀️ 前一天', command: 'mcinfo1.在线图 20260724', style: 1 },
        { label: '❌ 后一天', command: 'mcinfo1.在线图 20260726', style: 0 },
      ])
      const keyboard = vi.mocked(sendRenderedReply).mock.calls[0][3].keyboard!
      expect(keyboard.rows.map(row => row.buttons.length)).toEqual([1, 2])
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses global text mode without running ECharts or Typst', async () => {
    const { action, apiClient } = createHarness(createResponse(), { defaultOutputModes: ['text'] })

    await expect(action({ session: {}, options: {} }, '20260725')).resolves.toBe('sent')

    expect(apiClient.get).toHaveBeenCalledOnce()
    expect(sendRenderedReply).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({
        text: expect.stringContaining('每小时趋势：'),
        keyboard: expect.anything(),
      }),
    )
    expect(vi.mocked(sendRenderedReply).mock.calls[0][3].text).toContain('00:00-00:59')
    expect(renderTypstTemplate).not.toHaveBeenCalled()
    expect(buildCommandKeyboard).toHaveBeenCalledTimes(2)
  })

  it('uses global combined mode and includes hourly text with the image', async () => {
    const { action } = createHarness(createResponse(), {
      defaultOutputModes: ['text', 'typst-image'],
    })

    await expect(action({ session: {}, options: {} }, '20260725')).resolves.toBe('sent')

    expect(sendRenderedReply).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({
        includeText: true,
        text: expect.stringContaining('每小时趋势：'),
      }),
    )
  })

  it('uses dryrun text data without calling the API or image renderer', async () => {
    const { action, apiClient } = createHarness(createResponse(), { defaultOutputModes: ['text'] })

    await expect(action({ session: {}, options: { dryrun: true } }, '20260725')).resolves.toBe('sent')

    expect(apiClient.get).not.toHaveBeenCalled()
    expect(sendRenderedReply).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({
        text: expect.stringContaining('DRY RUN · 内置演示数据'),
        keyboard: expect.anything(),
      }),
    )
    expect(vi.mocked(sendRenderedReply).mock.calls[0][3].text).toContain('23:00-23:59')
    expect(renderTypstTemplate).not.toHaveBeenCalled()
    expect(buildCommandKeyboard).toHaveBeenCalledTimes(2)
  })

  it('renders dryrun image data and preserves explicit state in date buttons', async () => {
    const { action, apiClient } = createHarness(createResponse(), { defaultOutputModes: ['text'] })

    await expect(action({ session: {}, options: { dryrun: true, mode: 'image' } }, '20260725'))
      .resolves.toBe('sent')

    expect(apiClient.get).not.toHaveBeenCalled()
    expect(renderTypstTemplate).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'playerActivity',
      expect.objectContaining({
        label: '测试服 [DRY RUN]',
        date_display: '2026年07月25日 · 内置演示数据',
      }),
      expect.any(Array),
    )
    expect(sendRenderedReply).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({
        title: expect.stringContaining('DRY RUN · 内置演示数据'),
        includeText: false,
      }),
    )
    const refreshButtons = vi.mocked(buildCommandKeyboard).mock.calls[0][1]
    const navigationButtons = vi.mocked(buildCommandKeyboard).mock.calls[1][1]
    expect(refreshButtons[0].command).toBe('mcinfo1.在线图 20260725 --dryrun --mode image')
    expect(navigationButtons[0].command).toBe('mcinfo1.在线图 20260724 --dryrun --mode image')
    expect(navigationButtons[1].command).toBe('mcinfo1.在线图 20260726 --dryrun --mode image')
  }, 30_000)

  it('keeps rendering the empty-state Typst image when the date has no data', async () => {
    const { action } = createHarness(createResponse(false))

    await expect(action({ session: {}, options: {} }, '20260725')).resolves.toBe('sent')

    expect(renderTypstTemplate).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), 'playerActivity',
      expect.objectContaining({ chart_available: false, chart_message: expect.stringContaining('暂无玩家活动数据') }),
      [],
    )
  })

  it('rejects invalid and future dates before calling the API', async () => {
    const invalid = createHarness()
    await expect(invalid.action({ session: {}, options: {} }, '2026-07-25')).resolves.toContain('日期格式不正确')
    expect(invalid.apiClient.get).not.toHaveBeenCalled()

    const future = createHarness()
    await expect(future.action({ session: {}, options: {} }, '99991231')).resolves.toContain('暂不支持预知未来')
    expect(future.apiClient.get).not.toHaveBeenCalled()
  })
})
