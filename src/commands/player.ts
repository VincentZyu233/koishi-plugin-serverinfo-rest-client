import { Context, h } from 'koishi'
import { Config } from '../config'
import {
  ApiClient,
  resolveOutputModes,
  getTypstRenderer,
  buildTypstTheme,
  escapeTypstText,
} from '../index'

interface Position {
  x: number
  y: number
  z: number
  dimId?: number
}

interface BlockPosition {
  x: number
  y: number
  z: number
}

interface Biome {
  id: number
  name: string
}

interface BlockInfo {
  type: string
  name: string
}

interface DeviceInfo {
  ip: string
  os: string
  clientId: string
  inputMode: number
  serverAddress: string
  avgPing: number
  avgPacketLoss: number
  lastPing: number
  lastPacketLoss: number
}

interface PlayerInfo {
  name: string
  xuid: string
  uuid: string
  uniqueId: string
  permLevel: number
  gameMode: number
  isOP: boolean
  isSimulatedPlayer: boolean
  health: number
  maxHealth: number
  pos: Position
  blockPos: BlockPosition
  feetPos: Position
  lastDeathPos: Position
  respawnPos: Position
  direction: object
  speed: number
  biome: Biome
  standingOn: BlockInfo
  isFlying: boolean
  isSneaking: boolean
  isSprinting: boolean
  isMoving: boolean
  isInAir: boolean
  isInWater: boolean
  isInLava: boolean
  isOnGround: boolean
  isOnFire: boolean
  isSleeping: boolean
  isGliding: boolean
  isRiding: boolean
  isInvisible: boolean
  isHungry: boolean
  canFly: boolean
  canSleep: boolean
  canPickupItems: boolean
  level: number
  currentExp: number
  totalExp: number
  expNeededForNextLevel: number
  handItem: object | null
  offHandItem: object | null
  armor: object[] | null
  tags: string[]
  device: DeviceInfo
  langCode: string
}

interface PlayerResponse extends PlayerInfo {}

// 字段过滤工具函数
function isFieldEnabled(cfg: Config, key: string): boolean {
  const filter = cfg.playerFieldFilters?.find(f => f.key === key)
  return filter?.enabled ?? true
}

const INPUT_MODE_MAP: Record<number, string> = {
  1: '⌨️ 键鼠',
  2: '📱 触屏',
  3: '🎮 手柄',
}

const DIMENSION_MAP: Record<number, string> = {
  0: '🌍 主世界',
  1: '🔥 下界',
  2: '🌌 末地',
}

const GAMEMODE_MAP: Record<number, string> = {
  0: '🗡️ 生存',
  1: '🎨 创造',
  2: '🎯 冒险',
  3: '👁️ 旁观',
}

const PERM_LEVEL_MAP: Record<number, string> = {
  0: '👤 成员',
  1: '⭐ 操作员',
  2: '👑 管理员',
  3: '🛡️ 服主',
}

function getDimension(dimId: number): string {
  return DIMENSION_MAP[dimId] || `❓ 未知 (${dimId})`
}

function getGameMode(mode: number): string {
  return GAMEMODE_MAP[mode] || `❓ 未知 (${mode})`
}

function getPermLevel(level: number): string {
  return PERM_LEVEL_MAP[level] || `❓ 未知 (${level})`
}

function getInputMode(mode: number): string {
  return INPUT_MODE_MAP[mode] || `❓ 未知 (${mode})`
}

function formatTextOutput(player: PlayerResponse, queryName: string, cfg: Config, label: string): string {
  if (!player || !player.name) {
    return `${label} 👤 玩家查询

❌ 未找到玩家: ${queryName}`
  }

  const lines: string[] = []
  lines.push(`${label} 👤 玩家详情: ${player.name}`)
  lines.push('')

  // 📋 基本信息
  const basicInfo: string[] = []
  if (isFieldEnabled(cfg, 'xuid')) basicInfo.push(`  • XUID: ${player.xuid}`)
  if (isFieldEnabled(cfg, 'uuid')) basicInfo.push(`  • UUID: ${player.uuid}`)
  if (isFieldEnabled(cfg, 'uniqueId')) basicInfo.push(`  • UniqueId: ${player.uniqueId}`)
  if (isFieldEnabled(cfg, 'permLevel')) basicInfo.push(`  • 权限等级: ${getPermLevel(player.permLevel)}`)
  if (isFieldEnabled(cfg, 'isOP')) basicInfo.push(`  • OP: ${player.isOP ? '✅ 是' : '❌ 否'}`)
  if (isFieldEnabled(cfg, 'isSimulatedPlayer')) basicInfo.push(`  • 模拟玩家: ${player.isSimulatedPlayer ? '✅ 是' : '❌ 否'}`)
  if (isFieldEnabled(cfg, 'langCode')) basicInfo.push(`  • 语言: ${player.langCode}`)
  
  if (basicInfo.length > 0) {
    lines.push('📋 基本信息:')
    lines.push(...basicInfo)
    lines.push('')
  }

  // 🎮 游戏状态
  const gameStatus: string[] = []
  if (isFieldEnabled(cfg, 'gameMode')) gameStatus.push(`  • 游戏模式: ${getGameMode(player.gameMode)}`)
  if (isFieldEnabled(cfg, 'health') && isFieldEnabled(cfg, 'maxHealth')) {
    gameStatus.push(`  • 生命值: ${player.health}/${player.maxHealth} ❤️`)
  }
  if (isFieldEnabled(cfg, 'speed')) gameStatus.push(`  • 移动速度: ${player.speed?.toFixed(2) ?? 'N/A'}`)

  // 状态标志
  const flags: string[] = []
  if (isFieldEnabled(cfg, 'isFlying') && player.isFlying) flags.push('🦅 飞行')
  if (isFieldEnabled(cfg, 'isSneaking') && player.isSneaking) flags.push('🐍 潜行')
  if (isFieldEnabled(cfg, 'isSprinting') && player.isSprinting) flags.push('🏃 疾跑')
  if (isFieldEnabled(cfg, 'isMoving') && player.isMoving) flags.push('🚶 移动中')
  if (isFieldEnabled(cfg, 'isInAir') && player.isInAir) flags.push('☁️ 空中')
  if (isFieldEnabled(cfg, 'isInWater') && player.isInWater) flags.push('💧 水中')
  if (isFieldEnabled(cfg, 'isInLava') && player.isInLava) flags.push('🔥 岩浆中')
  if (isFieldEnabled(cfg, 'isOnGround') && player.isOnGround) flags.push('🧱 地面')
  if (isFieldEnabled(cfg, 'isOnFire') && player.isOnFire) flags.push('🔥 着火')
  if (isFieldEnabled(cfg, 'isSleeping') && player.isSleeping) flags.push('😴 睡觉')
  if (isFieldEnabled(cfg, 'isGliding') && player.isGliding) flags.push('🪂 滑翔')
  if (isFieldEnabled(cfg, 'isRiding') && player.isRiding) flags.push('🐴 骑乘')
  if (isFieldEnabled(cfg, 'isInvisible') && player.isInvisible) flags.push('👻 隐身')
  if (isFieldEnabled(cfg, 'isHungry') && player.isHungry) flags.push('🍖 饥饿')
  if (isFieldEnabled(cfg, 'canFly') && player.canFly) flags.push('✈️ 可飞行')
  
  if (flags.length > 0) gameStatus.push(`  • 状态: ${flags.join(' | ')}`)
  
  if (gameStatus.length > 0) {
    lines.push('🎮 游戏状态:')
    lines.push(...gameStatus)
    lines.push('')
  }

  // ⭐ 经验信息
  const expInfo: string[] = []
  if (isFieldEnabled(cfg, 'level')) expInfo.push(`  • 等级: ${player.level}`)
  if (isFieldEnabled(cfg, 'currentExp')) expInfo.push(`  • 当前经验: ${player.currentExp}`)
  if (isFieldEnabled(cfg, 'totalExp')) expInfo.push(`  • 总经验: ${player.totalExp}`)
  if (isFieldEnabled(cfg, 'expNeededForNextLevel')) expInfo.push(`  • 升级所需: ${player.expNeededForNextLevel}`)
  
  if (expInfo.length > 0) {
    lines.push('⭐ 经验信息:')
    lines.push(...expInfo)
    lines.push('')
  }

  // 📍 位置信息
  const posInfo: string[] = []
  if (isFieldEnabled(cfg, 'pos.dimId') && player.pos) {
    posInfo.push(`  • 维度: ${getDimension(player.pos.dimId)}`)
  }
  if (isFieldEnabled(cfg, 'pos') && player.pos) {
    posInfo.push(`  • 精确坐标: ${player.pos.x.toFixed(2)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(2)}`)
  }
  if (isFieldEnabled(cfg, 'blockPos') && player.blockPos) {
    posInfo.push(`  • 方块坐标: ${player.blockPos.x}, ${player.blockPos.y}, ${player.blockPos.z}`)
  }
  if (isFieldEnabled(cfg, 'feetPos') && player.feetPos) {
    posInfo.push(`  • 脚部坐标: ${player.feetPos.x.toFixed(2)}, ${player.feetPos.y.toFixed(2)}, ${player.feetPos.z.toFixed(2)}`)
  }
  if (isFieldEnabled(cfg, 'lastDeathPos') && player.lastDeathPos) {
    posInfo.push(`  • 上次死亡: ${player.lastDeathPos.x}, ${player.lastDeathPos.y}, ${player.lastDeathPos.z} (${getDimension(player.lastDeathPos.dimId)})`)
  }
  if (isFieldEnabled(cfg, 'respawnPos') && player.respawnPos) {
    posInfo.push(`  • 重生点: ${player.respawnPos.x}, ${player.respawnPos.y}, ${player.respawnPos.z} (${getDimension(player.respawnPos.dimId)})`)
  }
  
  if (posInfo.length > 0) {
    lines.push('📍 位置信息:')
    lines.push(...posInfo)
    lines.push('')
  }

  // 🌍 环境信息
  const envInfo: string[] = []
  if (isFieldEnabled(cfg, 'biome') || isFieldEnabled(cfg, 'biome.name')) {
    if (player.biome) {
      const biomeDisplay = isFieldEnabled(cfg, 'biome.id') 
        ? `${player.biome.name} (ID: ${player.biome.id})`
        : player.biome.name
      envInfo.push(`  • 生物群系: ${biomeDisplay}`)
    }
  }
  if (isFieldEnabled(cfg, 'standingOn') || isFieldEnabled(cfg, 'standingOn.name')) {
    if (player.standingOn) {
      const blockDisplay = isFieldEnabled(cfg, 'standingOn.type')
        ? `${player.standingOn.name} (${player.standingOn.type})`
        : player.standingOn.name
      envInfo.push(`  • 脚下方块: ${blockDisplay}`)
    }
  }
  
  if (envInfo.length > 0) {
    lines.push('🌍 环境信息:')
    lines.push(...envInfo)
    lines.push('')
  }

  // 📱 设备信息
  if (isFieldEnabled(cfg, 'device') && player.device) {
    const deviceInfo: string[] = []
    if (isFieldEnabled(cfg, 'device.os')) deviceInfo.push(`  • 操作系统: ${player.device.os}`)
    if (isFieldEnabled(cfg, 'device.inputMode')) deviceInfo.push(`  • 输入方式: ${getInputMode(player.device.inputMode)}`)
    if (isFieldEnabled(cfg, 'device.ip')) deviceInfo.push(`  • IP 地址: ${player.device.ip}`)
    if (isFieldEnabled(cfg, 'device.clientId')) deviceInfo.push(`  • 客户端 ID: ${player.device.clientId}`)
    if (isFieldEnabled(cfg, 'device.serverAddress')) deviceInfo.push(`  • 服务器地址: ${player.device.serverAddress}`)
    if (isFieldEnabled(cfg, 'device.avgPing')) deviceInfo.push(`  • 平均延迟: ${player.device.avgPing}ms`)
    if (isFieldEnabled(cfg, 'device.lastPing')) deviceInfo.push(`  • 最近延迟: ${player.device.lastPing}ms`)
    if (isFieldEnabled(cfg, 'device.avgPacketLoss')) deviceInfo.push(`  • 平均丢包率: ${(player.device.avgPacketLoss * 100).toFixed(2)}%`)
    if (isFieldEnabled(cfg, 'device.lastPacketLoss')) deviceInfo.push(`  • 最近丢包率: ${(player.device.lastPacketLoss * 100).toFixed(2)}%`)
    
    if (deviceInfo.length > 0) {
      lines.push('📱 设备信息:')
      lines.push(...deviceInfo)
      lines.push('')
    }
  }

  // 🎒 物品信息
  const itemInfo: string[] = []
  if (isFieldEnabled(cfg, 'handItem') && player.handItem) {
    itemInfo.push(`  • 主手物品: ${JSON.stringify(player.handItem)}`)
  }
  if (isFieldEnabled(cfg, 'offHandItem') && player.offHandItem) {
    itemInfo.push(`  • 副手物品: ${JSON.stringify(player.offHandItem)}`)
  }
  if (isFieldEnabled(cfg, 'armor') && player.armor && player.armor.length > 0) {
    itemInfo.push(`  • 装备: ${JSON.stringify(player.armor)}`)
  }
  if (isFieldEnabled(cfg, 'tags') && player.tags && player.tags.length > 0) {
    itemInfo.push(`  • 标签: ${player.tags.join(', ')}`)
  }
  
  if (itemInfo.length > 0) {
    lines.push('🎒 物品信息:')
    lines.push(...itemInfo)
  }

  return lines.join('\n').trimEnd()
}

function generateTypstCode(player: PlayerResponse, queryName: string, theme: ReturnType<typeof buildTypstTheme>, cfg: Config, label: string): string {
  const timestamp = new Date().toLocaleString('zh-CN')

  if (!player || !player.name) {
    return `#set page(
  width: 400pt,
  height: auto,
  margin: (x: 14pt, y: 14pt),
  fill: ${theme.pageBg}
)

#set text(
  font: ("${theme.fontFamily}", "Noto Sans CJK SC", "Microsoft YaHei"),
  size: 11pt,
  fill: ${theme.textColor},
  lang: "zh"
)

#align(center)[
  #block(
    fill: ${theme.headerFill},
    stroke: 2pt + ${theme.headerStroke},
    radius: 6pt,
    inset: 10pt,
    width: 100%
  )[
    #text(size: 16pt, weight: "bold", fill: ${theme.headerText})[
      ${escapeTypstText(label)} 👤 玩家查询
    ]
  ]
]

#v(8pt)

#block(
  fill: ${theme.panelFill},
  stroke: 1pt + ${theme.panelStroke},
  radius: 4pt,
  inset: 12pt,
  width: 100%
)[
  #align(center)[
    #text(size: 12pt)[❌ 未找到玩家: ${escapeTypstText(queryName)}]
  ]
]

#v(8pt)

#align(center)[
  #text(size: 8pt, fill: ${theme.statsText})[
    Generated by serverinfo-rest-client · ${escapeTypstText(timestamp)}
  ]
]
`
  }

  // 构建状态标志
  const flags: string[] = []
  if (isFieldEnabled(cfg, 'isOP') && player.isOP) flags.push('👑 OP')
  if (isFieldEnabled(cfg, 'isFlying') && player.isFlying) flags.push('🦅 飞行')
  if (isFieldEnabled(cfg, 'isSneaking') && player.isSneaking) flags.push('🐍 潜行')
  if (isFieldEnabled(cfg, 'isSprinting') && player.isSprinting) flags.push('🏃 疾跑')
  if (isFieldEnabled(cfg, 'isInWater') && player.isInWater) flags.push('💧 水中')
  if (isFieldEnabled(cfg, 'isInLava') && player.isInLava) flags.push('🔥 岩浆')
  if (isFieldEnabled(cfg, 'isOnFire') && player.isOnFire) flags.push('🔥 着火')
  if (isFieldEnabled(cfg, 'isGliding') && player.isGliding) flags.push('🪂 滑翔')
  if (isFieldEnabled(cfg, 'isRiding') && player.isRiding) flags.push('🐴 骑乘')
  if (isFieldEnabled(cfg, 'isInvisible') && player.isInvisible) flags.push('👻 隐身')

  // 构建基本信息表格行
  const basicInfoRows: string[] = []
  if (isFieldEnabled(cfg, 'xuid')) {
    basicInfoRows.push(`[XUID], [#text(size: 9pt)[${escapeTypstText(player.xuid)}]],`)
  }
  if (isFieldEnabled(cfg, 'uuid')) {
    basicInfoRows.push(`[UUID], [#text(size: 9pt)[${escapeTypstText(player.uuid)}]],`)
  }
  if (isFieldEnabled(cfg, 'uniqueId')) {
    basicInfoRows.push(`[UniqueId], [#text(size: 9pt)[${escapeTypstText(player.uniqueId)}]],`)
  }
  if (isFieldEnabled(cfg, 'permLevel')) {
    basicInfoRows.push(`[权限等级], [${escapeTypstText(getPermLevel(player.permLevel))}],`)
  }
  if (isFieldEnabled(cfg, 'isSimulatedPlayer')) {
    basicInfoRows.push(`[模拟玩家], [${player.isSimulatedPlayer ? '✅ 是' : '❌ 否'}],`)
  }
  if (isFieldEnabled(cfg, 'langCode')) {
    basicInfoRows.push(`[语言], [${escapeTypstText(player.langCode)}],`)
  }

  // 构建游戏状态网格项
  const gameStatusItems: string[] = []
  if (isFieldEnabled(cfg, 'gameMode')) {
    gameStatusItems.push(`[游戏模式: ${escapeTypstText(getGameMode(player.gameMode))}]`)
  }
  if (isFieldEnabled(cfg, 'health') && isFieldEnabled(cfg, 'maxHealth')) {
    gameStatusItems.push(`[生命值: ❤️ ${player.health}/${player.maxHealth}]`)
  }
  if (isFieldEnabled(cfg, 'speed')) {
    gameStatusItems.push(`[移动速度: 🏃 ${player.speed?.toFixed(2) ?? 'N/A'}]`)
  }
  if (isFieldEnabled(cfg, 'isHungry')) {
    gameStatusItems.push(`[饥饿: ${player.isHungry ? '🍖 是' : '🍗 否'}]`)
  }

  // 构建经验信息网格项
  const expItems: string[] = []
  if (isFieldEnabled(cfg, 'level')) {
    expItems.push(`[等级: ⭐ ${player.level}]`)
  }
  if (isFieldEnabled(cfg, 'currentExp')) {
    expItems.push(`[当前经验: ${player.currentExp}]`)
  }
  if (isFieldEnabled(cfg, 'totalExp')) {
    expItems.push(`[总经验: ${player.totalExp}]`)
  }
  if (isFieldEnabled(cfg, 'expNeededForNextLevel')) {
    expItems.push(`[升级所需: ${player.expNeededForNextLevel}]`)
  }

  // 构建位置信息表格行
  const posInfoRows: string[] = []
  if (isFieldEnabled(cfg, 'pos.dimId') && player.pos) {
    posInfoRows.push(`[维度], [${escapeTypstText(getDimension(player.pos.dimId))}],`)
  }
  if (isFieldEnabled(cfg, 'pos') && player.pos) {
    posInfoRows.push(`[精确坐标], [${player.pos.x.toFixed(2)}, ${player.pos.y.toFixed(2)}, ${player.pos.z.toFixed(2)}],`)
  }
  if (isFieldEnabled(cfg, 'blockPos') && player.blockPos) {
    posInfoRows.push(`[方块坐标], [${player.blockPos.x}, ${player.blockPos.y}, ${player.blockPos.z}],`)
  }
  if (isFieldEnabled(cfg, 'lastDeathPos') && player.lastDeathPos) {
    posInfoRows.push(`[上次死亡], [${player.lastDeathPos.x}, ${player.lastDeathPos.y}, ${player.lastDeathPos.z}],`)
  }
  if (isFieldEnabled(cfg, 'respawnPos') && player.respawnPos) {
    posInfoRows.push(`[重生点], [${player.respawnPos.x}, ${player.respawnPos.y}, ${player.respawnPos.z}],`)
  }

  // 构建环境信息表格行
  const envInfoRows: string[] = []
  if ((isFieldEnabled(cfg, 'biome') || isFieldEnabled(cfg, 'biome.name')) && player.biome) {
    const biomeDisplay = isFieldEnabled(cfg, 'biome.id')
      ? `${player.biome.name} (ID: ${player.biome.id})`
      : player.biome.name
    envInfoRows.push(`[生物群系], [${escapeTypstText(biomeDisplay)}],`)
  }
  if ((isFieldEnabled(cfg, 'standingOn') || isFieldEnabled(cfg, 'standingOn.name')) && player.standingOn) {
    envInfoRows.push(`[脚下方块], [${escapeTypstText(player.standingOn.name)}],`)
  }

  // 构建设备信息表格行
  const deviceInfoRows: string[] = []
  if (isFieldEnabled(cfg, 'device') && player.device) {
    if (isFieldEnabled(cfg, 'device.os')) {
      deviceInfoRows.push(`[操作系统], [${escapeTypstText(player.device.os)}],`)
    }
    if (isFieldEnabled(cfg, 'device.inputMode')) {
      deviceInfoRows.push(`[输入方式], [${escapeTypstText(getInputMode(player.device.inputMode))}],`)
    }
    if (isFieldEnabled(cfg, 'device.ip')) {
      deviceInfoRows.push(`[IP 地址], [#text(size: 9pt)[${escapeTypstText(player.device.ip)}]],`)
    }
    if (isFieldEnabled(cfg, 'device.serverAddress')) {
      deviceInfoRows.push(`[服务器地址], [#text(size: 9pt)[${escapeTypstText(player.device.serverAddress)}]],`)
    }
    if (isFieldEnabled(cfg, 'device.avgPing')) {
      deviceInfoRows.push(`[平均延迟], [${player.device.avgPing}ms],`)
    }
    if (isFieldEnabled(cfg, 'device.lastPing')) {
      deviceInfoRows.push(`[最近延迟], [${player.device.lastPing}ms],`)
    }
    if (isFieldEnabled(cfg, 'device.avgPacketLoss')) {
      deviceInfoRows.push(`[平均丢包], [${(player.device.avgPacketLoss * 100).toFixed(2)}%],`)
    }
  }

  // 构建各个面板的 Typst 代码
  const panels: string[] = []

  // 基本信息面板
  if (basicInfoRows.length > 0) {
    panels.push(`#block(
  fill: ${theme.panelFill},
  stroke: 1pt + ${theme.panelStroke},
  radius: 4pt,
  inset: 12pt,
  width: 100%
)[
  #text(weight: "bold", fill: ${theme.sectionTitle})[📋 基本信息]
  #v(6pt)
  #table(
    columns: (auto, 1fr),
    stroke: none,
    row-gutter: 4pt,
    ${basicInfoRows.join('\n    ')}
  )
]`)
  }

  // 游戏状态面板
  if (gameStatusItems.length > 0) {
    panels.push(`#block(
  fill: ${theme.panelFill},
  stroke: 1pt + ${theme.panelStroke},
  radius: 4pt,
  inset: 12pt,
  width: 100%
)[
  #text(weight: "bold", fill: ${theme.sectionTitle})[🎮 游戏状态]
  #v(6pt)
  #grid(
    columns: (1fr, 1fr),
    gutter: 8pt,
    ${gameStatusItems.join(',\n    ')},
  )
]`)
  }

  // 经验信息面板
  if (expItems.length > 0) {
    panels.push(`#block(
  fill: ${theme.panelFill},
  stroke: 1pt + ${theme.panelStroke},
  radius: 4pt,
  inset: 12pt,
  width: 100%
)[
  #text(weight: "bold", fill: ${theme.sectionTitle})[⭐ 经验信息]
  #v(6pt)
  #grid(
    columns: (1fr, 1fr),
    gutter: 8pt,
    ${expItems.join(',\n    ')},
  )
]`)
  }

  // 位置信息面板
  if (posInfoRows.length > 0) {
    panels.push(`#block(
  fill: ${theme.panelFill},
  stroke: 1pt + ${theme.panelStroke},
  radius: 4pt,
  inset: 12pt,
  width: 100%
)[
  #text(weight: "bold", fill: ${theme.sectionTitle})[📍 位置信息]
  #v(6pt)
  #table(
    columns: (auto, 1fr),
    stroke: none,
    row-gutter: 4pt,
    ${posInfoRows.join('\n    ')}
  )
]`)
  }

  // 环境信息面板
  if (envInfoRows.length > 0) {
    panels.push(`#block(
  fill: ${theme.panelFill},
  stroke: 1pt + ${theme.panelStroke},
  radius: 4pt,
  inset: 12pt,
  width: 100%
)[
  #text(weight: "bold", fill: ${theme.sectionTitle})[🌍 环境信息]
  #v(6pt)
  #table(
    columns: (auto, 1fr),
    stroke: none,
    row-gutter: 4pt,
    ${envInfoRows.join('\n    ')}
  )
]`)
  }

  // 设备信息面板
  if (deviceInfoRows.length > 0) {
    panels.push(`#block(
  fill: ${theme.panelFill},
  stroke: 1pt + ${theme.panelStroke},
  radius: 4pt,
  inset: 12pt,
  width: 100%
)[
  #text(weight: "bold", fill: ${theme.sectionTitle})[📱 设备信息]
  #v(6pt)
  #table(
    columns: (auto, 1fr),
    stroke: none,
    row-gutter: 4pt,
    ${deviceInfoRows.join('\n    ')}
  )
]`)
  }

  return `#set page(
  width: 450pt,
  height: auto,
  margin: (x: 14pt, y: 14pt),
  fill: ${theme.pageBg}
)

#set text(
  font: ("${theme.fontFamily}", "Noto Sans CJK SC", "Microsoft YaHei"),
  size: 11pt,
  fill: ${theme.textColor},
  lang: "zh"
)

#align(center)[
  #block(
    fill: ${theme.headerFill},
    stroke: 2pt + ${theme.headerStroke},
    radius: 6pt,
    inset: 10pt,
    width: 100%
  )[
    #text(size: 16pt, weight: "bold", fill: ${theme.headerText})[
      ${escapeTypstText(label)} 👤 ${escapeTypstText(player.name)}
    ]
    ${flags.length > 0 ? `#h(8pt) #text(size: 11pt, fill: ${theme.headerText})[${flags.join(' ')}]` : ''}
  ]
]

#v(8pt)

${panels.join('\n\n#v(6pt)\n\n')}

#v(8pt)

#align(center)[
  #text(size: 8pt, fill: ${theme.statsText})[
    Generated by serverinfo-rest-client · ${escapeTypstText(timestamp)}
  ]
]
`
}

export function registerPlayerCommand(
  ctx: Context,
  cfg: Config,
  apiClient: ApiClient,
  logger: any,
  prefix: string,
  label: string
) {
  ctx.command(`${prefix}.player <name:string>`, '查询指定玩家')
    .option('mode', '-m <mode:string> 输出模式 (text/image)')
    .action(async ({ session, options }, name) => {
      if (!name) {
        return `❌ 请指定玩家名称，例如: ${prefix}.player Steve`
      }

      try {
        const data = await apiClient.get<PlayerResponse>('/player', { name })
        const modes = resolveOutputModes(options.mode, cfg)

        const results: h[] = []

        for (const mode of modes) {
          if (mode === 'text') {
            results.push(h.text(formatTextOutput(data, name, cfg, label)))
          } else if (mode === 'typst-image') {
            try {
              const renderer = await getTypstRenderer(ctx, cfg, logger)
              const theme = buildTypstTheme(cfg)
              const typstCode = generateTypstCode(data, name, theme, cfg, label)
              const pngBuffer = await renderer.toPng(typstCode, cfg.typstRenderScale)
              results.push(h.image(pngBuffer, 'image/png'))
            } catch (err) {
              logger.warn(`Typst 渲染失败: ${err}`)
              results.push(h.text(`[Typst 渲染失败: ${err.message}]`))
            }
          }
        }

        if (cfg.quoteCommandReplies && session.messageId) {
          return h('', [h.quote(session.messageId), ...results])
        }
        return results
      } catch (error) {
        logger.error(`查询玩家失败: ${error}`)
        return `❌ 查询玩家失败: ${error.message}`
      }
    })
}
