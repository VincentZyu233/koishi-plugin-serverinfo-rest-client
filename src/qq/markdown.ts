import { h, type Context, type Session } from 'koishi'
import type { Config } from '../config'
import { shouldQuote, withQuote } from '../feedback'
import { logInfo } from '../logger'
import type { QQKeyboard } from './types'

export interface SendQQMarkdownOptions {
  associate?: boolean
  quote?: boolean
}

export async function sendQQMarkdown(
  ctx: Context,
  config: Config,
  session: Session,
  markdown: string,
  fallbackContent: string,
  keyboard: QQKeyboard | null,
  options: SendQQMarkdownOptions = {},
) {
  const bot = session.bot as any
  const quote = options.quote !== false && shouldQuote(session, config)
  const associate = options.associate === true || quote
  if (bot.config?.autoStreamText) {
    const content = h('qq:rawmarkdown', {
      content: markdown,
      ...(keyboard ? { keyboard } : {}),
    })
    await session.send(quote ? withQuote(session, config, content) : content)
    if (config.verboseConsoleLog) {
      logInfo(ctx, config, 'QQ Markdown 消息发送成功', `适配器: qq-crack\n平台: ${session.platform}\n频道: ${session.channelId}`)
    }
    return
  }

  const payload: any = {
    msg_type: 2,
    content: fallbackContent,
    markdown: { content: markdown },
  }
  if (keyboard?.rows?.length) payload.keyboard = { content: keyboard }
  if (associate && session.messageId && Date.now() - (session.timestamp || Date.now()) < 300_000) {
    payload.msg_id = session.messageId
    payload.msg_seq = Math.floor(Math.random() * 0xffffff) + 1
    if (quote) payload.message_reference = { message_id: session.messageId }
  }

  if (!bot.internal) throw new Error('当前 QQ 适配器未暴露 internal 发送接口')
  if (session.isDirect && bot.internal.sendPrivateMessage) {
    await bot.internal.sendPrivateMessage(session.channelId, payload)
  } else {
    await bot.internal.sendMessage(session.channelId, payload)
  }
  if (config.verboseConsoleLog) {
    logInfo(ctx, config, 'QQ Markdown 消息发送成功', [
      '适配器: QQ 官方 Bot',
      `平台: ${session.platform}`,
      `频道: ${session.channelId}`,
      `会话类型: ${session.isDirect ? '私聊' : '群聊'}`,
      `键盘: ${keyboard?.rows?.length ? '已附带' : '未附带'}`,
    ].join('\n'))
  }
}
