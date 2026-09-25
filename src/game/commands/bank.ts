import type { GameConfig } from '../config'
import { checkBankLoan, checkMfoLoan, debtOf, needPhase, repayCore } from '../rules'
import type { CommandOf, GameEvent, Rejection, RunState } from '../types'
import type { CommandHandler } from './types'

/** bank/loan — кредит банка: 5000₽ под 0.3%/день, нужна ❤️ ≥ 15 (GDD §3.5.8). */
export const bankLoanHandler: CommandHandler<CommandOf<'bank/loan'>> = {
  check: (state, _cmd, config) => needPhase(state, 'day') ?? checkBankLoan(state, config.balance),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    draft.wallet += B.BANK_LOAN
    draft.debtBank += B.BANK_LOAN
    draft.borrowedToday += B.BANK_LOAN
    return [{ type: 'loanTaken', lender: 'bank', amount: B.BANK_LOAN }]
  }
}

/** mfo/loan — МФО: 3000₽ под 1%/день, только лимит долга. */
export const mfoLoanHandler: CommandHandler<CommandOf<'mfo/loan'>> = {
  check: (state, _cmd, config) => needPhase(state, 'day') ?? checkMfoLoan(state, config.balance),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    draft.wallet += B.MFO_LOAN
    draft.debtMfo += B.MFO_LOAN
    draft.borrowedToday += B.MFO_LOAN
    return [{ type: 'loanTaken', lender: 'mfo', amount: B.MFO_LOAN }]
  }
}

export interface RepayPlan {
  amount: number
}

/** Минимальная сумма погашения сейчас: остаток долга меньше минимума гасится целиком (B-08). */
export function minRepayAmount(debt: number, config: GameConfig): number {
  return Math.min(config.balance.REPAY_MIN, debt)
}

/**
 * Нормализует сумму погашения (TD-09, GDD E10–E11): floor, clamp к [min(REPAY_MIN, долг), min(долг, кошелёк)].
 * Возвращает план или отказ. Используется и ядром, и UI (подпись кнопки).
 */
export function planRepay(state: RunState, rawAmount: number, config: GameConfig): RepayPlan | Rejection {
  const debt = debtOf(state)
  if (debt <= 0) return { reason: 'no_debt' }
  if (!Number.isFinite(rawAmount) || Math.floor(rawAmount) <= 0) return { reason: 'invalid_amount' }

  const low = minRepayAmount(debt, config)
  const requested = Math.floor(rawAmount)
  if (requested < low) return { reason: 'amount_below_min', min: low }

  const high = Math.min(debt, state.wallet)
  if (high < low) return { reason: 'no_money', min: low }

  return { amount: Math.min(requested, high) }
}

export function isRejection(value: RepayPlan | Rejection): value is Rejection {
  return 'reason' in value
}

/** debt/repay — погашение: МФО → банк, +1❤️ за каждые 2000₽ «несегодняшних» денег. */
export const repayHandler: CommandHandler<CommandOf<'debt/repay'>> = {
  check(state, cmd, config) {
    const phase = needPhase(state, 'day')
    if (phase) return phase
    const plan = planRepay(state, cmd.amount, config)
    return isRejection(plan) ? plan : null
  },
  apply(draft, cmd, ctx) {
    const plan = planRepay(draft, cmd.amount, ctx.config)
    if (isRejection(plan)) return []
    const sideEvents: GameEvent[] = []
    draft.wallet -= plan.amount
    const repGain = repayCore(draft, plan.amount, sideEvents, ctx.config.balance)
    return [{ type: 'debtRepaid', amount: plan.amount, repGain, debtLeft: debtOf(draft), viaBill: false }, ...sideEvents]
  }
}
