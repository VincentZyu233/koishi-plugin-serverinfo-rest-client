import { Schema } from 'koishi'

/**
 * 输出模式类型
 */
export type OutputMode = 'text' | 'typst-image'

/**
 * 插件配置接口
 */
export interface Config {
  // ========== 🔌 服务器连接配置 ==========
  /** 服务器 IP 地址 */
  serverIp: string
  /** 服务器端口 */
  serverPort: number
  /** 访问令牌 */
  token: string
  /** API 前缀 */
  apiPrefix: string
  /** 请求超时时间（毫秒） */
  timeout: number

  // ========== 🎯 指令细节设置 ==========
  /** 是否隐藏玩家坐标 */
  hidePlayerCoordinates: boolean
  /** 玩家信息字段过滤配置 */
  playerFieldFilters: { key: string; enabled: boolean }[]

  // ========== 📤 输出配置 ==========
  /** 默认输出模式 */
  defaultOutputModes: OutputMode[]
  /** 指令触发的回复是否引用原消息 */
  quoteCommandReplies: boolean

  // ========== 🧩 Typst 渲染配置 ==========
  /** Typst 字体路径 */
  typstFontPath: string
  /** Typst 图片渲染倍率（清晰度） */
  typstRenderScale: number
  /** Typst 背景色 */
  typstPageBgColor: string
  /** Typst 正文文本颜色 */
  typstTextColor: string
  /** Typst 标题栏填充色 */
  typstHeaderFillColor: string
  /** Typst 标题栏描边色 */
  typstHeaderStrokeColor: string
  /** Typst 标题栏文字颜色 */
  typstHeaderTextColor: string
  /** Typst 内容面板填充色 */
  typstPanelFillColor: string
  /** Typst 内容面板描边色 */
  typstPanelStrokeColor: string
  /** Typst 小节标题颜色 */
  typstSectionTitleColor: string
  /** Typst 统计信息文字颜色 */
  typstStatsTextColor: string

  // ========== 🛠️ 调试选项 ==========
  /** 启用调试日志 */
  verboseConsoleLog: boolean
}

// Schema 工厂函数：输出模式多选
function createOutputModeSchema() {
  return Schema.array(
    Schema.union([
      Schema.const('text' as const).description('📝 文字'),
      Schema.const('typst-image' as const).description('🧩 Typst 图片'),
    ])
  ).role('checkbox')
}

/**
 * 插件配置 Schema
 */
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    serverIp: Schema.string()
      .default('127.0.0.1')
      .description('🌐 服务器 IP 地址'),
    serverPort: Schema.number()
      .default(60203)
      .min(1)
      .max(65535)
      .description('🔌 服务器端口'),
    token: Schema.string()
      .default('')
      .role('secret')
      .description('🔑 访问令牌（如果服务器启用了 token 认证）'),
    apiPrefix: Schema.string()
      .default('/api/v1')
      .description('📡 API 前缀'),
    timeout: Schema.number()
      .default(10000)
      .min(1000)
      .max(60000)
      .description('⏱️ 请求超时时间（毫秒）'),
  }).description('🔌 服务器连接配置'),

  Schema.object({
    hidePlayerCoordinates: Schema.boolean()
      .default(true)
      .description('🙈 是否隐藏玩家坐标（players 指令中不显示具体坐标）'),
    playerFieldFilters: Schema.array(
      Schema.object({
        key: Schema.string().description('字段路径（嵌套用英文句号分隔，如 pos.x、device.ip）'),
        enabled: Schema.boolean().default(true).description('是否显示'),
      })
    )
      .role('table')
      .default([
        // 📋 基本信息 - 一般可以展示
        { key: 'name', enabled: true },
        { key: 'xuid', enabled: true },
        { key: 'uuid', enabled: true },
        { key: 'uniqueId', enabled: false },
        { key: 'permLevel', enabled: true },
        { key: 'isOP', enabled: true },
        { key: 'isSimulatedPlayer', enabled: true },
        { key: 'langCode', enabled: true },
        // 🎮 游戏状态
        { key: 'gameMode', enabled: true },
        { key: 'health', enabled: true },
        { key: 'maxHealth', enabled: true },
        { key: 'speed', enabled: true },
        { key: 'isFlying', enabled: true },
        { key: 'isSneaking', enabled: true },
        { key: 'isSprinting', enabled: true },
        { key: 'isMoving', enabled: true },
        { key: 'isInAir', enabled: true },
        { key: 'isInWater', enabled: true },
        { key: 'isInLava', enabled: true },
        { key: 'isOnGround', enabled: true },
        { key: 'isOnFire', enabled: true },
        { key: 'isSleeping', enabled: true },
        { key: 'isGliding', enabled: true },
        { key: 'isRiding', enabled: true },
        { key: 'isInvisible', enabled: true },
        { key: 'isHungry', enabled: true },
        { key: 'canFly', enabled: true },
        { key: 'canSleep', enabled: true },
        { key: 'canPickupItems', enabled: true },
        // 📍 位置信息 - 隐私敏感，默认隐藏坐标细节
        { key: 'pos', enabled: false },
        { key: 'pos.dimId', enabled: true },
        { key: 'blockPos', enabled: false },
        { key: 'feetPos', enabled: false },
        { key: 'lastDeathPos', enabled: false },
        { key: 'respawnPos', enabled: false },
        { key: 'direction', enabled: false },
        // 🌍 环境信息
        { key: 'biome', enabled: true },
        { key: 'biome.id', enabled: false },
        { key: 'biome.name', enabled: true },
        { key: 'standingOn', enabled: true },
        { key: 'standingOn.type', enabled: false },
        { key: 'standingOn.name', enabled: true },
        // ⭐ 经验信息
        { key: 'level', enabled: true },
        { key: 'currentExp', enabled: true },
        { key: 'totalExp', enabled: true },
        { key: 'expNeededForNextLevel', enabled: true },
        // 🎒 物品信息
        { key: 'handItem', enabled: true },
        { key: 'offHandItem', enabled: true },
        { key: 'armor', enabled: true },
        { key: 'tags', enabled: true },
        // 📱 设备信息 - 高度隐私，默认隐藏
        { key: 'device', enabled: false },
        { key: 'device.ip', enabled: false },
        { key: 'device.os', enabled: true },
        { key: 'device.clientId', enabled: false },
        { key: 'device.inputMode', enabled: true },
        { key: 'device.serverAddress', enabled: false },
        { key: 'device.avgPing', enabled: true },
        { key: 'device.avgPacketLoss', enabled: true },
        { key: 'device.lastPing', enabled: true },
        { key: 'device.lastPacketLoss', enabled: true },
      ])
      .description('🔧 玩家信息字段过滤（控制 mcinfo.player 指令显示哪些字段）'),
  }).description('🎯 指令细节设置'),

  Schema.object({
    defaultOutputModes: createOutputModeSchema()
      .default(['text'])
      .description('📤 默认输出模式（可多选，使用 --mode 参数可覆盖）'),
    quoteCommandReplies: Schema.boolean()
      .default(true)
      .description('💬 指令触发的回复是否引用原消息'),
  }).description('📤 输出配置'),

  Schema.object({
    typstFontPath: Schema.string()
      .default('/home/bawuyinguo/Fonts/LXGWWenKai/LXGWWenKaiMono-Medium.ttf')
      .role('textarea', { rows: [2, 5] })
      .description('🔤 Typst 渲染字体绝对路径（ttf/otf 格式）'),
    typstRenderScale: Schema.number()
      .default(2.33)
      .min(1)
      .max(10)
      .step(0.01)
      .description('🔍 Typst 图片渲染倍率（调整输出图片分辨率）'),
    typstPageBgColor: Schema.string()
      .role('color')
      .default('#f9efe2')
      .description('🧁 Typst 背景色'),
    typstTextColor: Schema.string()
      .role('color')
      .default('#2f2f35')
      .description('🖋️ Typst 正文文本颜色'),
    typstHeaderFillColor: Schema.string()
      .role('color')
      .default('#5dade2')
      .description('🎀 Typst 标题栏填充色'),
    typstHeaderStrokeColor: Schema.string()
      .role('color')
      .default('#3498db')
      .description('🪄 Typst 标题栏描边色'),
    typstHeaderTextColor: Schema.string()
      .role('color')
      .default('#ffffff')
      .description('✨ Typst 标题栏文字颜色'),
    typstPanelFillColor: Schema.string()
      .role('color')
      .default('#fffbf8')
      .description('📦 Typst 内容面板填充色'),
    typstPanelStrokeColor: Schema.string()
      .role('color')
      .default('#f3efe5')
      .description('🧷 Typst 内容面板描边色'),
    typstSectionTitleColor: Schema.string()
      .role('color')
      .default('#2980b9')
      .description('🧭 Typst 小节标题颜色'),
    typstStatsTextColor: Schema.string()
      .role('color')
      .default('#8788a5')
      .description('📊 Typst 统计信息文字颜色'),
  }).description('🧩 Typst 渲染配置'),

  Schema.object({
    verboseConsoleLog: Schema.boolean()
      .default(false)
      .description('🐛 启用调试日志'),
  }).description('🛠️ 调试选项'),
])
