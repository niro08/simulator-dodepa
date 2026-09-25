import { describe, expect, it } from 'vitest'
import { defaultConfig, ITEM_IDS } from './config'
import { applyInvariants, clamp, toInt } from './invariants'
import { dispatch, executeCommand } from './reducer'
import { createRng } from './rng'
import { createRun } from './state'
import { newSession } from './testing'
import type { Command, RunState } from './types'

const config = defaultConfig
const B = config.balance

/** Случайные команды со случайными (в т.ч. мусорными) параметрами. */
function randomCommand(rng: ReturnType<typeof createRng>): Command {
  const amount = rng.pick([0, 49, 50, 500, 999, 1000, 1500, 3000, 99_999, Number.NaN, -5, 333.3])
  const item = rng.pick(ITEM_IDS)
  const commands: Command[] = [
    { type: 'day/wake' }, { type: 'day/sleep' }, { type: 'day/resume' }, { type: 'event/choose', option: rng.int(0, 1) },
    { type: 'bills/pay' }, { type: 'bills/defer' }, { type: 'run/extend' }, { type: 'run/quit' },
    { type: 'casino/enter' }, { type: 'casino/leave' }, { type: 'casino/deposit', amount, bonus: rng.next() < 0.5 },
    { type: 'casino/withdraw', amount }, { type: 'bet/set', value: amount }, { type: 'slot/spin' }, { type: 'slot/spin' },
    { type: 'slot/spin' }, { type: 'work/shift' }, { type: 'work/shady' }, { type: 'family/help' }, { type: 'friends/borrow' },
    { type: 'bank/loan' }, { type: 'mfo/loan' }, { type: 'debt/repay', amount }, { type: 'pawn/pawn', item }, { type: 'pawn/redeem', item }
  ]
  return rng.pick(commands)
}

describe('dispatch', () => {
  it('не мутирует исходное состояние', () => {
    const state = newSession(1, config, false).run
    const frozen = JSON.stringify(state)
    dispatch(state, { type: 'work/shift' }, { rng: createRng(1), config, now: 1 })
    dispatch({ ...state, location: 'casino', casino: 1000 }, { type: 'slot/spin' }, { rng: createRng(1), config, now: 1 })
    dispatch(state, { type: 'day/sleep' }, { rng: createRng(1), config, now: 1 })
    expect(JSON.stringify(state)).toBe(frozen)
  })

  it('10⁴ случайных команд: кошелёк/казино/долг ≥ 0, целые, ⚡ ≤ 100 и не растёт внутри дня, ❤️/🔥 в рамках (AC 3, B-06, TD-15)', () => {
    const picker = createRng(777)
    let state = executeCommand(createRun(config, 777, 0), { type: 'day/wake' }, { config, now: 0 }).state
    let runs = 1
    for (let i = 0; i < 10_000; i++) {
      if (state.phase === 'ended') {
        state = executeCommand(createRun(config, 777 + runs, 0), { type: 'day/wake' }, { config, now: 0 }).state
        runs += 1
      }
      const before = state
      const cmd = randomCommand(picker)
      const result = executeCommand(before, cmd, { config, now: i })
      state = result.state
      for (const key of ['wallet', 'casino', 'debtBank', 'debtMfo', 'energy', 'rep', 'tilt', 'bet', 'day'] as const) {
        expect(Number.isInteger(state[key]), key).toBe(true)
      }
      expect(state.wallet).toBeGreaterThanOrEqual(0)
      expect(state.casino).toBeGreaterThanOrEqual(0)
      expect(state.debtBank).toBeGreaterThanOrEqual(0)
      expect(state.debtMfo).toBeGreaterThanOrEqual(0)
      expect(state.energy).toBeGreaterThanOrEqual(0)
      expect(state.energy).toBeLessThanOrEqual(B.ENERGY_PER_DAY)
      expect(state.rep).toBeGreaterThanOrEqual(B.REP_MIN)
      expect(state.rep).toBeLessThanOrEqual(B.REP_MAX)
      expect(state.tilt).toBeGreaterThanOrEqual(0)
      expect(state.tilt).toBeLessThanOrEqual(B.TILT_MAX)
      expect(state.bet).toBeGreaterThanOrEqual(B.MIN_BET)
      expect(state.log.length).toBeLessThanOrEqual(B.LOG_LIMIT)
      // Внутри дня ⚡ только тратится (утро — отдельная команда day/wake)
      if (cmd.type !== 'day/wake' && cmd.type !== 'event/choose' && state.day === before.day) {
        expect(state.energy).toBeLessThanOrEqual(before.energy)
      }
      // Отказ не меняет состояние (AC 11), кроме записи в хронику
      if (!result.ok) expect({ ...state, log: [], nextLogId: 0 }).toEqual({ ...before, log: [], nextLogId: 0 })
    }
    expect(runs).toBeGreaterThanOrEqual(1)
  })

  it('хроника: новые сверху, id уникальны и растут, лимит соблюдается', () => {
    let state = newSession(1, config, false).run
    for (let i = 0; i < 80; i++) state = executeCommand(state, { type: 'casino/enter' }, { config, now: i }).state
    const ids = state.log.map((e) => e.id)
    expect(state.log).toHaveLength(B.LOG_LIMIT)
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
    expect(new Set(ids).size).toBe(ids.length)
    expect(state.nextLogId).toBe((ids[0] ?? 0) + 1)
  })

  it('отказ пишется в хронику как rejected', () => {
    const state: RunState = { ...newSession(1, config, false).run, energy: 0 }
    const result = dispatch(state, { type: 'work/shift' }, { rng: createRng(1), config, now: 9 })
    expect(result.state.log[0]).toMatchObject({ t: 9, event: { type: 'rejected', command: 'work/shift', reason: 'no_energy' } })
  })
})

describe('executeCommand', () => {
  it('RNG из сейва: одинаковое состояние → одинаковый исход; rngState сдвигается (сейв-скам не работает)', () => {
    const state = { ...newSession(2024, config, false).run, location: 'casino' as const, casino: 1000 }
    const a = executeCommand(state, { type: 'slot/spin' }, { config, now: 1 })
    const b = executeCommand(state, { type: 'slot/spin' }, { config, now: 1 })
    expect(a.state).toEqual(b.state)
    expect(a.state.rngState).not.toBe(state.rngState)
  })
})

describe('invariants (TD-15)', () => {
  it('чинит мусор: NaN, строки, дроби, отрицательные, выход за пределы', () => {
    const broken = {
      ...createRun(config, 1, 0),
      wallet: Number.NaN,
      casino: -5,
      energy: 500,
      rep: 90,
      tilt: 150,
      debtMfo: 12.9,
      bet: '75' as unknown as number
    }
    expect(applyInvariants(broken, config)).toMatchObject({ wallet: 1000, casino: 0, energy: 100, rep: 40, tilt: 100, debtMfo: 12, bet: 75 })
    expect(applyInvariants({ ...broken, rep: -3 }, config).friendsBlocked).toBe(true)
  })

  it('helpers', () => {
    expect(toInt('abc', 7)).toBe(7)
    expect(toInt('', 7)).toBe(7)
    expect(toInt(Infinity, 7)).toBe(7)
    expect(clamp(5, 0, null)).toBe(5)
    expect(clamp(5, 0, 3)).toBe(3)
  })
})
