import { SLEEP_EVENTS } from '../content/events'
import type { SleepEventDef } from '../types'
import { ACHIEVEMENTS, type AchievementDef } from './achievements'
import { BALANCE_V1, EVENTS_BALANCE, STATS_BALANCE, type BalanceV1, type StatsBalance } from './balance'
import { COSMETICS, type CosmeticsCatalog } from './cosmetics'
import { SLOT_V1, type SlotConfigV1 } from './slot'

export * from './balance'
export * from './slot'
export * from './achievements'
export * from './cosmetics'

export type EventsBalance = typeof EVENTS_BALANCE

/**
 * Полный конфиг игры. Передаётся в ядро через ctx.config, в тестах подменяется.
 * Новые секции (achievements, cosmetics…) добавляются сюда полями.
 */
export interface GameConfig {
  balance: BalanceV1
  slot: SlotConfigV1
  stats: StatsBalance
  /**
   * Пул событий сна (система — day.ts; контент — CD-12, src/game/content/events.ts).
   * balance — числа механик, которые считаются при выборе (фриспины, кэшбэк, продажа вещи…).
   */
  events: { pool: readonly SleepEventDef[]; balance: EventsBalance }
  /** Достижения (CD-13, systems-spec §4). */
  achievements: readonly AchievementDef[]
  /** Каталог косметики (CD-19 логика, systems-spec §5). */
  cosmetics: CosmeticsCatalog
}

export const defaultConfig: GameConfig = {
  balance: BALANCE_V1,
  slot: SLOT_V1,
  stats: STATS_BALANCE,
  // Полный пул CD-12: 26 карточек content-pack + 3 бытовые (economy-v1 §9, «Изменения после CD-12»)
  events: { pool: SLEEP_EVENTS, balance: EVENTS_BALANCE },
  achievements: ACHIEVEMENTS,
  cosmetics: COSMETICS
}

/** Конфиг без событий сна — для детерминированных тестов и сверки с эталонным симулятором. */
export const noEventsConfig: GameConfig = { ...defaultConfig, events: { ...defaultConfig.events, pool: [] } }
