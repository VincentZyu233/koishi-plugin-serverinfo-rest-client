import type { CommandExecutionResponse } from '../api/types'
import { runWithWaitingHint, withQuote } from '../feedback'
import { hasPermission } from '../permissions'
import { aliasCommand, COMMAND_NAMES, commandDescription, primaryCommand } from './command-names'
import type { CommandRegistrationContext } from './types'
import { formatErrorForLog, logInfo } from '../logger'

export function registerExecuteCommand({
  ctx,
  config,
  apiClient,
  prefix,
}: CommandRegistrationContext) {
  const executeCommand = primaryCommand(prefix, COMMAND_NAMES.executeCommand)
  ctx.command(
    `${executeCommand} <command:text>`,
    commandDescription(COMMAND_NAMES.executeCommand, '执行 BDS 管理命令'),
  )
    .alias(aliasCommand(prefix, COMMAND_NAMES.executeCommand))
    .action(async ({ session }, rawCommand) => {
      if (!hasPermission(session, config.commandExecutionAdminList)) {
        return withQuote(session, config, '你不在执行命令权限名单中')
      }
      const command = String(rawCommand || '').trim().replace(/^\//, '')
      if (!command) return withQuote(session, config, `请提供命令，例如：${executeCommand} list`)
      if (!config.adminToken) return withQuote(session, config, '尚未配置管理 API 令牌，无法执行命令')
      return runWithWaitingHint(ctx, session, config, async () => {
        try {
          const data = await apiClient.post<CommandExecutionResponse>('/admin/command', {
            command,
            requester: `${session.platform}:${session.userId}`,
          }, { admin: true })
          const text = `${data.success ? '执行成功' : '执行失败'}：${data.command}\n${data.output || '服务器没有返回输出'}`
          return withQuote(session, config, text)
        } catch (error) {
          logInfo(ctx, config, '[ERROR] 执行管理命令失败', formatErrorForLog(error))
          return withQuote(session, config, `执行命令失败：${error instanceof Error ? error.message : String(error)}`)
        }
      })
    })
}
