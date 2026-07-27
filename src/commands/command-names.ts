export const COMMAND_NAMES = {
  buttonMenu: { primary: '按钮菜单', alias: 'button-menu', emoji: '⌨️' },
  healthCheck: { primary: '健康检查', alias: 'health-check', emoji: '❤️' },
  serverOverview: { primary: '查在线', alias: 'server-overview', emoji: '🌐' },
  playerHistory: { primary: '历史记录', alias: 'player-history', emoji: '📚' },
  playerActivity: { primary: '在线图', alias: 'online-chart', emoji: '📈' },
  playerStatistics: { primary: '玩家数据统计', alias: 'player-stats', emoji: '📊' },
  executeCommand: { primary: '执行命令', alias: 'execute-command', emoji: '🛠️' },
  bindPlayer: { primary: '绑定玩家', alias: 'bind-player', emoji: '🔗' },
  unbindPlayer: { primary: '解绑玩家', alias: 'unbind-player', emoji: '🔓' },
  addWhitelist: { primary: '添加白名单', alias: 'add-whitelist', emoji: '➕' },
  whitelistBinding: { primary: '查询白名单绑定', alias: 'whitelist-binding', emoji: '🔎' },
  removeWhitelist: { primary: '移除白名单', alias: 'remove-whitelist', emoji: '➖' },
  serverStatus: { primary: '服务器状态', alias: 'server-status', emoji: '📊' },
  serverDetails: { primary: '服务器信息', alias: 'server-details', emoji: '🖥️' },
  playerList: { primary: '玩家列表', alias: 'player-list', emoji: '👥' },
  playerCount: { primary: '玩家数量', alias: 'player-count', emoji: '🔢' },
  playerNames: { primary: '玩家名列表', alias: 'player-names', emoji: '📝' },
  playerDetails: { primary: '玩家在线详情', alias: 'player-details', emoji: '👤' },
  allTypstImagePreview: { primary: '所有Typst图片预览', alias: 'all-typst-image-preview', emoji: '🖼️' },
} as const

export const PLAYER_ACTIVITY_ADDITIONAL_ALIASES = [
  '在线折线图',
  '在线柱形图',
  '玩家活动',
  'player-activity',
] as const

export type CommandName = (typeof COMMAND_NAMES)[keyof typeof COMMAND_NAMES]

export const DEFAULT_COMMAND_PREFIX = 'mcinfo1'

export interface CommandScope {
  rootCommand: string
  featurePrefix: string
}

export function resolveCommandScope(commandPrefix: string, useCommandPrefix: boolean | undefined): CommandScope {
  const rootCommand = commandPrefix || DEFAULT_COMMAND_PREFIX
  return {
    rootCommand,
    featurePrefix: useCommandPrefix === false ? '' : rootCommand,
  }
}

function scopedCommand(prefix: string, name: string): string {
  return prefix ? `${prefix}.${name}` : name
}

export function primaryCommand(prefix: string, command: CommandName): string {
  return scopedCommand(prefix, command.primary)
}

export function aliasCommand(prefix: string, command: CommandName | string): string {
  return scopedCommand(prefix, typeof command === 'string' ? command : command.alias)
}

export function commandUsage(prefix: string, command: CommandName, argument = ''): string {
  const suffix = argument ? ` ${argument}` : ''
  return `${primaryCommand(prefix, command)}${suffix} (${command.alias})`
}

export function commandDescription(command: CommandName, description: string): string {
  return `${command.emoji} ${description}（alias：${command.alias}）`
}
