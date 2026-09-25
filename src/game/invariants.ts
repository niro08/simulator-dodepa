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
 * Инварианты рана: после каждой команды и при загрузке сейва (B-05, B-07, B-09, TD-15; GDD §3.8).
 * Целые числа; кошелёк, баланс казино, долги ≥ 0; ⚡ ∈ [0, ENERGY_PER_DAY]; 🔥 ∈ [0, 100];
 * ❤️ ∈ [REP_MIN, REP_MAX]; ставка ≥ MIN_BET; день ≥ 1.
 * «Семья ушла» проверяется в changeRep до клампа — здесь только страховка формы.
 */
export function applyInvariants(state: RunState, config: GameConfig): RunState {
  const B = config.balance
  const money = (x: unknown, fallback: number) => Math.max(0, toInt(x, fallback))
  return {
    ...state,
    day: Math.max(1, toInt(state.day, 1)),
    wallet: money(state.wallet, B.START_WALLET),
    casino: money(state.casino, 0),
    debtBank: money(state.debtBank, 0),
    debtMfo: money(state.debtMfo, 0),
    energy: clamp(toInt(state.energy, B.ENERGY_PER_DAY), 0, B.ENERGY_PER_DAY),
    tilt: clamp(toInt(state.tilt, 0), 0, B.TILT_MAX),
    rep: clamp(toInt(state.rep, B.START_REP), B.REP_MIN, B.REP_MAX),
    bet: Math.max(B.MIN_BET, toInt(state.bet, B.START_BET)),
    repayProgress: clamp(toInt(state.repayProgress, 0), 0, B.REPAY_REP_STEP - 1),
    casinoNights: Math.max(0, toInt(state.casinoNights, 0)),
    // ❤️ ≤ 0 блокирует друзей навсегда (залипает)
    friendsBlocked: state.friendsBlocked || toInt(state.rep, B.START_REP) <= 0
  }
}
