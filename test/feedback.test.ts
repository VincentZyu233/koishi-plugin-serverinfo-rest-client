import { describe, expect, it, vi } from 'vitest'
import { h } from 'koishi'
import { runWithWaitingHint, WAITING_HINT_TEXT, withQuote } from '../src/feedback'

function createHarness(configOverrides: Record<string, unknown> = {}) {
  const info = vi.fn()
  const send = vi.fn().mockResolvedValue(['waiting-message'])
  const deleteMessage = vi.fn().mockResolvedValue(undefined)
  const ctx = { logger: { info } } as any
  const session = {
    messageId: 'source-message',
    channelId: 'channel-1',
    send,
    bot: { deleteMessage },
  } as any
  const config = {
    enableQuote: true,
    enableWaitingHint: true,
    verboseConsoleLog: false,
    ...configOverrides,
  } as any
  return { ctx, session, config, info, send, deleteMessage }
}

describe('command feedback', () => {
  it('adds a quote only when enableQuote is enabled', () => {
    const enabled = createHarness()
    const quoted = withQuote(enabled.session, enabled.config, '处理完成') as any
    const elements = h.normalize(quoted)
    expect(elements[0]).toMatchObject({ type: 'quote', attrs: { id: 'source-message' } })
    expect(elements[1]).toMatchObject({ type: 'text', attrs: { content: '处理完成' } })

    const disabled = createHarness({ enableQuote: false })
    expect(withQuote(disabled.session, disabled.config, '处理完成')).toBe('处理完成')
  })

  it('immediately sends and then deletes the waiting hint', async () => {
    const harness = createHarness()
    const events: string[] = []
    harness.send.mockImplementation(async () => {
      events.push('send')
      return ['waiting-message']
    })
    harness.deleteMessage.mockImplementation(async () => {
      events.push('delete')
    })

    const result = await runWithWaitingHint(harness.ctx, harness.session, harness.config, async () => {
      events.push('operation')
      return '完成'
    })

    expect(result).toBe('完成')
    expect(events).toEqual(['send', 'operation', 'delete'])
    const waiting = harness.send.mock.calls[0][0] as any
    const elements = h.normalize(waiting)
    expect(elements[0]).toMatchObject({ type: 'quote', attrs: { id: 'source-message' } })
    expect(elements[1]).toMatchObject({ type: 'text', attrs: { content: WAITING_HINT_TEXT } })
    expect(harness.deleteMessage).toHaveBeenCalledWith('channel-1', 'waiting-message')
  })

  it('skips the waiting lifecycle when disabled', async () => {
    const harness = createHarness({ enableWaitingHint: false })

    await expect(runWithWaitingHint(harness.ctx, harness.session, harness.config, async () => '完成'))
      .resolves.toBe('完成')
    expect(harness.send).not.toHaveBeenCalled()
    expect(harness.deleteMessage).not.toHaveBeenCalled()
  })

  it('continues the operation when sending the waiting hint fails', async () => {
    const harness = createHarness()
    harness.send.mockRejectedValue(new Error('send failed'))

    await expect(runWithWaitingHint(harness.ctx, harness.session, harness.config, async () => '完成'))
      .resolves.toBe('完成')
    expect(harness.deleteMessage).not.toHaveBeenCalled()
    expect(harness.info.mock.calls.flat().join(' ')).toContain('发送等待提示失败')
  })

  it('does not replace the result when deleting the waiting hint fails', async () => {
    const harness = createHarness()
    harness.deleteMessage.mockRejectedValue(new Error('delete failed'))

    await expect(runWithWaitingHint(harness.ctx, harness.session, harness.config, async () => '完成'))
      .resolves.toBe('完成')
    expect(harness.info.mock.calls.flat().join(' ')).toContain('删除等待提示失败')
  })

  it('deletes the waiting hint when the operation throws', async () => {
    const harness = createHarness()

    await expect(runWithWaitingHint(harness.ctx, harness.session, harness.config, async () => {
      throw new Error('operation failed')
    })).rejects.toThrow('operation failed')
    expect(harness.deleteMessage).toHaveBeenCalledWith('channel-1', 'waiting-message')
  })
})
