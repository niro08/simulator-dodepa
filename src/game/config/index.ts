import type { SleepEventDef } from '../types'
import { BALANCE_V1, STATS_BALANCE, type BalanceV1, type StatsBalance } from './balance'
import { SLOT_V1, type SlotConfigV1 } from './slot'

export * from './balance'
export * from './slot'

/**
 * Полный конфиг игры. Передаётся в ядро через ctx.config, в тестах подменяется.
 * Новые секции (achievements, cosmetics…) добавляются сюда полями.
 */
export interface GameConfig {
  balance: BalanceV1
  slot: SlotConfigV1
  stats: StatsBalance
  /** Пул событий сна (система — day.ts; контент — CD-12, src/game/content/events.ts). */
  events: { pool: readonly SleepEventDef[] }
}

export const defaultConfig: GameConfig = {
  balance: BALANCE_V1,
  slot: SLOT_V1,
  stats: STATS_BALANCE,
  // Пусто до CD-12: только бытовые карточки без остального пула делают честный ран слишком дорогим
  // (economy-v1 §9: баланс посчитан на полном пуле из 29 карточек). См. content/events.ts.
  events: { pool: [] }
}
