import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createPlayerActivityDryrunResponse, resolveActivityDate } from '../src/activity'
import {
  createTypstPreviewInstanceKey,
  TYPST_PREVIEW_DEFINITIONS,
  TypstPreviewGenerator,
} from '../src/preview'

const mocks = vi.hoisted(() => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  return {
    png,
    renderTypstTemplate: vi.fn(async () => png),
    renderPlayerActivityChartPng: vi.fn(() => png),
    getTypstFontPaths: vi.fn(() => []),
  }
})

vi.mock('../src/typst', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/typst')>(),
  renderTypstTemplate: mocks.renderTypstTemplate,
}))

vi.mock('../src/activity', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/activity')>(),
  renderPlayerActivityChartPng: mocks.renderPlayerActivityChartPng,
}))

vi.mock('../src/font', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/font')>(),
  getTypstFontPaths: mocks.getTypstFontPaths,
}))

const temporaryDirectories: string[] = []

afterEach(async () => {
  mocks.renderTypstTemplate.mockClear()
  mocks.renderPlayerActivityChartPng.mockClear()
  await Promise.all(temporaryDirectories.splice(0).map(directory => (
    rm(directory, { recursive: true, force: true })
  )))
})

async function createHarness(apiClient: any) {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), 'll-serverinfo-preview-'))
  temporaryDirectories.push(baseDir)
  const ctx = {
    baseDir,
    logger: { info: vi.fn() },
  } as any
  const config = {
    commandPrefix: 'mcinfo1',
    serverLabel: '测试服',
    historyPageSize: 30,
    hidePlayerCoordinates: true,
    playerFieldFilters: [],
    verboseConsoleLog: false,
    typstRenderScale: 2.33,
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
    typstFontFamily: 'LXGW WenKai Mono',
  } as any
  return {
    baseDir,
    generator: new TypstPreviewGenerator(ctx, config, apiClient),
  }
}

describe('TypstPreviewGenerator', () => {
  it('generates and atomically replaces all dryrun previews without API requests', async () => {
    const apiClient = {
      get: vi.fn(() => Promise.reject(new Error('dryrun must not call API'))),
      post: vi.fn(() => Promise.reject(new Error('dryrun must not call API'))),
    }
    const { generator } = await createHarness(apiClient)

    expect(generator.instanceKey).toBe(createTypstPreviewInstanceKey('mcinfo1'))
    const first = await generator.generate('dryrun')
    expect(first.summary).toEqual({ total: 11, success: 11, skipped: 0, error: 0 })
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(first.items.every(item => item.absolutePath?.startsWith(first.outputDirectory))).toBe(true)

    const expectedFiles = [
      'metadata.json',
      ...TYPST_PREVIEW_DEFINITIONS.map(item => item.fileName),
    ].sort()
    expect((await readdir(first.outputDirectory)).sort()).toEqual(expectedFiles)
    expect(expectedFiles).not.toContain('manifest.json')

    const metadata = JSON.parse(await readFile(path.join(first.outputDirectory, 'metadata.json'), 'utf8'))
    expect(metadata).toMatchObject({
      schemaVersion: 1,
      instanceKey: generator.instanceKey,
      mode: 'dryrun',
      summary: { total: 11, success: 11 },
    })
    expect(metadata.items.map((item: any) => item.fileName)).toEqual(
      TYPST_PREVIEW_DEFINITIONS.map(item => item.fileName),
    )
    expect(metadata.items[0]).toMatchObject({
      mimeType: 'image/png',
      sizeBytes: mocks.png.length,
      width: 1,
      height: 1,
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })

    const image = await generator.readImage('dryrun', 'serverInfo')
    expect(image.fileName).toBe('服务器信息-server-details.png')
    expect(image.data).toEqual(mocks.png)

    await generator.generate('dryrun')
    expect((await readdir(first.outputDirectory)).sort()).toEqual(expectedFiles)
  })

  it('skips live player detail without online players and falls back to history for stats', async () => {
    const now = Date.now()
    const activity = createPlayerActivityDryrunResponse(resolveActivityDate(undefined, now), now)
    const historicalPlayer = {
      name: 'HistoryPlayer',
      xuid: '253540000000001',
      uuid: '00000000-0000-4000-8000-000000000001',
      firstSeenMs: now - 86_400_000,
      lastSeenMs: now,
      totalPlayMs: 7_200_000,
      joinCount: 4,
      blocksMined: 120,
      mobsKilled: 8,
      money: null,
      moneyAvailable: false,
    }
    const apiClient = {
      get: vi.fn(async (endpoint: string) => {
        if (endpoint === '/health') return { status: 'healthy', timestamp: now, uptime: 1000 }
        if (endpoint === '/overview') return {
          status: 'online', timestamp: now, uptimeMs: 1000,
          tps: { realtime: 20, avg10s: 20, avg60s: 20, avg300s: 20, sampledSeconds: 60 },
          players: { online: 0, max: 30, names: [] },
          versions: { bds: '1.0', protocol: 1, levilamina: '1.0', plugin: '1.0' },
        }
        if (endpoint === '/players/history') return {
          total: 1, page: 1, pageSize: 30, pageCount: 1, players: [historicalPlayer],
        }
        if (endpoint === '/players/activity-history') return activity
        if (endpoint === '/players') return { count: 0, players: [] }
        if (endpoint === '/players/count') return { count: 0 }
        if (endpoint === '/players/names') return { count: 0, names: [] }
        if (endpoint === '/players/stats') return historicalPlayer
        if (endpoint === '/server') return {
          status: 'online', levelName: 'World', bdsVersion: '1.0', protocolVersion: 1,
          levilaminaVersion: '1.0', pluginVersion: '1.0', onlinePlayers: 0, maxPlayers: 30,
        }
        if (endpoint === '/status') return {
          status: 'online', plugin: 'serverinfo-rest', version: '1.0', playerCount: 0,
          bdsVersion: '1.0', protocolVersion: 1,
        }
        throw new Error(`unexpected endpoint: ${endpoint}`)
      }),
    }
    const { generator } = await createHarness(apiClient)

    const result = await generator.generate('live')
    expect(result.summary).toEqual({ total: 11, success: 10, skipped: 1, error: 0 })
    expect(result.items.find(item => item.id === 'playerDetail')).toMatchObject({
      status: 'skipped',
      absolutePath: null,
      mimeType: null,
      width: null,
      height: null,
      sha256: null,
      message: expect.stringContaining('没有在线玩家'),
    })
    expect(result.items.find(item => item.id === 'playerStats')).toMatchObject({
      status: 'success',
      selectedPlayer: 'HistoryPlayer',
    })
    expect(apiClient.get).toHaveBeenCalledWith('/players/stats', { name: 'HistoryPlayer' })
    expect(await readdir(result.outputDirectory)).not.toContain('玩家在线详情-player-details.png')
  })
})
