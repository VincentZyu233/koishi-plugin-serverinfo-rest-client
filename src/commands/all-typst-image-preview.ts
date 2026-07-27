import { runWithWaitingHint, withQuote } from '../feedback'
import type { TypstPreviewMetadata } from '../preview'
import { aliasCommand, COMMAND_NAMES, commandDescription, primaryCommand } from './command-names'
import type { CommandRegistrationContext } from './types'

export function registerAllTypstImagePreviewCommand({
  ctx,
  config,
  prefix,
  typstPreviewGenerator,
}: CommandRegistrationContext): void {
  if (!config.enableAllTypstImagePreviewCommand) return
  if (!typstPreviewGenerator) throw new Error('Typst 预览生成器未初始化')

  ctx.command(
    primaryCommand(prefix, COMMAND_NAMES.allTypstImagePreview),
    commandDescription(COMMAND_NAMES.allTypstImagePreview, '批量生成所有 Typst 图片预览'),
    { authority: 4 },
  )
    .alias(aliasCommand(prefix, COMMAND_NAMES.allTypstImagePreview))
    .option('dryrun', '-d, --dryrun, --dry-run 使用内置演示数据，不请求服务端 API')
    .action(async ({ session, options }) => runWithWaitingHint(ctx, session, config, async () => {
      try {
        const result = await typstPreviewGenerator.generate(options.dryrun ? 'dryrun' : 'live')
        return withQuote(session, config, formatPreviewResult(result))
      } catch (error) {
        return withQuote(
          session,
          config,
          `❌ 所有 Typst 图片预览生成失败：${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }))
}

function formatPreviewResult(result: TypstPreviewMetadata): string {
  const source = result.mode === 'dryrun' ? 'DRY RUN · 内置演示数据' : '真实服务端数据'
  const lines = [
    `🖼️ 所有 Typst 图片预览生成完成（${source}）`,
    `成功 ${result.summary.success}/${result.summary.total}，跳过 ${result.summary.skipped}，失败 ${result.summary.error}`,
    `输出目录：${result.outputDirectory}`,
  ]
  const issues = result.items.filter(item => item.status !== 'success')
  if (issues.length) {
    lines.push('', '未生成项目：')
    lines.push(...issues.map(item => `- ${item.primary}：${item.message || item.status}`))
  }
  return lines.join('\n')
}
