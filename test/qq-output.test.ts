import { describe, expect, it, vi } from 'vitest'
import { buildQQKeyboard } from '../src/qq/keyboard'
import { buildQQButtonMenu } from '../src/qq/menu'
import { sendQQMarkdown } from '../src/qq/markdown'
import { sendRenderedReply } from '../src/qq/sender'
import { formatQQOnlineMarkdown } from '../src/qq/template'
import { CLIENT_VERSION } from '../src/version'

describe('QQ Markdown and keyboard', () => {
  const ctx = { logger: { info: vi.fn() } } as any
  const config = {
    commandPrefix: 'mcinfo2', useCommandPrefix: true, serverLabel: '二服', qqKeyboardEnabled: true,
    qqMarkdownKeyboardJson: '', qqMarkdownMaxPlayers: 2, qqMarkdownEnabled: true, enableQuote: true,
  } as any

  it('builds the first menu page as a 2x4 command grid plus navigation', () => {
    const menu = buildQQButtonMenu(config, 1)

    expect(menu.keyboard?.rows.map(row => row.buttons.length)).toEqual([2, 2, 2, 2, 2])
    expect(menu.keyboard?.rows[0].buttons.map(button => button.render_data.label)).toEqual([
      '🎮 mcinfo2', '⌨️ 按钮菜单',
    ])
    expect(menu.keyboard?.rows[1].buttons.map(button => button.render_data.label)).toEqual([
      '🌐 查在线', '🖥️ 服务器信息',
    ])
    expect(menu.keyboard?.rows[3].buttons.map(button => button.render_data.label)).toEqual([
      '🔢 玩家数量', '📚 历史记录',
    ])
    expect(menu.keyboard?.rows[4].buttons[0]).toMatchObject({
      render_data: { label: '❌ 上一页', style: 0 },
      action: { data: 'mcinfo2.按钮菜单 0', enter: true },
    })
    expect(menu.keyboard?.rows[4].buttons[1].action.data).toBe('mcinfo2.按钮菜单 2')
    expect(menu.markdown).toContain('> 🎮 服务器：二服')
    expect(menu.markdown).toContain(`> 🔌 版本：v${CLIENT_VERSION}`)
    expect(menu.markdown).toContain('> 📄 当前页：1 / 2')
  })

  it('builds the second page without administrator commands and protects input actions', () => {
    const menu = buildQQButtonMenu(config, 2)
    const rows = menu.keyboard!.rows
    const labels = rows.flatMap(row => row.buttons.map(button => button.render_data.label))

    expect(rows.map(row => row.buttons.length)).toEqual([2, 2, 2, 1, 2])
    expect(labels).toContain('📈 玩家活动')
    expect(labels).toContain('👥 玩家列表')
    expect(labels).toContain('📝 玩家名列表')
    expect(labels).toContain('🔗 绑定玩家')
    expect(labels).toContain('🔓 解绑玩家')
    expect(labels).not.toContain('➕ 添加白名单')
    expect(labels).not.toContain('🔎 查询白名单绑定')
    expect(labels).not.toContain('➖ 移除白名单')
    expect(labels).not.toContain('🛠️ 执行命令')
    expect(rows[2].buttons.every(button => button.action.enter === false)).toBe(true)
    expect(rows[3].buttons[0].action.enter).toBe(false)
    expect(rows[4].buttons[1]).toMatchObject({
      render_data: { label: '❌ 下一页', style: 0 },
      action: { data: 'mcinfo2.按钮菜单 3', enter: true },
    })
  })

  it('keeps the root command while removing feature prefixes from menu actions', () => {
    const menu = buildQQButtonMenu({ ...config, useCommandPrefix: false }, 1)

    expect(menu.keyboard?.rows[0].buttons[0].action.data).toBe('mcinfo2')
    expect(menu.keyboard?.rows[0].buttons[1].action.data).toBe('按钮菜单')
    expect(menu.keyboard?.rows[1].buttons[0].action.data).toBe('查在线')
    expect(menu.keyboard?.rows[4].buttons[1].action.data).toBe('按钮菜单 2')
    expect(menu.markdown).toContain('功能前缀：已关闭')
  })

  it('expands the reusable command prefix in keyboard actions', () => {
    const keyboard = buildQQKeyboard(config)!
    expect(keyboard.rows[0].buttons[0].action.data).toBe('mcinfo2.查在线')
  })

  it('removes feature prefixes while keeping the configured root help command', () => {
    const keyboard = buildQQKeyboard({ ...config, useCommandPrefix: false })!
    expect(keyboard.rows[0].buttons[0].action.data).toBe('查在线')
    expect(keyboard.rows[0].buttons[1].action.data).toBe('mcinfo2 --help')
  })

  it('builds public image Markdown and truncates long player lists', () => {
    const markdown = formatQQOnlineMarkdown({
      online: true,
      latencyMs: 12,
      overview: { players: { online: 3, max: 20, names: ['A', 'B', 'C'] } },
    } as any, config, 'https://cdn.example/status.png', { width: 800, height: 450 })
    expect(markdown).toContain('https://cdn.example/status.png')
    expect(markdown).toContain('还有 1 名玩家未显示')
  })

  it('uses the official adapter internal API for direct replies', async () => {
    const sendPrivateMessage = vi.fn().mockResolvedValue(undefined)
    const session = {
      isDirect: true, channelId: 'private-1', messageId: 'message-1', timestamp: Date.now(),
      bot: { internal: { sendPrivateMessage } },
    } as any
    await sendQQMarkdown(ctx, config, session, '# status', 'status', buildQQKeyboard(config))
    expect(sendPrivateMessage).toHaveBeenCalledWith('private-1', expect.objectContaining({
      msg_type: 2,
      msg_id: 'message-1',
      markdown: { content: '# status' },
      keyboard: expect.any(Object),
      message_reference: { message_id: 'message-1' },
    }))
  })

  it('omits QQ reply association when quoting is disabled', async () => {
    const sendPrivateMessage = vi.fn().mockResolvedValue(undefined)
    const session = {
      isDirect: true, channelId: 'private-1', messageId: 'message-1', timestamp: Date.now(),
      bot: { internal: { sendPrivateMessage } },
    } as any

    await sendQQMarkdown(ctx, { ...config, enableQuote: false }, session, '# status', 'status', null)

    const payload = sendPrivateMessage.mock.calls[0][1]
    expect(payload.msg_id).toBeUndefined()
    expect(payload.msg_seq).toBeUndefined()
    expect(payload.message_reference).toBeUndefined()
  })

  it('uses qq:rawmarkdown when the adapter exposes autoStreamText', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const session = { bot: { config: { autoStreamText: true } }, send } as any
    await sendQQMarkdown(ctx, config, session, '# status', 'status', buildQQKeyboard(config))
    expect(send).toHaveBeenCalledOnce()
  })

  it('omits fallback text when a rendered reply requests image-only output', async () => {
    const output = await sendRenderedReply(ctx, { platform: 'discord' } as any, {
      ...config,
      enableQuote: false,
      qqMarkdownEnabled: false,
    }, {
      image: Buffer.from('png'),
      text: '不应发送的文字',
      title: '图片模式',
      includeText: false,
    }) as any

    expect(output.children.map((child: any) => child.type)).toEqual(['image'])
  })
})
