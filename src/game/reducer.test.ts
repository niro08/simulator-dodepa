import { describe, expect, it } from 'vitest'
import { defaultConfig } from './config'
import { applyInvariants, clamp, toInt } from './invariants'
import { dispatch, executeCommand } from './reducer'
import { createRng } from './rng'
import { createRun } from './state'
import type { Command, RunState } from './types'

const config = defaultConfig

const COMMANDS: Command[] = [
  { type: 'slot/spin' },
  { type: 'work/job' },
  { type: 'work/shady' },
  { type: 'friends/borrow' },
  { type: 'friends/help' },
  { type: 'bank/credit' },
  { type: 'bank/repay', amount: 1000 },
  { type: 'bank/repay', amount: 333.3 },
  { type: 'bet/set', value: 50 },
  { type: 'bet/set', value: 500 }
]

describe('dispatch', () => {
  it('не мутирует исходное состояние', () => {
    const state = createRun(config, 1, 0)
    const frozen = JSON.stringify(state)
    dispatch(state, { type: 'work/job' }, { rng: createRng(1), config, now: 1 })
    dispatch(state, { type: 'slot/spin' }, { rng: createRng(1), config, now: 1 })
    expect(JSON.stringify(state)).toBe(frozen)
  })

  it('инварианты на 10⁴ случайных команд: целые, money/energy/debt ≥ 0, rep ≥ min, bet ≥ minBet', () => {
    const picker = createRng(777)
    let state = createRun(config, 777, 0)
    for (let i = 0; i < 10_000; i++) {
      state = executeCommand(state, picker.pick(COMMANDS), { config, now: i }).state
      for (const key of ['money', 'energy', 'reputation', 'debt', 'bet'] as const) {
        expect(Number.isInteger(state[key])).toBe(true)
      }
      expect(state.money).toBeGreaterThanOrEqual(0)
      expect(state.energy).toBeGreaterThanOrEqual(0)
      expect(state.debt).toBeGreaterThanOrEqual(0)
      expect(state.reputation).toBeGreaterThanOrEqual(config.balance.limits.reputationMin)
      expect(state.bet).toBeGreaterThanOrEqual(config.balance.limits.minBet)
      expect(state.log.length).toBeLessThanOrEqual(config.balance.limits.logLimit)
    }
  })

  it('хроника: новые сверху, id уникальны и растут, лимит соблюдается', () => {
    let state = createRun(config, 1, 0)
    for (let i = 0; i < 30; i++) state = executeCommand(state, { type: 'friends/help' }, { config, now: i }).state
    const ids = state.log.map((e) => e.id)
    expect(state.log).toHaveLength(config.balance.limits.logLimit)
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
    expect(new Set(ids).size).toBe(ids.length)
    expect(state.nextLogId).toBe((ids[0] ?? 0) + 1)
  })

  it('отказ пишется в хронику как rejected', () => {
    const state: RunState = { ...createRun(config, 1, 0), energy: 0 }
    const result = dispatch(state, { type: 'work/job' }, { rng: createRng(1), config, now: 9 })
    expect(result.state.log[0]).toMatchObject({ t: 9, event: { type: 'rejected', command: 'work/job' } })
  })
})

describe('executeCommand', () => {
  it('RNG из сейва: одинаковое состояние → одинаковый исход; rngState сдвигается', () => {
    const state = createRun(config, 2024, 0)
    const a = executeCommand(state, { type: 'slot/spin' }, { config, now: 1 })
    const b = executeCommand(state, { type: 'slot/spin' }, { config, now: 1 })
    expect(a.state).toEqual(b.state)
    expect(a.state.rngState).not.toBe(state.rngState)
  })
})

describe('invariants', () => {
  it('чинит мусор: NaN, строки, дроби, отрицательные', () => {
    const broken = {
      ...createRun(config, 1, 0),
      money: Number.NaN,
      energy: -5,
      reputation: -300,
      debt: 12.9,
      bet: '75' as unknown as number
    }
    expect(applyInvariants(broken, config)).toMatchObject({ money: 1000, energy: 0, reputation: -10, debt: 12, bet: 75 })
  })

  it('верхние лимиты применяются, если заданы', () => {
    const capped = {
      ...config,
      balance: { ...config.balance, limits: { ...config.balance.limits, energyMax: 100, reputationMax: 50 } }
    }
    const state = { ...createRun(config, 1, 0), energy: 500, reputation: 90 }
    expect(applyInvariants(state, capped)).toMatchObject({ energy: 100, reputation: 50 })
  })

  it('helpers', () => {
    expect(toInt('abc', 7)).toBe(7)
    expect(toInt('', 7)).toBe(7)
    expect(toInt(Infinity, 7)).toBe(7)
    expect(clamp(5, 0, null)).toBe(5)
    expect(clamp(5, 0, 3)).toBe(3)
  })
})
