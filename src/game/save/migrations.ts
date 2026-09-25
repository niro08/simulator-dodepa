import type { SaveEnv } from './schema'
import { CURRENT_SAVE_VERSION, createDefaultProfile, createDefaultSettings } from './schema'

type Json = Record<string, unknown>
/** Миграция с версии N на N+1. Может возвращать «сырые» значения — их чинит validate. */
type Migration = (data: Json, env: SaveEnv) => Json

/**
 * v0 (legacy, ключ `dodepaSave`, eb138e2): плоский { money, energy, reputation, debt, bet, logs: string[] }.
 * → v1: забег в `run`, строки хроники как события legacyText, пустой профиль.
 * Статистика legacy-игрока начинается с нуля.
 */
function migrateV0toV1(data: Json, env: SaveEnv): Json {
  const logs = Array.isArray(data.logs) ? data.logs.filter((x) => typeof x === 'string' && x.trim() !== '') : []
  return {
    version: 1,
    savedAt: env.now,
    build: 'legacy',
    run: {
      id: `run-legacy-${env.now.toString(36)}`,
      startedAt: env.now,
      money: data.money,
      energy: data.energy,
      reputation: data.reputation,
      debt: data.debt,
      bet: data.bet,
      rngState: env.seed,
      flags: {},
      stats: {},
      // Новые записи — в начале, поэтому id убывают к концу.
      log: logs.map((text, i) => ({ id: logs.length - i, t: env.now, event: { type: 'legacyText', text } })),
      nextLogId: logs.length + 1
    },
    profile: createDefaultProfile(),
    settings: createDefaultSettings()
  }
}

/** Ключ — версия, С которой мигрируем. */
export const MIGRATIONS: Record<number, Migration> = {
  0: migrateV0toV1
}

/** Версия сырого сейва: нет поля version → legacy v0. */
export function detectVersion(data: Json): number {
  const v = data.version
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0
}

/** Последовательно применяет миграции до CURRENT_SAVE_VERSION. Для версий из будущего не делает ничего. */
export function migrate(data: Json, env: SaveEnv): Json {
  let current = data
  let version = detectVersion(current)
  while (version < CURRENT_SAVE_VERSION) {
    const step = MIGRATIONS[version]
    if (!step) throw new Error(`Нет миграции сейва с версии ${version}`)
    current = step(current, env)
    const next = detectVersion(current)
    if (next <= version) throw new Error(`Миграция ${version} не повысила версию сейва`)
    version = next
  }
  return current
}
