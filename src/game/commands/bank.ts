import type { GameConfig } from '../config'
import { calculateReward } from '../reward'
import type { CommandOf, Rejection, RunState } from '../types'
import { needEnergy, type CommandHandler } from './types'

/** bank/credit — кредит: деньги сейчас, долг с процентом. */
export const creditHandler: CommandHandler<CommandOf<'bank/credit'>> = {
  check(state, _cmd, config) {
    const credit = config.balance.bank.credit
    return (
      needEnergy(state, credit.energyCost) ??
      (state.reputation + credit.reputationDelta < credit.minReputationAfter
        ? { reason: 'lowReputation', min: credit.minReputationAfter - credit.reputationDelta }
        : null)
    )
  },
  apply(draft, _cmd, ctx) {
    const credit = ctx.config.balance.bank.credit
    const amount = calculateReward(credit.baseReward, draft.reputation, ctx.config.balance.reward, ctx.rng)
    const interest = credit.interestMin + ctx.rng.next() * (credit.interestMax - credit.interestMin)
    const debtIncrease = Math.floor(amount * (1 + interest))

    draft.money += amount
    draft.debt += debtIncrease
    draft.energy -= credit.energyCost
    draft.reputation += credit.reputationDelta
    return [
      {
        type: 'credit',
        interest: Math.round(interest * 1000) / 1000,
        delta: { money: amount, debt: debtIncrease, energy: -credit.energyCost, reputation: credit.reputationDelta }
      }
    ]
  }
}

export interface RepayPlan {
  amount: number
  reputationGain: number
}

/** Минимальная сумма погашения сейчас: остаток долга меньше минимума гасится целиком (B-08). */
export function minRepayAmount(debt: number, config: GameConfig): number {
  return Math.min(config.balance.bank.repay.minAmount, debt)
}

/**
 * Нормализует сумму погашения (TD-09): floor, clamp к [min(minRepay, debt), min(debt, money)].
 * Возвращает план или отказ. Используется и ядром, и UI (подпись кнопки).
 */
export function planRepay(state: RunState, rawAmount: number, config: GameConfig): RepayPlan | Rejection {
  if (state.debt <= 0) return { reason: 'noDebt' }
  if (!Number.isFinite(rawAmount) || Math.floor(rawAmount) <= 0) return { reason: 'invalidAmount' }

  const low = minRepayAmount(state.debt, config)
  const requested = Math.floor(rawAmount)
  if (requested < low) return { reason: 'repayTooLow', min: low }

  const high = Math.min(state.debt, state.money)
  if (high < low) return { reason: 'noMoney', min: low }

  const amount = Math.min(requested, high)
  return { amount, reputationGain: Math.floor(amount / config.balance.bank.repay.reputationPerAmount) }
}

export function isRejection(value: RepayPlan | Rejection): value is Rejection {
  return 'reason' in value
}

/** bank/repay — погашение долга выбранной суммой. */
export const repayHandler: CommandHandler<CommandOf<'bank/repay'>> = {
  check(state, cmd, config) {
    const plan = planRepay(state, cmd.amount, config)
    return isRejection(plan) ? plan : null
  },
  apply(draft, cmd, ctx) {
    const plan = planRepay(draft, cmd.amount, ctx.config)
    if (isRejection(plan)) return []
    draft.money -= plan.amount
    draft.debt -= plan.amount
    draft.reputation += plan.reputationGain
    return [{ type: 'repay', delta: { money: -plan.amount, debt: -plan.amount, reputation: plan.reputationGain } }]
  }
}
