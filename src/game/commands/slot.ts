import type { SlotConfig, SlotOutcomeDef, SymbolId } from '../config'
import type { Rng } from '../rng'
import type { CommandOf, SpinResult } from '../types'
import type { CommandHandler } from './types'

/** Выбор исхода по весам таблицы. */
export function rollOutcome(slot: SlotConfig, rng: Rng): SlotOutcomeDef {
  const total = slot.outcomes.reduce((sum, o) => sum + o.weight, 0)
  let roll = rng.next() * total
  for (const outcome of slot.outcomes) {
    roll -= outcome.weight
    if (roll < 0) return outcome
  }
  // Недостижимо при total > 0; защита от пустой/нулевой таблицы.
  return slot.outcomes[slot.outcomes.length - 1] as SlotOutcomeDef
}

/** Раскладка барабанов для исхода: выигрыш — три одинаковых, иначе никогда не три одинаковых. */
export function rollReels(outcome: SlotOutcomeDef, slot: SlotConfig, rng: Rng): [SymbolId, SymbolId, SymbolId] {
  if (outcome.symbols && outcome.symbols.length > 0) {
    const symbol = rng.pick(outcome.symbols)
    return [symbol, symbol, symbol]
  }
  const first = rng.pick(slot.symbols)
  const second = rng.pick(slot.symbols)
  let third = rng.pick(slot.symbols)
  if (slot.symbols.length > 1) {
    while (first === second && second === third) third = rng.pick(slot.symbols)
  }
  return [first, second, third]
}

/** Полный расчёт спина: исход, множитель, целая выплата ≥ 0, раскладка. */
export function resolveSpin(bet: number, slot: SlotConfig, rng: Rng): { result: SpinResult; energyDelta: number } {
  const outcome = rollOutcome(slot, rng)
  const { min, max } = outcome.multiplier
  const multiplier = max > min ? min + rng.next() * (max - min) : min
  const payout = Math.max(0, Math.floor(bet * multiplier))
  return {
    result: {
      bet,
      outcomeId: outcome.id,
      multiplier: Math.round(multiplier * 100) / 100,
      payout,
      reels: rollReels(outcome, slot, rng)
    },
    energyDelta: outcome.energyDelta
  }
}

/** slot/spin — атомарно: списание ставки, исход и выплата в одном dispatch (ADR-001). */
export const spinHandler: CommandHandler<CommandOf<'slot/spin'>> = {
  check(state, _cmd, config) {
    const { minBet } = config.balance.limits
    if (state.bet < minBet) return { reason: 'betTooLow', min: minBet }
    if (state.money < state.bet) return { reason: 'noMoney', min: state.bet }
    return null
  },
  apply(draft, _cmd, ctx) {
    const { result, energyDelta } = resolveSpin(draft.bet, ctx.config.slot, ctx.rng)
    draft.money += result.payout - result.bet
    draft.energy += energyDelta
    return [{ type: 'spin', ...result, delta: { money: result.payout - result.bet, energy: energyDelta } }]
  }
}

/** bet/set — ставка нормализуется (целое, ≥ minBet), никогда не отклоняется. */
export const setBetHandler: CommandHandler<CommandOf<'bet/set'>> = {
  check: () => null,
  apply(draft, cmd, ctx) {
    const from = draft.bet
    const value = Number.isFinite(cmd.value) ? Math.floor(cmd.value) : from
    draft.bet = Math.max(ctx.config.balance.limits.minBet, value)
    return [{ type: 'betChanged', from, to: draft.bet }]
  }
}
