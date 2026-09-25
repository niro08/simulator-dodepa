import { describe, expect, it } from 'vitest'
import { defaultConfig, noEventsConfig, type GameConfig } from './config'
import { LIFE_EVENTS } from './content/events'
import { debtOf } from './rules'
import { casinoSession, playRun, STRATEGIES, winRate } from './strategies'
import { exec, newSession, tryExec } from './testing'

/**
 * Баланс на настоящем ядре (economy-v1 §9–§11, CD-04). Эталон — tools/balance-sim/sim.mjs.
 * 1) без событий сна честный ран детерминирован (economy §9.2) — побитная сверка с эталоном без событий;
 * 2) на полном пуле (CD-12, defaultConfig) — коридоры целей economy §9/§11.3:
 *    честный 50–68%, казино каждый день ≤ 15%, лудоман ≈ 0, темщик < честного.
 * Фактические значения — economy-v1 «Изменения после CD-12».
 */

type SimModule = {
  EVENTS: unknown[]
  STRATEGIES: Record<string, unknown>
  simulateRun: (strat: unknown, seed: number) => { ending: string | null; day: number; wallet: number; rep: number; debtBank: number; debtMfo: number; grade: string | null }
  runStrategy: (key: string, runs: number, seed0: number) => { wins?: number; winRate?: number; endings?: Record<string, number> } & Record<string, unknown>
}

async function loadSim(): Promise<SimModule> {
  const url = new URL('../../tools/balance-sim/sim.mjs', import.meta.url).href
  const sim = (await import(/* @vite-ignore */ url)) as SimModule
  sim.EVENTS.length = 0 // без событий сна — как ядро до CD-12
  return sim
}

function simWinRate(sim: SimModule, key: string, runs: number, seed0 = 1): number {
  let wins = 0
  for (let i = 0; i < runs; i++) if (sim.simulateRun(sim.STRATEGIES[key], seed0 + i).ending === 'quit') wins += 1
  return wins / runs
}

describe('баланс: стратегии на ядре', () => {
  it('честный работник без событий: совпадает с эталонным симулятором и побеждает', async () => {
    const sim = await loadSim()
    for (const seed of [1, 2, 3]) {
      const core = playRun(STRATEGIES.honest, seed, noEventsConfig)
      const ref = sim.simulateRun(sim.STRATEGIES.honest, seed)
      expect(core.outcome).toBe(ref.ending)
      expect(core.session.run.grade).toBe(ref.grade)
      expect(core.session.run.day).toBe(ref.day)
      expect(core.session.run.wallet).toBe(ref.wallet)
      expect(core.session.run.rep).toBe(ref.rep)
      expect(debtOf(core.session.run)).toBe(ref.debtBank + ref.debtMfo)
    }
    expect(playRun(STRATEGIES.honest, 7, noEventsConfig).outcome).toBe('quit')
  })

  it('казино каждый день без событий: в пределах ±6 п.п. от эталона без событий', async () => {
    const sim = await loadSim()
    const runs = 400
    const core = winRate(STRATEGIES.casinoDaily, runs, 1, noEventsConfig)
    const ref = simWinRate(sim, 'casino_daily', runs, 1)
    expect(Math.abs(core.wins - ref)).toBeLessThanOrEqual(0.06)
  }, 60_000)

  it('бытовые карточки сна дают дисперсию честному рану (система событий CD-12 готова)', () => {
    const config: GameConfig = { ...defaultConfig, events: { ...defaultConfig.events, pool: LIFE_EVENTS } }
    const results = new Set<string>()
    for (let seed = 1; seed <= 30; seed++) {
      const { session } = playRun(STRATEGIES.honest, seed, config, true)
      results.add(`${session.run.day}:${session.run.wallet}`)
      expect(session.events.some((e) => e.type === 'sleepEventShown')).toBe(true)
    }
    expect(results.size).toBeGreaterThan(10)
  })

})

describe('баланс: коридоры economy §9 на полном пуле событий (CD-12)', () => {
  // 1000 честных ранов ≈ 0.6 с; seed-диапазоны разные, чтобы коридор не держался на одном наборе
  const honest = winRate(STRATEGIES.honest, 1000, 1)
  const honest2 = winRate(STRATEGIES.honest, 1000, 50_001)

  it('честный работник: 50–68% побед, карточки реально выпадают', () => {
    for (const r of [honest, honest2]) {
      expect(r.wins).toBeGreaterThanOrEqual(0.5)
      expect(r.wins).toBeLessThanOrEqual(0.68)
    }
    const { session } = playRun(STRATEGIES.honest, 3, defaultConfig, true)
    expect(session.events.filter((e) => e.type === 'sleepEventShown').length).toBeGreaterThanOrEqual(3)
  })

  it('казино каждый день (ставка 100): ≤ 15% побед, «Ночь ×3» 10–30%', () => {
    const runs = 600
    const r = winRate(STRATEGIES.casinoDaily, runs, 1)
    expect(r.wins).toBeLessThanOrEqual(0.15)
    expect(r.wins).toBeLessThan(honest.wins / 3)
    const nights = (r.outcomes.casino_nights ?? 0) / runs
    expect(nights).toBeGreaterThanOrEqual(0.1)
    expect(nights).toBeLessThanOrEqual(0.3)
  }, 60_000)

  it('лудоман (бонус, «ДОДЕП ВСЁ», додеп в долг): ≈ 0 побед, в основном «Ночь ×3»', () => {
    const runs = 300
    const r = winRate(STRATEGIES.ludoman, runs, 1)
    expect(r.wins).toBeLessThanOrEqual(0.02)
    expect((r.outcomes.casino_nights ?? 0) / runs).toBeGreaterThan(0.6)
  }, 60_000)

  it('темщик (смена + темка каждый день): меньше честного и ≤ 20%', () => {
    const { wins, outcomes } = winRate(STRATEGIES.shady, 300, 1)
    expect(wins).toBeLessThanOrEqual(0.2)
    expect(wins).toBeLessThan(honest.wins)
    expect((outcomes.jail ?? 0) + (outcomes.family_left ?? 0)).toBeGreaterThan(0)
  })
})

describe('регресс B-06 (economy-v1 §10)', () => {
  it('цикл «⚡ на спины по 50 → темка»: средний прирост wallet + casino − debt ≤ +150₽/день', () => {
    let totalGain = 0
    let totalDays = 0
    for (let seed = 1; seed <= 1000; seed++) {
      const s = newSession(seed, defaultConfig, false)
      const start = s.run.wallet + s.run.casino - debtOf(s.run)
      while (s.run.phase !== 'ended' && s.run.day <= 28) {
        if (s.run.phase === 'daySummary') exec(s, { type: 'day/wake' })
        else if (s.run.phase === 'event') exec(s, { type: 'event/choose', option: 1 })
        else if (s.run.phase === 'bills') {
          if (!tryExec(s, { type: 'bills/pay' }) && !tryExec(s, { type: 'bills/defer' })) exec(s, { type: 'bills/refuse' })
        } else if (s.run.phase === 'fork') break
        else if (s.run.phase === 'day') {
          const spinBudget = s.run.energy - s.config.balance.SHADY_ENERGY
          casinoSession(s, { bet: 50, budget: 1000, maxSpins: Math.max(0, Math.floor(spinBudget / s.config.balance.SPIN_ENERGY)) })
          if (s.run.phase !== 'day') continue
          tryExec(s, { type: 'work/shady' })
          tryExec(s, { type: 'bills/pay' })
          if (s.run.phase === 'day') exec(s, { type: 'day/sleep' })
        } else break
      }
      totalGain += s.run.wallet + s.run.casino - debtOf(s.run) - start
      totalDays += s.run.day
    }
    expect(totalGain / totalDays).toBeLessThanOrEqual(150)
  }, 60_000)
})
