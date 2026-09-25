/**
 * Боты-стратегии из economy-v1 §11 (порт tools/balance-sim/sim.mjs) поверх настоящего ядра.
 * Нужны тестам баланса и регресса (B-06, winrate). Решения бота — только через команды и геттеры ядра.
 */
import { billTotal, checkBankLoan, checkMfoLoan, debtOf, isForkOpen, nextUnpaidBill, shiftPay } from './rules'
import { exec, newSession, tryExec, type Session } from './testing'
import type { GameConfig } from './config'
import type { EndingId, RunState } from './types'

export interface Strategy {
  /** Действия дня (фаза day). */
  day(s: Session): void
  /** Счёт сегодня, до оплаты: добрать денег. */
  bill?(s: Session): void
  /** Выбор в карточке события (индекс варианта). */
  event?(s: Session): number
}

export type RunOutcome = EndingId | 'extend_in_debt' | 'timeout'

/** Сколько смены принесут до дня toDay включительно (оценка без событий, как в sim.mjs). */
function projectedIncome(run: RunState, toDay: number, config: GameConfig): number {
  let income = 0
  let shifts = run.shiftsDone
  for (let d = run.day; d <= toDay; d++) {
    if (d === run.day && run.energy < config.balance.SHIFT_ENERGY) continue
    income += shiftPay({ ...run, shiftsDone: shifts }, config.balance)
    shifts += 1
  }
  return income
}

/** Сколько не хватит к следующему счёту (≤ 0 — хватает). */
export function reserveNeeded(run: RunState, config: GameConfig): number {
  const B = config.balance
  const bill = nextUnpaidBill(run)
  if (!bill) return 0
  return (
    billTotal(run, bill, B) +
    B.LIVING_COST * (bill.dueDay - run.day) -
    run.wallet -
    projectedIncome(run, bill.dueDay, config) +
    (bill.week === 4 ? debtOf(run) : 0)
  )
}

function coverWithLoans(s: Session, need: number): void {
  const B = s.config.balance
  while (s.run.wallet < need) {
    if (!checkBankLoan(s.run, B)) exec(s, { type: 'bank/loan' })
    else if (!checkMfoLoan(s.run, B)) exec(s, { type: 'mfo/loan' })
    else return
  }
}

function repaySurplus(s: Session, buffer = 0): void {
  if (debtOf(s.run) <= 0) return
  const amount = -reserveNeeded(s.run, s.config) - buffer
  if (amount > 0) tryExec(s, { type: 'debt/repay', amount: Math.min(amount, s.run.wallet, debtOf(s.run)) })
}

function repayAll(s: Session): void {
  const amount = Math.min(debtOf(s.run), s.run.wallet)
  if (amount > 0) tryExec(s, { type: 'debt/repay', amount })
}

function todayBillTotal(s: Session): number {
  const bill = s.run.bills.find((b) => b.dueDay === s.run.day && b.status !== 'paid')
  return bill ? billTotal(s.run, bill, s.config.balance) : 0
}

/** Сессия казино: депозит до бюджета, спины ставкой bet, пока можно (как casinoSession в sim.mjs). */
export function casinoSession(s: Session, opts: { bet: number; budget: number; bonus?: boolean; maxSpins?: number; stopAtTilt?: number }): void {
  const B = s.config.balance
  if (s.run.phase !== 'day') return
  tryExec(s, { type: 'casino/enter' })
  if (s.run.casino < opts.bet && opts.budget > 0) {
    tryExec(s, { type: 'casino/deposit', amount: Math.min(opts.budget, s.run.wallet), bonus: opts.bonus ?? false })
  }
  if (s.run.bet !== opts.bet) exec(s, { type: 'bet/set', value: opts.bet })
  let n = 0
  while (s.run.phase === 'day' && n < (opts.maxSpins ?? Infinity) && s.run.tilt < (opts.stopAtTilt ?? Infinity)) {
    if (!tryExec(s, { type: 'slot/spin' })) break
    n += 1
    if (s.run.casino < B.MIN_BET) break
  }
  if (s.run.phase === 'day') tryExec(s, { type: 'casino/leave' })
}

export const STRATEGIES = {
  /** Смена + семья каждый день; разрывы — банк/МФО; вещи не трогает. */
  honest: {
    day(s) {
      tryExec(s, { type: 'work/shift' })
      tryExec(s, { type: 'family/help' })
      repaySurplus(s)
    },
    bill(s) {
      const bill = s.run.bills.find((b) => b.dueDay === s.run.day && b.status !== 'paid')
      if (!bill) return
      const total = todayBillTotal(s)
      if (s.run.wallet < total + (bill.week === 4 ? debtOf(s.run) : 0) && bill.week < 4) coverWithLoans(s, total)
    },
    event: () => 1
  },
  /** Казино каждый день: смена + спины по 100, депозит ≤ 1000/день, без бонуса и ломбарда. */
  casinoDaily: {
    day(s) {
      tryExec(s, { type: 'work/shift' })
      casinoSession(s, { bet: 100, budget: 1000 })
      if (s.run.phase !== 'day') return
      if (s.run.casino >= 2000 && s.run.bonus.state !== 'active') tryExec(s, { type: 'casino/withdraw', amount: s.run.casino })
      if (debtOf(s.run) > 0) repayAll(s)
    },
    bill(s) {
      const total = todayBillTotal(s)
      if (s.run.wallet < total) coverWithLoans(s, total)
    },
    event: () => 1
  },
  /** Темщик: смена + темка каждый день. */
  shady: {
    day(s) {
      tryExec(s, { type: 'work/shift' })
      tryExec(s, { type: 'work/shady' })
      if (debtOf(s.run) > 0) repayAll(s)
    },
    bill(s) {
      const bill = s.run.bills.find((b) => b.dueDay === s.run.day && b.status !== 'paid')
      const total = todayBillTotal(s)
      if (bill && s.run.wallet < total && bill.week < 4) coverWithLoans(s, total)
    },
    event: () => 1
  }
} satisfies Record<string, Strategy>

/**
 * Прогон одного рана стратегией до концовки (как simulateRun в sim.mjs): день → счёт → развилка → сон.
 * На развилке бот гасит долг кошельком и завязывает; с долгом — «extend_in_debt» (в P0-метрике не победа).
 */
export function playRun(strategy: Strategy, seed: number, config?: GameConfig, progress = false): { outcome: RunOutcome; session: Session } {
  const s = newSession(seed, config, progress)
  for (let guard = 0; guard < 10_000; guard++) {
    const run = s.run
    switch (run.phase) {
      case 'ended':
        return { outcome: run.endingId ?? 'timeout', session: s }
      case 'event':
        exec(s, { type: 'event/choose', option: strategy.event?.(s) ?? 1 })
        break
      case 'morning':
      case 'daySummary':
        exec(s, { type: 'day/wake' })
        break
      case 'bills':
        if (!tryExec(s, { type: 'bills/pay' }) && !tryExec(s, { type: 'bills/defer' })) exec(s, { type: 'bills/refuse' })
        break
      case 'fork':
        if (!tryExec(s, { type: 'run/quit' })) return { outcome: 'extend_in_debt', session: s }
        break
      case 'day': {
        strategy.day(s)
        if (s.run.phase !== 'day') break
        strategy.bill?.(s)
        tryExec(s, { type: 'bills/pay' })
        if (isForkOpen(s.run)) {
          repayAll(s)
          if (!tryExec(s, { type: 'run/quit' })) return { outcome: 'extend_in_debt', session: s }
          break
        }
        exec(s, { type: 'day/sleep' })
        break
      }
      default:
        return { outcome: 'timeout', session: s }
    }
  }
  return { outcome: 'timeout', session: s }
}

/** Доля побед (концовка quit) на N ранах с сидами seed0…seed0+N−1. */
export function winRate(strategy: Strategy, runs: number, seed0 = 1, config?: GameConfig): { wins: number; outcomes: Record<string, number> } {
  const outcomes: Record<string, number> = {}
  let wins = 0
  for (let i = 0; i < runs; i++) {
    const { outcome } = playRun(strategy, seed0 + i, config)
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1
    if (outcome === 'quit') wins += 1
  }
  return { wins: wins / runs, outcomes }
}
