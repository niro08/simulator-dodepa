/**
 * Ожидаемый остаток бонуса после отыгрыша — для Изнанки (economy-v1 §5.4).
 * Баланс казино при серии ставок b — случайное блуждание с поглощением в 0; диффузионное приближение.
 * Референс: expectedBonusLeft() в tools/balance-sim/sim.mjs. Погрешность ≤ 10% отн. (сверено с Монте-Карло).
 */
import type { GameConfig } from './config'
import { slotMetrics } from './config'

/** erf — аппроксимация Абрамовица–Стиган 7.1.26. */
export function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return x >= 0 ? y : -y
}

const Phi = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))
const phi = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI)

export interface BonusForecast {
  /** Ожидаемый остаток баланса после отыгрыша, ₽ (0, если скорее сольёшь). */
  expectedLeft: number
  /** Вероятность отыграть. */
  pClear: number
  /** Ожидаемая потеря на оставшемся обороте: (1 − RTP) × W. */
  expectedLossOnWager: number
}

/**
 * casino — текущий баланс, wagerLeft — оставшийся оборот, bet — ставка игрока
 * (ограничивается BONUS_MAX_BET и MIN_BET).
 */
export function expectedBonusLeft(casino: number, wagerLeft: number, bet: number, config: GameConfig): BonusForecast {
  const B = config.balance
  const metrics = slotMetrics(config.slot)
  const expectedLossOnWager = Math.round((1 - metrics.rtp) * Math.max(0, wagerLeft))
  if (wagerLeft <= 0) return { expectedLeft: casino, pClear: 1, expectedLossOnWager: 0 }
  if (casino <= 0) return { expectedLeft: 0, pClear: 0, expectedLossOnWager }
  const b = Math.max(B.MIN_BET, Math.min(bet, B.BONUS_MAX_BET))
  const n = wagerLeft / b
  const mu = -(1 - metrics.rtp) * b
  const sig2 = metrics.variance * b * b
  const m = casino + mu * n
  const mm = -casino + mu * n
  const sd = Math.sqrt(sig2 * n)
  const k = Math.exp((-2 * mu * casino) / sig2)
  const left = m * Phi(m / sd) + sd * phi(m / sd) - k * (mm * Phi(mm / sd) + sd * phi(mm / sd))
  const pClear = Phi(m / sd) - k * Phi(mm / sd)
  return {
    expectedLeft: Math.max(0, Math.round(left)),
    pClear: Math.min(1, Math.max(0, pClear)),
    expectedLossOnWager
  }
}
