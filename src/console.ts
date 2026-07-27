import path from 'node:path'
import type { Context } from 'koishi'
import type {} from '@koishijs/plugin-console'
import type { Config } from './config'
import { logInfo } from './logger'
import {
  type TypstPreviewGenerator,
  type TypstPreviewInstanceStatus,
  type TypstPreviewInstanceSummary,
  type TypstPreviewMetadata,
  type TypstPreviewMode,
} from './preview'
import {
  getTemplateAssetStatus,
  listRuntimeTemplateFiles,
  restoreOfficialTemplates,
  type TemplateAssetStatus,
  type TemplateRestoreResult,
} from './template'

export interface TemplateConsoleStatus extends TemplateAssetStatus {
  files: string[]
}

export interface TypstPreviewConsoleImage {
  absolutePath: string
  fileName: string
  dataUrl: string
}

declare module '@koishijs/plugin-console' {
  interface Events {
    'll-serverinfo-rest-client/templates/status'(): Promise<TemplateConsoleStatus>
    'll-serverinfo-rest-client/templates/restore'(): Promise<TemplateRestoreResult>
    'll-serverinfo-rest-client/previews/instances'(): Promise<TypstPreviewInstanceSummary[]>
    'll-serverinfo-rest-client/previews/status'(instanceKey: string): Promise<TypstPreviewInstanceStatus>
    'll-serverinfo-rest-client/previews/generate'(
      instanceKey: string,
      mode: TypstPreviewMode,
    ): Promise<TypstPreviewMetadata>
    'll-serverinfo-rest-client/previews/image'(
      instanceKey: string,
      mode: TypstPreviewMode,
      id: string,
    ): Promise<TypstPreviewConsoleImage>
  }
}

const registeredRoots = new WeakSet<object>()
const previewGenerators = new WeakMap<object, Map<string, TypstPreviewGenerator>>()

export function applyTemplateConsole(
  ctx: Context,
  cfg: Config,
  resetTemplateCaches: () => void,
  previewGenerator: TypstPreviewGenerator,
): void {
  const root = ((ctx as Context & { root?: Context }).root || ctx) as Context
  let generators = previewGenerators.get(root)
  if (!generators) {
    generators = new Map()
    previewGenerators.set(root, generators)
  }
  generators.set(previewGenerator.instanceKey, previewGenerator)
  ctx.on('dispose', () => {
    if (generators?.get(previewGenerator.instanceKey) === previewGenerator) {
      generators.delete(previewGenerator.instanceKey)
    }
  })
  if (registeredRoots.has(root)) return
  registeredRoots.add(root)

  root.inject(['console'], (consoleCtx) => {
    consoleCtx.console.addListener('ll-serverinfo-rest-client/templates/status', async () => ({
      ...(await getTemplateAssetStatus(root.baseDir, cfg.typstTemplateFolderRelativePath)),
      files: await listRuntimeTemplateFiles(root.baseDir, cfg.typstTemplateFolderRelativePath),
    }), { authority: 1 })

    consoleCtx.console.addListener('ll-serverinfo-rest-client/templates/restore', async () => {
      const result = await restoreOfficialTemplates(root.baseDir, cfg.typstTemplateFolderRelativePath)
      resetTemplateCaches()
      logInfo(
        ctx,
        cfg,
        'Typst 默认模板已恢复',
        `备份目录: ${result.backupPath || '无（原目录不存在）'}`,
      )
      return result
    }, { authority: 4 })

    consoleCtx.console.addListener('ll-serverinfo-rest-client/previews/instances', async () => (
      [...(previewGenerators.get(root)?.values() || [])]
        .map(generator => generator.summary)
        .sort((left, right) => left.commandPrefix.localeCompare(right.commandPrefix))
    ), { authority: 0 })

    consoleCtx.console.addListener('ll-serverinfo-rest-client/previews/status', async (instanceKey) => (
      getPreviewGenerator(root, instanceKey).getStatus()
    ), { authority: 0 })

    consoleCtx.console.addListener('ll-serverinfo-rest-client/previews/generate', async (instanceKey, mode) => (
      getPreviewGenerator(root, instanceKey).generate(mode)
    ), { authority: 0 })

    consoleCtx.console.addListener('ll-serverinfo-rest-client/previews/image', async (instanceKey, mode, id) => {
      const image = await getPreviewGenerator(root, instanceKey).readImage(mode, id)
      return {
        absolutePath: image.absolutePath,
        fileName: image.fileName,
        dataUrl: `data:image/png;base64,${image.data.toString('base64')}`,
      }
    }, { authority: 0 })

    consoleCtx.console.addEntry({
      dev: path.resolve(__dirname, '../client/index.ts'),
      prod: path.resolve(__dirname, '../dist'),
    })
  })
}

function getPreviewGenerator(root: object, instanceKey: string): TypstPreviewGenerator {
  const generator = previewGenerators.get(root)?.get(String(instanceKey || ''))
  if (!generator) throw new Error('指定的 serverinfo-rest-client 实例不存在或已停用')
  return generator
}
