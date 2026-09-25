import { describe, expect, it } from 'vitest'
import { SLEEP_EVENT_TEXTS } from '@/i18n'
import { defaultConfig, EVENT_WEIGHTS, EVENTS_BALANCE as E } from '../config'
import { eligibleSleepEvents } from '../day'
import { canExecute } from '../reducer'
import { shiftPay } from '../rules'
import { exec, newSession, type Session } from '../testing'
import type { RunState } from '../types'
import { buildPendingEvent } from '../view'
import { SLEEP_EVENTS } from './events'

const config = defaultConfig
const B = config.balance

/** Сессия дня 5 с принудительно показанной карточкой id (и правкой состояния). */
function withEvent(id: string, patch: Partial<RunState> = {}, seed = 1): Session {
  const s = newSession(seed, config)
  s.run = { ...s.run, day: 5, ...patch, phase: 'event', pendingEventId: id }
  return s
}

const choose = (s: Session, option: number) => exec(s, { type: 'event/choose', option })

describe('CD-12: пул карточек сна (данные)', () => {
  it('26 карточек content-pack + 3 бытовые; у каждой текст, вес из конфига и бесплатный вариант', () => {
    expect(SLEEP_EVENTS).toHaveLength(29)
    expect(new Set(SLEEP_EVENTS.map((e) => e.id)).size).toBe(29)
    for (const e of SLEEP_EVENTS) {
      expect(EVENT_WEIGHTS[e.id as keyof typeof EVENT_WEIGHTS], e.id).toBe(e.weight)
      expect(SLEEP_EVENT_TEXTS[e.id]?.options, e.id).toHaveLength(2)
      expect(SLEEP_EVENT_TEXTS[e.id]?.results, e.id).toHaveLength(2)
      expect(e.options.some((o) => o.cost === undefined && !o.effect.mfoLoan), e.id).toBe(true)
    }
    expect(config.events.pool).toBe(SLEEP_EVENTS)
  })

  it('1000 ранов-ночей без исключений: все 29 карточек встречаются, энергия и деньги в границах', () => {
    const seen = new Set<string>()
    const choosers = [0, 1]
    for (let seed = 1; seed <= 400 && seen.size < 29; seed++) {
      const s = newSession(seed, config, false)
      const pick = choosers[seed % 2] ?? 1
      for (let guard = 0; guard < 400 && s.run.phase !== 'ended' && s.run.day <= 28; guard++) {
        const run = s.run
        if (run.phase === 'event') {
          seen.add(run.pendingEventId ?? '')
          const view = buildPendingEvent(run, config)
          const option = view?.options[pick]?.affordable ? pick : 1
          exec(s, { type: 'event/choose', option })
        } else if (run.phase === 'daySummary') exec(s, { type: 'day/wake' })
        else if (run.phase === 'bills') {
          if (canExecute(run, { type: 'bills/pay' }, config)) exec(s, { type: 'bills/refuse' })
          else exec(s, { type: 'bills/pay' })
        } else if (run.phase === 'fork') break
        else if (run.phase === 'day') {
          // Разнообразный день: смена, казино, друзья, ломбард, темка — чтобы открыть условия карточек
          const variant = (seed + run.day) % 5
          if (variant === 0 && !canExecute(run, { type: 'work/shift' }, config)) exec(s, { type: 'work/shift' })
          if (variant === 1 && !canExecute(run, { type: 'friends/borrow' }, config)) exec(s, { type: 'friends/borrow' })
          if (variant === 2 && !canExecute(run, { type: 'pawn/pawn', item: 'teaset' }, config)) exec(s, { type: 'pawn/pawn', item: 'teaset' })
          if (variant === 3 && !canExecute(run, { type: 'mfo/loan' }, config)) exec(s, { type: 'mfo/loan' })
          if (variant === 4 && !canExecute(run, { type: 'work/shady' }, config)) exec(s, { type: 'work/shady' })
          if (s.run.phase === 'day' && seed % 3 !== 0) {
            if (!canExecute(s.run, { type: 'casino/enter' }, config)) exec(s, { type: 'casino/enter' })
            if (s.run.casino < B.MIN_BET && !canExecute(s.run, { type: 'casino/deposit', amount: 500 }, config)) {
              exec(s, { type: 'casino/deposit', amount: seed % 4 === 0 ? s.run.wallet : 500, bonus: seed % 4 === 1 })
            }
            if (seed % 4 === 0) exec(s, { type: 'bet/set', value: 500 })
            for (let i = 0; i < 25 && !canExecute(s.run, { type: 'slot/spin' }, config); i++) exec(s, { type: 'slot/spin' })
            if (s.run.phase === 'day' && s.run.casino >= 1000 && !canExecute(s.run, { type: 'casino/withdraw', amount: 1000 }, config)) {
              exec(s, { type: 'casino/withdraw', amount: 1000 })
            }
            if (s.run.phase === 'day' && s.run.location === 'casino') exec(s, { type: 'casino/leave' })
          }
          if (s.run.phase === 'day') exec(s, { type: 'day/sleep' })
        }
        expect(s.run.energy).toBeLessThanOrEqual(B.ENERGY_PER_DAY)
        expect(s.run.wallet).toBeGreaterThanOrEqual(0)
        expect(s.run.casino).toBeGreaterThanOrEqual(0)
      }
    }
    expect([...SLEEP_EVENTS.map((e) => e.id)].filter((id) => !seen.has(id))).toEqual([])
  }, 60_000)

  it('условия: цепочки и пороги', () => {
    const base = newSession(1, config).run
    const ids = (run: RunState) => eligibleSleepEvents(run, config).map((e) => e.id)
    expect(ids(base)).not.toContain('eduard_visit')
    expect(ids({ ...base, flags: { eduard_ignored: true } })).toContain('eduard_visit')
    expect(ids(base)).not.toContain('mama_blocks_site')
    expect(ids({ ...base, flags: { mama_told: true } })).toContain('mama_blocks_site')
    expect(ids({ ...base, eventState: { ...base.eventState, bedTilt: 70 }, casino: 500 })).toContain('insomnia_spin')
    expect(ids({ ...base, eventState: { ...base.eventState, bedTilt: 69 }, casino: 500 })).not.toContain('insomnia_spin')
    expect(ids({ ...base, today: { ...base.today, nearMiss: 3 } })).toContain('dream_777')
    expect(ids({ ...base, day: 3, items: { ...base.items, bike: 'pawned' }, eventState: { ...base.eventState, pawnedOn: { bike: 1 } } })).toContain(
      'pawn_offer'
    )
    expect(ids({ ...base, day: 2, items: { ...base.items, bike: 'pawned' }, eventState: { ...base.eventState, pawnedOn: { bike: 1 } } })).not.toContain(
      'pawn_offer'
    )
    // «один раз за ран»
    expect(ids({ ...base, eventCooldowns: { mama_meds: 2 }, day: 20 })).not.toContain('mama_meds')
  })
})

describe('CD-12: механики карточек', () => {
  it('mama_meds: платный вариант недоступен без денег; эффекты ❤️/🔥', () => {
    const poor = withEvent('mama_meds', { wallet: 100 })
    expect(canExecute(poor.run, { type: 'event/choose', option: 0 }, config)).toEqual({ reason: 'option_unaffordable', min: E.EVT_MAMA_MEDS_COST })
    const s = withEvent('mama_meds', { wallet: 5000, rep: 10 })
    choose(s, 0)
    expect(s.run).toMatchObject({ wallet: 3000, rep: 14, phase: 'day' })
  })

  it('push_we_miss_you: 50 фриспинов → баланс казино под вейджер ×40', () => {
    const s = withEvent('push_we_miss_you')
    const r = choose(s, 0)
    const credited = r.events.find((e) => e.type === 'casinoCredited')
    expect(credited).toMatchObject({ source: 'freespins' })
    if (credited?.type !== 'casinoCredited') throw new Error()
    expect(s.run.casino).toBe(credited.amount)
    if (credited.amount > 0) expect(s.run.bonus).toMatchObject({ state: 'active', wagerReq: 40 * credited.amount })
  })

  it('eduard_call: 500₽ гасят долг; «сбросить» открывает eduard_visit', () => {
    const s = withEvent('eduard_call', { wallet: 1000, debtMfo: 3000 })
    choose(s, 0)
    expect(s.run).toMatchObject({ wallet: 500, debtMfo: 2500 })
    const small = withEvent('eduard_call', { wallet: 1000, debtMfo: 200 })
    choose(small, 0)
    expect(small.run).toMatchObject({ wallet: 800, debtMfo: 0 })
    const ignore = withEvent('eduard_call', { debtMfo: 3000 })
    choose(ignore, 1)
    expect(ignore.run.flags.eduard_ignored).toBe(true)
  })

  it('eduard_visit: в результате — прогноз долга к 28-му дню', () => {
    const s = withEvent('eduard_visit', { debtMfo: 10_000 })
    const r = choose(s, 0)
    const resolved = r.events.find((e) => e.type === 'sleepEventResolved')
    expect(resolved).toMatchObject({ eventId: 'eduard_visit' })
    if (resolved?.type !== 'sleepEventResolved') throw new Error()
    expect(resolved.amount).toBeGreaterThan(10_000)
  })

  it('boss_saturday: +600₽ и смена засчитана для повышения', () => {
    const s = withEvent('boss_saturday', { shiftsDone: 4, wallet: 0 })
    choose(s, 0)
    expect(s.run).toMatchObject({ wallet: E.EVT_BOSS_SAT_PAY, shiftsDone: 5, energy: 100 + E.EVT_BOSS_SAT_ENERGY })
  })

  it('boss_caught / boss_advance: вычеты из следующих смен', () => {
    const caught = withEvent('boss_caught')
    const full = shiftPay(caught.run, B)
    choose(caught, 0)
    const r1 = exec(caught, { type: 'work/shift' })
    expect(r1.events.find((e) => e.type === 'shiftWorked')).toMatchObject({ pay: full - Math.round(full * 0.3), deducted: Math.round(full * 0.3) })

    const adv = withEvent('boss_advance', { wallet: 0 })
    choose(adv, 0)
    expect(adv.run.wallet).toBe(E.EVT_ADVANCE_AMOUNT)
    expect(adv.run.eventState.shiftDeductions).toEqual([1000, 1000])
    const pay = shiftPay(adv.run, B)
    exec(adv, { type: 'work/shift' })
    expect(adv.run.wallet).toBe(E.EVT_ADVANCE_AMOUNT + Math.max(0, pay - 1000))
    expect(adv.run.eventState.shiftDeductions).toEqual([1000])
  })

  it('seryoga_wants_back: вернуть весь долг Серёге', () => {
    const s = newSession(3, config)
    exec(s, { type: 'friends/borrow' })
    const lent = s.run.eventState.friendDebt
    expect(lent).toBeGreaterThan(0)
    s.run = { ...s.run, phase: 'event', pendingEventId: 'seryoga_wants_back' }
    expect(buildPendingEvent(s.run, config)?.options[0]).toMatchObject({ cost: lent, affordable: true })
    const wallet = s.run.wallet
    choose(s, 0)
    expect(s.run.wallet).toBe(wallet - lent)
    expect(s.run.eventState.friendDebt).toBe(0)
  })

  it('anzhelika_bonus: следующий депозит +100% (до 3000₽) под вейджер ×35', () => {
    const s = withEvent('anzhelika_bonus', { wallet: 5000, bonus: { state: 'declined', wagerReq: 0, wagered: 0 }, flags: { deposited: true } })
    choose(s, 0)
    exec(s, { type: 'casino/deposit', amount: 4000 })
    expect(s.run.casino).toBe(4000 + 3000)
    expect(s.run.bonus).toMatchObject({ state: 'active', wagerReq: 35 * 3000 })
    expect(s.run.flags.anzhelika_boost).toBe(false)
  })

  it('sms_preapproved: займ МФО; при лимите долга вариант недоступен', () => {
    const s = withEvent('sms_preapproved', { wallet: 0, rep: 5 })
    choose(s, 0)
    expect(s.run).toMatchObject({ wallet: B.MFO_LOAN, debtMfo: B.MFO_LOAN })
    const full = withEvent('sms_preapproved', { debtMfo: B.DEBT_LIMIT - 1000 })
    expect(canExecute(full.run, { type: 'event/choose', option: 0 }, config)).toEqual({ reason: 'debt_limit', min: B.DEBT_LIMIT })
  })

  it('withdraw_verification: 1000₽ уходят депозитом в казино', () => {
    const s = withEvent('withdraw_verification', { wallet: 1500 })
    const r = choose(s, 0)
    expect(s.run).toMatchObject({ wallet: 500, casino: 1000 })
    expect(r.events).toContainEqual({ type: 'deposit', amount: 1000 })
  })

  it('insomnia_spin: 10 настоящих спинов без ⚡, 🔥 +10, ⚡ −20', () => {
    const s = withEvent('insomnia_spin', { casino: 5000, bet: 100, tilt: 20 })
    const r = choose(s, 0)
    const spins = r.events.filter((e) => e.type === 'spin')
    expect(spins).toHaveLength(10)
    expect(spins.every((e) => e.type === 'spin' && e.energyCost === 0)).toBe(true)
    const net = spins.reduce((sum, e) => sum + (e.type === 'spin' ? e.payout - e.bet : 0), 0)
    expect(s.run.casino).toBe(5000 + net)
    expect(s.run.tilt).toBe(30)
    expect(s.run.energy).toBe(80)
    expect(r.events.find((e) => e.type === 'sleepEventResolved')).toMatchObject({ amount: net })
    expect(s.run.stats.spins).toBe(10)
  })

  it('mama_blocks_site: казино закрыто сегодня (вход, депозит), завтра открыто', () => {
    const s = withEvent('mama_blocks_site')
    choose(s, 0)
    expect(canExecute(s.run, { type: 'casino/enter' }, config)).toEqual({ reason: 'blocked_by_mama' })
    expect(canExecute(s.run, { type: 'casino/deposit', amount: 100 }, config)).toEqual({ reason: 'blocked_by_mama' })
    exec(s, { type: 'day/sleep' })
    if (s.run.phase === 'daySummary') exec(s, { type: 'day/wake' })
    if (s.run.phase === 'event') choose(s, 1)
    expect(canExecute(s.run, { type: 'casino/enter' }, config)).toBeNull()
  })

  it('dream_777 «Это знак»: утром сразу сайт казино', () => {
    const s = withEvent('dream_777')
    choose(s, 0)
    expect(s.run.location).toBe('casino')
  })

  it('cashback_letter: 5% недельного проигрыша под вейджер ×10', () => {
    const s = withEvent('cashback_letter', { eventState: { ...newSession(1, config).run.eventState, weekCasinoNet: -8000 } })
    expect(buildPendingEvent(s.run, config)?.vars.amount).toBe(400)
    choose(s, 0)
    expect(s.run.casino).toBe(400)
    expect(s.run.bonus).toMatchObject({ state: 'active', wagerReq: 4000 })
  })

  it('pawn_offer: самая старая вещь продаётся насовсем (+20% залога), выкуп невозможен', () => {
    const base = newSession(1, config).run
    const s = withEvent('pawn_offer', {
      wallet: 0,
      items: { ...base.items, bike: 'pawned', laptop: 'pawned' },
      eventState: { ...base.eventState, pawnedOn: { bike: 3, laptop: 1 } }
    })
    expect(buildPendingEvent(s.run, config)?.vars.item).toBe('laptop')
    const r = choose(s, 0)
    expect(s.run.items.laptop).toBe('sold')
    expect(s.run.wallet).toBe(Math.floor(B.PAWN_VALUE.laptop * 0.2))
    expect(r.events).toContainEqual({ type: 'itemSold', itemId: 'laptop', amount: 1200 })
    expect(canExecute(s.run, { type: 'pawn/redeem', item: 'laptop' }, config)).toEqual({ reason: 'item_not_pawned' })
  })

  it('life_fine: «Отложить» — долг в МФО через недостачу', () => {
    const s = withEvent('life_fine')
    choose(s, 1)
    expect(s.run.debtMfo).toBe(E.EVT_LIFE_FINE_DEBT)
  })
})
