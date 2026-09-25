import { describe, expect, it } from 'vitest'
import type { CommandType, GameEvent, RejectReason } from '@/game'
import { eventTone, formatEvent, formatRejection, formatSpinBanner } from './ru'

const EVENTS: GameEvent[] = [
  { type: 'runStarted' },
  { type: 'spin', bet: 100, outcomeId: 'jackpot', multiplier: 7, payout: 700, reels: ['seven', 'seven', 'seven'], delta: { money: 600 } },
  { type: 'spin', bet: 100, outcomeId: 'triple', multiplier: 2, payout: 200, reels: ['star', 'star', 'star'], delta: { money: 100 } },
  { type: 'spin', bet: 100, outcomeId: 'lose', multiplier: 0, payout: 0, reels: ['star', 'seven', 'clown'], delta: { money: -100, energy: 5 } },
  { type: 'spin', bet: 100, outcomeId: 'lose', multiplier: 0, payout: 0, reels: ['star', 'seven', 'clown'], delta: { money: -100 } },
  { type: 'job', delta: { money: 300, energy: -10, reputation: 1 } },
  { type: 'shady', delta: { money: 1500, energy: -10, reputation: -3 } },
  { type: 'borrow', delta: { money: 400, energy: -5, reputation: -1 } },
  { type: 'help', delta: { energy: -5, reputation: 1 } },
  { type: 'credit', interest: 0.25, delta: { money: 1000, debt: 1250, energy: -15, reputation: -2 } },
  { type: 'repay', delta: { money: -1000, debt: -1000, reputation: 1 } },
  { type: 'betChanged', from: 100, to: 200 },
  { type: 'rejected', command: 'slot/spin', reason: 'betTooLow', min: 50 },
  { type: 'legacyText', text: 'старая запись' }
]

describe('i18n/ru', () => {
  it('каждое событие форматируется без undefined/NaN', () => {
    for (const event of EVENTS) {
      const text = formatEvent(event)
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toMatch(/undefined|NaN|null/)
    }
  })

  it('тексты совпадают с прежними (eb138e2)', () => {
    expect(formatEvent(EVENTS[5]!)).toBe('Подработка принесла +300₽, забрала 10⚡ и дала +1❤️')
    expect(formatEvent(EVENTS[6]!)).toBe('Замутил темку на +1500₽ (-10⚡, -3❤️)')
    expect(formatEvent(EVENTS[3]!)).toBe('🎰 Слот-машина: Проигрыш... но азарт даёт +5⚡')
    expect(formatEvent(EVENTS[1]!)).toBe('🎰 ДЖЕКПОТ 777! Выигрыш: 700₽')
  })

  it('все отказы всех команд имеют текст', () => {
    const commands: CommandType[] = ['slot/spin', 'bet/set', 'work/job', 'work/shady', 'friends/borrow', 'friends/help', 'bank/credit', 'bank/repay']
    const reasons: RejectReason[] = ['noEnergy', 'noMoney', 'betTooLow', 'noTrust', 'lowReputation', 'noDebt', 'repayTooLow', 'invalidAmount']
    for (const command of commands) {
      for (const reason of reasons) {
        expect(formatRejection(command, { reason, min: 10 })).not.toMatch(/undefined/)
      }
    }
    expect(formatRejection('slot/spin', { reason: 'betTooLow', min: 50 })).toBe('Минимальная ставка — 50₽')
  })

  it('баннер спина и тон', () => {
    expect(formatSpinBanner(EVENTS[1] as Extract<GameEvent, { type: 'spin' }>)).toBe('💥 ДЖЕКПОТ 777! +700₽')
    expect(formatSpinBanner(EVENTS[2] as Extract<GameEvent, { type: 'spin' }>)).toBe('🎉 ВЫИГРЫШ! +200₽')
    expect(formatSpinBanner(EVENTS[3] as Extract<GameEvent, { type: 'spin' }>)).toBe('😔 Не повезло... +5⚡')
    expect(EVENTS.map(eventTone)).toContain('rejected')
    expect(eventTone(EVENTS[1]!)).toBe('jackpot')
    expect(eventTone(EVENTS[3]!)).toBe('lose')
    expect(eventTone(EVENTS[5]!)).toBe('info')
  })
})
