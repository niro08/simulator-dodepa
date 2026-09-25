/**
 * Боты-стратегии из economy-v1 §11 (порт tools/balance-sim/sim.mjs) поверх настоящего ядра.
 * Нужны тестам баланса и регресса (B-06, winrate). Решения бота — только через команды и геттеры ядра.
 */
import { ITEM_IDS, type GameConfig, type ItemId } from './config'
import { findSleepEvent, optionCost, optionRejection } from './day'
import { billTotal, checkBankLoan, checkMfoLoan, debtOf, isForkOpen, nextUnpaidBill, shiftPay } from './rules'
import { exec, newSession, tryExec, type Session } from './testing'
import type { EndingId, Profile, RunState } from './types'

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

// ─── Выбор в карточках сна (порт eventHonest / eventGambler из sim.mjs) ─────────

const A = 0
const B_OPT = 1

/** Карточки, где «честный» отказывается (казино, займы, сомнительные предложения). */
const HONEST_DECLINE = new Set([
  'push_we_miss_you', 'anzhelika_bonus', 'sms_preapproved', 'signals_channel', 'dream_777', 'stream_clip',
  'withdraw_verification', 'cashback_letter', 'insomnia_spin', 'pawn_offer', 'mfo_robot', 'boss_caught', 'boss_advance'
])

/** Честный: семья и правда; платные варианты — если после оплаты хватает к следующему счёту. */
export function honestEventChoice(s: Session): number {
  const id = s.run.pendingEventId ?? ''
  const def = findSleepEvent(s.config, id)
  if (!def) return B_OPT
  if (id === 'mama_worried') return B_OPT
  if (id === 'mama_blocks_site') return A
  if (HONEST_DECLINE.has(id)) return B_OPT
  if (optionRejection(s.run, def.options[0], s.config)) return B_OPT
  if (id === 'eduard_call') return A
  const cost = optionCost(s.run, def.options[0])
  const after = { ...s.run, wallet: s.run.wallet - cost }
  if (id.startsWith('life_')) return reserveNeeded(after, s.config) <= 0 ? A : B_OPT
  if (cost > 0) return reserveNeeded(after, s.config) <= -500 ? A : B_OPT
  return A
}

const GAMBLER_ACCEPT = new Set([
  'push_we_miss_you', 'anzhelika_bonus', 'dream_777', 'stream_clip', 'insomnia_spin', 'sms_preapproved', 'mama_worried'
])

/** Игрок: берёт всё «казинное», бытовое — деньгами при запасе; прочие платные — нет. */
export function gamblerEventChoice(s: Session): number {
  const id = s.run.pendingEventId ?? ''
  const def = findSleepEvent(s.config, id)
  if (!def) return B_OPT
  if (optionRejection(s.run, def.options[0], s.config)) return B_OPT
  if (GAMBLER_ACCEPT.has(id)) return A
  if (id.startsWith('life_')) return s.run.wallet > 3000 ? A : B_OPT
  return optionCost(s.run, def.options[0]) > 0 ? B_OPT : A
}

function coverWithPawn(s: Session, need: number): boolean {
  const B = s.config.balance
  const order: ItemId[] = ['teaset', 'bike', 'phone', 'console', 'laptop']
  while (s.run.wallet < need) {
    const gap = need - s.run.wallet
    const own = order.filter((i) => s.run.items[i] === 'owned')
    if (own.length === 0) return false
    const fit = own.filter((i) => B.PAWN_VALUE[i] >= gap).sort((a, b) => B.PAWN_VALUE[a] - B.PAWN_VALUE[b])[0]
    const item = fit ?? own.sort((a, b) => B.PAWN_VALUE[b] - B.PAWN_VALUE[a])[0]
    if (!item || !tryExec(s, { type: 'pawn/pawn', item })) return false
  }
  return true
}

/**
 * Лудоман (sim.mjs `ludoman`): бонус на весь кошелёк, ставка ≈10% баланса, при 🔥 ≥ 70 каждый 4-й спин — «ДОДЕП ВСЁ»;
 * додеп из друзей/МФО/ломбарда; вывод при балансе ≥ 10 000.
 */
function ludomanDay(s: Session): void {
  const B = s.config.balance
  tryExec(s, { type: 'work/shift' })
  for (let round = 0; round < 4 && s.run.phase === 'day'; round++) {
    if (s.run.casino < B.MIN_BET) {
      if (s.run.wallet < 500) {
        if (!tryExec(s, { type: 'friends/borrow' }) && !tryExec(s, { type: 'mfo/loan' })) {
          const item = ITEM_IDS.find((i) => s.run.items[i] === 'owned')
          if (!item || !tryExec(s, { type: 'pawn/pawn', item })) break
        }
      }
      if (!tryExec(s, { type: 'casino/deposit', amount: s.run.wallet, bonus: true })) break
    }
    tryExec(s, { type: 'casino/enter' })
    let n = 0
    while (s.run.phase === 'day' && s.run.casino >= B.MIN_BET) {
      const allIn = s.run.tilt >= B.TILT_T2 && n % 4 === 3
      const bet = allIn ? s.run.casino : Math.max(100, Math.round((s.run.casino * 0.1) / 50) * 50)
      if (s.run.bet !== bet) exec(s, { type: 'bet/set', value: bet })
      if (!tryExec(s, { type: 'slot/spin' })) break
      n += 1
    }
    if (s.run.phase !== 'day') return
    if (s.run.casino >= 10000 && s.run.bonus.state !== 'active') {
      tryExec(s, { type: 'casino/withdraw', amount: s.run.casino - 1000 })
      break
    }
    if (s.run.energy < B.SPIN_ENERGY && s.run.tilt < B.TILT_T2) break
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
    event: honestEventChoice
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
    event: gamblerEventChoice
  },
  /** Лудоман: бонус, «ДОДЕП ВСЁ», додеп из друзей/МФО/ломбарда. */
  ludoman: {
    day: ludomanDay,
    bill(s) {
      const total = todayBillTotal(s)
      if (s.run.wallet < total) {
        coverWithLoans(s, total)
        if (s.run.wallet < total) coverWithPawn(s, total)
      }
    },
    event: gamblerEventChoice
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
    event: honestEventChoice
  }
} satisfies Record<string, Strategy>

/**
 * Прогон одного рана стратегией до концовки (как simulateRun в sim.mjs): день → счёт → развилка → сон.
 * На развилке бот гасит долг кошельком и завязывает; с долгом — «extend_in_debt» (в P0-метрике не победа).
 */
export function playRun(
  strategy: Strategy,
  seed: number,
  config?: GameConfig,
  progress = false,
  profile?: Profile
): { outcome: RunOutcome; session: Session } {
  const s = newSession(seed, config, progress, profile)
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
