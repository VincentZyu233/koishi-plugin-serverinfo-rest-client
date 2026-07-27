import type { TypstTemplateName } from '../template'

export type TypstPreviewMode = 'live' | 'dryrun'
export type TypstPreviewItemStatus = 'success' | 'skipped' | 'error'

export interface TypstPreviewDefinition {
  id: TypstTemplateName
  primary: string
  alias: string
  fileName: string
}

export interface TypstPreviewItemMetadata extends TypstPreviewDefinition {
  status: TypstPreviewItemStatus
  absolutePath: string | null
  mimeType: 'image/png' | null
  sizeBytes: number | null
  width: number | null
  height: number | null
  sha256: string | null
  selectedPlayer?: string
  message?: string
}

export interface TypstPreviewMetadata {
  schemaVersion: 1
  instanceKey: string
  commandPrefix: string
  serverLabel: string
  mode: TypstPreviewMode
  generatedAt: string
  outputDirectory: string
  summary: {
    total: number
    success: number
    skipped: number
    error: number
  }
  items: TypstPreviewItemMetadata[]
}

export interface TypstPreviewInstanceSummary {
  instanceKey: string
  commandPrefix: string
  serverLabel: string
}

export interface TypstPreviewInstanceStatus extends TypstPreviewInstanceSummary {
  rootDirectory: string
  busy: boolean
  activeMode: TypstPreviewMode | null
  modes: Record<TypstPreviewMode, TypstPreviewMetadata | null>
}

export interface TypstPreviewImage {
  absolutePath: string
  fileName: string
  data: Buffer
}
