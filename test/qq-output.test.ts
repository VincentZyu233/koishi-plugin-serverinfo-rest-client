import { describe, expect, it, vi } from 'vitest'
vi.mock('../src/qq/server', () => ({
  storeQQImage: vi.fn().mockResolvedValue('https://cdn.example/rendered.png'),
}))

import { buildQQKeyboard } from '../src/qq/keyboard'
import { buildQQButtonMenu } from '../src/qq/menu'
import { sendQQMarkdown } from '../src/qq/markdown'
import { sendOnlineStatus, sendRenderedReply } from '../src/qq/sender'
import { storeQQImage } from '../src/qq/server'
import { formatQQOnlineMarkdown } from '../src/qq/template'
import { CLIENT_VERSION } from '../src/version'

describe('QQ Markdown and keyboard', () => {
  const ctx = { logger: { info: vi.fn() } } as any
  const config = {
    commandPrefix: 'mcinfo2', useCommandPrefix: true, serverLabel: '二服', qqKeyboardEnabled: true,
    qqMarkdownKeyboardJson: '', qqMarkdownMaxPlayers: 2, qqMarkdownEnabled: true,
    qqMarkdownEmbedImage: false, enableQuote: true,
  } as any

  const elementTypes = (fragment: any[]) => fragment.flatMap(element => (
    element.type === '' ? element.children.map((child: any) => child.type) : [element.type]
  ))

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
    expect(labels).toContain('📈 在线图')
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

  it('sends a normal quoted image followed by unquoted Markdown and keyboard when embedding is disabled', async () => {
    const send = vi.fn().mockResolvedValue(['image-message'])
    const sendMessage = vi.fn().mockResolvedValue({ id: 'markdown-message' })
    const keyboard = buildQQKeyboard(config)
    const session = {
      platform: 'qq', channelId: 'group-1', messageId: 'source-message', timestamp: Date.now(),
      send, bot: { internal: { sendMessage } },
    } as any

    await sendRenderedReply(ctx, session, config, {
      image: Buffer.from('png'), text: '普通文字', title: '玩家活动',
      markdownBody: 'Markdown 正文', keyboard,
    })

    const plain = send.mock.calls[0][0]
    expect(elementTypes(plain)).toEqual(['quote', 'image'])
    expect(sendMessage).toHaveBeenCalledOnce()
    const payload = sendMessage.mock.calls[0][1]
    expect(payload.markdown.content).toContain('Markdown 正文')
    expect(payload.markdown.content).not.toContain('![')
    expect(payload.keyboard).toEqual({ content: keyboard })
    expect(payload.msg_id).toBe('source-message')
    expect(payload.message_reference).toBeUndefined()
    expect(storeQQImage).not.toHaveBeenCalled()
  })

  it('keeps keyboard delivery when Markdown output is disabled', async () => {
    const send = vi.fn().mockResolvedValue(['plain-message'])
    const sendMessage = vi.fn().mockResolvedValue({ id: 'keyboard-message' })
    const keyboard = buildQQKeyboard(config)
    const session = {
      platform: 'qq', channelId: 'group-1', messageId: 'source-message', timestamp: Date.now(),
      send, bot: { internal: { sendMessage } },
    } as any

    await sendRenderedReply(ctx, session, { ...config, qqMarkdownEnabled: false }, {
      image: Buffer.from('png'), text: '普通文字', title: '玩家活动', keyboard,
    })

    const plain = send.mock.calls[0][0]
    expect(elementTypes(plain)).toEqual(['quote', 'image', 'text'])
    const payload = sendMessage.mock.calls[0][1]
    expect(payload.markdown.content).toContain('可用操作')
    expect(payload.keyboard).toEqual({ content: keyboard })
    expect(payload.msg_id).toBe('source-message')
    expect(payload.message_reference).toBeUndefined()
  })

  it('still attempts the keyboard when the normal QQ message fails', async () => {
    const send = vi.fn().mockRejectedValue(new Error('media send failed'))
    const sendMessage = vi.fn().mockResolvedValue({ id: 'keyboard-message' })
    const keyboard = buildQQKeyboard(config)
    const session = {
      platform: 'qq', channelId: 'group-1', messageId: 'source-message', timestamp: Date.now(),
      send, bot: { internal: { sendMessage } },
    } as any

    await expect(sendRenderedReply(ctx, session, { ...config, qqMarkdownEnabled: false }, {
      image: Buffer.from('png'), text: '普通文字', title: '玩家活动', keyboard,
    })).rejects.toThrow('media send failed')

    expect(sendMessage).toHaveBeenCalledOnce()
    expect(sendMessage.mock.calls[0][1].keyboard).toEqual({ content: keyboard })
  })

  it('keeps the single Markdown message when image embedding is enabled', async () => {
    vi.mocked(storeQQImage).mockResolvedValueOnce('https://cdn.example/rendered.png')
    const send = vi.fn().mockResolvedValue([])
    const sendMessage = vi.fn().mockResolvedValue({ id: 'markdown-message' })
    const keyboard = buildQQKeyboard(config)
    const session = {
      platform: 'qq', channelId: 'group-1', messageId: 'source-message', timestamp: Date.now(),
      send, bot: { internal: { sendMessage } },
    } as any

    await sendRenderedReply(ctx, session, { ...config, qqMarkdownEmbedImage: true }, {
      image: Buffer.from('png'), text: '普通文字', title: '玩家活动',
      markdownBody: 'Markdown 正文', keyboard,
    })

    expect(send).not.toHaveBeenCalled()
    const payload = sendMessage.mock.calls[0][1]
    expect(payload.markdown.content).toContain('https://cdn.example/rendered.png')
    expect(payload.keyboard).toEqual({ content: keyboard })
    expect(payload.message_reference).toEqual({ message_id: 'source-message' })
  })

  it('falls back from embedded images without dropping Markdown body or keyboard', async () => {
    vi.mocked(storeQQImage).mockRejectedValueOnce(new Error('public image unavailable'))
    const send = vi.fn().mockResolvedValue(['image-message'])
    const sendMessage = vi.fn().mockResolvedValue({ id: 'markdown-message' })
    const keyboard = buildQQKeyboard(config)
    const session = {
      platform: 'qq', channelId: 'group-1', messageId: 'source-message', timestamp: Date.now(),
      send, bot: { internal: { sendMessage } },
    } as any

    await sendRenderedReply(ctx, session, { ...config, qqMarkdownEmbedImage: true }, {
      image: Buffer.from('png'), text: '普通文字', title: '玩家活动',
      markdownBody: 'Markdown 正文', keyboard,
    })

    expect(elementTypes(send.mock.calls[0][0])).toEqual(['quote', 'image'])
    const payload = sendMessage.mock.calls[0][1]
    expect(payload.markdown.content).toContain('Markdown 正文')
    expect(payload.markdown.content).not.toContain('![')
    expect(payload.keyboard).toEqual({ content: keyboard })
  })

  it('keeps the online-status keyboard when Markdown output is disabled', async () => {
    const send = vi.fn().mockResolvedValue(['plain-message'])
    const sendMessage = vi.fn().mockResolvedValue({ id: 'keyboard-message' })
    const session = {
      platform: 'qq', channelId: 'group-1', messageId: 'source-message', timestamp: Date.now(),
      send, bot: { internal: { sendMessage } },
    } as any
    const result = {
      online: true,
      overview: { players: { online: 1, max: 20, names: ['Steve'] } },
    } as any

    await sendOnlineStatus(ctx, session, { ...config, qqMarkdownEnabled: false }, result, Buffer.from('png'))

    expect(elementTypes(send.mock.calls[0][0])).toEqual(['quote', 'image', 'text'])
    expect(sendMessage.mock.calls[0][1].keyboard.content.rows).toHaveLength(1)
    expect(sendMessage.mock.calls[0][1].message_reference).toBeUndefined()
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
