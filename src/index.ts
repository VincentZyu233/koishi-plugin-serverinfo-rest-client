import { Context, h } from 'koishi'
import { } from 'koishi-plugin-to-image-service'
import { } from 'koishi-plugin-w-node'
import { Config, OutputMode } from './config'
import { registerHealthCommand } from './commands/health'
import { registerStatusCommand } from './commands/status'
import { registerServerCommand } from './commands/server'
import { registerPlayersCommand } from './commands/players'
import { registerPlayersCountCommand } from './commands/players-count'
import { registerPlayersNamesCommand } from './commands/players-names'
import { registerPlayerCommand } from './commands/player'
import path from 'node:path'
import fs from 'node:fs'

export const name = 'serverinfo-rest-client'

export const inject = {
  required: [],
  optional: ['toImageService', 'node'],
}

export { Config }

export const usage = `
## 🎮 Minecraft BDS 服务器信息查询插件

对接 serverinfo-rest-js 服务端，查询 Minecraft BDS 服务器信息。

### ⚠️ 前置依赖

可选依赖（用于 Typst 图片渲染）：

- **to-image-service + w-node** - Typst 图片渲染

### 🎯 功能特性

- 🔍 查询服务器健康状态
- 📊 查询服务器状态和详细信息
- 👥 查询在线玩家列表
- 📝 支持 文字 / Typst 图片 两种输出模式

### 📝 指令列表

| 指令 | 说明 |
| --- | --- |
| \`mcinfo.health\` | 健康检查 |
| \`mcinfo.status\` | 服务器状态 |
| \`mcinfo.server\` | 服务器详细信息 |
| \`mcinfo.players\` | 玩家列表 |
| \`mcinfo.players-count\` | 玩家数量 |
| \`mcinfo.players-names\` | 玩家名列表 |
| \`mcinfo.player <name>\` | 查询指定玩家 |

### 🎛️ 通用选项

所有指令都支持 \`--mode\` 参数来指定输出模式：

- \`--mode text\` - 文字输出
- \`--mode image\` - Typst 图片输出
`

// ==================== API 客户端 ====================

export interface ApiClient {
  get<T>(endpoint: string, params?: Record<string, string>): Promise<T>
  getBaseUrl(): string
  getApiBase(): string
}

export function createApiClient(cfg: Config, logger: any): ApiClient {
  const baseUrl = `http://${cfg.serverIp}:${cfg.serverPort}`
  const apiBase = `${baseUrl}${cfg.apiPrefix}`

  function buildUrl(endpoint: string, params?: Record<string, string>): string {
    const allParams: Record<string, string> = { ...params }
    if (cfg.token) {
      allParams.token = cfg.token
    }
    const queryString = Object.entries(allParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    return queryString ? `${endpoint}?${queryString}` : endpoint
  }

  async function get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = buildUrl(`${apiBase}${endpoint}`, params)
    logger.debug(`[API] GET ${url}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), cfg.timeout)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'koishi-plugin-serverinfo-rest-client/1.0',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      logger.debug(`[API] Response:`, JSON.stringify(data).substring(0, 200))
      return data as T
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${cfg.timeout}ms)`)
      }
      throw error
    }
  }

  return {
    get,
    getBaseUrl: () => baseUrl,
    getApiBase: () => apiBase,
  }
}

// ==================== Typst 渲染器 ====================

import type { NodeCompiler, NodeAddFontBlobs } from '@myriaddreamin/typst-ts-node-compiler'
import type { Font, FontFormat } from 'koishi-plugin-to-image-service'

export interface TypstTheme {
  fontFamily: string
  pageBg: string
  textColor: string
  headerFill: string
  headerStroke: string
  headerText: string
  panelFill: string
  panelStroke: string
  sectionTitle: string
  statsText: string
}

function toTypstColor(value: string | undefined, fallback: string): string {
  const v = (value || '').trim()
  if (!v) return `rgb("${fallback}")`
  if (v.startsWith('#')) return `rgb("${v}")`
  const rgbMatch = v.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
  if (rgbMatch) return `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})`
  return `rgb("${fallback}")`
}

export function buildTypstTheme(cfg: Config): TypstTheme {
  return {
    fontFamily: cfg.typstFontFamily || 'LXGW WenKai Mono',
    pageBg: toTypstColor(cfg.typstPageBgColor, '#f9efe2'),
    textColor: toTypstColor(cfg.typstTextColor, '#2f2f35'),
    headerFill: toTypstColor(cfg.typstHeaderFillColor, '#5dade2'),
    headerStroke: toTypstColor(cfg.typstHeaderStrokeColor, '#3498db'),
    headerText: toTypstColor(cfg.typstHeaderTextColor, '#ffffff'),
    panelFill: toTypstColor(cfg.typstPanelFillColor, '#fffbf8'),
    panelStroke: toTypstColor(cfg.typstPanelStrokeColor, '#f3efe5'),
    sectionTitle: toTypstColor(cfg.typstSectionTitleColor, '#2980b9'),
    statsText: toTypstColor(cfg.typstStatsTextColor, '#8788a5'),
  }
}

export function escapeTypstText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/@/g, '\\@')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
}

export class TypstRenderer {
  private typst: typeof import('@myriaddreamin/typst-ts-node-compiler') | null = null
  private compiler: NodeCompiler | null = null
  private lastFonts: Font[] = []
  private readonly fontFormats: FontFormat[] = ['ttf', 'otf']
  private readonly typstModuleName = '@myriaddreamin/typst-ts-node-compiler'
  private readonly workspaceDir = path.resolve(__dirname, '..')
  private initialized = false

  constructor(
    private ctx: Context,
    private logger: any,
    private cfg: Config,
  ) {}

  async init(): Promise<void> {
    if (!this.ctx.node) {
      throw new Error('w-node 服务未启用，无法使用 Typst 渲染')
    }
    if (!this.ctx.toImageService) {
      throw new Error('to-image-service 服务未启用，无法使用 Typst 渲染')
    }

    const maxWaitMs = 10000
    const intervalMs = 200
    let waited = 0
    while (!this.ctx.toImageService?.svgToImage?.resvg && waited < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      waited += intervalMs
    }
    if (!this.ctx.toImageService?.svgToImage?.resvg) {
      throw new Error(`to-image-service 的 svgToImage.resvg 在 ${maxWaitMs}ms 内未就绪`)
    }

    this.typst = await this.ctx.node.safeImport(this.typstModuleName)
    this.logger.info('Typst 模块加载成功')
    this.initialized = true
  }

  isReady(): boolean {
    return this.initialized && !!this.typst
  }

  private getCompiler(): NodeCompiler {
    if (!this.typst) {
      throw new Error('Typst 模块未初始化，请先调用 init()')
    }

    const fonts = this.ctx.toImageService.fontManagement.getFonts(this.fontFormats)

    const customFontPath = this.cfg.typstFontPath
    if (customFontPath && fs.existsSync(customFontPath)) {
      try {
        const customFontBuffer = fs.readFileSync(customFontPath)
        fonts.push({
          name: path.basename(customFontPath),
          filePath: customFontPath,
          data: customFontBuffer,
          format: customFontPath.endsWith('.otf') ? 'otf' : 'ttf'
        })
      } catch (err) {
        this.logger.warn(`加载自定义字体失败: ${customFontPath}, 错误: ${err}`)
      }
    }

    if (
      !this.compiler ||
      fonts.length !== this.lastFonts.length ||
      (fonts.length > 0 && fonts.some(f => !this.lastFonts.some(lf => lf.data === f.data)))
    ) {
      this.compiler = this.typst.NodeCompiler.create({
        fontArgs: fonts.map(font => ({
          fontBlobs: [font.data],
        }) as NodeAddFontBlobs),
        workspace: this.workspaceDir,
      })
      this.lastFonts = fonts
    }

    return this.compiler
  }

  private fixSvgForResvg(svg: string): string {
    let fixed = svg.replace(
      /\.outline_glyph\s+path,\s*\npath\.outline_glyph\s*{\s*\n\s*fill:\s*var\(--glyph_fill\);\s*\n\s*stroke:\s*var\(--glyph_stroke\);\s*\n}/g,
      ''
    )
    fixed = fixed.replace(/\.outline_glyph[^}]*fill:\s*var\(--glyph_fill\)[^}]*}/g, '')
    fixed = fixed.replace(/\.outline_glyph[^}]*transition[^}]*}/g, '')
    fixed = fixed.replace(/\.hover\s+\.typst-text\s*{[^}]*}/g, '')
    return fixed
  }

  private toSvg(content: string): string {
    const compiler = this.getCompiler()
    try {
      let result = compiler.svg({ mainFileContent: content })
      result = this.fixSvgForResvg(result)
      return result
    } finally {
      compiler.evictCache(10)
    }
  }

  async toPng(content: string, scale: number = 2.33): Promise<Buffer> {
    const svg = this.toSvg(content)
    
    if (!this.ctx.toImageService?.svgToImage?.resvg) {
      throw new Error('toImageService.svgToImage.resvg 尚未就绪')
    }
    
    const result = await this.ctx.toImageService.svgToImage.resvg(svg, {
      options: {
        fitTo: { mode: 'zoom', value: scale },
      },
    })
    return Buffer.from(result)
  }
}

let sharedRenderer: TypstRenderer | null = null

export async function getTypstRenderer(ctx: Context, cfg: Config, logger: any): Promise<TypstRenderer> {
  if (!sharedRenderer) {
    sharedRenderer = new TypstRenderer(ctx, logger, cfg)
  }
  if (!sharedRenderer.isReady()) {
    await sharedRenderer.init()
  }
  return sharedRenderer
}

// ==================== 工具函数 ====================

export function resolveOutputModes(modeArg: string | undefined, cfg: Config): OutputMode[] {
  if (modeArg) {
    if (modeArg === 'text') return ['text']
    if (modeArg === 'image') return ['typst-image']
  }
  return cfg.defaultOutputModes
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ==================== 插件入口 ====================

export function apply(ctx: Context, cfg: Config) {
  const logger = ctx.logger(name)
  const apiClient = createApiClient(cfg, logger)

  logger.info(`服务器地址: ${apiClient.getBaseUrl()}`)
  logger.info(`API 地址: ${apiClient.getApiBase()}`)

  // 注册主指令
  ctx.command('mcinfo', 'Minecraft BDS 服务器信息查询')
    .action(async ({ session }) => {
      return h.text(`🎮 Minecraft BDS 服务器信息查询

使用以下子指令查询服务器信息：
• mcinfo.health - 健康检查
• mcinfo.status - 服务器状态
• mcinfo.server - 服务器详细信息
• mcinfo.players - 玩家列表
• mcinfo.players-count - 玩家数量
• mcinfo.players-names - 玩家名列表
• mcinfo.player「玩家名」- 查询指定玩家

所有指令支持 --mode (text/image) 参数指定输出模式`)
    })

  // 注册子指令
  registerHealthCommand(ctx, cfg, apiClient, logger)
  registerStatusCommand(ctx, cfg, apiClient, logger)
  registerServerCommand(ctx, cfg, apiClient, logger)
  registerPlayersCommand(ctx, cfg, apiClient, logger)
  registerPlayersCountCommand(ctx, cfg, apiClient, logger)
  registerPlayersNamesCommand(ctx, cfg, apiClient, logger)
  registerPlayerCommand(ctx, cfg, apiClient, logger)
}
