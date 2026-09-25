import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../config'
import { canExecute, dispatch } from '../reducer'
import { createRng } from '../rng'
import { debtOf, friendAmount, shiftPay } from '../rules'
import { newSession } from '../testing'
import type { Command, RunState } from '../types'
import { minRepayAmount, planRepay } from './bank'

const config = defaultConfig
const B = config.balance
/** Ран в фазе day дня 1 («Жизнь»). */
const run = (patch: Partial<RunState> = {}): RunState => ({ ...newSession(1, config, false).run, ...patch })
const exec = (state: RunState, cmd: Command, seed = 1) => dispatch(state, cmd, { rng: createRng(seed), config, now: 5 })
const check = (state: RunState, cmd: Command) => canExecute(state, cmd, config)

describe('смена (CD-08)', () => {
  it('−60⚡, +900₽ на старте, 🔥 −10', () => {
    const result = exec(run({ tilt: 30 }), { type: 'work/shift' })
    expect(result.state).toMatchObject({ energy: 40, wallet: 1900, tilt: 20, shiftsDone: 1 })
    expect(result.events[0]).toMatchObject({ type: 'shiftWorked', pay: 900, promoted: false })
  })

  it('повышение каждые 5 смен (+15%), бонус ❤️ до +30%, штраф −30% при ❤️ < 0; кап 630…2048 (B-05)', () => {
    expect(shiftPay(run({ shiftsDone: 5 }), B)).toBe(1035)
    expect(shiftPay(run({ shiftsDone: 10, rep: 18 }), B)).toBe(Math.round(900 * 1.3 * 1.08))
    expect(shiftPay(run({ shiftsDone: 99, rep: 40 }), B)).toBe(2048)
    expect(shiftPay(run({ rep: -1 }), B)).toBe(630)
    for (let rep = B.REP_MIN; rep <= B.REP_MAX; rep++) {
      for (let shifts = 0; shifts <= 40; shifts += 5) {
        const pay = shiftPay(run({ rep, shiftsDone: shifts }), B)
        expect(pay).toBeGreaterThanOrEqual(630)
        expect(pay).toBeLessThanOrEqual(2048)
      }
    }
    const promo = exec(run({ shiftsDone: 4 }), { type: 'work/shift' })
    expect(promo.events[0]).toMatchObject({ promoted: true })
  })

  it('недоступна из казино и без сил', () => {
    expect(check(run({ location: 'casino' }), { type: 'work/shift' })).toEqual({ reason: 'in_casino' })
    expect(check(run({ energy: 59 }), { type: 'work/shift' })).toEqual({ reason: 'no_energy', min: 60 })
  })
})

describe('темка (CD-08)', () => {
  it('❤️ −2 всегда; успех 1800–2800₽ шагом 100; провал — штраф 2000, 🔥 +10', () => {
    let wins = 0
    for (let seed = 0; seed < 400; seed++) {
      const result = exec(run({ wallet: 5000 }), { type: 'work/shady' }, seed)
      expect(result.state.rep).toBe(8)
      expect(result.state.energy).toBe(70)
      const e = result.events.find((x) => x.type === 'schemeResolved')
      if (e?.type !== 'schemeResolved') throw new Error('нет события')
      if (e.success) {
        wins += 1
        expect(e.amount % 100).toBe(0)
        expect(e.amount).toBeGreaterThanOrEqual(1800)
        expect(e.amount).toBeLessThanOrEqual(2800)
        expect(result.state.wallet).toBe(5000 + e.amount)
      } else {
        expect(result.state.wallet).toBe(3000)
        expect(result.state.tilt).toBe(10)
      }
    }
    expect(wins / 400).toBeGreaterThan(0.42)
    expect(wins / 400).toBeLessThan(0.58)
  })

  it('штраф при пустом кошельке → недостача в МФО, кошелёк не отрицательный (GDD E1)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const result = exec(run({ wallet: 400 }), { type: 'work/shady' }, seed)
      if (result.state.wallet === 0) {
        expect(result.state.debtMfo).toBe(1600)
        expect(result.events).toContainEqual({ type: 'forcedMfo', amount: 1600, reason: 'shady_fine' })
        return
      }
    }
    throw new Error('не нашли провал')
  })

  it('«Сел» только при ❤️ ≤ −10 и 25%; «Сел» главнее «Семья ушла» (GDD §3.9)', () => {
    let jailed = 0
    let familyOnly = 0
    for (let seed = 0; seed < 2000; seed++) {
      const result = exec(run({ rep: -13, wallet: 10_000 }), { type: 'work/shady' }, seed)
      // −13 − 2 = −15 → «Семья ушла» всегда; при провале и броске — «Сел»
      expect(result.state.phase).toBe('ended')
      if (result.state.endingId === 'jail') jailed += 1
      else if (result.state.endingId === 'family_left') familyOnly += 1
    }
    expect(jailed / 2000).toBeGreaterThan(0.1)
    expect(jailed / 2000).toBeLessThan(0.15) // 0.5 × 0.25
    expect(jailed + familyOnly).toBe(2000)
    for (let seed = 0; seed < 300; seed++) {
      expect(exec(run({ rep: -7 }), { type: 'work/shady' }, seed).state.endingId).toBeNull()
    }
  })
})

describe('семья и друзья (CD-08)', () => {
  it('семья: ❤️ +2, 🔥 −15, раз в день', () => {
    const once = exec(run({ tilt: 20 }), { type: 'family/help' })
    expect(once.state).toMatchObject({ rep: 12, tilt: 5, energy: 80, familyHelpsToday: 1 })
    expect(check(once.state, { type: 'family/help' })).toEqual({ reason: 'daily_limit', min: 1 })
  })

  it('друзья: round10(min(800, 200 + 15·❤️) × 0.5^k), ❤️ −3, не долг', () => {
    const state = run()
    expect(friendAmount(state, B)).toBe(350)
    const first = exec(state, { type: 'friends/borrow' })
    expect(first.state).toMatchObject({ wallet: 1350, rep: 7, energy: 90, friendLoansThisWeek: 1 })
    expect(debtOf(first.state)).toBe(0)
    expect(friendAmount(first.state, B)).toBe(Math.round((305 * 0.5) / 10) * 10)
    expect(friendAmount(run({ rep: 40 }), B)).toBe(800)
  })

  it('друзья: ❤️ ≤ 0 — блокировка навсегда; без телефона — нельзя; мелочь < 50 — «самим не хватает»', () => {
    const blocked = exec(run({ rep: 2 }), { type: 'friends/borrow' })
    expect(blocked.state.friendsBlocked).toBe(true)
    expect(blocked.events).toContainEqual({ type: 'friendsBlocked' })
    expect(check({ ...blocked.state, rep: 30 }, { type: 'friends/borrow' })).toEqual({ reason: 'friends_blocked' })
    expect(check(run({ items: { ...run().items, phone: 'pawned' } }), { type: 'friends/borrow' })).toEqual({ reason: 'no_phone' })
    expect(check(run({ friendLoansThisWeek: 4 }), { type: 'friends/borrow' })).toMatchObject({ reason: 'friends_broke' })
  })
})

describe('банк / МФО / погашение (CD-08)', () => {
  it('банк: 5000₽, нужна ❤️ ≥ 15; МФО: 3000₽; лимит долга 30 000', () => {
    expect(check(run(), { type: 'bank/loan' })).toEqual({ reason: 'rep_too_low', min: 15 })
    const bank = exec(run({ rep: 15 }), { type: 'bank/loan' })
    expect(bank.state).toMatchObject({ wallet: 6000, debtBank: 5000, borrowedToday: 5000 })
    const mfo = exec(run(), { type: 'mfo/loan' })
    expect(mfo.state).toMatchObject({ wallet: 4000, debtMfo: 3000 })
    expect(check(run({ debtMfo: 27_001 }), { type: 'mfo/loan' })).toEqual({ reason: 'debt_limit', min: 30_000 })
    expect(check(run({ debtMfo: 27_000 }), { type: 'mfo/loan' })).toBeNull()
  })

  it('погашение: сначала МФО, потом банк; от 500₽, остаток < 500 — целиком (B-08)', () => {
    const result = exec(run({ debtMfo: 1000, debtBank: 5000, wallet: 3000 }), { type: 'debt/repay', amount: 2500 })
    expect(result.state).toMatchObject({ debtMfo: 0, debtBank: 3500, wallet: 500 })
    expect(minRepayAmount(234, config)).toBe(234)
    expect(planRepay(run({ debtMfo: 234, wallet: 300 }), 234, config)).toEqual({ amount: 234 })
    expect(planRepay(run({ debtMfo: 5000, wallet: 3000 }), 9999, config)).toEqual({ amount: 3000 })
    expect(planRepay(run({ debtMfo: 5000, wallet: 3000 }), 499, config)).toEqual({ reason: 'amount_below_min', min: 500 })
    expect(planRepay(run({ debtMfo: 5000, wallet: 300 }), 1000, config)).toEqual({ reason: 'no_money', min: 500 })
    expect(planRepay(run(), 1000, config)).toEqual({ reason: 'no_debt' })
    for (const amount of [Number.NaN, 0, -100]) {
      expect(planRepay(run({ debtMfo: 5000 }), amount, config)).toEqual({ reason: 'invalid_amount' })
    }
  })

  it('❤️ за погашение: +1 за 2000₽, но не за деньги, взятые сегодня (GDD E13)', () => {
    const borrowed = exec(run(), { type: 'mfo/loan' }).state
    const repaid = exec(borrowed, { type: 'debt/repay', amount: 3000 })
    expect(repaid.state.rep).toBe(10)
    const old = exec(run({ debtMfo: 4000, wallet: 4000 }), { type: 'debt/repay', amount: 4000 })
    expect(old.state.rep).toBe(12)
    expect(old.events[0]).toMatchObject({ type: 'debtRepaid', amount: 4000, repGain: 2, debtLeft: 0 })
  })
})

describe('ломбард (CD-08)', () => {
  it('заложить: +залог; выкупить: 130% (ceil); проданное не выкупается', () => {
    const pawned = exec(run(), { type: 'pawn/pawn', item: 'laptop' })
    expect(pawned.state.wallet).toBe(7000)
    expect(pawned.state.items.laptop).toBe('pawned')
    expect(pawned.events[0]).toMatchObject({ type: 'itemPawned', itemId: 'laptop', amount: 6000, ownedLeft: 4 })
    expect(check(pawned.state, { type: 'pawn/pawn', item: 'laptop' })).toEqual({ reason: 'item_not_owned' })
    expect(check({ ...pawned.state, wallet: 7799 }, { type: 'pawn/redeem', item: 'laptop' })).toEqual({ reason: 'no_money', min: 7800 })
    const back = exec({ ...pawned.state, wallet: 8000 }, { type: 'pawn/redeem', item: 'laptop' })
    expect(back.state).toMatchObject({ wallet: 200 })
    expect(back.state.items.laptop).toBe('owned')
    expect(check(run({ items: { ...run().items, bike: 'sold' } }), { type: 'pawn/redeem', item: 'bike' })).toEqual({ reason: 'item_not_pawned' })
    expect(check(run(), { type: 'pawn/pawn', item: 'yacht' as never })).toEqual({ reason: 'item_not_owned' })
  })
})

describe('кошелёк / казино (CD-06)', () => {
  it('депозит мгновенный; мин. 50; только из кошелька', () => {
    expect(check(run(), { type: 'casino/deposit', amount: 49 })).toEqual({ reason: 'amount_below_min', min: 50 })
    expect(check(run(), { type: 'casino/deposit', amount: 1001 })).toEqual({ reason: 'no_money', min: 1001 })
    expect(check(run(), { type: 'casino/deposit', amount: Number.NaN })).toEqual({ reason: 'invalid_amount' })
    const result = exec(run(), { type: 'casino/deposit', amount: 500, bonus: false })
    expect(result.state).toMatchObject({ wallet: 500, casino: 500 })
    expect(result.state.bonus.state).toBe('declined')
  })

  it('бонус 200% на первый депозит: кап 5000, вейджер ×40 от бонуса, только раз за ран', () => {
    const first = exec(run({ wallet: 8000 }), { type: 'casino/deposit', amount: 7000 })
    expect(first.state.casino).toBe(7000 + 10_000)
    expect(first.state.bonus).toEqual({ state: 'active', wagerReq: 400_000, wagered: 0 })
    expect(first.events).toContainEqual({ type: 'bonusGranted', deposit: 7000, bonus: 10_000, wagerRequired: 400_000 })
    const second = exec(first.state, { type: 'casino/deposit', amount: 500 })
    expect(second.state.casino).toBe(17_500)
    expect(second.events.some((e) => e.type === 'bonusGranted')).toBe(false)
  })

  it('вывод: мин. 1000, комиссия 5% (floor), приходит утром следующего дня; при бонусе — заблокирован', () => {
    const locked = run({ casino: 3000, bonus: { state: 'active', wagerReq: 80_000, wagered: 1000 } })
    expect(check(locked, { type: 'casino/withdraw', amount: 1000 })).toEqual({ reason: 'bonus_locked', min: 79_000 })
    expect(check(run({ casino: 3000 }), { type: 'casino/withdraw', amount: 999 })).toEqual({ reason: 'amount_below_min', min: 1000 })
    expect(check(run({ casino: 3000 }), { type: 'casino/withdraw', amount: 3001 })).toEqual({ reason: 'no_money', min: 3001 })
    const w = exec(run({ casino: 3000, tilt: 20 }), { type: 'casino/withdraw', amount: 1999 })
    expect(w.state.casino).toBe(1001)
    expect(w.state.withdrawals).toEqual([{ amount: 1999, net: 1899, arriveDay: 2 }])
    expect(w.state.tilt).toBe(15)
    expect(w.state.wallet).toBe(1000) // сегодня не пришло
  })

  it('вход/выход из казино', () => {
    const inside = exec(run(), { type: 'casino/enter' }).state
    expect(inside.location).toBe('casino')
    expect(check(inside, { type: 'casino/enter' })).toEqual({ reason: 'in_casino' })
    expect(exec(inside, { type: 'casino/leave' }).state.location).toBe('life')
    expect(check(run(), { type: 'casino/leave' })).toEqual({ reason: 'not_in_casino' })
  })
})
