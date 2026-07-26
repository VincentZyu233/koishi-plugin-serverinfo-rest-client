import { h, type Context, type Session } from 'koishi'
import type { Config } from './config'
import { formatErrorForLog, logInfo } from './logger'

export const WAITING_HINT_TEXT = '⏳ 正在处理服务器请求，请稍候...'

export function shouldQuote(session: Session, config: Config): boolean {
  return Boolean(config.enableQuote && session.messageId)
}

export function withQuote(
  session: Session,
  config: Config,
  content: h.Fragment,
): h.Fragment {
  if (!shouldQuote(session, config)) return content
  const children = typeof content === 'string' ? [h.text(content)] : h.normalize(content)
  return [h.quote(session.messageId!), ...children]
}

export function withOrderedQueryReply(
  session: Session,
  config: Config,
  content: h.Fragment,
): h.Fragment {
  if (session.platform !== 'qq') return withQuote(session, config, content)
  const children = typeof content === 'string' ? [h.text(content)] : h.normalize(content)
  const images = children.filter(child => child.type === 'image' || child.type === 'img')
  const remaining = children.filter(child => child.type !== 'image' && child.type !== 'img')
  return withQuote(session, config, [...images, ...remaining])
}

export async function runWithWaitingHint<T>(
  ctx: Context,
  session: Session,
  config: Config,
  operation: () => Promise<T>,
): Promise<T> {
  let waitingMessageId: string | undefined

  if (config.enableWaitingHint) {
    try {
      const messageIds = await session.send(withQuote(session, config, WAITING_HINT_TEXT))
      waitingMessageId = messageIds[0]
    } catch (error) {
      logInfo(ctx, config, '[WARN] 发送等待提示失败，继续执行请求', formatErrorForLog(error))
    }
  }

  try {
    return await operation()
  } finally {
    if (waitingMessageId) {
      try {
        await session.bot.deleteMessage(session.channelId, waitingMessageId)
      } catch (error) {
        logInfo(ctx, config, '[WARN] 删除等待提示失败', formatErrorForLog(error))
      }
    }
  }
}
