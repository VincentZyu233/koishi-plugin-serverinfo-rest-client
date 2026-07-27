import { describe, expect, it, vi } from 'vitest'
import {
  aliasCommand,
  COMMAND_NAMES,
  commandUsage,
  PLAYER_ACTIVITY_ADDITIONAL_ALIASES,
  primaryCommand,
  registerCommands,
  resolveCommandScope,
} from '../src/commands'

function collectRegistrations(commandPrefix: string, useCommandPrefix = true, enablePreview = false) {
  const registrations: Array<{
    declaration: string
    primary: string
    description: string
    aliases: string[]
    authority?: number
    options: Array<[string, string]>
    action?: Function
  }> = []
  const ctx = {
    logger: { info: vi.fn() },
    command: vi.fn((declaration: string, description: string, commandConfig?: { authority?: number }) => {
      const registration = {
        declaration,
        primary: declaration.split(' ')[0],
        description,
        aliases: [] as string[],
        authority: commandConfig?.authority,
        options: [] as Array<[string, string]>,
      }
      registrations.push(registration)
      const chain: any = {
        alias: vi.fn((name: string) => {
          registration.aliases.push(name)
          return chain
        }),
        option: vi.fn((name: string, syntax: string) => {
          registration.options.push([name, syntax])
          return chain
        }),
        action: vi.fn((handler: Function) => {
          registration.action = handler
          return chain
        }),
      }
      return chain
    }),
  } as any
  const scope = resolveCommandScope(commandPrefix, useCommandPrefix)
  registerCommands({
    ctx,
    config: {
      whitelistBindingAuthority: 1,
      enableQuote: false,
      enableWaitingHint: true,
      enableAllTypstImagePreviewCommand: enablePreview,
    } as any,
    apiClient: {} as any,
    rootCommand: scope.rootCommand,
    prefix: scope.featurePrefix,
    label: '测试服务器',
    typstPreviewGenerator: { generate: vi.fn() } as any,
  })
  return { registrations, scope }
}

describe('command registration', () => {
  it('registers the root command and every feature through the production entry', () => {
    const { registrations } = collectRegistrations('mcinfo1')
    const [root, ...features] = registrations
    const alwaysRegistered = Object.values(COMMAND_NAMES)
      .filter(command => command !== COMMAND_NAMES.allTypstImagePreview)
    const expected = alwaysRegistered.map(command => ({
      primary: primaryCommand('mcinfo1', command),
      aliases: [
        aliasCommand('mcinfo1', command),
        ...(command === COMMAND_NAMES.playerActivity
          ? PLAYER_ACTIVITY_ADDITIONAL_ALIASES.map(alias => aliasCommand('mcinfo1', alias))
          : []),
      ],
    }))

    expect(root).toMatchObject({ primary: 'mcinfo1', aliases: [] })
    const send = vi.fn()
    const help = root.action!({ session: { send } })
    expect(help.attrs.content).toContain('mcinfo1.健康检查 (health-check)')
    expect(help.attrs.content).toContain('mcinfo1.玩家在线详情 <玩家名> (player-details)')
    expect(help.attrs.content).toContain('mcinfo1.在线图 [yyyyMMdd] [--mode text|image] [--dryrun] (online-chart)')
    expect(send).not.toHaveBeenCalled()
    expect(features.map(({ primary, aliases }) => ({ primary, aliases }))).toEqual(expected)
    expect(new Set(expected.map(({ primary }) => primary)).size).toBe(expected.length)
    const allAliases = expected.flatMap(({ aliases }) => aliases)
    expect(new Set(allAliases).size).toBe(allAliases.length)
    alwaysRegistered.forEach((command, index) => {
      expect(features[index].description).toContain(`（alias：${command.alias}）`)
      expect(features[index].description).toContain(command.emoji)
      expect(command.alias).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)+$/)
    })
    expect(commandUsage('mcinfo1', COMMAND_NAMES.playerDetails, '<玩家名>'))
      .toBe('mcinfo1.玩家在线详情 <玩家名> (player-details)')
    expect(aliasCommand('mcinfo1', COMMAND_NAMES.serverStatus)).toBe('mcinfo1.server-status')
  })

  it('keeps the configured root while registering top-level feature commands', () => {
    const { registrations, scope } = collectRegistrations('mcinfo2', false)
    const [root, ...features] = registrations
    const expected = Object.values(COMMAND_NAMES)
      .filter(command => command !== COMMAND_NAMES.allTypstImagePreview)
      .map(command => ({
      primary: primaryCommand('', command),
      aliases: [
        aliasCommand('', command),
        ...(command === COMMAND_NAMES.playerActivity
          ? PLAYER_ACTIVITY_ADDITIONAL_ALIASES.map(alias => aliasCommand('', alias))
          : []),
      ],
    }))

    expect(scope).toEqual({ rootCommand: 'mcinfo2', featurePrefix: '' })
    expect(root).toMatchObject({ primary: 'mcinfo2', aliases: [] })
    expect(features.map(({ primary, aliases }) => ({ primary, aliases }))).toEqual(expected)
    expect(features.every(({ primary, aliases }) => (
      !primary.startsWith('mcinfo2.') && aliases.every(alias => !alias.startsWith('mcinfo2.'))
    ))).toBe(true)
    expect(commandUsage('', COMMAND_NAMES.playerDetails, '<玩家名>'))
      .toBe('玩家在线详情 <玩家名> (player-details)')
    expect(aliasCommand('', COMMAND_NAMES.serverStatus)).toBe('server-status')
  })

  it('falls back to mcinfo1 for an empty root command and keeps prefixes enabled by default', () => {
    expect(resolveCommandScope('', undefined)).toEqual({
      rootCommand: 'mcinfo1',
      featurePrefix: 'mcinfo1',
    })
  })

  it('registers the authority 4 preview command only when explicitly enabled', () => {
    const disabled = collectRegistrations('mcinfo1', true, false)
    expect(disabled.registrations.some(item => item.primary === 'mcinfo1.所有Typst图片预览')).toBe(false)
    expect(disabled.registrations[0].action!({ session: {} }).attrs.content)
      .not.toContain('所有Typst图片预览')

    const enabled = collectRegistrations('mcinfo1', true, true)
    const preview = enabled.registrations.find(item => item.primary === 'mcinfo1.所有Typst图片预览')
    expect(preview).toMatchObject({
      aliases: ['mcinfo1.all-typst-image-preview'],
      authority: 4,
      options: [[
        'dryrun',
        '-d, --dryrun, --dry-run 使用内置演示数据，不请求服务端 API',
      ]],
    })
    expect(enabled.registrations[0].action!({ session: {} }).attrs.content)
      .toContain('mcinfo1.所有Typst图片预览 [--dryrun] (all-typst-image-preview)')
  })
})
