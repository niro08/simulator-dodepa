/**
 * Честная статистика (design/systems-spec.md §3.1): `reduceStats(stats, event)` — одна функция
 * для `run.stats` и `profile.stats` (lifetime). Все счётчики — целые ≥ 0 и монотонные
 * (только растут или берут максимум) — под Steam Stats (ADR-006). Производные — в statement.ts.
 * Счётчики, нужные ачивкам CD-13 (systems-spec §4), помечены «ач.».
 */
import type { GameEvent, PlayerStats, RunState } from './types'
import { debtOf } from './rules'

/** Ключи-максимумы (остальные — суммы). */
export const MAX_STATS = ['biggestPayout', 'longestLoseStreak', 'netLossPeak', 'maxDebt', 'tiltPeak', 'peakCasino'] as const

export const STAT_KEYS = [
  // Слот
  'spins', // ач. VETERAN_500
  'spinsFree',
  'casinoEnergySpent',
  'totalWagered',
  'totalPaidOut',
  'winsShowcase',
  'winsReal',
  'pushes',
  'ldw', // ач. LDW_10
  'nearMiss', // ач. NEAR_MISS_10
  'jackpots', // ач. JACKPOT_777
  'allInSpins',
  'biggestPayout',
  'longestLoseStreak',
  'netLossPeak', // ач. VALUED_CUSTOMER
  'peakCasino',
  // Кошелёк ↔ казино
  'deposits', // ач. FIRST_DEPOSIT
  'deposited',
  'bonusesTaken',
  'bonusGranted',
  'bonusesCleared', // ач. WAGER_CLEARED
  'bonusesBusted', // ач. BONUS_BUSTED
  'withdrawals', // ач. WITHDRAW_5
  'withdrawnGross',
  'withdrawnNet',
  'withdrawFees',
  'casinoNights', // ач. TILT_100
  'casinoNightLoss',
  'casinoBalanceForfeited',
  'withdrawalsForfeited',
  // Жизнь
  'shifts', // ач. SHIFTS_20_RUN
  'shiftEarned',
  'promotions',
  'schemes',
  'schemesSucceeded', // ач. SCHEMES_10
  'schemeEarned',
  'schemeFines',
  'friendLoans',
  'friendLoaned',
  'friendsBlocked', // ач. BLOCKED_BY_FRIENDS
  'familyHelps', // ач. FAMILY_10_RUN
  // Долг и ломбард
  'loansBank',
  'loansMfo', // ач. MFO_3_RUN
  'borrowed',
  'interestPaid',
  'debtRepaid',
  'forcedMfo',
  'maxDebt',
  'itemsPawned',
  'pawnReceived',
  'itemsRedeemed', // ач. REDEEM_3_RUN
  'redeemPaid',
  'redeemPremium',
  'itemsLost',
  // Счета и дни
  'billsPaid',
  'billsPaidAmount',
  'billsLate',
  'billPenalties',
  'livingCostPaid',
  'sleepEvents',
  'daysPlayed',
  'daysNoSpins',
  'daysTilt70',
  'tiltPeak',
  'cleanWeeks', // ач. CLEAN_WEEK
  'extraWeeks',
  // Время и мета
  'playSec', // ач. —
  'underbellySec', // ач. INSIGHT
  'fakeTimerExpiries', // ач. TIMER_LIES (UI, CD-13)
  'runsStarted',
  'runsFinished'
] as const

export type StatKey = (typeof STAT_KEYS)[number]

export function stat(stats: PlayerStats, key: StatKey): number {
  return stats[key] ?? 0
}

function add(stats: PlayerStats, key: StatKey, n: number): void {
  if (n !== 0) stats[key] = stat(stats, key) + n
}

function max(stats: PlayerStats, key: StatKey, n: number): void {
  if (n > stat(stats, key)) stats[key] = n
}

/** Применяет одно событие к счётчикам. Мутирует переданную копию. */
export function applyStatEvent(stats: PlayerStats, event: GameEvent): void {
  switch (event.type) {
    case 'spin':
      add(stats, 'spins', 1)
      if (event.energyCost === 0) add(stats, 'spinsFree', 1)
      add(stats, 'casinoEnergySpent', event.energyCost)
      add(stats, 'totalWagered', event.bet)
      add(stats, 'totalPaidOut', event.payout)
      if (event.payout > 0) add(stats, 'winsShowcase', 1)
      if (event.multiplier > 1) add(stats, 'winsReal', 1)
      if (event.multiplier === 1) add(stats, 'pushes', 1)
      if (event.ldw) add(stats, 'ldw', 1)
      if (event.nearMiss) add(stats, 'nearMiss', 1)
      if (event.outcomeId === 'jackpot') add(stats, 'jackpots', 1)
      if (event.allIn) add(stats, 'allInSpins', 1)
      max(stats, 'biggestPayout', event.payout)
      max(stats, 'longestLoseStreak', event.loseStreak)
      max(stats, 'netLossPeak', stat(stats, 'totalWagered') - stat(stats, 'totalPaidOut'))
      max(stats, 'peakCasino', event.casinoAfter)
      break
    case 'deposit':
      add(stats, 'deposits', 1)
      add(stats, 'deposited', event.amount)
      break
    case 'bonusGranted':
      add(stats, 'bonusesTaken', 1)
      add(stats, 'bonusGranted', event.bonus)
      break
    case 'bonusCleared':
      add(stats, 'bonusesCleared', 1)
      break
    case 'bonusBusted':
      add(stats, 'bonusesBusted', 1)
      break
    case 'withdrawRequested':
      add(stats, 'withdrawals', 1)
      add(stats, 'withdrawnGross', event.gross)
      add(stats, 'withdrawnNet', event.net)
      add(stats, 'withdrawFees', event.fee)
      break
    case 'casinoNight':
      add(stats, 'casinoNights', 1)
      add(stats, 'casinoNightLoss', event.lost)
      break
    case 'shiftWorked':
      add(stats, 'shifts', 1)
      add(stats, 'shiftEarned', event.pay)
      if (event.promoted) add(stats, 'promotions', 1)
      break
    case 'schemeResolved':
      add(stats, 'schemes', 1)
      if (event.success) {
        add(stats, 'schemesSucceeded', 1)
        add(stats, 'schemeEarned', event.amount)
      } else add(stats, 'schemeFines', event.fine)
      break
    case 'friendBorrowed':
      add(stats, 'friendLoans', 1)
      add(stats, 'friendLoaned', event.amount)
      break
    case 'friendsBlocked':
      add(stats, 'friendsBlocked', 1)
      break
    case 'familyHelped':
      add(stats, 'familyHelps', 1)
      break
    case 'loanTaken':
      add(stats, event.lender === 'bank' ? 'loansBank' : 'loansMfo', 1)
      add(stats, 'borrowed', event.amount)
      break
    case 'interestAccrued':
      add(stats, 'interestPaid', event.total)
      break
    case 'debtRepaid':
      add(stats, 'debtRepaid', event.amount)
      break
    case 'forcedMfo':
      add(stats, 'forcedMfo', event.amount)
      break
    case 'itemPawned':
      add(stats, 'itemsPawned', 1)
      add(stats, 'pawnReceived', event.amount)
      break
    case 'itemRedeemed':
      add(stats, 'itemsRedeemed', 1)
      add(stats, 'redeemPaid', event.cost)
      add(stats, 'redeemPremium', event.cost - event.pawnAmount)
      break
    case 'livingCostPaid':
      add(stats, 'livingCostPaid', event.amount)
      break
    case 'billPaid':
      add(stats, 'billsPaid', 1)
      add(stats, 'billsPaidAmount', event.amount)
      if (event.late) add(stats, 'billsLate', 1)
      break
    case 'billDeferred':
      add(stats, 'billPenalties', event.penalty)
      break
    case 'sleepEventShown':
      add(stats, 'sleepEvents', 1)
      break
    case 'slept':
      add(stats, 'daysPlayed', 1)
      if (event.tilt70) add(stats, 'daysTilt70', 1)
      if (event.cleanWeek) add(stats, 'cleanWeeks', 1)
      if (event.noSpins) add(stats, 'daysNoSpins', 1)
      break
    case 'tiltChanged':
      max(stats, 'tiltPeak', event.value)
      break
    case 'weekChoice':
      if (event.choice === 'one_more_week') add(stats, 'extraWeeks', 1)
      break
    case 'timeTracked':
      add(stats, 'playSec', Math.max(0, Math.floor(event.playSec)))
      add(stats, 'underbellySec', Math.max(0, Math.floor(event.underbellySec)))
      break
    case 'runStarted':
      add(stats, 'runsStarted', 1)
      break
    case 'runEnded':
      add(stats, 'casinoBalanceForfeited', event.forfeitedCasino)
      add(stats, 'withdrawalsForfeited', event.forfeitedWithdrawals)
      add(stats, 'itemsLost', event.itemsLost.length)
      if (event.endingId !== 'abandoned') add(stats, 'runsFinished', 1)
      break
    default:
      break
  }
}

/** Новая статистика после событий команды + максимумы, видимые только по состоянию (долг). */
export function reduceStats(stats: PlayerStats, events: readonly GameEvent[], run?: RunState | null): PlayerStats {
  const next = { ...stats }
  for (const event of events) applyStatEvent(next, event)
  if (run) max(next, 'maxDebt', debtOf(run))
  return next
}
