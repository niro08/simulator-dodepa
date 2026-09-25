import { describe, expect, it } from 'vitest'
import { expectedBonusLeft } from './bonus'
import { defaultConfig } from './config'
import { abandonRun, applyProgress } from './progress'
import { createDefaultProfile } from './save/schema'
import { buildStatement, casinoNetFinal, equivalents, luckReport, rtpActual } from './statement'
import { stat } from './stats'
import { casinoSession, playRun, STRATEGIES } from './strategies'
import { exec, newSession, tryExec } from './testing'
import { buildHud, buildPendingEvent, buildUnderbelly } from './view'

const config = defaultConfig
const B = config.balance

describe('честная статистика (CD-10, systems-spec §3.1)', () => {
  it('сверка денег казино после каждой команды: баланс = внесено + бонус + выплачено − оборот − выведено − «Ночи»', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newSession(seed)
      exec(s, { type: 'casino/enter' })
      exec(s, { type: 'casino/deposit', amount: 1000, bonus: seed % 2 === 0 })
      for (let i = 0; i < 400 && s.run.phase !== 'ended'; i++) {
        if (s.run.phase === 'day') {
          if (!tryExec(s, { type: 'slot/spin' })) {
            if (s.run.casino >= 1000 && !tryExec(s, { type: 'casino/withdraw', amount: 1000 })) exec(s, { type: 'day/sleep' })
            else if (!tryExec(s, { type: 'casino/deposit', amount: 500 })) exec(s, { type: 'day/sleep' })
          }
        } else if (s.run.phase === 'daySummary') exec(s, { type: 'day/wake' })
        else if (s.run.phase === 'bills') exec(s, { type: 'bills/refuse' })
        else break
        const st = s.run.stats
        const expected =
          stat(st, 'deposited') + stat(st, 'bonusGranted') + stat(st, 'totalPaidOut') -
          stat(st, 'totalWagered') - stat(st, 'withdrawnGross') - stat(st, 'casinoNightLoss')
        expect(s.run.casino).toBe(expected)
      }
    }
  })

  it('счётчики спинов: витрина vs на самом деле, LDW, серия, пик потерь; run и lifetime одной формой', () => {
    const s = newSession(9)
    casinoSession(s, { bet: 100, budget: 1000, maxSpins: 20 })
    const st = s.run.stats
    const spins = s.events.filter((e) => e.type === 'spin')
    expect(stat(st, 'spins')).toBe(spins.length)
    expect(stat(st, 'totalWagered')).toBe(spins.reduce((sum, e) => sum + (e.type === 'spin' ? e.bet : 0), 0))
    expect(stat(st, 'winsShowcase')).toBeGreaterThanOrEqual(stat(st, 'winsReal'))
    expect(stat(st, 'casinoEnergySpent')).toBe(2 * (stat(st, 'spins') - stat(st, 'spinsFree')))
    expect(stat(st, 'netLossPeak')).toBeGreaterThanOrEqual(stat(st, 'totalWagered') - stat(st, 'totalPaidOut'))
    expect(stat(st, 'deposits')).toBe(1)
    expect(s.profile.stats.spins).toBe(st.spins)
    expect(s.profile.stats.runsStarted).toBe(1)
  })

  it('счётчики для ачивок CD-13: смены, семья, дни, «Ночи», МФО, ломбард, чистая неделя', () => {
    const { session } = playRun(STRATEGIES.honest, 3, config, true)
    const st = session.run.stats
    expect(st).toMatchObject({ shifts: 28, familyHelps: 28, daysPlayed: 27, cleanWeeks: 3, daysNoSpins: 27, billsPaid: 4, runsFinished: 1 })
    expect(session.profile.endings.quit).toMatchObject({ count: 1, bestGrade: 'A' })
    expect(session.profile.runHistory[0]).toMatchObject({ endingId: 'quit', grade: 'A', days: 28 })
    const s = newSession(4)
    exec(s, { type: 'mfo/loan' })
    exec(s, { type: 'pawn/pawn', item: 'bike' })
    exec(s, { type: 'pawn/redeem', item: 'bike' })
    expect(s.run.stats).toMatchObject({ loansMfo: 1, borrowed: 3000, itemsPawned: 1, itemsRedeemed: 1, redeemPremium: 750, maxDebt: 3000 })
  })

  it('время: timeTracked копится в run и lifetime', () => {
    const s = newSession(1)
    const next = applyProgress(s.run, s.profile, [{ type: 'timeTracked', playSec: 10.7, underbellySec: 5 }], config, 0)
    expect(next.run.stats).toMatchObject({ playSec: 10, underbellySec: 5 })
    expect(next.profile.stats).toMatchObject({ playSec: 10, underbellySec: 5 })
  })

  it('брошенный ран: история пополняется, концовка не засчитывается', () => {
    const s = newSession(1)
    const profile = abandonRun(s.run, s.profile, config, 5)
    expect(profile.runHistory[0]).toMatchObject({ endingId: 'abandoned', endedAt: 5 })
    expect(profile.endings).toEqual({})
    expect(stat(profile.stats, 'runsFinished')).toBe(0)
    expect(applyProgress(s.run, createDefaultProfile(), [], config).profile.stats).toEqual({})
  })
})

describe('Выписка и Изнанка (systems-spec §3.2–§3.5)', () => {
  it('производные: RTP игрока, итог казино, удача, эквиваленты', () => {
    const st = { totalWagered: 41_000, totalPaidOut: 36_500, deposited: 12_000, withdrawnNet: 2850 }
    expect(rtpActual(st)).toBeCloseTo(0.8902, 3)
    expect(rtpActual({})).toBeNull()
    expect(casinoNetFinal(st)).toBe(-9150)
    expect(luckReport(st, config)).toEqual({ expectedLoss: 4102, actualLoss: 4500, luck: -398 })
    expect(equivalents(9150, config)).toEqual([
      { id: 'EQ_GIFT_MOM', n: 3, price: 3000 },
      { id: 'EQ_UTILITIES', n: 1, price: 6000 },
      { id: 'EQ_SHIFTS', n: 10, price: 900 }
    ])
    expect(equivalents(100, config)).toEqual([])
  })

  it('buildStatement по концу рана: концовка, сгоревшее у казино, полная цена', () => {
    const s = newSession(21)
    exec(s, { type: 'casino/enter' })
    exec(s, { type: 'casino/deposit', amount: 1000, bonus: false })
    exec(s, { type: 'slot/spin' })
    exec(s, { type: 'mfo/loan' })
    while (s.run.phase !== 'ended') {
      if (s.run.phase === 'day') exec(s, { type: 'day/sleep' })
      else if (s.run.phase === 'daySummary') exec(s, { type: 'day/wake' })
      else if (s.run.phase === 'bills') exec(s, { type: 'bills/refuse' })
    }
    const statement = buildStatement(s.run, s.profile, config)
    expect(statement).toMatchObject({ endingId: 'collectors', days: 7, spins: 1, deposited: 1000, forfeited: s.run.casino })
    expect(statement.lostToCasino).toBe(1000)
    expect(statement.interestPaid).toBeGreaterThan(0)
    expect(statement.fullCost).toBe(statement.lostToCasino + statement.interestPaid)
    expect(statement.lifetime.runs).toBe(1)
    expect(statement.rtpDeclared).toBeCloseTo(0.89995, 5)
  })

  it('HUD и Изнанка: счёт, развилка, прогноз бонуса, долг, вещи', () => {
    const s = newSession(2)
    exec(s, { type: 'casino/enter' })
    exec(s, { type: 'casino/deposit', amount: 1000 })
    const hud = buildHud(s.run, config)
    expect(hud).toMatchObject({ day: 1, week: 1, wallet: 0, casino: 3000, effectiveBet: 100, betCap: 100, forkOpen: false, shiftPay: 900 })
    expect(hud.bill).toMatchObject({ week: 1, daysLeft: 6, total: 3500, isToday: false })
    expect(hud.bonus).toMatchObject({ state: 'active', wagerReq: 80_000, wagerLeft: 80_000 })
    expect(hud.quitBlock).toEqual({ reason: 'not_fork_day' })
    const under = buildUnderbelly(s.run, config)
    expect(under.slot.tickerLossesPerWin).toBe(7)
    expect(under.casino.withdrawable).toBe(0)
    expect(under.bonus?.forecast.expectedLossOnWager).toBe(8004) // (1 − 0.89995) × 80 000
    expect(under.debt.mfoApr).toBeCloseTo(36.78, 1)
    expect(under.items.find((i) => i.id === 'phone')).toMatchObject({ pawnValue: 3000, redeemCost: 3900 })
    expect(buildPendingEvent(s.run, config)).toBeNull()
  })

  it('прогноз бонуса ≈ Монте-Карло economy §5.3 (депозит 1000, ставка 100 → ~1000₽, ~8%)', () => {
    const f = expectedBonusLeft(3000, 80_000, 100, config)
    expect(f.expectedLeft).toBeGreaterThan(900)
    expect(f.expectedLeft).toBeLessThan(1200)
    expect(f.pClear).toBeGreaterThan(0.06)
    expect(f.pClear).toBeLessThan(0.11)
    expect(expectedBonusLeft(500, 0, 100, config)).toMatchObject({ expectedLeft: 500, pClear: 1 })
    expect(expectedBonusLeft(0, 1000, 100, config)).toMatchObject({ expectedLeft: 0, pClear: 0 })
    expect(B.BONUS_MAX_BET).toBe(100)
  })
})
