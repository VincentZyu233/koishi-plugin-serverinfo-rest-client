import { mkdtemp, rm } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_FIELD_FILTERS } from '../src/config'
import { ensureTemplateAssets } from '../src/template'
import { TypstPreviewGenerator } from '../src/preview'

describe('Typst preview integration', () => {
  it('renders all dryrun payloads into real PNG files', async () => {
    const baseDir = await mkdtemp(path.join(process.env.TEMP || process.cwd(), 'll-serverinfo-preview-render-'))
    const ctx = { baseDir, logger: { info: vi.fn() }, on: vi.fn() } as any
    const config = {
      commandPrefix: 'preview-test',
      serverLabel: '测试服',
      historyPageSize: 30,
      hidePlayerCoordinates: true,
      playerFieldFilters: DEFAULT_PLAYER_FIELD_FILTERS.map(field => ({ ...field })),
      verboseConsoleLog: false,
      typstFontPath: '',
      typstEmojiFontPath: '',
      typstFontFamily: 'Arial',
      typstTemplateFolderRelativePath: ['runtime', 'templates'],
      typstRenderScale: 1,
      typstTransparentBackground: false,
      typstPageBgColor: '#f2f6f1',
      typstTextColor: '#26332b',
      typstHeaderFillColor: '#2c5e3b',
      typstHeaderStrokeColor: '#7fa973',
      typstHeaderTextColor: '#ffffff',
      typstPanelFillColor: '#ffffff',
      typstPanelStrokeColor: '#cbd9ce',
      typstSectionTitleColor: '#2c5e3b',
      typstStatsTextColor: '#66746b',
    } as any
    const apiClient = {
      get: vi.fn(() => Promise.reject(new Error('dryrun must not call API'))),
      post: vi.fn(() => Promise.reject(new Error('dryrun must not call API'))),
    } as any

    try {
      await ensureTemplateAssets(ctx, config)
      const metadata = await new TypstPreviewGenerator(ctx, config, apiClient).generate('dryrun')
      const failures = metadata.items.filter(item => item.status !== 'success')
      expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
      expect(metadata.summary).toEqual({ total: 11, success: 11, skipped: 0, error: 0 })
      expect(apiClient.get).not.toHaveBeenCalled()
      for (const item of metadata.items) {
        expect(item.mimeType, item.id).toBe('image/png')
        expect(item.sizeBytes, item.id).toBeGreaterThan(1_000)
        expect(item.width, item.id).toBeGreaterThan(0)
        expect(item.height, item.id).toBeGreaterThan(0)
        expect(item.sha256, item.id).toMatch(/^[a-f0-9]{64}$/)
        expect(item.absolutePath, item.id).toMatch(/\.png$/)
      }
    } finally {
      await rm(baseDir, { recursive: true, force: true })
    }
  }, 120_000)
})
