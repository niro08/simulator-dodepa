/**
 * Пакет 2 «Контакты» (design/contacts-shady.md): генерация, срок, сгорание, засвет, ярусы, разводы, вещи,
 * сейв и тест контента (EV ≤ 8₽/⚡). Критерии приёмки §12 п.1–10.
 */
import { describe, expect, it } from 'vitest'
import { noEventsConfig, type GameConfig } from './config'
import { burnedCount, contactDepth, offerCandidates, offerEv, pEff } from './contacts'
import { CONTACT_OFFERS, type OfferDef } from './content/contacts'
import { canExecute, dispatch, executeCommand } from './reducer'
import { createRng, deriveSeed, fnv1a } from './rng'
import { validateRun } from './save/validate'
import { newSession } from './testing'
import type { Command, ContactsState, EventOf, GameEvent, RunState } from './types'
import { buildContacts } from './view'

const on: GameConfig = { ...noEventsConfig, balance: { ...noEventsConfig.balance, FEATURE_EVENING_FIX: true, FEATURE_CONTACTS: true } }
const off: GameConfig = { ...noEventsConfig, balance: { ...noEventsConfig.balance, FEATURE_EVENING_FIX: true, FEATURE_CONTACTS: false } }
const B = on.balance
const def = (id: string): OfferDef => CONTACT_OFFERS.find((o) => o.id === id)!
const run = (seed = 1, patch: Partial<RunState> = {}, cfg: GameConfig = on): RunState => ({ ...newSession(seed, cfg, false).run, ...patch })
const act = (state: RunState, cmd: Command, cfg: GameConfig = on) => dispatch(state, cmd, { rng: createRng(1), config: cfg, now: 0 })
const find = <T extends GameEvent['type']>(events: readonly GameEvent[], type: T) =>
  events.find((e) => e.type === type) as EventOf<T> | undefined
/** Ран с заданным предложением на руках. */
const withOffer = (id: string, patch: Partial<ContactsState> = {}, runPatch: Partial<RunState> = {}, seed = 1): RunState => {
  const r = run(seed, runPatch)
  return {
    ...r,
    contacts: { offers: [{ id, reward: def(id).rewardMax, expiresDay: r.day + def(id).expiry }], used: [], burned: [], heat: 0, ...patch }
  }
}
const nextDay = (s: RunState, cfg: GameConfig = on) => {
  const a = executeCommand(s, { type: 'day/sleep' }, { config: cfg, now: 0 })
  expect(a.ok).toBe(true)
  const b = executeCommand(a.state, { type: 'day/wake' }, { config: cfg, now: 0 })
  expect(b.ok).toBe(true)
  return b.state
}
const offer = (s: RunState, id: string) => act(s, { type: 'work/offer', offerId: id })

describe('контент (§3.1, §5, §12 п.10)', () => {
  it('id уникальны; суммы кратны шагу; у разводов p = 0 и штраф 0; EV нормальных ≤ 8₽/⚡ при засвете 0', () => {
    expect(new Set(CONTACT_OFFERS.map((o) => o.id)).size).toBe(CONTACT_OFFERS.length)
    expect(on.contacts.offers).toBe(CONTACT_OFFERS)
    for (const o of CONTACT_OFFERS) {
      expect(o.rewardMin, o.id).toBeLessThanOrEqual(o.rewardMax)
      expect(o.rewardMin % B.CONTACT_REWARD_STEP, o.id).toBe(0)
      expect(o.rewardMax % B.CONTACT_REWARD_STEP, o.id).toBe(0)
      expect(o.rep, o.id).toBeLessThanOrEqual(0)
      if (o.scam) {
        expect(o.successChance, o.id).toBe(0)
        expect(o.fine, o.id).toBe(0)
        expect(offerEv(o, 0, B), o.id).toBe(-o.scam.price)
      } else {
        expect(offerEv(o, 0, B) / o.energy, o.id).toBeLessThanOrEqual(B.CONTACT_EV_PER_ENERGY_MAX + 1e-9)
      }
      if (o.afterOffer) expect(CONTACT_OFFERS.some((x) => x.id === o.afterOffer)).toBe(true)
    }
  })

  it('таблица EV §5: ярус 1 в плюсе по деньгам, gosha_safe при засвете 30 ≈ −1500', () => {
    expect(Math.round(offerEv(def('tolik_wash'), 0, B))).toBe(240)
    expect(Math.round(offerEv(def('neighbor_boxes'), 0, B))).toBe(115)
    expect(Math.round(offerEv(def('vadik_point'), 0, B))).toBe(-175)
    expect(Math.round(offerEv(def('gosha_safe'), 30, B))).toBe(-1500)
  })
})

describe('флаг (§12 п.1–2)', () => {
  it('contactsOn = false: work/offer → feature_disabled, поля contacts нет, темка по-старому', () => {
    const s = nextDay(run(1, {}, off), off)
    expect('contacts' in s).toBe(false)
    expect(canExecute(s, { type: 'work/offer', offerId: 'tolik_wash' }, off)).toEqual({ reason: 'feature_disabled' })
    expect(canExecute(s, { type: 'work/shady' }, off)).toBeNull()
    // без FEATURE_EVENING_FIX контакты тоже выключены
    const noFix: GameConfig = { ...on, balance: { ...B, FEATURE_EVENING_FIX: false } }
    expect('contacts' in run(1, {}, noFix)).toBe(false)
  })

  it('contactsOn = true: work/shady → feature_disabled', () => {
    expect(canExecute(run(), { type: 'work/shady' }, on)).toEqual({ reason: 'feature_disabled' })
  })
})

describe('утро: генерация (§4.1–4.2, §12 п.4–5)', () => {
  it('rng: deriveSeed и fnv1a — чистые uint32', () => {
    expect(deriveSeed(1, 1, 0xc0a7ac75)).toBe(deriveSeed(1, 1, 0xc0a7ac75))
    expect(deriveSeed(1, 2, 0xc0a7ac75)).not.toBe(deriveSeed(1, 1, 0xc0a7ac75))
    expect(fnv1a('')).toBe(0x811c9dc5)
    expect(fnv1a('a')).toBe(0xe40c292c)
  })

  it('день 1: ровно 2 предложения яруса 1; rngState не меняется; тот же сид — те же предложения', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = run(seed)
      expect(r.contacts?.offers).toHaveLength(2)
      for (const o of r.contacts!.offers) expect(def(o.id).tier).toBe(1)
      expect(r.rngState).toBe(run(seed, {}, off).rngState)
      expect(r.contacts).toEqual(run(seed).contacts)
      for (const o of r.contacts!.offers) {
        const d = def(o.id)
        expect(o.reward).toBeGreaterThanOrEqual(d.rewardMin)
        expect(o.reward).toBeLessThanOrEqual(d.rewardMax)
      }
    }
  })

  it('день 8 без долгов: 3 слота, ярус 2 возможен; ярус 3 — нет', () => {
    const tiers = new Set<number>()
    for (let seed = 1; seed <= 60; seed++) {
      const r = run(seed, { day: 8 })
      expect(contactDepth(r, on)).toBe(2)
      const fresh = { ...r, contacts: { offers: [], used: [], burned: [], heat: 0 } }
      const s = nextDay({ ...fresh, day: 7, bills: fresh.bills.map((b) => ({ ...b, status: 'paid' as const })) })
      expect(s.day).toBe(8)
      expect(s.contacts!.offers).toHaveLength(3)
      for (const o of s.contacts!.offers) tiers.add(def(o.id).tier)
    }
    expect(tiers.has(2)).toBe(true)
    expect(tiers.has(3)).toBe(false)
  })

  it('долг 15 000 на 3-й день открывает ярус 3', () => {
    const tiers = new Set<number>()
    for (let seed = 1; seed <= 60; seed++) {
      const r = run(seed, { day: 2, debtMfo: 15_000 })
      const s = nextDay({ ...r, contacts: { offers: [], used: [], burned: [], heat: 0 } })
      expect(s.day).toBe(3)
      expect(contactDepth(s, on)).toBe(3)
      for (const o of s.contacts!.offers) tiers.add(def(o.id).tier)
    }
    expect(tiers.has(3)).toBe(true)
  })

  it('глубина: ❤️ ≤ 5 → 2, ❤️ ≤ 0 → 3, сожжено ≥ 2 → 2', () => {
    expect(contactDepth(run(1, { rep: 6 }), on)).toBe(1)
    expect(contactDepth(run(1, { rep: 5 }), on)).toBe(2)
    expect(contactDepth(run(1, { rep: 0 }), on)).toBe(3)
    const r = withOffer('tolik_wash', { used: ['neighbor_boxes', 'valera_pallets'] })
    expect(burnedCount(r, on)).toBe(2)
    expect(contactDepth(r, on)).toBe(2)
    // сгоревший Вадик: + его непотраченные предложения (4 шт.)
    expect(burnedCount(withOffer('tolik_wash', { burned: ['vadik'] }), on)).toBe(4)
  })

  it('срок: «до завтра» живёт один день, ярус 3 «только сегодня»; eduard_tv — только при долге ≥ 10 000', () => {
    const s = withOffer('tolik_wash')
    const d2 = nextDay(s)
    expect(d2.contacts!.offers.some((o) => o.id === 'tolik_wash')).toBe(true)
    const d3 = nextDay(d2)
    expect(d3.contacts!.offers.some((o) => o.id === 'tolik_wash')).toBe(false)
    expect(d3.contacts!.used).not.toContain('tolik_wash')
    const safe = nextDay(withOffer('gosha_safe'))
    expect(safe.contacts!.offers.some((o) => o.id === 'gosha_safe')).toBe(false)
    const tv = nextDay(withOffer('eduard_tv', {}, { debtMfo: 11_000 }))
    expect(tv.debtMfo).toBeGreaterThanOrEqual(10_000)
    const deep = run(1, { rep: 0, debtMfo: 0 })
    expect(offerCandidates({ ...deep, contacts: { offers: [], used: [], burned: [], heat: 0 } }, on).some((c) => c.def.id === 'eduard_tv')).toBe(false)
    expect(
      offerCandidates({ ...deep, debtMfo: 10_000, contacts: { offers: [], used: [], burned: [], heat: 0 } }, on).some((c) => c.def.id === 'eduard_tv')
    ).toBe(true)
  })

  it('кандидатов нет — слоты пустые, «Телефон молчит»', () => {
    const all = CONTACT_OFFERS.map((o) => o.id)
    const s = nextDay({ ...run(), contacts: { offers: [], used: all, burned: [], heat: 0 } })
    expect(s.contacts!.offers).toEqual([])
    expect(buildContacts(s, on)?.offers).toEqual([])
  })
})

describe('команда work/offer (§4.3, §12 п.6)', () => {
  it('порядок проверок: no_offer → item_not_owned → evening_used → no_energy; развод — no_money; из казино — in_casino', () => {
    const s = withOffer('tolik_wash')
    expect(canExecute(s, { type: 'work/offer', offerId: 'gosha_safe' }, on)).toEqual({ reason: 'no_offer' })
    expect(canExecute({ ...s, location: 'casino' }, { type: 'work/offer', offerId: 'tolik_wash' }, on)).toEqual({ reason: 'in_casino' })
    expect(canExecute({ ...s, eveningUsed: 'family', energy: 0 }, { type: 'work/offer', offerId: 'tolik_wash' }, on)).toEqual({
      reason: 'evening_used',
      evening: 'family'
    })
    expect(canExecute({ ...s, energy: 29 }, { type: 'work/offer', offerId: 'tolik_wash' }, on)).toEqual({ reason: 'no_energy', min: 30 })
    expect(canExecute({ ...s, phase: 'bills' }, { type: 'work/offer', offerId: 'tolik_wash' }, on)).toEqual({ reason: 'wrong_phase' })
    const scam = withOffer('mentor_course', {}, { wallet: 1499 })
    expect(canExecute(scam, { type: 'work/offer', offerId: 'mentor_course' }, on)).toEqual({ reason: 'no_money', min: 1500 })
  })

  it('сделка занимает вечер, ⚡ и ❤️ списываются, предложение гаснет навсегда; успех — +reward', () => {
    let seen = { ok: false, fail: false }
    for (let seed = 1; seed <= 40 && !(seen.ok && seen.fail); seed++) {
      const s = withOffer('tolik_wash', {}, { wallet: 5000 }, seed)
      const r = offer(s, 'tolik_wash')
      expect(r.ok).toBe(true)
      const st = r.state
      expect(st.eveningUsed).toBe('shady')
      expect(st.energy).toBe(s.energy - 30)
      expect(st.contacts!.used).toContain('tolik_wash')
      expect(st.contacts!.offers.some((o) => o.id === 'tolik_wash')).toBe(false)
      expect(st.contacts!.heat).toBe(10)
      expect(st.contacts!.lastDealDay).toBe(s.day)
      expect(st.rngState).toBe(s.rngState)
      const e = find(r.events, 'schemeResolved')!
      expect(e.offerId).toBe('tolik_wash')
      if (e.success) {
        seen.ok = true
        expect(st.wallet).toBe(5000 + 900)
        expect(st.today.earned).toBe(900)
        expect(st.rep).toBe(s.rep - 1)
        expect(st.contacts!.burned).toEqual([])
      } else {
        seen.fail = true
        expect(e.fine).toBe(2000)
        expect(st.wallet).toBe(3000)
        expect(st.tilt).toBe(s.tilt + 10)
        expect(st.contacts!.burned).toEqual(['tolik'])
      }
      // тот же сид — тот же исход (подпоток сделки от сида, дня и id)
      expect(offer(s, 'tolik_wash').events).toEqual(r.events)
    }
    expect(seen).toEqual({ ok: true, fail: true })
  })

  it('провал сжигает контакт: утром все его предложения исчезают и больше не выпадают', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = withOffer('tolik_wash', {}, { wallet: 5000 }, seed)
      const both = { ...s, contacts: { ...s.contacts!, offers: [...s.contacts!.offers, { id: 'tolik_car', reward: 2700, expiresDay: s.day + 1 }] } }
      const r = offer(both, 'tolik_wash')
      if (find(r.events, 'schemeResolved')!.success) continue
      let st = r.state
      for (let i = 0; i < 12; i++) {
        st = nextDay(st)
        expect(st.contacts!.offers.every((o) => def(o.id).contact !== 'tolik')).toBe(true)
        if (st.phase !== 'day') break
      }
      return
    }
    throw new Error('не нашлось провала')
  })

  it('взятое предложение не выпадает до конца рана', () => {
    const r = offer(withOffer('neighbor_boxes', {}, { wallet: 5000 }), 'neighbor_boxes').state
    let st = r
    for (let i = 0; i < 10 && st.phase === 'day'; i++) {
      st = nextDay({ ...st, bills: st.bills.map((b) => ({ ...b, status: 'paid' as const })) })
      expect(st.contacts!.offers.some((o) => o.id === 'neighbor_boxes')).toBe(false)
    }
  })
})

describe('вещи (§6, §12 п.7)', () => {
  it('велик в ломбарде: lyoha_courier серый item_not_owned, утром исчезает; после выкупа может выпасть снова', () => {
    const s = withOffer('lyoha_courier', {}, { wallet: 10_000 })
    const pawned = act(s, { type: 'pawn/pawn', item: 'bike' }).state
    expect(canExecute(pawned, { type: 'work/offer', offerId: 'lyoha_courier' }, on)).toEqual({ reason: 'item_not_owned' })
    expect(buildContacts(pawned, on)?.offers[0]?.rejection).toEqual({ reason: 'item_not_owned' })
    const next = nextDay(pawned)
    expect(next.contacts!.offers.some((o) => o.id === 'lyoha_courier')).toBe(false)
    expect(offerCandidates(next, on).some((c) => c.def.id === 'lyoha_courier')).toBe(false)
    const back = act(next, { type: 'pawn/redeem', item: 'bike' }).state
    expect(back.items.bike).toBe('owned')
    expect(offerCandidates(back, on).some((c) => c.def.id === 'lyoha_courier')).toBe(true)
  })
})

describe('засвет и «Сел» (§4.4, §12 п.8)', () => {
  it('сделка яруса 2 при засвете 0 → 20; день без сделки → 0; в день сделки не спадает', () => {
    const s = withOffer('gosha_phones', {}, { wallet: 5000 })
    const done = offer(s, 'gosha_phones').state
    expect(done.contacts!.heat).toBe(20)
    const d2 = nextDay(done)
    expect(d2.contacts!.heat).toBe(20)
    const d3 = nextDay(d2)
    expect(d3.contacts!.heat).toBe(0)
  })

  it('шанс при засвете 40 ниже базового на 20 п.п.; кламп 5…95%', () => {
    expect(pEff(def('tolik_wash'), 40, B)).toBeCloseTo(0.6)
    expect(pEff(def('gosha_safe'), 100, B)).toBe(B.CONTACT_P_MIN)
    const view = buildContacts(withOffer('tolik_wash', { heat: 40 }), on)!
    expect(view.offers[0]!.chanceBase).toBe(0.8)
    expect(view.offers[0]!.chance).toBeCloseTo(0.6)
    expect(view.heatPenaltyPct).toBe(20)
    expect(view.jailRisk).toBe(false)
  })

  it('провал при засвете ≥ 60 и ❤️ > −10 бросает арест с шансом def.jail; при засвете 50 — нет', () => {
    let fails = 0
    let jailed = 0
    for (let seed = 1; seed <= 400; seed++) {
      const hot = offer(withOffer('gosha_safe', { heat: 60 }, { wallet: 10_000 }, seed), 'gosha_safe')
      const e = find(hot.events, 'schemeResolved')!
      if (!e.success) fails += 1
      if (e.jailed) {
        jailed += 1
        expect(hot.state.endingId).toBe('jail')
      }
      const cool = find(offer(withOffer('gosha_safe', { heat: 50 }, { wallet: 10_000 }, seed), 'gosha_safe').events, 'schemeResolved')!
      expect(cool.jailed).toBe(false)
    }
    expect(jailed).toBeGreaterThan(0)
    expect(jailed / fails).toBeGreaterThan(0.25)
    expect(jailed / fails).toBeLessThan(0.55)
    expect(buildContacts(withOffer('gosha_safe', { heat: 60 }), on)!.jailRisk).toBe(true)
  })
})

describe('разводы (§4.3 п.2, §12 п.9)', () => {
  it('списывает price, scamPaid вместо schemeResolved, засвет и lastDealDay не меняются; luck_boost ставит значок', () => {
    const s = withOffer('luck_boost', { heat: 30 }, { wallet: 5000 })
    const r = offer(s, 'luck_boost')
    expect(r.ok).toBe(true)
    expect(find(r.events, 'scamPaid')).toEqual({ type: 'scamPaid', offerId: 'luck_boost', price: 2000 })
    expect(find(r.events, 'schemeResolved')).toBeUndefined()
    expect(r.state.wallet).toBe(3000)
    expect(r.state.contacts!.heat).toBe(30)
    expect(r.state.contacts!.lastDealDay).toBeUndefined()
    expect(r.state.contacts!.fakeLuckUntil).toBe(s.day + 3)
    expect(r.state.eveningUsed).toBe('shady')
    expect(buildContacts(r.state, on)!.fakeLuck).toBe(true)
    // ночью засвет спадает: сделки не было
    expect(nextDay(r.state).contacts!.heat).toBe(10)
  })

  it('mentor_pro выпадает только после mentor_course', () => {
    const base = run(1, { day: 10 })
    const without = { ...base, contacts: { offers: [], used: [], burned: [], heat: 0 } }
    expect(offerCandidates(without, on).some((c) => c.def.id === 'mentor_pro')).toBe(false)
    const after = { ...base, contacts: { offers: [], used: ['mentor_course'], burned: [], heat: 0 } }
    expect(offerCandidates(after, on).some((c) => c.def.id === 'mentor_pro')).toBe(true)
  })
})

describe('сейв (§3.2)', () => {
  const env = (config: GameConfig) => ({ config, now: 0, seed: 1 })

  it('валидная структура копируется; неизвестные id и контакты выкидываются', () => {
    const s = withOffer('tolik_wash', { used: ['neighbor_boxes', 'deleted_offer'], burned: ['vadik'], heat: 30, lastDealDay: 1 })
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>
    const c = raw.contacts as Record<string, unknown>
    ;(c.offers as unknown[]).push({ id: 'deleted_offer', reward: 100, expiresDay: 3 })
    ;(c.burned as unknown[]).push('nobody')
    const v = validateRun(raw, env(on))!
    expect(v.contacts).toEqual({
      offers: [{ id: 'tolik_wash', reward: 900, expiresDay: s.day + 1 }],
      used: ['neighbor_boxes'],
      burned: ['vadik'],
      heat: 30,
      lastDealDay: 1
    })
  })

  it('битая структура или выключенный флаг — поля нет (утром создастся заново)', () => {
    const s = withOffer('tolik_wash')
    const broken = { ...JSON.parse(JSON.stringify(s)), contacts: { offers: 'x', used: [], burned: [], heat: 0 } }
    expect(validateRun(broken, env(on))!.contacts).toBeUndefined()
    expect(validateRun(JSON.parse(JSON.stringify(s)), env(off))!.contacts).toBeUndefined()
    const clamped = { ...JSON.parse(JSON.stringify(s)), contacts: { ...s.contacts, heat: 500 } }
    expect(validateRun(clamped, env(on))!.contacts!.heat).toBe(100)
  })
})
