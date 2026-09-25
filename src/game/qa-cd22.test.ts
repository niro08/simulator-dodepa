/**
 * Регресс багов приёмки CD-22 (production/qa/acceptance-report.md §5): QA-01, QA-02, QA-04, QA-05, QA-08.
 * Тексты (QA-02/03/06/07/09) — в src/i18n/ru.test.ts, стор (QA-05) — в src/stores/game.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { noEventsConfig, type GameConfig } from './config'
import { dispatch } from './reducer'
import { createRng } from './rng'
import { collectorsCause } from './rules'
import { loadSave, parseSave } from './save'
import { newSession } from './testing'
import type { Bill, Command, EventOf, GameEvent, RunState } from './types'
import { buildHud } from './view'

const config = noEventsConfig
const B = config.balance
const base = (patch: Partial<RunState> = {}): RunState => ({ ...newSession(1, config, false).run, ...patch })
const act = (state: RunState, cmd: Command, cfg: GameConfig = config) =>
  dispatch(state, cmd, { rng: createRng(1), config: cfg, now: 0 })
const find = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.find((e): e is EventOf<T> => e.type === type)
const paidBills = (): Bill[] => base().bills.map((b) => ({ ...b, status: 'paid' as const }))
const env = { config, now: 1_700_000_000_000, seed: 5 }

describe('QA-01: «ЗАВЯЗАТЬ» с деньгами на сайте (GDD §3.7, E24)', () => {
  const fork = (patch: Partial<RunState> = {}) => base({ day: 28, phase: 'fork', bills: paidBills(), ...patch })

  it('HUD знает, что сгорит: баланс казино + выводы в очереди; runEnded списывает ту же сумму', () => {
    const state = fork({ casino: 1500, withdrawals: [{ amount: 1000, net: 950, arriveDay: 29 }] })
    const hud = buildHud(state, config)
    expect(hud.quitBlock).toBeNull()
    expect(hud.quitForfeit).toEqual({ casino: 1500, withdrawals: 950, total: 2450 })
    const ended = act(state, { type: 'run/quit' })
    expect(ended.state.phase).toBe('ended')
    expect(find(ended.events, 'runEnded')).toMatchObject({ endingId: 'quit', forfeitedCasino: 1500, forfeitedWithdrawals: 950 })
  })

  it('без денег на сайте предупреждать нечего (total = 0)', () => {
    expect(buildHud(fork(), config).quitForfeit).toEqual({ casino: 0, withdrawals: 0, total: 0 })
  })
})

describe('QA-02: причина «Коллекторов» — неделя неоплаченного счёта', () => {
  it('отсроченный счёт недели 1, отказ на дне 8 → неделя 1, отсрочка была', () => {
    const bills = base().bills.map((b) => (b.week === 1 ? { ...b, dueDay: 8, status: 'deferred' as const } : b))
    const state = base({ day: 8, phase: 'bills', graceUsed: true, bills })
    const ended = act(state, { type: 'bills/refuse' })
    expect(ended.state.endingId).toBe('collectors')
    expect(collectorsCause(ended.state)).toEqual({ week: 1, deferred: true, graceUsed: true, fork: false })
  })

  it('отказ в день 7 без отсрочки → неделя 1, «отсрочка использована» не пишется', () => {
    const state = base({ day: 7, phase: 'bills' })
    const ended = act(state, { type: 'bills/refuse' })
    expect(collectorsCause(ended.state)).toEqual({ week: 1, deferred: false, graceUsed: false, fork: false })
  })

  it('endless: неоплаченный счёт недели 5 (dueDay 36 после отсрочки) → неделя 5, а не 6', () => {
    const bills: Bill[] = [...paidBills(), { week: 5, dueDay: 36, fixed: 20250, status: 'deferred' }]
    const state = base({ day: 36, phase: 'bills', endless: true, extraWeeks: 1, graceUsed: true, bills })
    expect(collectorsCause(act(state, { type: 'bills/refuse' }).state).week).toBe(5)
  })

  it('фолбэк без «Ещё неделю»: долг в день развилки → счёт оплачен, причина — долг', () => {
    const cfg: GameConfig = { ...config, balance: { ...B, FEATURE_ENDLESS: false } }
    const state = base({ day: 28, phase: 'day', bills: paidBills(), debtMfo: 3000, energy: 0 })
    const ended = act(state, { type: 'day/sleep' }, cfg)
    expect(ended.state.endingId).toBe('collectors')
    expect(collectorsCause(ended.state)).toMatchObject({ week: 4, fork: true })
  })
})

describe('QA-04: валидатор сейва не пускает день за пределы рана', () => {
  const withRun = (run: Record<string, unknown>) => JSON.stringify({ version: 3, run: { ...base(), ...run }, profile: {}, settings: {} })
  const dayOf = (text: string) => {
    const r = parseSave(text, env)
    return r.status === 'ok' ? r.save.run?.day : null
  }

  it('day 99 без «Ещё неделю» → последний день рана (28)', () => {
    expect(dayOf(withRun({ day: 99, endless: false }))).toBe(B.RUN_DAYS)
  })

  it('отсрочка счёта недели 4 — день 29 допустим', () => {
    const bills = paidBills().map((b) => (b.week === 4 ? { ...b, dueDay: 29, status: 'deferred' } : b))
    expect(dayOf(withRun({ day: 29, graceUsed: true, bills }))).toBe(29)
  })

  it('«Ещё неделю»: предел — срок последнего счёта; обычные дни не трогаются', () => {
    const bills = [...paidBills(), { week: 5, dueDay: 35, fixed: 13500, status: 'upcoming' }]
    expect(dayOf(withRun({ day: 36, endless: true, bills }))).toBe(35)
    expect(dayOf(withRun({ day: 33, endless: true, bills }))).toBe(33)
    expect(dayOf(withRun({ day: 12 }))).toBe(12)
  })

  it('срок счёта клампится к 7w…7w+1 (день нельзя «растянуть» битым счётом)', () => {
    const bills = paidBills().map((b) => (b.week === 4 ? { ...b, dueDay: 500 } : b))
    const r = parseSave(withRun({ day: 400, bills }), env)
    expect(r.status === 'ok' && r.save.run?.bills.find((b) => b.week === 4)?.dueDay).toBe(29)
    expect(r.status === 'ok' && r.save.run?.day).toBe(29)
  })
})

describe('QA-05: миграция legacy — уведомление и уборка битого ключа', () => {
  it('старый забег (v0) закрыт миграцией → notice legacy_run_reset', () => {
    const outcome = loadSave({ main: null, backup: null, legacy: JSON.stringify({ money: 12345, energy: 5 }) }, env)
    expect(outcome.source).toBe('legacy')
    expect(outcome.save.run).toBeNull()
    expect(outcome.notices).toEqual(['legacy_run_reset'])
  })

  it('v1 без забега и текущий сейв — без уведомления', () => {
    const v1 = JSON.stringify({ version: 1, run: null, profile: {}, settings: {} })
    expect(loadSave({ main: v1, backup: null, legacy: null }, env).notices).toEqual([])
    const v3 = JSON.stringify({ version: 3, run: null, profile: {}, settings: {} })
    expect(loadSave({ main: v3, backup: null, legacy: null }, env).notices).toEqual([])
  })

  it('битый legacy при пустых слотах: нужен запись нового сейва (после неё ключ удаляется)', () => {
    const outcome = loadSave({ main: null, backup: null, legacy: '{"energy": NaN' }, env)
    expect(outcome.source).toBe('new')
    expect(outcome.needsWrite).toBe(true)
    expect(outcome.notices).toEqual([])
  })

  it('битые основной/бэкап не затираются до первой записи (R-10), даже если есть битый legacy', () => {
    const outcome = loadSave({ main: '{bad', backup: '{bad', legacy: '{bad' }, env)
    expect(outcome.source).toBe('new')
    expect(outcome.needsWrite).toBe(false)
  })
})

describe('QA-08: «Честный труженик» — неделя без единого спина (systems-spec §4 #9, §3 cleanWeeks)', () => {
  const day7 = (patch: Partial<RunState> = {}) => base({ day: 7, phase: 'day', bills: paidBills(), ...patch })
  const slept = (state: RunState) => find(act(state, { type: 'day/sleep' }).events, 'slept')

  it('сон на дне 7k при spinsThisWeek = 0 → cleanWeek; один спин за неделю → нет', () => {
    expect(slept(day7())?.cleanWeek).toBe(true)
    expect(slept(day7({ spinsThisWeek: 1 }))?.cleanWeek).toBe(false)
    expect(slept(base({ day: 6, phase: 'day' }))?.cleanWeek).toBe(false)
  })

  it('принятые фриспины — тоже спины: неделя с ними не «чистая»', () => {
    const state = base({ day: 5, phase: 'event', pendingEventId: 'push_we_miss_you', bills: paidBills() })
    const cfg: GameConfig = { ...config, events: { ...config.events, pool: newSession(1).config.events.pool } }
    const chosen = act(state, { type: 'event/choose', option: 0 }, cfg)
    expect(find(chosen.events, 'casinoCredited')).toMatchObject({ source: 'freespins' })
    expect(chosen.state.spinsThisWeek).toBe(cfg.events.balance.EVT_FREESPINS_COUNT)
    const declined = act(state, { type: 'event/choose', option: 1 }, cfg)
    expect(declined.state.spinsThisWeek).toBe(0)
  })
})
