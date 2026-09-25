import type { CommandType, GameEvent, Rejection, RejectReason, SpinResult } from '@/game'

/** Число со знаком: +5 / -3. */
export function signed(n: number | undefined): string {
  const v = n ?? 0
  return v > 0 ? `+${v}` : `${v}`
}

/** Модуль числа для «(-10⚡, -3❤️)». */
function abs(n: number | undefined): number {
  return Math.abs(n ?? 0)
}

/** Текст события для хроники. Switch исчерпывающий: новое событие без текста не соберётся. */
export function formatEvent(event: GameEvent): string {
  switch (event.type) {
    case 'runStarted':
      return 'Новый забег. Снова в бой!'
    case 'spin':
      if (event.outcomeId === 'jackpot') return `🎰 ДЖЕКПОТ 777! Выигрыш: ${event.payout}₽`
      if (event.payout > 0) return `🎰 Слот-машина: Ты выиграл ${event.payout}₽!`
      return event.delta.energy
        ? `🎰 Слот-машина: Проигрыш... но азарт даёт ${signed(event.delta.energy)}⚡`
        : '🎰 Слот-машина: Проигрыш...'
    case 'job':
      return `Подработка принесла +${event.delta.money}₽, забрала ${abs(event.delta.energy)}⚡ и дала ${signed(event.delta.reputation)}❤️`
    case 'shady':
      return `Замутил темку на +${event.delta.money}₽ (-${abs(event.delta.energy)}⚡, ${signed(event.delta.reputation)}❤️)`
    case 'borrow':
      return `Друг одолжил тебе ${event.delta.money}₽ (-${abs(event.delta.energy)}⚡, ${signed(event.delta.reputation)}❤️)`
    case 'help':
      return `Ты помог другу: ${signed(event.delta.reputation)}❤️ и -${abs(event.delta.energy)}⚡`
    case 'credit':
      return `Банк выдал ${event.delta.money}₽, долг вырос на ${event.delta.debt}₽ (-${abs(event.delta.energy)}⚡, ${signed(event.delta.reputation)}❤️)`
    case 'repay':
      return `Ты погасил ${abs(event.delta.money)}₽ долга (${signed(event.delta.reputation)}❤️)`
    case 'betChanged':
      return `Ставка: ${event.to}₽`
    case 'rejected':
      return formatRejection(event.command, event)
    case 'legacyText':
      return event.text
  }
}

type RejectText = string | ((r: Rejection) => string)

const REJECT_DEFAULT: Record<RejectReason, RejectText> = {
  noEnergy: 'Не хватает энергии',
  noMoney: 'Недостаточно денег',
  betTooLow: (r) => `Минимальная ставка — ${r.min}₽`,
  noTrust: 'Тебе больше никто не доверяет',
  lowReputation: 'Слишком низкая репутация',
  noDebt: 'Долг уже погашен',
  repayTooLow: (r) => `Минимальная сумма погашения — ${r.min}₽`,
  invalidAmount: 'Введи сумму'
}

/** Тексты отказов, специфичные для команды (перекрывают REJECT_DEFAULT). */
const REJECT_BY_COMMAND: Partial<Record<CommandType, Partial<Record<RejectReason, RejectText>>>> = {
  'slot/spin': { noMoney: 'Недостаточно денег для ставки' },
  'work/job': { noEnergy: 'Слишком устал для подработки' },
  'work/shady': { noEnergy: 'Слишком устал для темных дел' },
  'friends/borrow': { noEnergy: 'Нет сил выпросить деньги' },
  'friends/help': { noEnergy: 'У тебя нет энергии, чтобы помогать' },
  'bank/credit': {
    noEnergy: 'Нет сил на оформление кредита',
    lowReputation: 'Банк отказал в кредите из-за низкой репутации'
  },
  'bank/repay': { noMoney: 'Недостаточно средств для погашения', invalidAmount: 'Введи сумму погашения' }
}

/** Текст отказа команды (для хроники и подсказок под кнопками). */
export function formatRejection(command: CommandType, rejection: Rejection): string {
  const text = REJECT_BY_COMMAND[command]?.[rejection.reason] ?? REJECT_DEFAULT[rejection.reason]
  return typeof text === 'function' ? text(rejection) : text
}

/** Крупная надпись результата в слот-машине. */
export function formatSpinBanner(result: SpinResult & { delta: { energy?: number } }): string {
  if (result.outcomeId === 'jackpot') return `💥 ДЖЕКПОТ 777! +${result.payout}₽`
  if (result.payout > 0) return `🎉 ВЫИГРЫШ! +${result.payout}₽`
  return result.delta.energy ? `😔 Не повезло... ${signed(result.delta.energy)}⚡` : '😔 Не повезло...'
}

/** Тон записи хроники — для оформления (отказ визуально отличается от успеха, TD-06). */
export type EventTone = 'info' | 'win' | 'jackpot' | 'lose' | 'rejected'

export function eventTone(event: GameEvent): EventTone {
  if (event.type === 'rejected') return 'rejected'
  if (event.type !== 'spin') return 'info'
  if (event.outcomeId === 'jackpot') return 'jackpot'
  return event.payout > 0 ? 'win' : 'lose'
}
