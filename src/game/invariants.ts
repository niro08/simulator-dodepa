import type { GameConfig } from './config'
import type { RunState } from './types'

/** Число → конечное целое (дроби вниз). Нечисло → fallback. */
export function toInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? Math.floor(n) : fallback
}

export function clamp(value: number, min: number, max: number | null): number {
  const upper = max === null ? value : Math.min(max, value)
  return Math.max(min, upper)
}

/**
 * Инварианты забега: после каждой команды и при загрузке сейва (B-07, B-09).
 * Целые числа; money, debt ≥ 0; energy ∈ [0, energyMax]; reputation ∈ [min, max]; bet ≥ minBet.
 */
export function applyInvariants(state: RunState, config: GameConfig): RunState {
  const { limits, start } = config.balance
  return {
    ...state,
    money: Math.max(0, toInt(state.money, start.money)),
    energy: clamp(toInt(state.energy, start.energy), 0, limits.energyMax),
    reputation: clamp(toInt(state.reputation, start.reputation), limits.reputationMin, limits.reputationMax),
    debt: Math.max(0, toInt(state.debt, start.debt)),
    bet: Math.max(limits.minBet, toInt(state.bet, start.bet))
  }
}
