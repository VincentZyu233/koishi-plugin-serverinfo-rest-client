import type { WhitelistRemovalResponse } from '../../api/types'
import { runWithWaitingHint, withQuote } from '../../feedback'
import { hasPermission } from '../../permissions'
import { aliasCommand, COMMAND_NAMES, commandDescription, primaryCommand } from '../command-names'
import type { CommandRegistrationContext } from '../types'
import { formatErrorForLog, logInfo } from '../../logger'
import { formatAllowlistResult, maskIdentifier, requesterId } from './shared'

export function registerRemoveWhitelistCommand({
  ctx,
  config,
  apiClient,
  prefix,
}: CommandRegistrationContext) {
  const command = COMMAND_NAMES.removeWhitelist
  const commandName = primaryCommand(prefix, command)
  ctx.command(
    `${commandName} <playerName:text>`,
    commandDescription(command, '管理员按 Xbox 玩家名移除唯一绑定；服务端启用同步时同时移除 BDS allowlist 项目'),
  )
    .alias(aliasCommand(prefix, command))
    .action(async ({ session }, rawPlayerName) => {
      if (!hasPermission(session, config.whitelistManagementAdminList)) {
        return withQuote(session, config, '你不在白名单管理权限名单中')
      }
      const playerName = String(rawPlayerName || '').trim()
      if (!playerName) return withQuote(session, config, `请提供 Xbox 玩家名，例如：${commandName} Steve`)
      if (!config.adminToken) return withQuote(session, config, '尚未配置管理 API 令牌，无法移除白名单')
      return runWithWaitingHint(ctx, session, config, async () => {
        try {
          const data = await apiClient.post<WhitelistRemovalResponse>('/whitelist/remove', {
            playerName,
            requester: requesterId(session),
          }, true)
          return withQuote(
            session,
            config,
            `已移除绑定：${maskIdentifier(data.binding.userId)} ↔ ${data.binding.playerName}${formatAllowlistResult(data)}`,
          )
        } catch (error) {
          logInfo(ctx, config, '[ERROR] 移除白名单失败', formatErrorForLog(error))
          return withQuote(session, config, `移除白名单失败：${error instanceof Error ? error.message : String(error)}`)
        }
      })
    })
}
