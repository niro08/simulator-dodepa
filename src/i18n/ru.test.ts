import { describe, expect, it } from 'vitest'
import {
  defaultConfig,
  ENDING_IDS,
  ITEM_IDS,
  type CommandType,
  type EventOf,
  type GameEvent,
  type GameEventType,
  type RejectReason
} from '@/game'
import { LIFE_EVENTS, SLEEP_EVENTS } from '@/game/content/events'
import {
  ENDINGS,
  endingTitle,
  eventTone,
  formatEvent,
  formatEventHonest,
  formatRejection,
  formatSpinBanner,
  howToPlay,
  ITEM_NAMES,
  money,
  SLEEP_EVENT_TEXTS,
  achievementText,
  collectorsStatementLine,
  cosmeticRewardLine,
  formatAchievementToast,
  formatSleepEventCard
} from './ru'
import { ENDING_SCREEN, MENU, PROTOCOL, TICKER_HONEST, TICKER_SHOWCASE, tickerHonest } from './ui'

const spin = (patch: Partial<EventOf<'spin'>>): EventOf<'spin'> => ({
  type: 'spin', bet: 100, outcomeId: 'lose', multiplier: 0, payout: 0, reels: ['star', 'clown', 'melon'], ldw: false, nearMiss: false,
  allIn: false, energyCost: 2, tiltBefore: 0, casinoBefore: 1000, casinoAfter: 900, bonusLocked: false, loseStreak: 1, ...patch
})

/** По одному событию каждого типа (satisfies требует покрыть все). */
const EVENTS = {
  runStarted: { type: 'runStarted', runId: 'r', seed: 1 },
  dayStarted: { type: 'dayStarted', day: 3, week: 1 },
  slept: { type: 'slept', day: 3, casinoNight: false, tilt70: false, cleanWeek: false, noSpins: true },
  spin: spin({}),
  casinoEntered: { type: 'casinoEntered' },
  casinoLeft: { type: 'casinoLeft' },
  deposit: { type: 'deposit', amount: 1000 },
  bonusGranted: { type: 'bonusGranted', deposit: 1000, bonus: 2000, wagerRequired: 80_000 },
  bonusDeclined: { type: 'bonusDeclined' },
  bonusCleared: { type: 'bonusCleared', released: 500 },
  bonusBusted: { type: 'bonusBusted', balanceLeft: 10, wagerLeft: 5000 },
  withdrawRequested: { type: 'withdrawRequested', gross: 1000, fee: 50, net: 950, arriveDay: 4 },
  withdrawPaid: { type: 'withdrawPaid', net: 950 },
  shiftWorked: { type: 'shiftWorked', pay: 900, promoted: false, repPenalty: false },
  schemeResolved: { type: 'schemeResolved', success: true, amount: 2300, fine: 0, jailed: false },
  friendBorrowed: { type: 'friendBorrowed', amount: 350, diminished: false },
  friendsBlocked: { type: 'friendsBlocked' },
  familyHelped: { type: 'familyHelped' },
  loanTaken: { type: 'loanTaken', lender: 'mfo', amount: 3000 },
  interestAccrued: { type: 'interestAccrued', bank: 0, mfo: 30, total: 30, debt: 3030 },
  debtRepaid: { type: 'debtRepaid', amount: 500, repGain: 0, debtLeft: 2530, viaBill: false },
  forcedMfo: { type: 'forcedMfo', amount: 100, reason: 'living' },
  itemPawned: { type: 'itemPawned', itemId: 'phone', amount: 3000, ownedLeft: 4 },
  itemRedeemed: { type: 'itemRedeemed', itemId: 'phone', cost: 3900, pawnAmount: 3000 },
  livingCostPaid: { type: 'livingCostPaid', amount: 300 },
  billsOpened: { type: 'billsOpened', week: 1, total: 3500, forced: false },
  billPaid: { type: 'billPaid', week: 1, amount: 3500, late: false, debtPart: 0 },
  billDeferred: { type: 'billDeferred', week: 1, penalty: 1750, fixed: 5250, dueDay: 8 },
  billCreated: { type: 'billCreated', week: 5, dueDay: 35, fixed: 13_500 },
  forkOpened: { type: 'forkOpened', week: 4, debt: 0, forced: false },
  weekChoice: { type: 'weekChoice', choice: 'one_more_week', week: 4 },
  tiltChanged: { type: 'tiltChanged', value: 44, delta: 4, source: 'spin_loss' },
  tiltStageChanged: { type: 'tiltStageChanged', from: 'calm', to: 'heated' },
  casinoNight: { type: 'casinoNight', n: 1, lost: 200 },
  sleepEventShown: { type: 'sleepEventShown', eventId: 'life_fridge' },
  sleepEventResolved: { type: 'sleepEventResolved', eventId: 'life_fridge', choice: 0 },
  runEnded: { type: 'runEnded', endingId: 'quit', grade: 'A', day: 28, weeksSurvived: 3, forfeitedCasino: 0, forfeitedWithdrawals: 0, itemsLost: [] },
  betChanged: { type: 'betChanged', from: 100, to: 200 },
  rejected: { type: 'rejected', command: 'slot/spin', reason: 'bet_below_min', min: 50 },
  timeTracked: { type: 'timeTracked', playSec: 10, underbellySec: 0 },
  casinoCredited: { type: 'casinoCredited', source: 'freespins', amount: 120, wagerRequired: 4800 },
  itemSold: { type: 'itemSold', itemId: 'laptop', amount: 1200 },
  fakeTimerExpired: { type: 'fakeTimerExpired' },
  achievementUnlocked: { type: 'achievementUnlocked', id: 'TILT_100', hidden: false, rewards: ['skin:clown'] }
} satisfies { [K in GameEventType]: Extract<GameEvent, { type: K }> }

const SPINS: EventOf<'spin'>[] = [
  spin({ outcomeId: 'jackpot', multiplier: 100, payout: 10_000, reels: ['seven', 'seven', 'seven'] }),
  spin({ outcomeId: 'diamonds', multiplier: 25, payout: 2500 }),
  spin({ outcomeId: 'premium_mix', multiplier: 2, payout: 200 }),
  spin({ outcomeId: 'fruit_mix', multiplier: 1, payout: 100 }),
  spin({ outcomeId: 'one_cherry', multiplier: 0.5, payout: 50, ldw: true }),
  spin({ nearMiss: true, reels: ['seven', 'seven', 'lemon'] }),
  spin({ allIn: true }),
  spin({})
]

describe('i18n/ru', () => {
  it('каждое событие (и варианты) форматируется без undefined/NaN', () => {
    for (const event of [...Object.values(EVENTS), ...SPINS] as GameEvent[]) {
      for (let variant = 0; variant < 4; variant++) {
        const text = formatEvent(event, variant)
        if (event.type !== 'timeTracked' && event.type !== 'fakeTimerExpired') expect(text.length, event.type).toBeGreaterThan(0)
        expect(text).not.toMatch(/undefined|NaN|null|\[object/)
      }
    }
  })

  it('варианты событий: смена, темка-провал, «Сел», повышение, погашение с ❤️, стадии тильта, концовки', () => {
    const extra: GameEvent[] = [
      { ...EVENTS.shiftWorked, promoted: true },
      { ...EVENTS.shiftWorked, repPenalty: true },
      { ...EVENTS.schemeResolved, success: false, fine: 2000 },
      { ...EVENTS.schemeResolved, success: false, jailed: true },
      { ...EVENTS.friendBorrowed, diminished: true },
      { ...EVENTS.loanTaken, lender: 'bank', amount: 5000 },
      { ...EVENTS.debtRepaid, repGain: 1 },
      { ...EVENTS.debtRepaid, viaBill: true },
      { ...EVENTS.forkOpened, debt: 500 },
      { ...EVENTS.weekChoice, choice: 'quit' },
      { ...EVENTS.tiltStageChanged, from: 'tilt', to: 'heated' },
      { ...EVENTS.tiltStageChanged, to: 'tilt' },
      { ...EVENTS.tiltStageChanged, to: 'night' },
      { ...EVENTS.tiltStageChanged, from: 'heated', to: 'calm' },
      { ...EVENTS.runEnded, endingId: 'abandoned', grade: null },
      { ...EVENTS.runEnded, endingId: 'jail', grade: null },
      { ...EVENTS.sleepEventResolved, eventId: 'unknown' }
    ]
    for (const event of extra) expect(formatEvent(event)).not.toMatch(/undefined|NaN/)
    expect(formatEvent(EVENTS.itemPawned)).toContain('📱 Телефон')
    expect(formatEvent(EVENTS.forcedMfo)).toBe('Недостачу оформили на тебя в МФО: 100₽.')
  })

  it('честные дубли Изнанки для казино-событий', () => {
    expect(formatEventHonest(SPINS[4]!)).toBe('Возврат 50₽ из 100₽. Итог -50₽. Фанфары — бесплатно.')
    expect(formatEventHonest(SPINS[5]!)).toContain('Исход был решён до вращения')
    for (const event of [...SPINS, EVENTS.deposit, EVENTS.bonusGranted, EVENTS.bonusCleared, EVENTS.bonusBusted, EVENTS.withdrawRequested, EVENTS.casinoNight]) {
      expect(formatEventHonest(event as GameEvent)).toMatch(/\S/)
    }
    expect(formatEventHonest(EVENTS.shiftWorked)).toBeNull()
  })

  it('все отказы всех команд имеют текст', () => {
    const commands: CommandType[] = [
      'day/wake', 'day/sleep', 'day/resume', 'event/choose', 'bills/pay', 'bills/defer', 'bills/refuse', 'run/quit', 'run/extend',
      'casino/enter', 'casino/leave', 'casino/deposit', 'casino/withdraw', 'bet/set', 'slot/spin', 'work/shift', 'work/shady',
      'family/help', 'friends/borrow', 'bank/loan', 'mfo/loan', 'debt/repay', 'pawn/pawn', 'pawn/redeem'
    ]
    const reasons: RejectReason[] = [
      'wrong_phase', 'in_casino', 'not_in_casino', 'no_energy', 'no_money', 'bet_below_min', 'amount_below_min', 'invalid_amount',
      'bonus_locked', 'daily_limit', 'friends_blocked', 'no_phone', 'friends_broke', 'rep_too_low', 'debt_limit', 'no_debt',
      'item_not_owned', 'item_not_pawned', 'no_bill', 'not_due', 'grace_used', 'not_fork_day', 'bill_unpaid', 'has_debt', 'forced',
      'feature_disabled', 'no_event', 'option_unaffordable'
    ]
    for (const command of commands) {
      for (const reason of reasons) {
        expect(formatRejection(command, { reason, min: 10 })).not.toMatch(/undefined/)
        expect(formatRejection(command, { reason })).not.toMatch(/undefined/)
      }
    }
    expect(formatRejection('slot/spin', { reason: 'bet_below_min', min: 50 })).toBe('Мин. ставка 50₽')
    expect(formatRejection('casino/withdraw', { reason: 'amount_below_min', min: 1000 })).toBe('Мин. вывод 1 000₽')
    expect(formatRejection('run/quit', { reason: 'has_debt', min: 12_345 })).toBe('Долг 12 345₽. Так не завязывают')
  })

  it('баннер спина празднует и LDW (Витрина); тон', () => {
    expect(formatSpinBanner(SPINS[0]!)).toBe('💥 ДЖЕКПОТ 777! +10 000₽')
    expect(formatSpinBanner(SPINS[4]!)).toBe('🎉 ВЫИГРЫШ! +50₽')
    expect(formatSpinBanner(SPINS[5]!)).toContain('ПОЧТИ')
    expect(formatSpinBanner(SPINS[7]!)).toBe('😔 Не повезло...')
    expect(eventTone(SPINS[0]!)).toBe('jackpot')
    expect(eventTone(SPINS[4]!)).toBe('win')
    expect(eventTone(SPINS[7]!)).toBe('lose')
    expect(eventTone(EVENTS.rejected)).toBe('rejected')
    expect(eventTone(EVENTS.casinoNight)).toBe('warn')
    expect(eventTone(EVENTS.shiftWorked)).toBe('info')
  })

  it('справочники покрывают все концовки, вещи и life-карточки; «Как играть» из конфига', () => {
    for (const id of ENDING_IDS) expect(ENDINGS[id].title).toMatch(/\S/)
    for (const id of ITEM_IDS) expect(ITEM_NAMES[id]).toMatch(/\S/)
    for (const e of LIFE_EVENTS) expect(SLEEP_EVENT_TEXTS[e.id]?.options).toHaveLength(2)
    expect(endingTitle('quit', 'C')).toBe('Завязал. Оценка C')
    expect(endingTitle('collectors', null)).toBe('Добрый вечер, мы из банка')
    const guide = howToPlay(defaultConfig)
    expect(guide.lines).toHaveLength(10)
    expect(guide.lines.join(' ')).toContain('RTP 90%')
    expect(guide.lines.join(' ')).toContain('тильт −50')
    expect(money(1234567)).toBe('1 234 567')
    expect(money(-500)).toBe('−500')
  })

  it('карточки сна CD-12: все тексты с подстановками без «дыр»; ачивки и тост', () => {
    for (const e of SLEEP_EVENTS) {
      const card = formatSleepEventCard({ eventId: e.id, vars: { casino_balance: 12_345, amount: 400, item: 'laptop' } })
      expect(card?.text, e.id).not.toMatch(/\{\w+\}|undefined/)
      for (const choice of [0, 1]) {
        const text = formatEvent({ type: 'sleepEventResolved', eventId: e.id, choice, amount: -1250, item: 'bike' })
        expect(text, `${e.id}/${choice}`).not.toMatch(/\{\w+\}|undefined|NaN/)
      }
    }
    expect(formatSleepEventCard({ eventId: 'insomnia_spin', vars: { casino_balance: 12_345 } })?.text).toContain('12 345₽')
    expect(formatEvent({ type: 'sleepEventResolved', eventId: 'insomnia_spin', choice: 0, amount: -1250 })).toContain('-1 250₽')
    expect(formatSleepEventCard({ eventId: 'pawn_offer', vars: { casino_balance: 0, item: 'laptop' } })?.text).toContain('💻 Ноутбук')
    expect(formatAchievementToast('TILT_100', ['skin:clown'])).toEqual({
      v: '🏆 ДОСТИЖЕНИЕ: Тильт-проф!',
      i: 'Зафиксировано: Тильт-проф. В этот момент решения принимал не ты.',
      reward: '🎨 Открыт скин: Клоунский'
    })
    expect(achievementText('ENDING_REFERRAL', true).title).toBe('???')
    expect(formatRejection('casino/enter', { reason: 'blocked_by_mama' })).toContain('Мама')
  })
})

describe('регресс CD-22: тексты (QA-02, QA-03, QA-06, QA-07, QA-09)', () => {
  it('QA-02: «Коллекторы» — неделя неоплаченного счёта; «Отсрочка использована» — только если была', () => {
    expect(collectorsStatementLine({ week: 1, deferred: true, graceUsed: true, fork: false })).toBe(
      'Итог: счёт недели 1 не оплачен. Отсрочка использована. Дело передано.'
    )
    const noGrace = collectorsStatementLine({ week: 1, deferred: false, graceUsed: false, fork: false })
    expect(noGrace).toContain('недели 1')
    expect(noGrace).not.toContain('Отсрочка использована')
    expect(collectorsStatementLine({ week: 4, deferred: false, graceUsed: false, fork: true })).toContain('долг — нет')
  })

  it('QA-03: в «Ещё неделю» нет «из 28»', () => {
    expect(ENDING_SCREEN.dayLine(36, 28, 6)).toBe('День 36 · неделя 6')
    expect(ENDING_SCREEN.dayLine(12, 28)).toBe('День 12 из 28')
    expect(MENU.continueSub(36, 28, 500, 0, 6)).toBe('День 36 · неделя 6 · 👛 500₽')
    expect(MENU.continueSub(3, 28, 500, 0)).toContain('День 3 из 28')
    expect(MENU.confirmBody(36, 28, 6)).not.toContain('из 28')
  })

  it('QA-06: род причастия у награды — «Открыта тема», «Открыт скин/звук/титул»', () => {
    expect(cosmeticRewardLine('theme:monday')).toMatch(/^🖥 Открыта тема: /)
    expect(cosmeticRewardLine('skin:clown')).toBe('🎨 Открыт скин: Клоунский')
    expect(cosmeticRewardLine('sound:honest')).toMatch(/^🔊 Открыт звук: /)
  })

  it('QA-07: честный тикер и Протокол берут долю отыгрыша бонуса из одного числа config (economy-v1 §5.3)', () => {
    const share = defaultConfig.stats.BONUS_CLEAR_SHARE
    expect(share).toBeGreaterThanOrEqual(0.077)
    expect(share).toBeLessThanOrEqual(0.088)
    const honest = tickerHonest(defaultConfig.stats)
    expect(honest).toHaveLength(TICKER_SHOWCASE.length)
    expect(honest.join('\n')).not.toMatch(/\{\w+\}/)
    const line = honest.find((l) => l.startsWith('Ки***л'))
    expect(line).toBe(`Ки***л: не отыграл бонус. Как ~${100 - Math.round(share * 100)}% игроков.`)
    expect(PROTOCOL.bonusExpected(1052, `${Math.round(share * 100)}%`)).toContain(`отыгрывают ~${Math.round(share * 100)}%`)
    expect(tickerHonest({ BONUS_CLEAR_SHARE: 0.11 }).find((l) => l.startsWith('Ки***л'))).toContain('~89%')
  })

  it('QA-09: в тикерах нет реальных брендов и сервисов', () => {
    const all = [...TICKER_SHOWCASE, ...TICKER_HONEST].join('\n')
    expect(all).not.toMatch(/telegram|телеграм|whatsapp|вконтакте|youtube|twitch|tiktok/i)
  })
})
