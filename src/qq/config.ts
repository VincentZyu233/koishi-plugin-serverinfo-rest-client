import { Schema } from 'koishi'
import { DEFAULT_QQ_KEYBOARD, stringifyKeyboard } from './keyboard'

export interface QQConfig {
  qqMarkdownEnabled: boolean
  qqKeyboardEnabled: boolean
  qqMarkdownEmbedImage: boolean
  publicBaseUrl: string
  qqImageCacheTtlMinutes: number
  qqImageCacheMaxFiles: number
  qqMarkdownMaxPlayers: number
  qqMarkdownKeyboardJson: string
}

export function createQQConfigSchema(): Schema<QQConfig> {
  return Schema.object({
    qqMarkdownEnabled: Schema.boolean()
      .default(true)
      .description('🤖 QQ 查询结果是否使用原生 Markdown；不影响按钮菜单和独立 Keyboard 消息'),
    qqKeyboardEnabled: Schema.boolean()
      .default(true)
      .description('⌨️ 是否启用 QQ 按钮；独立于 Markdown 开关，控制查询键盘和按钮菜单指令'),
    qqMarkdownEmbedImage: Schema.boolean()
      .default(false)
      .description('🖼️ QQ Markdown 是否通过公网 URL 嵌入图片；关闭时图片改用普通 QQ 图片消息发送'),
    publicBaseUrl: Schema.string()
      .default('')
      .role('textarea', { rows: [2, 4] })
      .description('🌐 QQ Markdown 图片公网根地址；留空时回退 Koishi server.selfUrl'),
    qqImageCacheTtlMinutes: Schema.number()
      .min(1)
      .step(1)
      .default(15)
      .description('🧹 QQ Markdown 临时图片保留分钟数'),
    qqImageCacheMaxFiles: Schema.number()
      .min(1)
      .step(1)
      .default(50)
      .description('🗃️ 每个 reusable 实例最多保留的 QQ Markdown 图片数量'),
    qqMarkdownMaxPlayers: Schema.number()
      .min(1)
      .step(1)
      .default(50)
      .description('👥 QQ Markdown 在线玩家名单最大展示数量'),
    qqMarkdownKeyboardJson: Schema.string()
      .role('textarea', { rows: [8, 16] })
      .default(stringifyKeyboard(DEFAULT_QQ_KEYBOARD))
      .description('⌨️ 查在线回复附带的 QQ Keyboard JSON，支持 ${commandPrefix} 和 ${serverLabel} 变量；按钮菜单使用内置分页布局，不读取此项'),
  }).description('🤖 QQ Markdown 与按钮适配')
}
