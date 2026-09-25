import { describe, expect, it } from 'vitest'
import { defaultConfig, expectedRtp, SLOT_V1 } from '../config'
import { dispatch } from '../reducer'
import { createRng } from '../rng'
import { newSession } from '../testing'
import type { EventOf, RunState } from '../types'
import { resolveSpin } from './slot'

const config = defaultConfig
const B = config.balance
/** Ран в фазе day, игрок в казино. */
const casinoRun = (patch: Partial<RunState> = {}): RunState => ({
  ...newSession(1, config, false).run,
  location: 'casino',
  casino: 10_000,
  ...patch
})
const ctx = (seed = 1) => ({ rng: createRng(seed), config, now: 1000 })
const spinEvent = (events: readonly { type: string }[]) => events.find((e) => e.type === 'spin') as EventOf<'spin'>

describe('slot/spin (CD-07)', () => {
  it('отказы по порядку GDD: не в казино, пустой баланс, нет сил; состояние не меняется', () => {
    expect(dispatch(casinoRun({ location: 'life' }), { type: 'slot/spin' }, ctx()).events[0]).toMatchObject({
      reason: 'not_in_casino'
    })
    const empty = casinoRun({ casino: 49 })
    const result = dispatch(empty, { type: 'slot/spin' }, ctx())
    expect(result.ok).toBe(false)
    expect(result.events[0]).toMatchObject({ type: 'rejected', reason: 'no_money', min: 50 })
    expect(result.state.casino).toBe(49)
    expect(dispatch(casinoRun({ energy: 1 }), { type: 'slot/spin' }, ctx()).events[0]).toMatchObject({ reason: 'no_energy', min: 2 })
    expect(dispatch(casinoRun({ phase: 'bills' }), { type: 'slot/spin' }, ctx()).events[0]).toMatchObject({ reason: 'wrong_phase' })
  })

  it('атомарно: ставка, выплата floor(bet × x), 2⚡; проигрыш не даёт ⚡ (B-06)', () => {
    for (let seed = 0; seed < 500; seed++) {
      const state = casinoRun({ bet: 150 })
      const result = dispatch(state, { type: 'slot/spin' }, ctx(seed))
      const spin = spinEvent(result.events)
      expect(result.ok).toBe(true)
      expect(spin.payout).toBe(Math.floor(150 * spin.multiplier))
      expect(result.state.casino).toBe(10_000 - 150 + spin.payout)
      expect(result.state.energy).toBe(state.energy - B.SPIN_ENERGY)
      expect(result.state.wallet).toBe(state.wallet)
    }
  })

  it('ставка клампится балансом казино; all-in определяется равенством', () => {
    const result = dispatch(casinoRun({ bet: 500, casino: 120 }), { type: 'slot/spin' }, ctx())
    expect(spinEvent(result.events)).toMatchObject({ bet: 120, allIn: true, casinoBefore: 120 })
  })

  it('при активном бонусе ставка ≤ BONUS_MAX_BET и идёт в оборот', () => {
    const state = casinoRun({ bet: 1000, bonus: { state: 'active', wagerReq: 80_000, wagered: 0 } })
    const result = dispatch(state, { type: 'slot/spin' }, ctx())
    expect(spinEvent(result.events).bet).toBe(B.BONUS_MAX_BET)
    expect(result.state.bonus.wagered).toBe(B.BONUS_MAX_BET)
  })

  it('бонус: отыгран → done, баланс < MIN_BET → lost', () => {
    const almost = casinoRun({ bonus: { state: 'active', wagerReq: 100, wagered: 0 } })
    const done = dispatch(almost, { type: 'slot/spin' }, ctx())
    expect(done.state.bonus.state).toBe('done')
    expect(done.events.some((e) => e.type === 'bonusCleared')).toBe(true)

    // Ищем сид с проигрышем: баланс 60 → 0 < 50 → бонус сгорел
    for (let seed = 0; seed < 50; seed++) {
      const r = dispatch(casinoRun({ casino: 60, bet: 60, bonus: { state: 'active', wagerReq: 10_000, wagered: 0 } }), { type: 'slot/spin' }, ctx(seed))
      if (spinEvent(r.events).payout === 0) {
        expect(r.state.bonus.state).toBe('lost')
        expect(r.events.find((e) => e.type === 'bonusBusted')).toMatchObject({ balanceLeft: 0, wagerLeft: 10_000 - 60 })
        return
      }
    }
    throw new Error('не нашли проигрыш')
  })

  it('тильт: проигрыш/LDW +4, выигрыш ≥2x −5, 1x — 0, all-in +10 (economy §7)', () => {
    const seen = new Set<string>()
    for (let seed = 0; seed < 400; seed++) {
      const state = casinoRun({ tilt: 50 })
      const result = dispatch(state, { type: 'slot/spin' }, ctx(seed))
      const spin = spinEvent(result.events)
      const expected = spin.multiplier < 1 ? 54 : spin.multiplier >= 2 ? 45 : 50
      expect(result.state.tilt).toBe(expected)
      seen.add(spin.multiplier < 1 ? (spin.ldw ? 'ldw' : 'loss') : spin.multiplier >= 2 ? 'win' : 'push')
    }
    expect([...seen].sort()).toEqual(['ldw', 'loss', 'push', 'win'])
    const allIn = dispatch(casinoRun({ tilt: 0, casino: 100, bet: 100 }), { type: 'slot/spin' }, ctx(3))
    const spin = spinEvent(allIn.events)
    expect(allIn.state.tilt).toBe(10 + (spin.multiplier < 1 ? 4 : spin.multiplier >= 2 ? -5 : 0))
  })

  it('🔥 ≥ 70: спин стоит 0⚡ и доступен при 0⚡', () => {
    const result = dispatch(casinoRun({ tilt: 70, energy: 0 }), { type: 'slot/spin' }, ctx())
    expect(result.ok).toBe(true)
    expect(spinEvent(result.events).energyCost).toBe(0)
    expect(result.state.energy).toBe(0)
  })

  it('тильт 100 → «Ночь в казино»: −20% баланса, день закончен, утром тильт 50', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = casinoRun({ tilt: 99, casino: 5000, bet: 100 })
      const result = dispatch(state, { type: 'slot/spin' }, ctx(seed))
      const spin = spinEvent(result.events)
      if (spin.multiplier >= 1) continue
      const casinoAfterSpin = spin.casinoAfter
      expect(result.events.find((e) => e.type === 'casinoNight')).toMatchObject({ n: 1, lost: Math.floor(casinoAfterSpin * 0.2) })
      expect(result.state.casino).toBe(casinoAfterSpin - Math.floor(casinoAfterSpin * 0.2))
      expect(result.state).toMatchObject({ phase: 'daySummary', day: 2, tilt: B.TILT_AFTER_CASINO_NIGHT, casinoNights: 1, location: 'life' })
      return
    }
    throw new Error('не нашли проигрыш')
  })

  it('«Реферальная программа»: баланс ≥ 100 000 сразу после выплаты', () => {
    for (let seed = 0; seed < 5000; seed++) {
      const result = dispatch(casinoRun({ casino: 99_950, bet: 100 }), { type: 'slot/spin' }, ctx(seed))
      if (spinEvent(result.events).multiplier >= 2) {
        expect(result.state).toMatchObject({ phase: 'ended', endingId: 'referral' })
        return
      }
    }
    throw new Error('не нашли выигрыш')
  })
})

describe('resolveSpin', () => {
  it('раскладка честная: исход = evalReels(reels), кроме near-miss (раскладка 7-7-X, исход lose)', () => {
    const rng = createRng(99)
    let nearMiss = 0
    let losses = 0
    for (let i = 0; i < 50_000; i++) {
      const r = resolveSpin(100, SLOT_V1, rng)
      expect(Number.isInteger(r.payout)).toBe(true)
      expect(r.ldw).toBe(r.multiplier > 0 && r.multiplier < 1)
      if (r.outcomeId === 'lose') losses += 1
      if (r.nearMiss) {
        nearMiss += 1
        expect(r.outcomeId).toBe('lose')
        expect(r.reels.filter((s) => s === 'seven')).toHaveLength(2)
      }
    }
    // 25% проигрышей рисуют near-miss (±2 п.п.)
    expect(Math.abs(nearMiss / losses - SLOT_V1.nearMiss.shareOfLosses)).toBeLessThan(0.02)
  })

  it('Монте-Карло 10⁶ спинов (seed): RTP 0.90 ± 0.01, LDW 12 ± 0.5% (CD-04)', () => {
    const rng = createRng(12345)
    const n = 1_000_000
    let paid = 0
    let ldw = 0
    for (let i = 0; i < n; i++) {
      const r = resolveSpin(1000, SLOT_V1, rng)
      paid += r.payout
      if (r.ldw) ldw += 1
    }
    expect(Math.abs(paid / (1000 * n) - expectedRtp(SLOT_V1))).toBeLessThan(0.01)
    expect(Math.abs(ldw / n - 0.12174)).toBeLessThan(0.005)
  })

  it('тильт не влияет на исходы: 200 000 спинов при 🔥 0 и 🔥 95 с одним seed совпадают побитно (CD-10)', () => {
    const outcomes = (tilt: number) => {
      const rng = createRng(2026)
      const base = casinoRun({ tilt, casino: 1_000_000, bet: 100 })
      const out = new Uint8Array(200_000)
      const ids = SLOT_V1.outcomes.map((o) => o.id)
      for (let i = 0; i < out.length; i++) {
        const spin = spinEvent(dispatch(base, { type: 'slot/spin' }, { rng, config, now: 0 }).events)
        out[i] = ids.indexOf(spin.outcomeId) * 2 + (spin.nearMiss ? 1 : 0)
      }
      return out
    }
    expect(Buffer.from(outcomes(0)).equals(Buffer.from(outcomes(95)))).toBe(true)
  }, 60_000)
})

describe('bet/set', () => {
  it('шаг 10 вниз, [MIN_BET; casino], «ДОДЕП ВСЁ» = ровно баланс, NaN — без изменений', () => {
    const state = casinoRun({ bet: 100, casino: 1234 })
    const set = (value: number, s = state) => dispatch(s, { type: 'bet/set', value }, ctx()).state.bet
    expect(set(257.7)).toBe(250)
    expect(set(0)).toBe(50)
    expect(set(99_999)).toBe(1234)
    expect(set(Number.NaN)).toBe(100)
    expect(set(500, casinoRun({ casino: 0 }))).toBe(50)
    expect(set(500, casinoRun({ bonus: { state: 'active', wagerReq: 1, wagered: 0 } }))).toBe(B.BONUS_MAX_BET)
  })

  it('смена ставки не пишется в хронику', () => {
    const state = casinoRun()
    const result = dispatch(state, { type: 'bet/set', value: 500 }, ctx())
    expect(result.events).toEqual([{ type: 'betChanged', from: 100, to: 500 }])
    expect(result.state.log).toEqual(state.log)
  })
})
