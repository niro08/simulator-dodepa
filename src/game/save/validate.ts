import { applyInvariants, toInt } from '../invariants'
import type { GameEvent, GameEventType, LogEntry, PlayerStats, Profile, RunState, Settings } from '../types'
import type { SaveEnv, SaveFile } from './schema'
import { CURRENT_SAVE_VERSION, createDefaultProfile, createDefaultSettings } from './schema'

/**
 * Валидация сейва на ручных guard'ах (ADR-008): невалидное поле → дефолт, а не сброс всего сейва.
 * Защита от поломок, а не от читеров (R-07).
 */

type Json = Record<string, unknown>

export function isRecord(x: unknown): x is Json {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function num(x: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function str(x: unknown, fallback: string): string {
  return typeof x === 'string' ? x : fallback
}

function bool(x: unknown, fallback: boolean): boolean {
  return typeof x === 'boolean' ? x : fallback
}

function numberMap(x: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isRecord(x)) return out
  for (const [key, value] of Object.entries(x)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

function boolMap(x: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (!isRecord(x)) return out
  for (const [key, value] of Object.entries(x)) {
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

/** Все типы событий; `satisfies` заставит дописать сюда новый тип (иначе он отфильтруется при загрузке). */
const EVENT_TYPES = {
  runStarted: true,
  spin: true,
  job: true,
  shady: true,
  borrow: true,
  help: true,
  credit: true,
  repay: true,
  betChanged: true,
  rejected: true,
  legacyText: true
} as const satisfies Record<GameEventType, true>

function isEvent(x: unknown): x is GameEvent {
  return isRecord(x) && typeof x.type === 'string' && x.type in EVENT_TYPES
}

function validateLog(x: unknown, limit: number): LogEntry[] {
  if (!Array.isArray(x)) return []
  return x
    .filter((e): e is Json => isRecord(e) && isEvent(e.event) && Number.isInteger(e.id))
    .map((e) => ({ id: e.id as number, t: num(e.t, 0), event: e.event as GameEvent }))
    .slice(0, limit)
}

export function validateRun(x: unknown, env: SaveEnv): RunState | null {
  if (!isRecord(x)) return null
  const { start, limits } = env.config.balance
  const log = validateLog(x.log, limits.logLimit)
  const maxLogId = log.reduce((m, e) => Math.max(m, e.id), 0)
  const run: RunState = {
    id: str(x.id, `run-${env.now.toString(36)}`),
    startedAt: num(x.startedAt, env.now),
    money: toInt(x.money, start.money),
    energy: toInt(x.energy, start.energy),
    reputation: toInt(x.reputation, start.reputation),
    debt: toInt(x.debt, start.debt),
    bet: toInt(x.bet, start.bet),
    rngState: toInt(x.rngState, env.seed) >>> 0,
    flags: boolMap(x.flags),
    stats: numberMap(x.stats) as PlayerStats,
    log,
    nextLogId: Math.max(toInt(x.nextLogId, 1), maxLogId + 1)
  }
  return applyInvariants(run, env.config)
}

export function validateProfile(x: unknown): Profile {
  const def = createDefaultProfile()
  if (!isRecord(x)) return def

  const achievements: Profile['achievements'] = {}
  if (isRecord(x.achievements)) {
    for (const [id, value] of Object.entries(x.achievements)) {
      if (isRecord(value)) achievements[id] = { unlockedAt: num(value.unlockedAt, 0) }
    }
  }

  const cosmetics = isRecord(x.cosmetics) ? x.cosmetics : {}
  const equipped: Record<string, string> = {}
  if (isRecord(cosmetics.equipped)) {
    for (const [slot, id] of Object.entries(cosmetics.equipped)) {
      if (typeof id === 'string') equipped[slot] = id
    }
  }
  const meta = isRecord(x.meta) ? x.meta : {}

  return {
    stats: numberMap(x.stats),
    achievements,
    cosmetics: {
      owned: Array.isArray(cosmetics.owned) ? cosmetics.owned.filter((c): c is string => typeof c === 'string') : [],
      equipped
    },
    meta: { currency: Math.floor(num(meta.currency, 0, 0)), upgrades: numberMap(meta.upgrades) }
  }
}

export function validateSettings(x: unknown): Settings {
  const def = createDefaultSettings()
  if (!isRecord(x)) return def
  return {
    locale: x.locale === 'en' || x.locale === 'ru' ? x.locale : def.locale,
    musicVolume: num(x.musicVolume, def.musicVolume, 0, 1),
    sfxVolume: num(x.sfxVolume, def.sfxVolume, 0, 1),
    reducedMotion: bool(x.reducedMotion, def.reducedMotion),
    skipSpinAnimation: bool(x.skipSpinAnimation, def.skipSpinAnimation)
  }
}

/** Приводит уже мигрированные данные к SaveFile текущей версии. */
export function validateSave(data: Json, env: SaveEnv): SaveFile {
  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: num(data.savedAt, env.now),
    build: str(data.build, ''),
    run: validateRun(data.run, env),
    profile: validateProfile(data.profile),
    settings: validateSettings(data.settings)
  }
}
