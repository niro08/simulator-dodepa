import type { SaveEnv } from './schema'
import { CURRENT_SAVE_VERSION, createDefaultSettings } from './schema'

type Json = Record<string, unknown>
/** Миграция с версии N на N+1. Может возвращать «сырые» значения — их чинит validate. */
type Migration = (data: Json, env: SaveEnv) => Json

/**
 * v0 (legacy, ключ `dodepaSave`, eb138e2): плоский { money, energy, reputation, debt, bet, logs: string[] }.
 * → v1: забег в `run`, пустой профиль. (Дальше его всё равно заменит миграция v1 → v2.)
 */
function migrateV0toV1(data: Json, env: SaveEnv): Json {
  return {
    version: 1,
    savedAt: env.now,
    build: 'legacy',
    run: {
      money: data.money,
      energy: data.energy,
      reputation: data.reputation,
      debt: data.debt,
      bet: data.bet
    },
    profile: {},
    settings: createDefaultSettings()
  }
}

/**
 * v1 → v2: ран 28 дней (GDD) — это другая игра: кошелёк/казино, счета, дни, вещи.
 * Решение: старый забег НЕ конвертируется, а сбрасывается (run = null → в меню «Новая игра»).
 * Причины: у старого забега нет ни дня, ни счетов, ни разделения денег; перенос денег дал бы
 * старт с преимуществом (пиллар 5 «никаких бонусов между ранами»). Статистика v1 не велась (пустая).
 * Сохраняются настройки; профиль приводится к новой форме (мета-валюта и cosmetics.owned удалены,
 * lifetime-статистика переносится как есть — ключи совпадают с systems-spec §3.1).
 */
function migrateV1toV2(data: Json): Json {
  const profile = typeof data.profile === 'object' && data.profile !== null ? (data.profile as Json) : {}
  const cosmetics = typeof profile.cosmetics === 'object' && profile.cosmetics !== null ? (profile.cosmetics as Json) : {}
  return {
    version: 2,
    savedAt: data.savedAt,
    build: data.build,
    run: null,
    profile: {
      stats: profile.stats,
      achievements: profile.achievements,
      equipped: cosmetics.equipped
    },
    settings: data.settings
  }
}

/**
 * v2 → v3 (CD-12): у рана появились `eventState` (вычеты из смен, блокировка казино, долг Серёге, недельные
 * счётчики, дни залога) и `today.nearMiss/shifts`. Ран переносится как есть: новые поля заполнит validate
 * значениями «ничего не было» (карточки просто начнут срабатывать с этого момента). Профиль не меняется.
 */
function migrateV2toV3(data: Json): Json {
  return { ...data, version: 3 }
}

/** Ключ — версия, С которой мигрируем. */
export const MIGRATIONS: Record<number, Migration> = {
  0: migrateV0toV1,
  1: migrateV1toV2,
  2: migrateV2toV3
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
