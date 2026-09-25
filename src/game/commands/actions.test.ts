import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../config'
import { canExecute, dispatch } from '../reducer'
import { createRng } from '../rng'
import { createRun } from '../state'
import type { Command, RunState } from '../types'
import { minRepayAmount, planRepay } from './bank'

const config = defaultConfig
const run = (patch: Partial<RunState> = {}): RunState => ({ ...createRun(config, 1, 0), ...patch })
const exec = (state: RunState, cmd: Command, seed = 1) => dispatch(state, cmd, { rng: createRng(seed), config, now: 5 })

describe('work', () => {
  it('подработка: -10⚡, +1❤️, деньги в диапазоне', () => {
    const result = exec(run({ reputation: 0 }), { type: 'work/job' })
    expect(result.ok).toBe(true)
    expect(result.state.energy).toBe(40)
    expect(result.state.reputation).toBe(1)
    expect(result.state.money - 1000).toBeGreaterThanOrEqual(240)
    expect(result.state.money - 1000).toBeLessThanOrEqual(359)
    expect(result.events[0]).toMatchObject({ type: 'job', delta: { energy: -10, reputation: 1 } })
  })

  it('темка: -10⚡, -3❤️, репутация не ниже минимума (B-07)', () => {
    const result = exec(run({ reputation: -9 }), { type: 'work/shady' })
    expect(result.state.reputation).toBe(-10)
    expect(result.state.money).toBeGreaterThan(1000)
  })

  it('без энергии — отказ без изменений', () => {
    const state = run({ energy: 9 })
    for (const type of ['work/job', 'work/shady'] as const) {
      const result = exec(state, { type })
      expect(result.ok).toBe(false)
      expect(result.events[0]).toMatchObject({ type: 'rejected', command: type, reason: 'noEnergy' })
      expect(result.state.energy).toBe(9)
      expect(result.state.money).toBe(1000)
    }
  })
})

describe('friends', () => {
  it('занять: нужна репутация ≥ 1', () => {
    expect(canExecute(run({ reputation: 0 }), { type: 'friends/borrow' }, config)).toMatchObject({ reason: 'noTrust' })
    expect(canExecute(run({ energy: 4 }), { type: 'friends/borrow' }, config)).toMatchObject({ reason: 'noEnergy' })
    const result = exec(run({ reputation: 1 }), { type: 'friends/borrow' })
    expect(result.ok).toBe(true)
    expect(result.state).toMatchObject({ energy: 45, reputation: 0 })
  })

  it('помочь: -5⚡, +1❤️', () => {
    expect(exec(run(), { type: 'friends/help' }).state).toMatchObject({ energy: 45, reputation: 11, money: 1000 })
    expect(exec(run({ energy: 0 }), { type: 'friends/help' }).ok).toBe(false)
  })
})

describe('bank/credit', () => {
  it('деньги, долг +20–30%, -15⚡, -2❤️', () => {
    for (let seed = 0; seed < 200; seed++) {
      const result = exec(run(), { type: 'bank/credit' }, seed)
      const got = result.state.money - 1000
      expect(result.state.debt).toBeGreaterThanOrEqual(Math.floor(got * 1.2))
      expect(result.state.debt).toBeLessThanOrEqual(Math.floor(got * 1.3))
      expect(result.state).toMatchObject({ energy: 35, reputation: 8 })
    }
  })

  it('отказ, если репутация после кредита < 0', () => {
    expect(canExecute(run({ reputation: 1 }), { type: 'bank/credit' }, config)).toMatchObject({ reason: 'lowReputation' })
    expect(canExecute(run({ reputation: 2 }), { type: 'bank/credit' }, config)).toBeNull()
    expect(canExecute(run({ energy: 14 }), { type: 'bank/credit' }, config)).toMatchObject({ reason: 'noEnergy' })
  })
})

describe('bank/repay (TD-09, B-08)', () => {
  it('остаток 234 при деньгах 300 гасится полностью', () => {
    const result = exec(run({ debt: 234, money: 300 }), { type: 'bank/repay', amount: 234 })
    expect(result.ok).toBe(true)
    expect(result.state).toMatchObject({ debt: 0, money: 66, reputation: 10 })
    expect(minRepayAmount(234, config)).toBe(234)
  })

  it('1000.5 → 1000, +1❤️', () => {
    const result = exec(run({ debt: 5000, money: 3000 }), { type: 'bank/repay', amount: 1000.5 })
    expect(result.state).toMatchObject({ debt: 4000, money: 2000, reputation: 11 })
  })

  it('пустой ввод / NaN / 0 → отказ без изменения состояния', () => {
    const state = run({ debt: 5000, money: 3000 })
    for (const amount of [Number.NaN, 0, -100]) {
      const result = exec(state, { type: 'bank/repay', amount })
      expect(result.ok).toBe(false)
      expect(result.events[0]).toMatchObject({ reason: 'invalidAmount' })
      expect(result.state).toMatchObject({ debt: 5000, money: 3000 })
    }
  })

  it('сумма зажимается к min(долг, деньги); ниже минимума — отказ', () => {
    expect(planRepay(run({ debt: 5000, money: 3000 }), 9999, config)).toEqual({ amount: 3000, reputationGain: 3 })
    expect(planRepay(run({ debt: 800, money: 5000 }), 5000, config)).toEqual({ amount: 800, reputationGain: 0 })
    expect(planRepay(run({ debt: 5000, money: 3000 }), 999, config)).toEqual({ reason: 'repayTooLow', min: 1000 })
    expect(planRepay(run({ debt: 5000, money: 500 }), 1000, config)).toEqual({ reason: 'noMoney', min: 1000 })
    expect(planRepay(run({ debt: 0 }), 1000, config)).toEqual({ reason: 'noDebt' })
  })
})
