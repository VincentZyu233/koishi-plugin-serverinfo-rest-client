import { createHash, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { TYPST_PREVIEW_OUTPUT_PARTS } from '../config'
import type { TypstPreviewMode } from './types'

export function createTypstPreviewInstanceKey(commandPrefix: string): string {
  const source = String(commandPrefix || 'server')
  const readable = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'server'
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 8)
  return `${readable}-${digest}`
}

export function resolvePreviewRoot(
  baseDir: string,
  configuredParts: readonly string[] | undefined,
  instanceKey: string,
): string {
  const root = path.resolve(baseDir)
  const parts = (configuredParts?.length ? configuredParts : TYPST_PREVIEW_OUTPUT_PARTS)
    .map(part => String(part).trim())
    .filter(Boolean)
  for (const part of parts) {
    const isAbsolute = path.posix.isAbsolute(part) || path.win32.isAbsolute(part)
    const isSingleSegment = path.posix.basename(part) === part && path.win32.basename(part) === part
    if (part === '.' || part === '..' || isAbsolute || !isSingleSegment) {
      throw new Error(`非法的 Typst 预览路径片段: ${part}`)
    }
  }
  const target = path.resolve(root, ...parts, instanceKey)
  const relative = path.relative(root, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Typst 预览目录必须位于 Koishi 根目录内: ${target}`)
  }
  return target
}

export async function replaceDirectory(stagingDirectory: string, outputDirectory: string): Promise<void> {
  await mkdir(path.dirname(outputDirectory), { recursive: true })
  const previousDirectory = `${outputDirectory}.previous-${randomUUID()}`
  let movedPrevious = false
  try {
    if (existsSync(outputDirectory)) {
      await rename(outputDirectory, previousDirectory)
      movedPrevious = true
    }
    await rename(stagingDirectory, outputDirectory)
    if (movedPrevious) await rm(previousDirectory, { recursive: true, force: true }).catch(() => {})
  } catch (error) {
    if (!existsSync(outputDirectory) && movedPrevious && existsSync(previousDirectory)) {
      await rename(previousDirectory, outputDirectory)
    }
    throw error
  }
}

export function assertPreviewMode(mode: string): asserts mode is TypstPreviewMode {
  if (mode !== 'live' && mode !== 'dryrun') {
    throw new Error(`不支持的 Typst 预览模式: ${mode}`)
  }
}

export function readPngDimensions(image: Buffer): { width: number, height: number } {
  const signature = image.subarray(0, 8).toString('hex')
  if (image.length < 24 || signature !== '89504e470d0a1a0a') {
    throw new Error('Typst 预览渲染结果不是有效的 PNG 图片')
  }
  const width = image.readUInt32BE(16)
  const height = image.readUInt32BE(20)
  if (width < 1 || height < 1) throw new Error('Typst 预览 PNG 尺寸无效')
  return { width, height }
}
