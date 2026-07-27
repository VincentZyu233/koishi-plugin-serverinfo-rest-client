import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Context } from 'koishi'
import type { ApiClient } from '../api/client'
import type { Config } from '../config'
import { formatErrorForLog, logInfo } from '../logger'
import { PreviewDataProvider, sanitizePreviewError, TypstPreviewSkippedError } from './data-provider'
import { TYPST_PREVIEW_DEFINITIONS } from './definitions'
import { renderPreview } from './renderer'
import {
  assertPreviewMode,
  createTypstPreviewInstanceKey,
  readPngDimensions,
  replaceDirectory,
  resolvePreviewRoot,
} from './storage'
import type {
  TypstPreviewImage,
  TypstPreviewInstanceStatus,
  TypstPreviewInstanceSummary,
  TypstPreviewItemMetadata,
  TypstPreviewMetadata,
  TypstPreviewMode,
} from './types'

export class TypstPreviewGenerator {
  readonly instanceKey: string
  readonly commandPrefix: string
  readonly serverLabel: string
  readonly rootDirectory: string
  private activeTask: Promise<TypstPreviewMetadata> | null = null
  private activeMode: TypstPreviewMode | null = null

  constructor(
    private readonly ctx: Context,
    private readonly config: Config,
    private readonly apiClient: ApiClient,
  ) {
    this.commandPrefix = config.commandPrefix || 'mcinfo1'
    this.serverLabel = config.serverLabel || '【神秘小服服】'
    this.instanceKey = createTypstPreviewInstanceKey(this.commandPrefix)
    this.rootDirectory = resolvePreviewRoot(
      ctx.baseDir,
      config.typstPreviewOutputFolderRelativePath,
      this.instanceKey,
    )
  }

  get summary(): TypstPreviewInstanceSummary {
    return {
      instanceKey: this.instanceKey,
      commandPrefix: this.commandPrefix,
      serverLabel: this.serverLabel,
    }
  }

  async getStatus(): Promise<TypstPreviewInstanceStatus> {
    const [live, dryrun] = await Promise.all([
      this.readMetadata('live'),
      this.readMetadata('dryrun'),
    ])
    return {
      ...this.summary,
      rootDirectory: this.rootDirectory,
      busy: Boolean(this.activeTask),
      activeMode: this.activeMode,
      modes: { live, dryrun },
    }
  }

  generate(mode: TypstPreviewMode): Promise<TypstPreviewMetadata> {
    if (mode !== 'live' && mode !== 'dryrun') {
      return Promise.reject(new Error(`不支持的 Typst 预览模式: ${mode}`))
    }
    if (this.activeTask) {
      return Promise.reject(new Error(`已有 ${this.activeMode} Typst 预览生成任务正在运行`))
    }
    this.activeMode = mode
    const task = this.generateInternal(mode).finally(() => {
      if (this.activeTask === task) {
        this.activeTask = null
        this.activeMode = null
      }
    })
    this.activeTask = task
    return task
  }

  async readImage(mode: TypstPreviewMode, id: string): Promise<TypstPreviewImage> {
    assertPreviewMode(mode)
    const definition = TYPST_PREVIEW_DEFINITIONS.find(entry => entry.id === id)
    if (!definition) throw new Error(`未知的 Typst 预览项: ${id}`)
    const metadata = await this.readMetadata(mode)
    const item = metadata?.items.find(entry => entry.id === id)
    if (!item || item.status !== 'success') throw new Error('该预览图片尚未成功生成')

    const outputDirectory = this.getOutputDirectory(mode)
    const expectedPath = path.join(outputDirectory, definition.fileName)
    if (path.resolve(item.absolutePath || '') !== path.resolve(expectedPath)) {
      throw new Error('预览图片元数据路径不合法')
    }
    return {
      absolutePath: expectedPath,
      fileName: definition.fileName,
      data: await readFile(expectedPath),
    }
  }

  private async generateInternal(mode: TypstPreviewMode): Promise<TypstPreviewMetadata> {
    const generatedAt = new Date().toISOString()
    const outputDirectory = this.getOutputDirectory(mode)
    const stagingDirectory = path.join(this.rootDirectory, `.${mode}-staging-${randomUUID()}`)
    const provider = new PreviewDataProvider(this.apiClient, this.config, mode)
    const items: TypstPreviewItemMetadata[] = []

    await mkdir(stagingDirectory, { recursive: true })
    logInfo(this.ctx, this.config, `开始生成 ${mode} Typst 图片预览`, `实例: ${this.instanceKey}`)
    try {
      for (const definition of TYPST_PREVIEW_DEFINITIONS) {
        try {
          const rendered = await renderPreview(
            this.ctx,
            this.config,
            this.serverLabel,
            definition.id,
            provider,
          )
          const dimensions = readPngDimensions(rendered.image)
          await writeFile(path.join(stagingDirectory, definition.fileName), rendered.image)
          items.push({
            ...definition,
            status: 'success',
            absolutePath: path.join(outputDirectory, definition.fileName),
            mimeType: 'image/png',
            sizeBytes: rendered.image.length,
            width: dimensions.width,
            height: dimensions.height,
            sha256: createHash('sha256').update(rendered.image).digest('hex'),
            ...(rendered.selectedPlayer ? { selectedPlayer: rendered.selectedPlayer } : {}),
          })
        } catch (error) {
          const skipped = error instanceof TypstPreviewSkippedError
          items.push({
            ...definition,
            status: skipped ? 'skipped' : 'error',
            absolutePath: null,
            mimeType: null,
            sizeBytes: null,
            width: null,
            height: null,
            sha256: null,
            message: sanitizePreviewError(error),
          })
          logInfo(
            this.ctx,
            this.config,
            `[${skipped ? 'WARN' : 'ERROR'}] Typst 预览生成失败: ${definition.primary}`,
            formatErrorForLog(error),
          )
        }
      }

      const metadata = createMetadata(this.summary, mode, generatedAt, outputDirectory, items)
      await writeFile(
        path.join(stagingDirectory, 'metadata.json'),
        `${JSON.stringify(metadata, null, 2)}\n`,
        'utf8',
      )
      await replaceDirectory(stagingDirectory, outputDirectory)
      logInfo(
        this.ctx,
        this.config,
        `${mode} Typst 图片预览生成完成`,
        `成功 ${metadata.summary.success}/${metadata.summary.total}，目录: ${outputDirectory}`,
      )
      return metadata
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true })
      throw error
    }
  }

  private getOutputDirectory(mode: TypstPreviewMode): string {
    return path.join(this.rootDirectory, mode)
  }

  private async readMetadata(mode: TypstPreviewMode): Promise<TypstPreviewMetadata | null> {
    const metadataPath = path.join(this.getOutputDirectory(mode), 'metadata.json')
    if (!existsSync(metadataPath)) return null
    try {
      const value = JSON.parse(await readFile(metadataPath, 'utf8')) as TypstPreviewMetadata
      if (value.schemaVersion !== 1 || value.instanceKey !== this.instanceKey || value.mode !== mode) return null
      return value
    } catch (error) {
      logInfo(this.ctx, this.config, `[WARN] Typst 预览 metadata.json 读取失败: ${mode}`, formatErrorForLog(error))
      return null
    }
  }
}

function createMetadata(
  summary: TypstPreviewInstanceSummary,
  mode: TypstPreviewMode,
  generatedAt: string,
  outputDirectory: string,
  items: TypstPreviewItemMetadata[],
): TypstPreviewMetadata {
  return {
    schemaVersion: 1,
    ...summary,
    mode,
    generatedAt,
    outputDirectory,
    summary: {
      total: items.length,
      success: items.filter(item => item.status === 'success').length,
      skipped: items.filter(item => item.status === 'skipped').length,
      error: items.filter(item => item.status === 'error').length,
    },
    items,
  }
}
