import { COMMAND_NAMES } from '../commands/command-names'
import type { TypstTemplateName } from '../template'
import type { TypstPreviewDefinition } from './types'

export const TYPST_PREVIEW_DEFINITIONS: readonly TypstPreviewDefinition[] = [
  definePreview('healthStatus', COMMAND_NAMES.healthCheck),
  definePreview('onlineStatus', COMMAND_NAMES.serverOverview),
  definePreview('playerHistory', COMMAND_NAMES.playerHistory),
  definePreview('playerActivity', COMMAND_NAMES.playerActivity),
  definePreview('playerStats', COMMAND_NAMES.playerStatistics),
  definePreview('playerDetail', COMMAND_NAMES.playerDetails),
  definePreview('playersList', COMMAND_NAMES.playerList),
  definePreview('playersCount', COMMAND_NAMES.playerCount),
  definePreview('playerNames', COMMAND_NAMES.playerNames),
  definePreview('serverInfo', COMMAND_NAMES.serverDetails),
  definePreview('serverStatus', COMMAND_NAMES.serverStatus),
] as const

function definePreview(
  id: TypstTemplateName,
  command: { primary: string, alias: string },
): TypstPreviewDefinition {
  return {
    id,
    primary: command.primary,
    alias: command.alias,
    fileName: `${command.primary}-${command.alias}.png`,
  }
}
