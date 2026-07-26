import { h, type Context, type Session } from 'koishi'
import type { Config } from '../config'
import type { OnlineStatusResult } from '../types'
import type { QQKeyboard } from './types'
import { withQuote } from '../feedback'
import { formatErrorForLog, logInfo } from '../logger'
import { buildQQKeyboard } from './keyboard'
import { fitQQMarkdownImage, getPngDimensions } from './image'
import { sendQQMarkdown } from './markdown'
import { storeQQImage } from './server'
import { formatPlainPlayerList, formatQQOnlineMarkdown, formatQQRenderedMarkdown } from './template'

export interface RenderedReplyOptions {
  image?: Buffer | null
  text: string
  title: string
  markdownBody?: string
  keyboard?: QQKeyboard | null
  includeText?: boolean
}

interface QQReplyOptions {
  image: Buffer | null
  text: string
  keyboard: QQKeyboard | null
  includeText: boolean
  formatMarkdown: (imageUrl?: string, dimensions?: { width: number; height: number }) => string
}

function buildPlainReply(
  session: Session,
  config: Config,
  image: Buffer | null,
  text: string,
  quote = true,
) {
  const children: h[] = []
  if (image) children.push(h.image(image, 'image/png'))
  if (text) children.push(h.text(text))
  const content = h('', children)
  return quote ? withQuote(session, config, content) : content
}

async function sendKeyboardOnly(
  ctx: Context,
  session: Session,
  config: Config,
  keyboard: QQKeyboard | null,
): Promise<void> {
  if (!keyboard?.rows?.length) return
  try {
    await sendQQMarkdown(
      ctx,
      config,
      session,
      '> **可用操作**',
      '可用操作',
      keyboard,
      { associate: true, quote: false },
    )
  } catch (error) {
    logInfo(ctx, config, '[WARN] QQ Keyboard 独立消息发送失败', formatErrorForLog(error))
  }
}

async function sendQQReply(
  ctx: Context,
  session: Session,
  config: Config,
  options: QQReplyOptions,
) {
  const plainText = options.includeText ? options.text : ''
  if (session.platform !== 'qq') {
    return buildPlainReply(session, config, options.image, plainText)
  }

  if (!config.qqMarkdownEnabled) {
    const plain = buildPlainReply(session, config, options.image, plainText)
    if (!options.keyboard?.rows?.length) return plain
    let plainError: unknown
    try {
      await session.send(plain)
    } catch (error) {
      plainError = error
      logInfo(ctx, config, '[WARN] QQ 普通图文发送失败，仍继续尝试 Keyboard', formatErrorForLog(error))
    }
    await sendKeyboardOnly(ctx, session, config, options.keyboard)
    if (plainError) throw plainError
    return
  }

  if (options.image && config.qqMarkdownEmbedImage) {
    try {
      const imageUrl = await storeQQImage(ctx, config, options.image)
      const dimensions = fitQQMarkdownImage(getPngDimensions(options.image))
      if (config.verboseConsoleLog) {
        logInfo(ctx, config, '准备发送 QQ Markdown 嵌图消息', [
          `图片 URL: ${imageUrl}`,
          `Markdown 图片尺寸: ${dimensions.width}x${dimensions.height}`,
          `键盘: ${options.keyboard?.rows?.length ? '已附带' : '未附带'}`,
        ].join('\n'))
      }
      await sendQQMarkdown(
        ctx,
        config,
        session,
        options.formatMarkdown(imageUrl, dimensions),
        options.text,
        options.keyboard,
      )
      return
    } catch (error) {
      logInfo(ctx, config, '[WARN] QQ Markdown 嵌图发送失败，回退普通图片与 Markdown 正文', formatErrorForLog(error))
    }
  }

  if (options.image) {
    try {
      await session.send(buildPlainReply(session, config, options.image, ''))
    } catch (error) {
      logInfo(ctx, config, '[WARN] QQ 普通图片发送失败，仍继续发送 Markdown 正文与 Keyboard', formatErrorForLog(error))
    }
    try {
      await sendQQMarkdown(
        ctx,
        config,
        session,
        options.formatMarkdown(),
        options.text,
        options.keyboard,
        { associate: true, quote: false },
      )
      return
    } catch (error) {
      logInfo(ctx, config, '[WARN] QQ Markdown 正文发送失败，回退普通文字', formatErrorForLog(error))
      let plainTextError: unknown
      try {
        await session.send(buildPlainReply(session, config, null, options.text, false))
      } catch (plainError) {
        plainTextError = plainError
        logInfo(ctx, config, '[WARN] QQ 普通文字回退发送失败，仍继续尝试 Keyboard', formatErrorForLog(plainError))
      }
      await sendKeyboardOnly(ctx, session, config, options.keyboard)
      if (plainTextError) throw plainTextError
      return
    }
  }

  try {
    await sendQQMarkdown(
      ctx,
      config,
      session,
      options.formatMarkdown(),
      options.text,
      options.keyboard,
    )
    return
  } catch (error) {
    logInfo(ctx, config, '[WARN] QQ Markdown 文字发送失败，回退普通文字', formatErrorForLog(error))
    let plainTextError: unknown
    try {
      await session.send(buildPlainReply(session, config, null, options.text))
    } catch (plainError) {
      plainTextError = plainError
      logInfo(ctx, config, '[WARN] QQ 普通文字回退发送失败，仍继续尝试 Keyboard', formatErrorForLog(plainError))
    }
    await sendKeyboardOnly(ctx, session, config, options.keyboard)
    if (plainTextError) throw plainTextError
  }
}

export async function sendRenderedReply(
  ctx: Context,
  session: Session,
  config: Config,
  options: RenderedReplyOptions,
) {
  return sendQQReply(ctx, session, config, {
    image: options.image ?? null,
    text: options.text,
    keyboard: options.keyboard ?? null,
    includeText: options.includeText !== false,
    formatMarkdown: (imageUrl, dimensions) => formatQQRenderedMarkdown(
      options.title,
      imageUrl,
      dimensions,
      options.markdownBody,
    ),
  })
}

export async function sendOnlineStatus(
  ctx: Context,
  session: Session,
  config: Config,
  result: OnlineStatusResult,
  image: Buffer | null,
) {
  return sendQQReply(ctx, session, config, {
    image,
    text: formatPlainPlayerList(result, config),
    keyboard: buildQQKeyboard(config),
    includeText: true,
    formatMarkdown: (imageUrl, dimensions) => formatQQOnlineMarkdown(
      result,
      config,
      imageUrl,
      dimensions,
    ),
  })
}
