import type { Context } from 'koishi'
import type { ApiClient } from '../api/client'
import type { Config } from '../config'
import type { TypstPreviewGenerator } from '../preview'

export interface CommandRegistrationContext {
  ctx: Context
  config: Config
  apiClient: ApiClient
  rootCommand: string
  prefix: string
  label: string
  typstPreviewGenerator?: TypstPreviewGenerator
}
