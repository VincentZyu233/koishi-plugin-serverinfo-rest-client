import { describe, expect, it, vi } from 'vitest'
import { applyTemplateConsole } from '../src/console'

describe('Typst preview console integration', () => {
  it('registers unrestricted preview RPCs and exposes every reusable instance', async () => {
    const listeners = new Map<string, { callback: Function, config: { authority: number } }>()
    const consoleService = {
      addListener: vi.fn((name: string, callback: Function, config: { authority: number }) => {
        listeners.set(name, { callback, config })
      }),
      addEntry: vi.fn(),
    }
    const root = {
      baseDir: 'G:\\koishi',
      inject: vi.fn((_services: string[], callback: Function) => callback({ console: consoleService })),
    } as any
    const createContext = () => ({
      root,
      logger: { info: vi.fn() },
      on: vi.fn(),
    }) as any
    const first = {
      instanceKey: 'mcinfo1-11111111',
      summary: { instanceKey: 'mcinfo1-11111111', commandPrefix: 'mcinfo1', serverLabel: '一服' },
      getStatus: vi.fn().mockResolvedValue({ instanceKey: 'mcinfo1-11111111' }),
      generate: vi.fn().mockResolvedValue({ mode: 'dryrun' }),
      readImage: vi.fn().mockResolvedValue({
        absolutePath: 'G:\\koishi\\preview.png',
        fileName: 'preview.png',
        data: Buffer.from('png'),
      }),
    } as any
    const second = {
      instanceKey: 'mcinfo2-22222222',
      summary: { instanceKey: 'mcinfo2-22222222', commandPrefix: 'mcinfo2', serverLabel: '二服' },
      getStatus: vi.fn(),
      generate: vi.fn(),
      readImage: vi.fn(),
    } as any
    const config = {
      typstTemplateFolderRelativePath: ['runtime', 'templates'],
      verboseConsoleLog: false,
    } as any

    applyTemplateConsole(createContext(), config, vi.fn(), first)
    applyTemplateConsole(createContext(), config, vi.fn(), second)

    const previewEvents = [
      'll-serverinfo-rest-client/previews/instances',
      'll-serverinfo-rest-client/previews/status',
      'll-serverinfo-rest-client/previews/generate',
      'll-serverinfo-rest-client/previews/image',
    ]
    expect(previewEvents.map(name => listeners.get(name)?.config.authority)).toEqual([0, 0, 0, 0])

    const instances = await listeners.get(previewEvents[0])!.callback()
    expect(instances).toEqual([first.summary, second.summary])
    await expect(listeners.get(previewEvents[1])!.callback(first.instanceKey))
      .resolves.toEqual({ instanceKey: first.instanceKey })
    await expect(listeners.get(previewEvents[2])!.callback(first.instanceKey, 'dryrun'))
      .resolves.toEqual({ mode: 'dryrun' })
    expect(first.generate).toHaveBeenCalledWith('dryrun')

    const image = await listeners.get(previewEvents[3])!.callback(first.instanceKey, 'dryrun', 'serverInfo')
    expect(image).toEqual({
      absolutePath: 'G:\\koishi\\preview.png',
      fileName: 'preview.png',
      dataUrl: `data:image/png;base64,${Buffer.from('png').toString('base64')}`,
    })
    expect(first.readImage).toHaveBeenCalledWith('dryrun', 'serverInfo')
  })
})
