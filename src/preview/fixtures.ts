import type {
  OverviewResponse,
  PlayerHistoryResponse,
  PlayerResponse,
  PlayersResponse,
  PlayerStatsResponse,
} from '../api/types'
import { CLIENT_VERSION } from '../version'

export function createDryrunOverview(now: number): OverviewResponse {
  return {
    status: 'online',
    timestamp: now,
    uptimeMs: 9 * 86_400_000,
    tps: {
      realtime: 20.0,
      avg10s: 19.92,
      avg60s: 19.84,
      avg300s: 19.76,
      sampledSeconds: 3600,
    },
    players: {
      online: 4,
      max: 30,
      names: ['Steve', 'Alex', 'MauveTag7855757', 'TheSky8750'],
    },
    versions: {
      bds: '1.26.10.4',
      protocol: 944,
      levilamina: '26.10.14',
      plugin: CLIENT_VERSION,
    },
  }
}

export function createDryrunPlayers(): PlayersResponse {
  const names = ['Steve', 'Alex', 'MauveTag7855757', 'TheSky8750']
  return {
    count: names.length,
    players: names.map((name, index) => ({
      name,
      xuid: `25354000000000${index}`,
      uuid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    })),
  }
}

export function createDryrunHistory(now: number): PlayerHistoryResponse {
  const names = ['Steve', 'Alex', 'MauveTag7855757', 'TheSky8750', 'SPT1145141']
  return {
    total: names.length,
    page: 1,
    pageSize: 30,
    pageCount: 1,
    players: names.map((name, index) => ({
      name,
      xuid: `25354000000000${index}`,
      uuid: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      firstSeenMs: now - (30 - index) * 86_400_000,
      lastSeenMs: now - index * 3_600_000,
      totalPlayMs: (index + 3) * 7_200_000,
      joinCount: 18 - index,
      blocksMined: 1250 * (index + 1),
      mobsKilled: 83 * (index + 1),
      money: 1200 + index * 350,
      moneyAvailable: true,
    })),
  }
}

export function createDryrunStats(now: number): PlayerStatsResponse {
  return {
    name: 'Steve',
    xuid: '253540000000000',
    uuid: '00000000-0000-4000-8000-000000000001',
    firstSeenMs: now - 30 * 86_400_000,
    lastSeenMs: now - 15 * 60_000,
    totalPlayMs: 8 * 86_400_000 + 14 * 3_600_000 + 26 * 60_000,
    joinCount: 86,
    blocksMined: 128450,
    mobsKilled: 2380,
    money: 9850,
    moneyAvailable: true,
  }
}

export function createDryrunPlayer(now: number): PlayerResponse {
  return {
    name: 'Steve',
    xuid: '253540000000000',
    uuid: '00000000-0000-4000-8000-000000000001',
    uniqueId: 'preview-player-1',
    locale: 'zh_CN',
    permissionLevel: { value: 1, name: 'member' },
    isOperator: false,
    isSimulated: false,
    gameMode: { value: 0, name: 'survival' },
    health: 18,
    maxHealth: 20,
    speed: 0.1,
    isFlying: false,
    isSneaking: false,
    isSprinting: true,
    isMoving: true,
    isSwimming: false,
    isInLava: false,
    isOnGround: true,
    isOnFire: false,
    isSleeping: false,
    isGliding: false,
    isRiding: false,
    isInvisible: false,
    canFly: false,
    canSleep: true,
    position: { x: 128.4, y: 72.0, z: -1480.2, dimensionId: 0 },
    blockPosition: { x: 128, y: 72, z: -1481, dimensionId: 0 },
    feetPosition: { x: 128.4, y: 72.0, z: -1480.2, dimensionId: 0 },
    lastDeathPosition: { x: 102, y: 64, z: -1502, dimensionId: 0 },
    respawnPosition: { x: 12, y: 68, z: 24, dimensionId: 0 },
    rotation: { pitch: 12.5, yaw: 226.0 },
    biome: { id: 4, name: 'Plains' },
    standingOn: { typeName: 'minecraft:grass_block', descriptionId: 'tile.grass.name' },
    expNeededForNextLevel: 17,
    mainHand: { typeName: 'minecraft:diamond_pickaxe', displayName: '钻石镐', count: 1, enchanted: true },
    offHand: { typeName: 'minecraft:torch', displayName: '火把', count: 32, enchanted: false },
    armor: [],
    device: {
      platform: { value: 7, name: 'desktop' },
      inputMode: { value: 1, name: 'mouse' },
    },
    network: {
      currentPingMs: 42,
      averagePingMs: 48,
      currentPacketLoss: 0.001,
      averagePacketLoss: 0.003,
    },
    snapshotAtMs: now,
  }
}
