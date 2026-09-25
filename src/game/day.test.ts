import { describe, expect, it } from 'vitest'
import { noEventsConfig, type GameConfig } from './config'
import { LIFE_EVENTS } from './content/events'
import { canExecute, dispatch, executeCommand } from './reducer'
import { createRng } from './rng'
import { debtOf, endlessBillFixed, isForkOpen } from './rules'
import { createRun } from './state'
import { playRun, STRATEGIES } from './strategies'
import { exec, newSession, tryExec, type Session } from './testing'
import type { Command, EventOf, GameEvent, RunState } from './types'

const config = noEventsConfig
const B = config.balance
const run = (patch: Partial<RunState> = {}): RunState => ({ ...newSession(1, config, false).run, ...patch })
const act = (state: RunState, cmd: Command, seed = 1, cfg: GameConfig = config) =>
  dispatch(state, cmd, { rng: createRng(seed), config: cfg, now: 0 })
const types = (events: readonly GameEvent[]) => events.map((e) => e.type)

/** Проспать до утра дня `day` сменами (бот платит счета). */
function liveUntil(s: Session, day: number): void {
  while (s.run.day < day && s.run.phase !== 'ended') {
    if (s.run.phase === 'daySummary') exec(s, { type: 'day/wake' })
    else if (s.run.phase === 'day') {
      tryExec(s, { type: 'work/shift' })
      tryExec(s, { type: 'bills/pay' })
      if (isForkOpen(s.run)) return
      exec(s, { type: 'day/sleep' })
    } else return
  }
  if (s.run.phase === 'daySummary') exec(s, { type: 'day/wake' })
}

describe('старт рана (GDD §3.1, AC 1)', () => {
  it('новый ран = значения §3.1; утро дня 1 без события', () => {
    const fresh = createRun(config, 7, 0)
    expect(fresh).toMatchObject({
      day: 1, phase: 'morning', location: 'life', energy: 100, wallet: 1000, casino: 0,
      debtBank: 0, debtMfo: 0, rep: 10, tilt: 0, bet: 100, graceUsed: false, endingId: null
    })
    expect(fresh.bills.map((b) => [b.week, b.dueDay, b.fixed, b.status])).toEqual([
      [1, 7, 3500, 'upcoming'], [2, 14, 5500, 'upcoming'], [3, 21, 7500, 'upcoming'], [4, 28, 10000, 'upcoming']
    ])
    expect(Object.values(fresh.items).every((i) => i === 'owned')).toBe(true)
    const woke = act(fresh, { type: 'day/wake' })
    expect(woke.state.phase).toBe('day')
    expect(types(woke.events)).toEqual(['dayStarted'])
  })

  it('команды вне своей фазы отклоняются', () => {
    const fresh = createRun(config, 7, 0)
    expect(canExecute(fresh, { type: 'work/shift' }, config)).toEqual({ reason: 'wrong_phase' })
    expect(canExecute(run(), { type: 'day/wake' }, config)).toEqual({ reason: 'wrong_phase' })
    expect(canExecute(run(), { type: 'bills/defer' }, config)).toEqual({ reason: 'wrong_phase' })
    expect(canExecute(run(), { type: 'run/extend' }, config)).toEqual({ reason: 'wrong_phase' })
    expect(canExecute(run({ phase: 'ended', endingId: 'quit' }), { type: 'bet/set', value: 100 }, config)).toEqual({ reason: 'wrong_phase' })
  })
})

describe('сон N1–N9 и утро M1–M8 (AC 2)', () => {
  it('фиксированные входы → фиксированный снимок после ночи', () => {
    const state = run({ day: 3, wallet: 200, debtMfo: 1000, debtBank: 2000, tilt: 80, maxTiltToday: 90, familyHelpsToday: 1, borrowedToday: 3000, location: 'casino' })
    const result = act(state, { type: 'day/sleep' })
    // N2: 300 при 200 в кошельке → недостача 100 в МФО; N4: проценты на 1100 и 2000
    expect(result.state).toMatchObject({
      wallet: 0, debtMfo: Math.ceil(1100 * 1.01), debtBank: Math.ceil(2000 * 1.003), tilt: 30,
      day: 4, phase: 'daySummary', familyHelpsToday: 0, borrowedToday: 0, maxTiltToday: 30, location: 'life'
    })
    expect(types(result.events)).toEqual(['forcedMfo', 'livingCostPaid', 'interestAccrued', 'tiltChanged', 'tiltStageChanged', 'slept'])
    expect(result.events.find((e) => e.type === 'slept')).toMatchObject({ day: 3, tilt70: true, casinoNight: false })
    expect(result.state.daySummary).toMatchObject({ day: 3, livingCost: 300, interest: 11 + 6, forcedMfo: 100 })
  })

  it('утро: ⚡ = 100 + модификатор (не копится), вывод приходит утром N+1 и не раньше (AC 9)', () => {
    const w = act(run({ casino: 2000 }), { type: 'casino/withdraw', amount: 2000 }).state
    const night = act(w, { type: 'day/sleep' }).state
    expect(night.wallet).toBe(700)
    const morning = act({ ...night, energyModNextMorning: -40, energy: 3 }, { type: 'day/wake' })
    expect(morning.state).toMatchObject({ energy: 60, energyModNextMorning: 0, wallet: 700 + 1900, withdrawals: [] })
    expect(morning.events).toContainEqual({ type: 'withdrawPaid', net: 1900 })
  })

  it('смена недели: сбрасываются займы у друзей; счёт дня получает статус due', () => {
    const state = run({ day: 7, friendLoansThisWeek: 3, phase: 'daySummary' })
    const woke = act(state, { type: 'day/wake' }).state
    expect(woke.friendLoansThisWeek).toBe(3)
    expect(woke.bills[0]?.status).toBe('due')
    const nextWeek = act({ ...state, day: 8 }, { type: 'day/wake' }).state
    expect(nextWeek.friendLoansThisWeek).toBe(0)
  })
})

describe('счета и отсрочка (GDD §3.6, AC 4)', () => {
  it('до срока — not_due; в день счёта — только целиком из кошелька; долговая часть гасит долг', () => {
    expect(canExecute(run({ day: 3 }), { type: 'bills/pay' }, config)).toEqual({ reason: 'not_due', min: 4 })
    const due = run({ day: 7, wallet: 3000, debtMfo: 2000 })
    expect(canExecute(due, { type: 'bills/pay' }, config)).toEqual({ reason: 'no_money', min: 3700 })
    const paid = act({ ...due, wallet: 5000 }, { type: 'bills/pay' })
    expect(paid.state).toMatchObject({ wallet: 1300, debtMfo: 1800 })
    expect(paid.state.bills[0]?.status).toBe('paid')
    expect(paid.events[0]).toMatchObject({ type: 'billPaid', week: 1, amount: 3700, debtPart: 200, late: false })
  })

  it('«Лечь спать» в день счёта без оплаты → экран счёта; «Назад» возвращает день', () => {
    const bills = act(run({ day: 7 }), { type: 'day/sleep' })
    expect(bills.state.phase).toBe('bills')
    expect(bills.events[0]).toMatchObject({ type: 'billsOpened', week: 1, total: 3500, forced: false })
    expect(act(bills.state, { type: 'day/resume' }).state.phase).toBe('day')
  })

  it('отсрочка: +50%, срок завтра, одна на ран; вторая неоплата → «Коллекторы»', () => {
    const bills = act(run({ day: 7, wallet: 0 }), { type: 'day/sleep' }).state
    const deferred = act(bills, { type: 'bills/defer' })
    expect(deferred.state).toMatchObject({ graceUsed: true, day: 8, phase: 'daySummary', tilt: 0 })
    expect(deferred.state.bills[0]).toMatchObject({ dueDay: 8, fixed: 5250, status: 'deferred' })
    expect(deferred.state.bills[1]?.dueDay).toBe(14) // следующие счета не сдвигаются
    const day8 = act(deferred.state, { type: 'day/wake' }).state
    const again = act(day8, { type: 'day/sleep' }).state
    expect(again.phase).toBe('bills')
    expect(canExecute(again, { type: 'bills/defer' }, config)).toEqual({ reason: 'grace_used' })
    const refused = act(again, { type: 'bills/refuse' })
    expect(refused.state).toMatchObject({ phase: 'ended', endingId: 'collectors', grade: null })
    expect(refused.events.at(-1)).toMatchObject({ type: 'runEnded', endingId: 'collectors' })
  })
})

describe('развилка «ЗАВЯЗАТЬ / ЕЩЁ НЕДЕЛЮ» (GDD §3.7, AC 6–7)', () => {
  const forkDay = (patch: Partial<RunState> = {}) => {
    const base = run({ day: 28, wallet: 20_000 })
    const bills = base.bills.map((b) => ({ ...b, status: 'paid' as const }))
    return { ...base, bills, ...patch }
  }

  it('«ЗАВЯЗАТЬ»: только в день развилки, после оплаты, при долге 0; оценки A/B/C', () => {
    expect(canExecute(run({ day: 20 }), { type: 'run/quit' }, config)).toEqual({ reason: 'not_fork_day' })
    const unpaid = run({ day: 28 })
    expect(canExecute(unpaid, { type: 'run/quit' }, config)).toEqual({ reason: 'bill_unpaid' })
    expect(canExecute(forkDay({ debtMfo: 100 }), { type: 'run/quit' }, config)).toEqual({ reason: 'has_debt', min: 100 })
    expect(act(forkDay({ rep: 20 }), { type: 'run/quit' }).state).toMatchObject({ phase: 'ended', endingId: 'quit', grade: 'A' })
    expect(act(forkDay({ rep: 19 }), { type: 'run/quit' }).state.grade).toBe('B')
    const noItems = { phone: 'pawned', bike: 'sold', laptop: 'pawned', teaset: 'pawned', console: 'pawned' } as const
    expect(act(forkDay({ items: noItems }), { type: 'run/quit' }).state.grade).toBe('C')
  })

  it('«Лечь спать» в день развилки → модалка; «ЕЩЁ НЕДЕЛЮ» создаёт счёт недели 5 = 13 500 со сроком 35', () => {
    const fork = act(forkDay({ debtMfo: 5000 }), { type: 'day/sleep' })
    expect(fork.state.phase).toBe('fork')
    expect(fork.events[0]).toMatchObject({ type: 'forkOpened', debt: 5000 })
    expect(canExecute(fork.state, { type: 'run/quit' }, config)).toMatchObject({ reason: 'has_debt' })
    const extended = act(fork.state, { type: 'run/extend' })
    expect(extended.state).toMatchObject({ endless: true, extraWeeks: 1, day: 29, phase: 'daySummary' })
    expect(extended.state.bills.at(-1)).toEqual({ week: 5, dueDay: 35, fixed: 13_500, status: 'upcoming' })
    expect(endlessBillFixed(6, B)).toBe(18_200)
    expect(endlessBillFixed(7, B)).toBe(24_600)
    // день 35 — снова развилка
    const day35 = { ...extended.state, day: 35, phase: 'day' as const, wallet: 50_000, debtMfo: 0 }
    const paid = act(day35, { type: 'bills/pay' }).state
    expect(isForkOpen(paid)).toBe(true)
    expect(canExecute(paid, { type: 'run/quit' }, config)).toBeNull()
  })

  it('без FEATURE_ENDLESS долг на развилке = «Коллекторы» (фолбэк GDD §3.7)', () => {
    const noEndless: GameConfig = { ...config, balance: { ...B, FEATURE_ENDLESS: false } }
    const result = act(forkDay({ debtMfo: 1 }), { type: 'day/sleep' }, 1, noEndless)
    expect(result.state.endingId).toBe('collectors')
    const clean = act(forkDay(), { type: 'day/sleep' }, 1, noEndless)
    expect(clean.state.phase).toBe('fork')
    expect(canExecute(clean.state, { type: 'run/extend' }, noEndless)).toEqual({ reason: 'feature_disabled' })
  })

  it('отсрочка счёта 4 → развилка на 29-й день (E21)', () => {
    const bills = act(run({ day: 28, wallet: 0, bills: run().bills.map((b) => (b.week < 4 ? { ...b, status: 'paid' as const } : b)) }), { type: 'day/sleep' }).state
    const deferred = act(bills, { type: 'bills/defer' }).state
    const day29 = { ...act(deferred, { type: 'day/wake' }).state, wallet: 20_000 }
    expect(day29.bills[3]).toMatchObject({ dueDay: 29, status: 'deferred' })
    const paid = act(day29, { type: 'bills/pay' })
    expect(paid.events[0]).toMatchObject({ type: 'billPaid', late: true })
    expect(isForkOpen(paid.state)).toBe(true)
  })
})

describe('концовки: все 7 достижимы, приоритет (GDD §3.9, AC 5)', () => {
  it('«Семья ушла»: ❤️ ≤ −15 после любого изменения', () => {
    const result = act(run({ rep: -13 }), { type: 'friends/borrow' })
    // ❤️ ≤ 0 → друзья заблокированы, займ недоступен
    expect(result.ok).toBe(false)
    const viaShady = act(run({ rep: -13, wallet: 10_000 }), { type: 'work/shady' }, 0)
    expect(['family_left', 'jail']).toContain(viaShady.state.endingId)
  })

  it('«Ночь в казино ×3»: третья ночь прерывает сон', () => {
    const state = run({ casinoNights: 2, casinoNightPending: true, casino: 1000 })
    const result = act(state, { type: 'day/sleep' })
    expect(result.state).toMatchObject({ phase: 'ended', endingId: 'casino_nights', casino: 800, day: 1 })
    expect(types(result.events)).toEqual(['casinoNight', 'runEnded'])
  })

  it('«Минимализм»: утром, всё заложено, денег < 50, займы закрыты', () => {
    const items = { phone: 'pawned', bike: 'pawned', laptop: 'pawned', teaset: 'pawned', console: 'pawned' } as const
    const state = run({ phase: 'daySummary', day: 5, wallet: 10, casino: 20, debtMfo: 29_000, items })
    expect(act(state, { type: 'day/wake' }).state).toMatchObject({ phase: 'ended', endingId: 'minimalism' })
    expect(act({ ...state, debtMfo: 27_000 }, { type: 'day/wake' }).state.phase).toBe('day')
  })

  it('каждая из 7 концовок встречается в сид-сценариях ядра', () => {
    const seen = new Set<string>()
    seen.add(act(run({ rep: -13, wallet: 10_000 }), { type: 'work/shady' }, 0).state.endingId ?? '')
    for (let seed = 0; seed < 100 && !seen.has('jail'); seed++) {
      seen.add(act(run({ rep: -13, wallet: 10_000 }), { type: 'work/shady' }, seed).state.endingId ?? '')
    }
    seen.add(act(act(run({ day: 7, wallet: 0, graceUsed: true }), { type: 'day/sleep' }).state, { type: 'bills/refuse' }).state.endingId ?? '')
    seen.add(act(run({ casinoNights: 2, casinoNightPending: true }), { type: 'day/sleep' }).state.endingId ?? '')
    const items = { phone: 'pawned', bike: 'pawned', laptop: 'pawned', teaset: 'pawned', console: 'pawned' } as const
    seen.add(act(run({ phase: 'daySummary', wallet: 0, debtMfo: 30_000, items }), { type: 'day/wake' }).state.endingId ?? '')
    for (let seed = 0; seed < 5000 && !seen.has('referral'); seed++) {
      seen.add(act(run({ location: 'casino', casino: 99_950 }), { type: 'slot/spin' }, seed).state.endingId ?? '')
    }
    const fork = run({ day: 28, bills: run().bills.map((b) => ({ ...b, status: 'paid' as const })) })
    seen.add(act(fork, { type: 'run/quit' }).state.endingId ?? '')
    seen.delete('')
    expect([...seen].sort()).toEqual(['casino_nights', 'collectors', 'family_left', 'jail', 'minimalism', 'quit', 'referral'])
  })

  it('после концовки ран закрыт: фаза ended, все команды отклоняются', () => {
    const ended = act(run({ casinoNights: 2, casinoNightPending: true }), { type: 'day/sleep' }).state
    expect(canExecute(ended, { type: 'day/wake' }, config)).toEqual({ reason: 'wrong_phase' })
    const again = act(ended, { type: 'work/shift' })
    expect(again.ok).toBe(false)
  })
})

describe('тильт 100 в особые дни (GDD §3.5.10, E3–E5)', () => {
  it('в день счёта → экран счёта без «Назад»; оплата → ночь с «Ночью в казино»', () => {
    for (let seed = 0; seed < 100; seed++) {
      const state = run({ day: 7, tilt: 99, location: 'casino', casino: 1000, wallet: 5000 })
      const result = act(state, { type: 'slot/spin' }, seed)
      if (result.state.phase !== 'bills') continue
      expect(result.state.forcedEnd).toBe(true)
      expect(canExecute(result.state, { type: 'day/resume' }, config)).toEqual({ reason: 'forced' })
      expect(canExecute(result.state, { type: 'pawn/pawn', item: 'bike' }, config)).toEqual({ reason: 'wrong_phase' })
      const paid = act(result.state, { type: 'bills/pay' })
      expect(paid.state).toMatchObject({ phase: 'daySummary', casinoNights: 1, tilt: 50 })
      return
    }
    throw new Error('не нашли проигрыш')
  })

  it('не-спиновые источники не поднимают тильт выше 99 (AC 8)', () => {
    const deferred = act(act(run({ day: 7, wallet: 0, tilt: 95 }), { type: 'day/sleep' }).state, { type: 'bills/defer' })
    const tiltEvents = deferred.events.filter((e): e is EventOf<'tiltChanged'> => e.type === 'tiltChanged')
    expect(tiltEvents[0]).toMatchObject({ value: 99, source: 'bill_deferred' })
    expect(deferred.events.some((e) => e.type === 'casinoNight')).toBe(false)
  })
})

describe('события сна: система (точка для CD-12)', () => {
  const withLife: GameConfig = { ...config, events: { ...config.events, pool: LIFE_EVENTS } }

  it('бросок ночью (не в ночь 1→2), показ утром, выбор, кулдаун 7 дней', () => {
    // ночь 1 → 2: события нет
    for (let seed = 0; seed < 30; seed++) {
      expect(dispatch(run(), { type: 'day/sleep' }, { rng: createRng(seed), config: withLife, now: 0 }).state.pendingEventId).toBeNull()
    }
    let found: RunState | null = null
    for (let seed = 0; seed < 50 && !found; seed++) {
      const night = dispatch(run({ day: 3 }), { type: 'day/sleep' }, { rng: createRng(seed), config: withLife, now: 0 }).state
      if (night.pendingEventId) found = night
    }
    if (!found) throw new Error('событие не выпало')
    expect(found.eventCooldowns[found.pendingEventId ?? '']).toBe(4)
    const morning = act(found, { type: 'day/wake' }, 1, withLife)
    expect(morning.state.phase).toBe('event')
    expect(morning.events).toContainEqual({ type: 'sleepEventShown', eventId: found.pendingEventId })
    expect(canExecute(morning.state, { type: 'work/shift' }, withLife)).toEqual({ reason: 'wrong_phase' })
    // платный вариант недоступен при нехватке; бесплатный доступен всегда
    const poor = { ...morning.state, wallet: 0 }
    expect(canExecute(poor, { type: 'event/choose', option: 0 }, withLife)).toMatchObject({ reason: 'option_unaffordable' })
    const chosen = act(poor, { type: 'event/choose', option: 1 }, 1, withLife)
    expect(chosen.state).toMatchObject({ phase: 'day', pendingEventId: null })
    expect(chosen.events[0]).toMatchObject({ type: 'sleepEventResolved', choice: 1 })
  })

  it('варианты life-карточек: ₽ или ⚡/🔥/МФО', () => {
    const shown = (id: string) => ({ ...run(), phase: 'event' as const, pendingEventId: id, wallet: 5000, energy: 100 })
    expect(act(shown('life_fridge'), { type: 'event/choose', option: 0 }, 1, withLife).state.wallet).toBe(2500)
    expect(act(shown('life_tooth'), { type: 'event/choose', option: 1 }, 1, withLife).state).toMatchObject({ energy: 40, tilt: 15 })
    const fine = act(shown('life_fine'), { type: 'event/choose', option: 1 }, 1, withLife)
    expect(fine.state.debtMfo).toBe(2000)
    expect(fine.events).toContainEqual({ type: 'forcedMfo', amount: 2000, reason: 'event' })
  })

  it('неизвестное событие в сейве не ломает утро', () => {
    const state = run({ phase: 'daySummary', pendingEventId: 'removed_event' })
    expect(act(state, { type: 'day/wake' }).state).toMatchObject({ phase: 'day', pendingEventId: null })
  })
})

describe('полный ран честным ботом и перезагрузки (AC 12)', () => {
  it('перезагрузка в любой фазе: executeCommand из сохранённого состояния даёт тот же результат', () => {
    const s = newSession(5)
    liveUntil(s, 7)
    const snapshot = JSON.parse(JSON.stringify(s.run)) as RunState
    const a = executeCommand(s.run, { type: 'day/sleep' }, { config, now: 0 })
    const b = executeCommand(snapshot, { type: 'day/sleep' }, { config, now: 0 })
    expect(a.state).toEqual(b.state)
  })

  it('честный бот проходит 28 дней: все счета оплачены, долг 0, «Завязал»', () => {
    const { outcome, session } = playRun(STRATEGIES.honest, 11, config, true)
    expect(outcome).toBe('quit')
    expect(session.run.day).toBe(28)
    expect(session.run.bills.every((b) => b.status === 'paid')).toBe(true)
    expect(debtOf(session.run)).toBe(0)
    expect(session.run.grade).toBe('A')
    expect(session.run.stats).toMatchObject({ shifts: 28, familyHelps: 28, billsPaid: 4, daysPlayed: 27 })
  })
})
