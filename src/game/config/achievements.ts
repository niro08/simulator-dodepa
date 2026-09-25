/**
 * Достижения (CD-13): design/systems-spec.md §4, ADR-006 (production/architecture.md).
 * id — UPPER_SNAKE = Steam API Name, НЕИЗМЕНЯЕМ после релиза. Тексты — i18n ACHIEVEMENT_TEXTS (content-pack §3).
 * Условия декларативны: `stat` даёт полоску прогресса и маппится на Steam Stats; `event` — редкие «моментальные».
 * Награды — только косметика (CosmeticId из config/cosmetics.ts), мета-валюты нет (пиллар 5).
 * Модуль не импортирует slot.ts (economy-v1 §12): ачивки и косметика не могут влиять на исход спина.
 */
import type { StatKey } from '../stats'
import type { EndingId, GameEvent, Profile, RunState } from '../types'
import type { BalanceV1 } from './balance'

export type AchievementCondition =
  | { kind: 'stat'; stat: StatKey; scope: 'run' | 'lifetime'; gte: number }
  /** Концовка рана (событие runEnded). */
  | { kind: 'ending'; ending: EndingId }
  /** В profile.endings есть все 7 концовок. */
  | { kind: 'allEndings' }
  /** Предикат на событии и состоянии ПОСЛЕ применения (run.stats уже обновлены). */
  | { kind: 'event'; match: (event: GameEvent, ctx: { run: RunState; profile: Profile; balance: BalanceV1 }) => boolean }

export interface AchievementDef {
  id: string
  /** Steam Hidden: в «Коллекции» закрытое показывается как «???». */
  hidden: boolean
  condition: AchievementCondition
  /** CosmeticId (`skin:clown`…). */
  rewards: readonly string[]
  /** false — id зарезервирован (P1), не проверяется и не показывается. */
  enabled?: boolean
  /** Steam: apiName по умолчанию = id; progressStat — Steam Stat для полоски прогресса. */
  steam?: { apiName?: string; progressStat?: string }
}

const stat = (s: StatKey, scope: 'run' | 'lifetime', gte: number): AchievementCondition => ({ kind: 'stat', stat: s, scope, gte })
const ending = (e: EndingId): AchievementCondition => ({ kind: 'ending', ending: e })

/** Порог ДОДЕП ВСЁ (#6) и BOTTOM_BREACHED (P1). */
export const ACH_ALL_IN_MIN_BET = 5000
export const ACH_BOTTOM_PEAK = 10000

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'FIRST_DEPOSIT', hidden: false, condition: stat('deposits', 'lifetime', 1), rewards: ['title:newbie'] },
  {
    id: 'BEGINNERS_LUCK',
    hidden: false,
    condition: { kind: 'event', match: (e, { run }) => e.type === 'spin' && (run.stats.spins ?? 0) === 1 && e.multiplier >= 2 },
    rewards: []
  },
  { id: 'NEAR_MISS_10', hidden: false, condition: stat('nearMiss', 'lifetime', 10), rewards: [] },
  { id: 'LDW_10', hidden: false, condition: stat('ldw', 'lifetime', 10), rewards: ['title:celebrant'] },
  { id: 'VETERAN_500', hidden: false, condition: stat('spins', 'lifetime', 500), rewards: ['skin:bandit_90s', 'sound:hall_90s'] },
  {
    id: 'ALL_IN_5000',
    hidden: false,
    condition: { kind: 'event', match: (e) => e.type === 'spin' && e.allIn && e.bet >= ACH_ALL_IN_MIN_BET },
    rewards: ['sound:streamer']
  },
  { id: 'JACKPOT_777', hidden: false, condition: stat('jackpots', 'lifetime', 1), rewards: ['title:three_axes'] },
  {
    id: 'JACKPOT_THEN_ZERO',
    hidden: true,
    // Обнуление выводом не считается: проверяется только на спине
    condition: { kind: 'event', match: (e, { run, balance }) => e.type === 'spin' && run.jackpotToday && e.casinoAfter < balance.MIN_BET },
    rewards: ['title:lucky']
  },
  { id: 'CLEAN_WEEK', hidden: false, condition: stat('cleanWeeks', 'run', 1), rewards: ['skin:garden'] },
  { id: 'SHIFTS_20_RUN', hidden: false, condition: stat('shifts', 'run', 20), rewards: ['title:shock_worker'] },
  { id: 'SCHEMES_10', hidden: false, condition: stat('schemesSucceeded', 'lifetime', 10), rewards: [] },
  { id: 'FAMILY_10_RUN', hidden: false, condition: stat('familyHelps', 'run', 10), rewards: ['skin:garden'] },
  { id: 'BLOCKED_BY_FRIENDS', hidden: false, condition: stat('friendsBlocked', 'lifetime', 1), rewards: [] },
  { id: 'MFO_3_RUN', hidden: false, condition: stat('loansMfo', 'run', 3), rewards: ['title:borrower'] },
  {
    id: 'PAWN_ALL',
    hidden: false,
    condition: { kind: 'event', match: (e) => e.type === 'itemPawned' && e.ownedLeft === 0 },
    rewards: ['skin:pawnshop']
  },
  { id: 'REDEEM_3_RUN', hidden: false, condition: stat('itemsRedeemed', 'run', 3), rewards: [] },
  { id: 'WAGER_CLEARED', hidden: false, condition: stat('bonusesCleared', 'lifetime', 1), rewards: ['theme:mirror47'] },
  { id: 'BONUS_BUSTED', hidden: false, condition: stat('bonusesBusted', 'lifetime', 1), rewards: [] },
  { id: 'WITHDRAW_5', hidden: false, condition: stat('withdrawals', 'lifetime', 5), rewards: [] },
  { id: 'VALUED_CUSTOMER', hidden: false, condition: stat('netLossPeak', 'lifetime', 100000), rewards: ['skin:gold_vip'] },
  { id: 'TILT_100', hidden: false, condition: stat('casinoNights', 'lifetime', 1), rewards: ['skin:clown'] },
  { id: 'TIMER_LIES', hidden: true, condition: stat('fakeTimerExpiries', 'lifetime', 1), rewards: ['title:skeptic'] },
  { id: 'INSIGHT', hidden: false, condition: stat('underbellySec', 'lifetime', 300), rewards: ['title:enlightened'] },
  { id: 'ENDING_QUIT', hidden: false, condition: ending('quit'), rewards: ['skin:grey_reality', 'theme:monday', 'sound:honest'] },
  { id: 'ENDING_COLLECTORS', hidden: false, condition: ending('collectors'), rewards: [] },
  { id: 'ENDING_JAIL', hidden: false, condition: ending('jail'), rewards: [] },
  { id: 'ENDING_FAMILY_LEFT', hidden: false, condition: ending('family_left'), rewards: [] },
  { id: 'ENDING_MINIMALISM', hidden: false, condition: ending('minimalism'), rewards: [] },
  // systems-spec §4 #29: в спеке концовка названа lost_week; в коде EndingId = casino_nights
  { id: 'ENDING_LOST_WEEK', hidden: false, condition: ending('casino_nights'), rewards: [] },
  { id: 'ENDING_REFERRAL', hidden: true, condition: ending('referral'), rewards: ['theme:stream'] },
  { id: 'ALL_ENDINGS', hidden: false, condition: { kind: 'allEndings' }, rewards: ['title:all_bottoms', 'skin:neon_noir'] },

  // P1 — id зарезервированы (systems-spec §4, приложение), не активны
  {
    id: 'BOTTOM_BREACHED',
    hidden: false,
    enabled: false,
    condition: {
      kind: 'event',
      match: (e, { run, balance }) => e.type === 'spin' && run.peakCasino >= ACH_BOTTOM_PEAK && e.casinoAfter < balance.MIN_BET
    },
    rewards: ['skin:crypto']
  },
  { id: 'ETERNAL_DODEP', hidden: false, enabled: false, condition: stat('extraWeeks', 'run', 4), rewards: [] }
]
