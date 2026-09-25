import { ITEM_IDS, type GameConfig, type ItemId } from './config'
import { appendLog } from './log'
import { initialBills } from './rules'
import type { DayCounters, ItemStatus, RunState } from './types'

export function freshDayCounters(run: Pick<RunState, 'rep' | 'tilt'>): DayCounters {
  return { earned: 0, wagered: 0, paidOut: 0, spins: 0, startRep: run.rep, startTilt: run.tilt }
}

/**
 * Новый ран (GDD §3.1): день 1, фаза `morning` — утро ещё не наступило,
 * первым командой идёт `day/wake` (стор делает это сам в newGame).
 */
export function createRun(config: GameConfig, seed: number, now: number): RunState {
  const B = config.balance
  const items = Object.fromEntries(ITEM_IDS.map((i) => [i, 'owned'])) as Record<ItemId, ItemStatus>
  const run: RunState = {
    id: `run-${now.toString(36)}-${(seed >>> 0).toString(36)}`,
    startedAt: now,
    seed: seed >>> 0,
    day: 1,
    phase: 'morning',
    location: 'life',
    energy: B.ENERGY_PER_DAY,
    wallet: B.START_WALLET,
    casino: 0,
    debtBank: 0,
    debtMfo: 0,
    rep: B.START_REP,
    tilt: 0,
    items,
    bet: B.START_BET,
    bonus: { state: 'available', wagerReq: 0, wagered: 0 },
    withdrawals: [],
    bills: initialBills(B),
    graceUsed: false,
    shiftsDone: 0,
    friendLoansThisWeek: 0,
    friendsBlocked: false,
    familyHelpsToday: 0,
    borrowedToday: 0,
    maxTiltToday: 0,
    repayProgress: 0,
    casinoNights: 0,
    casinoNightPending: false,
    forcedEnd: false,
    energyModNextMorning: 0,
    pendingEventId: null,
    eventCooldowns: {},
    endless: false,
    extraWeeks: 0,
    endingId: null,
    grade: null,
    withdrewToday: false,
    spinsThisWeek: 0,
    loseStreak: 0,
    jackpotToday: false,
    peakCasino: 0,
    today: freshDayCounters({ rep: B.START_REP, tilt: 0 }),
    daySummary: null,
    rngState: seed >>> 0,
    flags: {},
    stats: {},
    log: [],
    nextLogId: 1
  }
  return appendLog(run, [{ type: 'runStarted', runId: run.id, seed: run.seed }], now, B.LOG_LIMIT)
}

/** Глубокая копия забега, которую обработчик команды может мутировать. */
export function cloneRun(state: RunState): RunState {
  return {
    ...state,
    items: { ...state.items },
    bonus: { ...state.bonus },
    withdrawals: state.withdrawals.map((w) => ({ ...w })),
    bills: state.bills.map((b) => ({ ...b })),
    eventCooldowns: { ...state.eventCooldowns },
    today: { ...state.today },
    daySummary: state.daySummary ? { ...state.daySummary } : null,
    flags: { ...state.flags },
    stats: { ...state.stats },
    log: state.log.slice()
  }
}
