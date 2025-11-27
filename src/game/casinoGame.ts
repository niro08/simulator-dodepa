export interface CasinoState {
  money: number
  energy: number
  reputation: number
  debt: number
  bet: number
}

export interface PersistedCasinoState extends CasinoState {
  logs: string[]
}

export const MIN_BET = 50
const JOB_REWARD = 200
const JOB_COST = 10
const BORROW_COST = 5
const CREDIT_COST = 5
const HELP_COST = 5
const CREDIT_AMOUNT = 1000
const CREDIT_INTEREST = 0.25
const REPAY_AMOUNT = 200
export const LOG_LIMIT = 20

const defaultState: CasinoState = {
  money: 1000,
  energy: 50,
  reputation: 10,
  debt: 0,
  bet: 100
}

export function createDefaultState(): CasinoState {
  return { ...defaultState }
}

export function normalizeLogs(logs: unknown): string[] {
  if (!Array.isArray(logs)) return []
  return logs
    .map(String)
    .filter((entry) => entry.trim().length > 0)
    .slice(0, LOG_LIMIT)
}

export function clampStateValues(state: CasinoState): CasinoState {
  return {
    ...state,
    money: Math.max(0, state.money),
    energy: Math.max(0, state.energy),
    reputation: Math.max(-10, state.reputation),
    debt: Math.max(0, state.debt),
    bet: Math.max(MIN_BET, state.bet)
  }
}

export type GameAction = (state: CasinoState) => string | void

export const playCasino: GameAction = (state) => {
  if (state.bet < MIN_BET) {
    return `Минимальная ставка — ${MIN_BET}₽`
  }
  if (state.money < state.bet) {
    return 'Недостаточно денег для ставки'
  }

  state.money -= state.bet
  const winChance = Math.random()

  if (winChance < 0.5) {
    const win = Math.floor(state.bet * (1.5 + Math.random() * 3))
    state.money += win
    return `Ты вытащил ${win}₽!`
  }

  state.energy += 5
  return 'Проигрыш... но азарт даёт +5⚡'
}

export const workJob: GameAction = (state) => {
  if (state.energy < JOB_COST) {
    return 'Слишком устал для подработки'
  }

  state.money += JOB_REWARD
  state.energy -= JOB_COST
  return `Подработка принесла +${JOB_REWARD}₽ и забрала ${JOB_COST}⚡`
}

export const borrowMoney: GameAction = (state) => {
  if (state.energy < BORROW_COST) {
    return 'Нет сил выпросить деньги'
  }
  if (state.reputation <= 0) {
    return 'Тебе больше никто не доверяет'
  }

  const multiplier = 0.5 + state.reputation / 20
  const amount = Math.floor((200 + Math.random() * 600) * multiplier)

  state.money += amount
  state.energy -= BORROW_COST
  state.reputation -= 1

  return `Друг одолжил ${amount}₽, но репутация упала на 1`
}

export const takeCredit: GameAction = (state) => {
  if (state.energy < CREDIT_COST) {
    return 'Нет сил на оформление кредита'
  }

  const debtIncrease = Math.floor(CREDIT_AMOUNT * (1 + CREDIT_INTEREST))

  state.money += CREDIT_AMOUNT
  state.debt += debtIncrease
  state.energy -= CREDIT_COST

  return `Банк выдал ${CREDIT_AMOUNT}₽, долг вырос на ${debtIncrease}₽`
}

export const helpFriend: GameAction = (state) => {
  if (state.energy < HELP_COST) {
    return 'У тебя нет энергии, чтобы помогать'
  }

  state.energy -= HELP_COST
  state.reputation += 1
  return 'Ты помог другу: +1❤️ и -5⚡'
}

export const repayDebt: GameAction = (state) => {
  if (state.debt <= 0) {
    return 'Долг уже погашен'
  }
  if (state.money < REPAY_AMOUNT) {
    return 'Недостаточно средств, чтобы платить по долгам'
  }

  state.money -= REPAY_AMOUNT
  state.debt -= REPAY_AMOUNT
  if (state.debt < 0) {
    state.debt = 0
  }
  state.reputation += 1

  return `Ты закрыл ${REPAY_AMOUNT}₽ долга и поднял репутацию`
}

export const resetGame: GameAction = (state) => {
  Object.assign(state, createDefaultState())
  return 'Прогресс сброшен. Снова в бой!'
}
