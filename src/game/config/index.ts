import { BALANCE, type BalanceConfig } from './balance'
import { SLOT, type SlotConfig } from './slot'

export * from './balance'
export * from './slot'

/**
 * Полный конфиг игры. Передаётся в ядро через ctx.config, в тестах подменяется.
 * Новые секции (achievements, cosmetics, progression…) добавляются сюда полями.
 */
export interface GameConfig {
  balance: BalanceConfig
  slot: SlotConfig
}

export const defaultConfig: GameConfig = {
  balance: BALANCE,
  slot: SLOT
}
