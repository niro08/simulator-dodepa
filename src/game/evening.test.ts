/**
 * Пакет «Быстрый фикс» (design/quick-fix-evening.md): вечер, полсмены, переработка, «Лечь пораньше»,
 * память тильта и пробуждение в казино, серия семьи. Критерии приёмки §10 п.1–6 + сейв (§5).
 */
import { describe, expect, it } from 'vitest'
import { noEventsConfig, type GameConfig } from './config'
import { canExecute, dispatch } from './reducer'
import { createRng } from './rng'
import { earlyBedPreview } from './rules'
import { validateRun } from './save/validate'
import { newSession } from './testing'
import type { Command, EventOf, GameEvent, RunState } from './types'

/** Пакет 1 проверяется со старой темкой (FEATURE_CONTACTS=false); контакты — contacts.test.ts. */
const on: GameConfig = { ...noEventsConfig, balance: { ...noEventsConfig.balance, FEATURE_EVENING_FIX: true, FEATURE_CONTACTS: false } }
const off: GameConfig = { ...noEventsConfig, balance: { ...noEventsConfig.balance, FEATURE_EVENING_FIX: false } }
const B = on.balance
/** Ран в фазе day дня 1, «Жизнь». */
const run = (patch: Partial<RunState> = {}, cfg: GameConfig = on): RunState => ({ ...newSession(1, cfg, false).run, ...patch })
const act = (state: RunState, cmd: Command, cfg: GameConfig = on) => dispatch(state, cmd, { rng: createRng(1), config: cfg, now: 0 })
const find = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.find((e) => e.type === type) as EventOf<T> | undefined

/** Цепочка команд; каждая обязана пройти. */
function chain(state: RunState, cmds: Command[], cfg: GameConfig = on): RunState {
  let s = state
  for (const cmd of cmds) {
    const r = act(s, cmd, cfg)
    expect(r.ok, `${cmd.type}: ${JSON.stringify(r.events[0])}`).toBe(true)
    s = r.state
  }
  return s
}
/** Лечь спать и проснуться. */
const nextDay = (s: RunState, cfg: GameConfig = on) => chain(s, [{ type: 'day/sleep' }, { type: 'day/wake' }], cfg)

describe('флаг выключен (§10 п.1)', () => {
  it('новые команды отклоняются feature_disabled; старые правила без изменений', () => {
    const s = run({}, off)
    for (const type of ['work/half', 'work/overtime', 'day/early'] as const) {
      expect(canExecute(s, { type }, off)).toEqual({ reason: 'feature_disabled' })
    }
    // семья + Серёга + темка в один день и спад 50 — как раньше; новые поля не появляются
    const after = chain(run({ wallet: 5000 }, off), [{ type: 'family/help' }, { type: 'friends/borrow' }, { type: 'work/shady' }], off)
    expect(after.eveningUsed).toBeUndefined()
    const shift = chain(run({}, off), [{ type: 'work/shift' }], off)
    expect(shift.workToday).toBeUndefined()
    const slept = act(run({ tilt: 80 }, off), { type: 'day/sleep' }, off).state
    expect(slept.tilt).toBe(30)
    const night = act(run({ location: 'casino', casinoNightPending: true, tilt: 100, casino: 1000 }, off), { type: 'day/sleep' }, off).state
    expect(night.tilt).toBe(off.balance.TILT_AFTER_CASINO_NIGHT)
    for (const key of ['eveningUsed', 'workToday', 'lastFamilyDay', 'earlyBedPending', 'earlyCarry', 'wokeInCasino']) {
      expect(key in slept).toBe(false)
    }
  })
})

describe('вечер: одна вечерняя команда в день (§3.1, §10 п.2)', () => {
  const evening: Command[] = [{ type: 'family/help' }, { type: 'friends/borrow' }, { type: 'work/shady' }, { type: 'work/overtime' }]
  const slots = ['family', 'friends', 'shady', 'overtime'] as const

  it('после любой вечерней команды три остальные отклоняются evening_used с тем, чем занят вечер', () => {
    evening.forEach((cmd, i) => {
      const s = chain(run({ wallet: 5000, energy: 100 }), [cmd])
      expect(s.eveningUsed).toBe(slots[i])
      for (const other of evening) {
        if (other === cmd) continue
        const r = canExecute({ ...s, energy: 100 }, other, on)
        // переработка после семьи и т.п. — сначала вечер; после переработки work_done главнее
        expect(r?.reason === 'evening_used' || r?.reason === 'daily_limit', `${cmd.type} → ${other.type}`).toBe(true)
        if (r?.reason === 'evening_used') expect(r.evening).toBe(slots[i])
      }
    })
  })

  it('порядок проверок: постоянные причины раньше вечера, вечер раньше энергии', () => {
    const used = run({ eveningUsed: 'family', energy: 0 })
    expect(canExecute({ ...used, location: 'casino' }, { type: 'family/help' }, on)).toEqual({ reason: 'in_casino' })
    expect(canExecute({ ...used, familyHelpsToday: 1 }, { type: 'family/help' }, on)).toMatchObject({ reason: 'daily_limit' })
    expect(canExecute({ ...used, friendsBlocked: true }, { type: 'friends/borrow' }, on)).toEqual({ reason: 'friends_blocked' })
    expect(canExecute(used, { type: 'friends/borrow' }, on)).toEqual({ reason: 'evening_used', evening: 'family' })
    expect(canExecute(used, { type: 'work/shady' }, on)).toEqual({ reason: 'evening_used', evening: 'family' })
    expect(canExecute(run({ energy: 0 }), { type: 'work/shady' }, on)).toEqual({ reason: 'no_energy', min: B.SHADY_ENERGY })
  })

  it('вечер и работа сбрасываются ночью', () => {
    const s = chain(run(), [{ type: 'work/shift' }, { type: 'family/help' }])
    expect(s).toMatchObject({ workToday: 'shift', eveningUsed: 'family' })
    const morning = nextDay(s)
    expect(morning.workToday).toBeUndefined()
    expect(morning.eveningUsed).toBeUndefined()
    expect(canExecute(morning, { type: 'work/shift' }, on)).toBeNull()
  })
})

describe('работа: смена, полсмены, переработка (§3.2, §10 п.2–3)', () => {
  it('после любой рабочей команды две другие и повтор отклоняются work_done', () => {
    for (const cmd of [{ type: 'work/shift' }, { type: 'work/half' }, { type: 'work/overtime' }] as const) {
      const s = { ...chain(run(), [cmd]), energy: 100, eveningUsed: undefined }
      for (const other of ['work/shift', 'work/half', 'work/overtime'] as const) {
        expect(canExecute(s, { type: other }, on), `${cmd.type} → ${other}`).toEqual({ reason: 'work_done' })
      }
    }
  })

  it('полсмены при 900₽: 405₽, −30⚡, 🔥 −5; смены и вычеты не тронуты', () => {
    const s = run({ tilt: 20, eventState: { ...run().eventState, shiftDeductions: [1000] } })
    const r = act(s, { type: 'work/half' })
    expect(r.state).toMatchObject({ wallet: 1405, energy: 70, tilt: 15, shiftsDone: 0, workToday: 'half' })
    expect(r.state.today).toMatchObject({ earned: 405, shifts: 0 })
    expect(r.state.eventState).toMatchObject({ shiftDeductions: [1000], shiftsThisWeek: 0 })
    expect(r.state.eveningUsed).toBeUndefined()
    expect(find(r.events, 'halfShiftWorked')).toEqual({ type: 'halfShiftWorked', pay: 405 })
  })

  it('переработка: round(900 × mult) минус вычет, +1 смена, −80⚡, 🔥 −5, занимает вечер', () => {
    const gross = Math.round(900 * B.OVERTIME_PAY_MULT)
    const s = run({ tilt: 20, eventState: { ...run().eventState, shiftDeductions: [300, 1000] } })
    const r = act(s, { type: 'work/overtime' })
    expect(r.state).toMatchObject({ wallet: 1000 + gross - 300, energy: 20, tilt: 15, shiftsDone: 1, workToday: 'overtime', eveningUsed: 'overtime' })
    expect(r.state.eventState.shiftDeductions).toEqual([1000])
    expect(r.state.today.shifts).toBe(1)
    expect(find(r.events, 'shiftWorked')).toMatchObject({ pay: gross - 300, deducted: 300, overtime: true })
    // без вычета при множителе спецификации 1.25 было бы 1125₽
    expect(Math.round(900 * 1.25)).toBe(1125)
  })

  it('переработка: проверки phase → life → work_done → evening → energy', () => {
    expect(canExecute(run({ location: 'casino' }), { type: 'work/overtime' }, on)).toEqual({ reason: 'in_casino' })
    expect(canExecute(run({ workToday: 'half', eveningUsed: 'family' }), { type: 'work/overtime' }, on)).toEqual({ reason: 'work_done' })
    expect(canExecute(run({ eveningUsed: 'family' }), { type: 'work/overtime' }, on)).toEqual({ reason: 'evening_used', evening: 'family' })
    expect(canExecute(run({ energy: 79 }), { type: 'work/overtime' }, on)).toEqual({ reason: 'no_energy', min: 80 })
  })

  it('переработка идёт в повышение, как смена', () => {
    const r = act(run({ shiftsDone: 4 }), { type: 'work/overtime' })
    expect(find(r.events, 'shiftWorked')).toMatchObject({ promoted: true })
  })
})

describe('семья: +2 «после разлуки», иначе +1 (§3.5, §10 п.4)', () => {
  /** Помогать маме в дни из списка (дни 1…max), ❤️-прирост каждого визита. */
  const repGains = (helpDays: number[]): number[] => {
    let s = run({ wallet: 100_000 })
    const gains: number[] = []
    for (let day = 1; day <= Math.max(...helpDays); day++) {
      if (!canExecute(s, { type: 'bills/pay' }, on)) s = chain(s, [{ type: 'bills/pay' }]) // день счёта (7)
      if (helpDays.includes(day)) {
        const before = s.rep
        s = chain(s, [{ type: 'family/help' }])
        gains.push(s.rep - before)
      }
      s = nextDay(s)
    }
    return gains
  }

  it('дни 1,2,3: +2,+1,+1; дни 1,3,5: +2,+1,+1; дни 1 и 8: +2,+2; дни 1 и 7: +2,+1', () => {
    expect(repGains([1, 2, 3])).toEqual([2, 1, 1])
    expect(repGains([1, 3, 5])).toEqual([2, 1, 1])
    expect(repGains([1, 8])).toEqual([2, 2])
    expect(repGains([1, 7])).toEqual([2, 1])
  })

  it('🔥 −15 всегда; lastFamilyDay = день; familyHelped.rep/yesterday для строки лога', () => {
    const r = act(run({ day: 5, tilt: 50, lastFamilyDay: 4 }), { type: 'family/help' })
    expect(r.state).toMatchObject({ tilt: 35, rep: 11, lastFamilyDay: 5 })
    expect(r.events[0]).toEqual({ type: 'familyHelped', rep: 1, yesterday: true })
    expect(act(run({ day: 5, lastFamilyDay: 3 }), { type: 'family/help' }).events[0]).toEqual({ type: 'familyHelped', rep: 1 })
    expect(act(run(), { type: 'family/help' }).events[0]).toEqual({ type: 'familyHelped', rep: 2 })
    expect(act(run({}, off), { type: 'family/help' }, off).events[0]).toEqual({ type: 'familyHelped' })
  })
})

describe('«Лечь пораньше» (§3.3, §10 п.5)', () => {
  it('превью: U=20 → −10/+4; U=50 → −25/+10; U=100 → −30/+10', () => {
    expect(earlyBedPreview({ energy: 20 }, B)).toEqual({ tilt: 10, energy: 4 })
    expect(earlyBedPreview({ energy: 50 }, B)).toEqual({ tilt: 25, energy: 10 })
    expect(earlyBedPreview({ energy: 100 }, B)).toEqual({ tilt: 30, energy: 10 })
  })

  it('с 50⚡ при 🔥 80: утром 🔥 = 80 − 25 − 40 = 15, ⚡ = 110', () => {
    const night = act(run({ energy: 50, tilt: 80 }), { type: 'day/early' })
    expect(night.ok).toBe(true)
    expect(find(night.events, 'earlyBed')).toEqual({ type: 'earlyBed', tilt: 25, energy: 10 })
    expect(night.events.find((e) => e.type === 'tiltChanged' && e.source === 'early_bed')).toBeTruthy()
    expect(night.state.eventState.bedTilt).toBe(55)
    expect(night.state).toMatchObject({ tilt: 15, earlyCarry: 10 })
    expect(night.state.earlyBedPending).toBeUndefined()
    const morning = act(night.state, { type: 'day/wake' }).state
    expect(morning.energy).toBe(110)
    expect(morning.earlyCarry).toBeUndefined()
  })

  it('штраф карточки сна гасит базу, бонус сверху сохраняется; карточка ⚡ не срезает 110', () => {
    const woke = act(run({ phase: 'daySummary', earlyCarry: 10, energyModNextMorning: -40 }), { type: 'day/wake' }).state
    expect(woke.energy).toBe(70)
  })

  it('проверки: из казино нельзя, нужно ⚡ ≥ 10', () => {
    expect(canExecute(run({ location: 'casino' }), { type: 'day/early' }, on)).toEqual({ reason: 'in_casino' })
    expect(canExecute(run({ energy: 9 }), { type: 'day/early' }, on)).toEqual({ reason: 'no_energy', min: 10 })
  })

  it('в день счёта: открывается счёт; «Назад» отменяет ранний сон', () => {
    const billDay = run({ day: 7, energy: 50, tilt: 60 })
    billDay.bills = billDay.bills.map((b) => (b.week === 1 ? { ...b, status: 'due' } : b))
    const bills = act(billDay, { type: 'day/early' }).state
    expect(bills).toMatchObject({ phase: 'bills', earlyBedPending: true })
    const back = act(bills, { type: 'day/resume' }).state
    expect(back.phase).toBe('day')
    expect(back.earlyBedPending).toBeUndefined()
    const slept = chain(back, [{ type: 'day/sleep' }, { type: 'bills/defer' }])
    expect(slept.earlyCarry).toBeUndefined()
    // отсрочка ведёт в ночь — бонус применяется
    const deferred = act(bills, { type: 'bills/defer' }).state
    expect(deferred.earlyCarry).toBe(10)
  })
})

describe('тильт помнит вечер и пробуждение в казино (§3.4, §10 п.6)', () => {
  it('спад за ночь TILT_SLEEP_DECAY_FIX (40) вместо 50', () => {
    expect(act(run({ tilt: 90 }), { type: 'day/sleep' }).state.tilt).toBe(90 - B.TILT_SLEEP_DECAY_FIX)
  })

  it('после «Ночи в казино»: утро в казино, 🔥 50; первый выход −10⚡, второй бесплатно', () => {
    const night = act(run({ location: 'casino', casinoNightPending: true, tilt: 100, casino: 1000 }), { type: 'day/sleep' }).state
    expect(night).toMatchObject({ location: 'casino', wokeInCasino: true, tilt: B.TILT_AFTER_CASINO_NIGHT_FIX })
    const morning = act(night, { type: 'day/wake' }).state
    expect(morning).toMatchObject({ phase: 'day', location: 'casino', energy: 100 })
    expect(canExecute(morning, { type: 'work/shift' }, on)).toEqual({ reason: 'in_casino' })
    const left = act(morning, { type: 'casino/leave' })
    expect(left.state).toMatchObject({ location: 'life', energy: 90 })
    expect(left.state.wokeInCasino).toBeUndefined()
    expect(left.events).toEqual([{ type: 'casinoLeft', woke: true, energy: 10 }])
    const again = chain(left.state, [{ type: 'casino/enter' }])
    const left2 = act(again, { type: 'casino/leave' })
    expect(left2.state.energy).toBe(90)
    expect(left2.events).toEqual([{ type: 'casinoLeft' }])
  })

  it('выход никогда не блокирует: при 3⚡ списывает 3', () => {
    const r = act(run({ location: 'casino', wokeInCasino: true, energy: 3 }), { type: 'casino/leave' })
    expect(r.state.energy).toBe(0)
    expect(r.events[0]).toMatchObject({ woke: true, energy: 3 })
  })

  it('мама поставила блок: старт в «Жизни»', () => {
    const night = act(run({ location: 'casino', casinoNightPending: true, tilt: 100, casino: 1000 }), { type: 'day/sleep' }).state
    const blocked = { ...night, eventState: { ...night.eventState, casinoBlockedUntil: night.day } }
    const morning = act(blocked, { type: 'day/wake' }).state
    expect(morning.location).toBe('life')
    expect(morning.wokeInCasino).toBeUndefined()
  })

  it('флаг выключен: после «Ночи» утро в «Жизни»', () => {
    const night = act(run({ location: 'casino', casinoNightPending: true, tilt: 100, casino: 1000 }, off), { type: 'day/sleep' }, off).state
    expect(night.location).toBe('life')
    expect('wokeInCasino' in night).toBe(false)
  })
})

describe('сейв (§5)', () => {
  const env = { config: on, now: 0, seed: 1 }

  it('валидные поля копируются, мусорные опускаются; старый сейв без полей — undefined', () => {
    const good = validateRun({ ...run({ day: 5 }), eveningUsed: 'family', workToday: 'half', lastFamilyDay: 3, earlyCarry: 10, earlyBedPending: true, wokeInCasino: true, energy: 110 }, env)
    expect(good).toMatchObject({ eveningUsed: 'family', workToday: 'half', lastFamilyDay: 3, earlyCarry: 10, earlyBedPending: true, wokeInCasino: true, energy: 110 })
    const bad = validateRun({ ...run({ day: 5 }), eveningUsed: 'casino', workToday: 1, lastFamilyDay: 6, earlyCarry: 11, earlyBedPending: false, wokeInCasino: 'yes' }, env)
    for (const key of ['eveningUsed', 'workToday', 'lastFamilyDay', 'earlyCarry', 'earlyBedPending', 'wokeInCasino']) {
      expect(key in (bad ?? {}), key).toBe(false)
    }
  })

  it('новые события не теряются в хронике при загрузке', () => {
    const s = chain(run(), [{ type: 'work/half' }])
    const loaded = validateRun(JSON.parse(JSON.stringify(s)), env)
    expect(loaded?.log.some((e) => e.event.type === 'halfShiftWorked')).toBe(true)
  })
})
