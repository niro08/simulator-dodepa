import { describe, expect, it } from 'vitest'
import { defaultConfig, expectedRtp } from '../config'
import { dispatch } from '../reducer'
import { createRng } from '../rng'
import { createRun } from '../state'
import type { EventOf, RunState } from '../types'
import { resolveSpin, rollOutcome } from './slot'

const config = defaultConfig
const run = (patch: Partial<RunState> = {}): RunState => ({ ...createRun(config, 1, 0), ...patch })
const ctx = (seed = 1) => ({ rng: createRng(seed), config, now: 1000 })

describe('slot/spin', () => {
  it('ставка < minBet отклоняется без изменения ресурсов', () => {
    const state = run({ bet: 10 })
    const result = dispatch(state, { type: 'slot/spin' }, ctx())
    expect(result.ok).toBe(false)
    expect(result.events).toEqual([{ type: 'rejected', command: 'slot/spin', reason: 'betTooLow', min: 50 }])
    expect(result.state).toMatchObject({ money: state.money, energy: state.energy, bet: 10 })
    expect(result.state.rngState).toBe(state.rngState)
  })

  it('ставка > денег отклоняется без изменения ресурсов', () => {
    const state = run({ money: 99, bet: 100 })
    const result = dispatch(state, { type: 'slot/spin' }, ctx())
    expect(result.ok).toBe(false)
    expect(result.events[0]).toMatchObject({ type: 'rejected', reason: 'noMoney' })
    expect(result.state.money).toBe(99)
  })

  it('атомарно: списание ставки и выплата в одном dispatch', () => {
    for (let seed = 0; seed < 500; seed++) {
      const state = run({ money: 1000, bet: 100 })
      const result = dispatch(state, { type: 'slot/spin' }, ctx(seed))
      const spin = result.events[0] as EventOf<'spin'>
      expect(result.ok).toBe(true)
      expect(result.state.money).toBe(1000 - 100 + spin.payout)
      expect(spin.delta.money).toBe(spin.payout - 100)
      expect(result.state.log[0]?.event).toEqual(spin)
    }
  })

  it('проигрыш: +5⚡ и никогда не три одинаковых; выигрыш: три одинаковых; джекпот: три seven', () => {
    const rng = createRng(99)
    const seen = new Set<string>()
    for (let i = 0; i < 20_000; i++) {
      const { result, energyDelta } = resolveSpin(100, config.slot, rng)
      const [a, b, c] = result.reels
      const triple = a === b && b === c
      seen.add(result.outcomeId)
      expect(Number.isInteger(result.payout)).toBe(true)
      expect(result.payout).toBeGreaterThanOrEqual(0)
      if (result.outcomeId === 'lose') {
        expect(triple).toBe(false)
        expect(result.payout).toBe(0)
        expect(energyDelta).toBe(5)
      } else {
        expect(triple).toBe(true)
        expect(energyDelta).toBe(0)
      }
      if (result.outcomeId === 'jackpot') {
        expect(result.reels).toEqual(['seven', 'seven', 'seven'])
        expect(result.payout).toBe(700)
      }
      if (result.outcomeId === 'triple') {
        expect(result.reels[0]).not.toBe('seven')
        expect(result.payout).toBeGreaterThanOrEqual(150)
        expect(result.payout).toBeLessThanOrEqual(450)
      }
    }
    expect([...seen].sort()).toEqual(['jackpot', 'lose', 'triple'])
  })

  it('Монте-Карло 10⁵ спинов (seed) попадает в ±0.01 от expectedRtp', () => {
    const rng = createRng(12345)
    const bet = 1000
    let paid = 0
    const n = 100_000
    for (let i = 0; i < n; i++) paid += resolveSpin(bet, config.slot, rng).result.payout
    expect(Math.abs(paid / (bet * n) - expectedRtp(config.slot))).toBeLessThan(0.01)
  })

  it('rollOutcome уважает веса и крайние случаи', () => {
    const only = { ...config.slot, outcomes: [{ id: 'x', weight: 1, multiplier: { min: 2, max: 2 }, energyDelta: 0 }] }
    expect(rollOutcome(only, createRng(1)).id).toBe('x')
    const zero = { ...config.slot, outcomes: [{ id: 'z', weight: 0, multiplier: { min: 0, max: 0 }, energyDelta: 0 }] }
    expect(rollOutcome(zero, createRng(1)).id).toBe('z')
  })
})

describe('bet/set', () => {
  it('нормализует: дробь вниз, не ниже minBet, NaN — без изменений', () => {
    const state = run({ bet: 100 })
    expect(dispatch(state, { type: 'bet/set', value: 250.7 }, ctx()).state.bet).toBe(250)
    expect(dispatch(state, { type: 'bet/set', value: 0 }, ctx()).state.bet).toBe(50)
    expect(dispatch(state, { type: 'bet/set', value: Number.NaN }, ctx()).state.bet).toBe(100)
  })

  it('смена ставки не пишется в хронику', () => {
    const state = run()
    const result = dispatch(state, { type: 'bet/set', value: 500 }, ctx())
    expect(result.events).toEqual([{ type: 'betChanged', from: 100, to: 500 }])
    expect(result.state.log).toEqual(state.log)
  })
})
