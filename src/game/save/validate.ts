import { ITEM_IDS, type ItemId } from '../config'
import { applyInvariants, toInt } from '../invariants'
import { ENDING_IDS, initialBills } from '../rules'
import { freshDayCounters, freshEventState } from '../state'
import type {
  Bill,
  BonusState,
  DaySummary,
  EndingId,
  EventState,
  GameEvent,
  GameEventType,
  Grade,
  ItemStatus,
  LogEntry,
  PlayerStats,
  Profile,
  RunEndId,
  RunPhase,
  RunState,
  RunSummary,
  Settings,
  Withdrawal
} from '../types'
import type { SaveEnv, SaveFile } from './schema'
import { CURRENT_SAVE_VERSION, createDefaultProfile, createDefaultSettings } from './schema'

/**
 * Валидация сейва на ручных guard'ах (ADR-008): невалидное поле → дефолт, а не сброс всего сейва.
 * Защита от поломок, а не от читеров (R-07).
 */

type Json = Record<string, unknown>

export function isRecord(x: unknown): x is Json {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function num(x: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function int(x: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return Math.min(max, Math.max(min, toInt(x, fallback)))
}

function str(x: unknown, fallback: string): string {
  return typeof x === 'string' ? x : fallback
}

function bool(x: unknown, fallback: boolean): boolean {
  return typeof x === 'boolean' ? x : fallback
}

function oneOf<T extends string>(x: unknown, values: readonly T[], fallback: T): T {
  return typeof x === 'string' && (values as readonly string[]).includes(x) ? (x as T) : fallback
}

function numberMap(x: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isRecord(x)) return out
  for (const [key, value] of Object.entries(x)) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return out
}

function boolMap(x: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (!isRecord(x)) return out
  for (const [key, value] of Object.entries(x)) {
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

function stringList(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
}

/** Все типы событий; `satisfies` заставит дописать сюда новый тип (иначе он отфильтруется при загрузке). */
const EVENT_TYPES = {
  runStarted: true,
  dayStarted: true,
  slept: true,
  spin: true,
  casinoEntered: true,
  casinoLeft: true,
  deposit: true,
  bonusGranted: true,
  bonusDeclined: true,
  bonusCleared: true,
  bonusBusted: true,
  withdrawRequested: true,
  withdrawPaid: true,
  shiftWorked: true,
  schemeResolved: true,
  friendBorrowed: true,
  friendsBlocked: true,
  familyHelped: true,
  loanTaken: true,
  interestAccrued: true,
  debtRepaid: true,
  forcedMfo: true,
  itemPawned: true,
  itemRedeemed: true,
  livingCostPaid: true,
  billsOpened: true,
  billPaid: true,
  billDeferred: true,
  billCreated: true,
  forkOpened: true,
  weekChoice: true,
  tiltChanged: true,
  tiltStageChanged: true,
  casinoNight: true,
  sleepEventShown: true,
  sleepEventResolved: true,
  runEnded: true,
  betChanged: true,
  rejected: true,
  timeTracked: true,
  casinoCredited: true,
  itemSold: true,
  fakeTimerExpired: true,
  achievementUnlocked: true
} as const satisfies Record<GameEventType, true>

function isEvent(x: unknown): x is GameEvent {
  return isRecord(x) && typeof x.type === 'string' && x.type in EVENT_TYPES
}

function validateLog(x: unknown, limit: number): LogEntry[] {
  if (!Array.isArray(x)) return []
  return x
    .filter((e): e is Json => isRecord(e) && isEvent(e.event) && Number.isInteger(e.id))
    .map((e) => ({ id: e.id as number, t: num(e.t, 0), event: e.event as GameEvent }))
    .slice(0, limit)
}

const PHASES: readonly RunPhase[] = ['morning', 'event', 'day', 'bills', 'fork', 'daySummary', 'ended']
const ITEM_STATUSES: readonly ItemStatus[] = ['owned', 'pawned', 'sold']
const BONUS_STATES: readonly BonusState[] = ['available', 'active', 'done', 'lost', 'declined']
const BILL_STATUSES: readonly Bill['status'][] = ['upcoming', 'due', 'paid', 'deferred']
const GRADES: readonly Grade[] = ['A', 'B', 'C']

function validateItems(x: unknown): Record<ItemId, ItemStatus> {
  const src = isRecord(x) ? x : {}
  return Object.fromEntries(ITEM_IDS.map((id) => [id, oneOf(src[id], ITEM_STATUSES, 'owned')])) as Record<ItemId, ItemStatus>
}

function validateBills(x: unknown, env: SaveEnv): Bill[] {
  if (!Array.isArray(x)) return initialBills(env.config.balance)
  const grace = Math.max(0, env.config.balance.GRACE_PER_RUN)
  const bills = x.filter(isRecord).map((b) => {
    const week = int(b.week, 1, 1)
    // Срок счёта — 7w, после отсрочки 7w + 1 (GDD §3.6)
    return {
      week,
      dueDay: int(b.dueDay, 7 * week, 7 * week, 7 * week + grace),
      fixed: int(b.fixed, 0, 0),
      status: oneOf(b.status, BILL_STATUSES, 'upcoming')
    }
  })
  return bills.length > 0 ? bills : initialBills(env.config.balance)
}

function validateWithdrawals(x: unknown): Withdrawal[] {
  if (!Array.isArray(x)) return []
  return x
    .filter(isRecord)
    .map((w) => ({ amount: int(w.amount, 0, 0), net: int(w.net, 0, 0), arriveDay: int(w.arriveDay, 1, 1) }))
}

function validateDaySummary(x: unknown): DaySummary | null {
  if (!isRecord(x)) return null
  return {
    day: int(x.day, 1, 1),
    earned: int(x.earned, 0),
    casinoWagered: int(x.casinoWagered, 0),
    casinoPaidOut: int(x.casinoPaidOut, 0),
    casinoNightLoss: int(x.casinoNightLoss, 0),
    livingCost: int(x.livingCost, 0),
    interest: int(x.interest, 0),
    forcedMfo: int(x.forcedMfo, 0),
    debt: int(x.debt, 0),
    wallet: int(x.wallet, 0),
    casino: int(x.casino, 0),
    repDelta: int(x.repDelta, 0),
    tiltDelta: int(x.tiltDelta, 0),
    casinoNight: bool(x.casinoNight, false),
    eventRolled: bool(x.eventRolled, false)
  }
}

function validateEventState(x: unknown): EventState {
  const def = freshEventState()
  if (!isRecord(x)) return def
  const pawnedOn: EventState['pawnedOn'] = {}
  if (isRecord(x.pawnedOn)) {
    for (const id of ITEM_IDS) if (x.pawnedOn[id] !== undefined) pawnedOn[id] = int(x.pawnedOn[id], 0, 0)
  }
  return {
    shiftDeductions: Array.isArray(x.shiftDeductions)
      ? x.shiftDeductions.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).map((v) => Math.max(0, Math.floor(v)))
      : def.shiftDeductions,
    casinoBlockedUntil: int(x.casinoBlockedUntil, 0, 0),
    friendDebt: int(x.friendDebt, 0, 0),
    shiftsThisWeek: int(x.shiftsThisWeek, 0, 0),
    weekCasinoNet: int(x.weekCasinoNet, 0),
    bedTilt: int(x.bedTilt, 0, 0),
    spins: int(x.spins, 0, 0),
    lastSpinDay: int(x.lastSpinDay, 0, 0),
    pawnedOn
  }
}

/**
 * Последний возможный день рана (QA-04): день счёта недели 4 (28, 29 после отсрочки); в «Ещё неделю» — срок
 * последнего созданного счёта (счёт следующей недели создаётся сразу при выборе, GDD §3.7).
 */
function maxRunDay(bills: readonly Bill[], endless: boolean, env: SaveEnv): number {
  const B = env.config.balance
  const lastDue = bills.reduce((m, b) => Math.max(m, b.dueDay), 0)
  const cap = B.RUN_DAYS + Math.max(0, B.GRACE_PER_RUN)
  return Math.max(1, endless ? lastDue : Math.min(lastDue, cap))
}

export function validateRun(x: unknown, env: SaveEnv): RunState | null {
  if (!isRecord(x)) return null
  const B = env.config.balance
  const log = validateLog(x.log, B.LOG_LIMIT)
  const maxLogId = log.reduce((m, e) => Math.max(m, e.id), 0)
  const bonusSrc = isRecord(x.bonus) ? x.bonus : {}
  const rep = int(x.rep, B.START_REP)
  const tilt = int(x.tilt, 0, 0, B.TILT_MAX)
  const today = isRecord(x.today) ? x.today : {}
  const endingId = oneOf<EndingId | ''>(x.endingId, ENDING_IDS, '')
  let phase = oneOf(x.phase, PHASES, 'day')
  if (phase === 'ended' && !endingId) phase = 'day'
  const bills = validateBills(x.bills, env)
  const endless = bool(x.endless, false)
  const run: RunState = {
    id: str(x.id, `run-${env.now.toString(36)}`),
    startedAt: num(x.startedAt, env.now),
    seed: int(x.seed, env.seed) >>> 0,
    day: int(x.day, 1, 1, maxRunDay(bills, endless, env)),
    phase,
    location: x.location === 'casino' ? 'casino' : 'life',
    energy: int(x.energy, B.ENERGY_PER_DAY),
    wallet: int(x.wallet, B.START_WALLET),
    casino: int(x.casino, 0),
    debtBank: int(x.debtBank, 0),
    debtMfo: int(x.debtMfo, 0),
    rep,
    tilt,
    items: validateItems(x.items),
    bet: int(x.bet, B.START_BET),
    bonus: {
      state: oneOf(bonusSrc.state, BONUS_STATES, 'available'),
      wagerReq: int(bonusSrc.wagerReq, 0, 0),
      wagered: int(bonusSrc.wagered, 0, 0)
    },
    withdrawals: validateWithdrawals(x.withdrawals),
    bills,
    graceUsed: bool(x.graceUsed, false),
    shiftsDone: int(x.shiftsDone, 0, 0),
    friendLoansThisWeek: int(x.friendLoansThisWeek, 0, 0),
    friendsBlocked: bool(x.friendsBlocked, false),
    familyHelpsToday: int(x.familyHelpsToday, 0, 0),
    borrowedToday: int(x.borrowedToday, 0, 0),
    maxTiltToday: int(x.maxTiltToday, tilt, 0, B.TILT_MAX),
    repayProgress: int(x.repayProgress, 0, 0),
    casinoNights: int(x.casinoNights, 0, 0),
    casinoNightPending: bool(x.casinoNightPending, false),
    forcedEnd: bool(x.forcedEnd, false),
    energyModNextMorning: int(x.energyModNextMorning, 0),
    pendingEventId: typeof x.pendingEventId === 'string' ? x.pendingEventId : null,
    eventCooldowns: numberMap(x.eventCooldowns),
    endless,
    extraWeeks: int(x.extraWeeks, 0, 0),
    endingId: endingId || null,
    grade: phase === 'ended' ? oneOf<Grade | ''>(x.grade, GRADES, '') || null : null,
    withdrewToday: bool(x.withdrewToday, false),
    spinsThisWeek: int(x.spinsThisWeek, 0, 0),
    loseStreak: int(x.loseStreak, 0, 0),
    jackpotToday: bool(x.jackpotToday, false),
    peakCasino: int(x.peakCasino, 0, 0),
    today: {
      ...freshDayCounters({ rep, tilt }),
      earned: int(today.earned, 0, 0),
      wagered: int(today.wagered, 0, 0),
      paidOut: int(today.paidOut, 0, 0),
      spins: int(today.spins, 0, 0),
      startRep: int(today.startRep, rep),
      startTilt: int(today.startTilt, tilt),
      nearMiss: int(today.nearMiss, 0, 0),
      shifts: int(today.shifts, 0, 0)
    },
    daySummary: validateDaySummary(x.daySummary),
    rngState: int(x.rngState, env.seed) >>> 0,
    eventState: validateEventState(x.eventState),
    flags: boolMap(x.flags),
    stats: numberMap(x.stats) as PlayerStats,
    log,
    nextLogId: Math.max(int(x.nextLogId, 1), maxLogId + 1)
  }
  return applyInvariants(run, env.config)
}

const RUN_END_IDS: readonly RunEndId[] = [...ENDING_IDS, 'abandoned']

function validateRunHistory(x: unknown, limit: number): RunSummary[] {
  if (!Array.isArray(x)) return []
  return x
    .filter(isRecord)
    .map((r) => ({
      runId: str(r.runId, ''),
      startedAt: num(r.startedAt, 0),
      endedAt: num(r.endedAt, 0),
      endingId: oneOf(r.endingId, RUN_END_IDS, 'abandoned'),
      grade: oneOf<Grade | ''>(r.grade, GRADES, '') || null,
      days: int(r.days, 1, 1),
      extraWeeks: int(r.extraWeeks, 0, 0),
      casinoNetFinal: int(r.casinoNetFinal, 0),
      totalWagered: int(r.totalWagered, 0, 0),
      totalPaidOut: int(r.totalPaidOut, 0, 0),
      playSec: int(r.playSec, 0, 0)
    }))
    .slice(0, limit)
}

export function validateProfile(x: unknown, env: SaveEnv): Profile {
  const def = createDefaultProfile()
  if (!isRecord(x)) return def

  const achievements: Profile['achievements'] = {}
  if (isRecord(x.achievements)) {
    for (const [id, value] of Object.entries(x.achievements)) {
      if (isRecord(value)) {
        achievements[id] = { unlockedAt: num(value.unlockedAt, 0), runId: typeof value.runId === 'string' ? value.runId : null }
      }
    }
  }

  const endings: Profile['endings'] = {}
  if (isRecord(x.endings)) {
    for (const id of ENDING_IDS) {
      const e = x.endings[id]
      if (isRecord(e)) {
        endings[id] = {
          count: int(e.count, 1, 0),
          firstAt: num(e.firstAt, 0),
          bestGrade: oneOf<Grade | ''>(e.bestGrade, GRADES, '') || null
        }
      }
    }
  }

  const equipped: Record<string, string> = {}
  if (isRecord(x.equipped)) {
    for (const [slot, id] of Object.entries(x.equipped)) {
      if (typeof id === 'string') equipped[slot] = id
    }
  }
  const flags = isRecord(x.flags) ? x.flags : {}

  return {
    stats: numberMap(x.stats),
    achievements,
    endings,
    equipped,
    unseenCosmetics: stringList(x.unseenCosmetics),
    runHistory: validateRunHistory(x.runHistory, env.config.stats.RUN_HISTORY_LIMIT),
    flags: { tutorialDone: bool(flags.tutorialDone, false), hintsSeen: stringList(flags.hintsSeen) }
  }
}

export function validateSettings(x: unknown): Settings {
  const def = createDefaultSettings()
  if (!isRecord(x)) return def
  return {
    locale: x.locale === 'en' || x.locale === 'ru' ? x.locale : def.locale,
    musicVolume: num(x.musicVolume, def.musicVolume, 0, 1),
    sfxVolume: num(x.sfxVolume, def.sfxVolume, 0, 1),
    reducedMotion: bool(x.reducedMotion, def.reducedMotion),
    skipSpinAnimation: bool(x.skipSpinAnimation, def.skipSpinAnimation)
  }
}

/** Приводит уже мигрированные данные к SaveFile текущей версии. */
export function validateSave(data: Json, env: SaveEnv): SaveFile {
  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: num(data.savedAt, env.now),
    build: str(data.build, ''),
    run: validateRun(data.run, env),
    profile: validateProfile(data.profile, env),
    settings: validateSettings(data.settings)
  }
}
