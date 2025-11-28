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
const JOB_COST = 10
const JOB_REPUTATION_GAIN = 1
const SHADY_DEAL_COST = 10
const SHADY_DEAL_REPUTATION_LOSS = 3
const BORROW_COST = 5
const CREDIT_COST = 15
const CREDIT_REPUTATION_LOSS = 2
const HELP_COST = 5
const REPAY_MIN_AMOUNT = 1000
const REPAY_REPUTATION_INTERVAL = 1000
export const LOG_LIMIT = 20

// Гибридная система расчета вознаграждения
// Итог = Гарантировано(70%) + Рандом(30%) + Бонус за высокую репутацию
//
// Примеры для базы 500₽ (занять у друга):
// Репутация 0:  300₽ (гарантировано) + 0-150₽ (рандом) = 300-450₽
// Репутация 50: 400₽ + 0-150₽ = 400-550₽
// Репутация 100: 450₽ + 0-150₽ + 100₽ (бонус) = 550-700₽
function calculateReward(baseAmount: number, reputation: number): number {
  // 1. Гарантированная часть (60-70% от базы) - зависит от репутации
  const guaranteedPercent = 0.6 + (reputation / 300) // От 60% до ~70% при репутации 30+
  const guaranteed = baseAmount * guaranteedPercent

  // 2. Случайная часть (0-30% от базы)
  const random = baseAmount * Math.random() * 0.3

  // 3. Бонус за высокую репутацию (если репутация > 70)
  const reputationBonus = reputation > 70 ? baseAmount * 0.2 : 0

  return Math.floor(guaranteed + random + reputationBonus)
}

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

  // Гибридная система: база 400₽, гарантировано 70%, рандом 30%, бонус при репутации > 70
  const baseAmount = 400
  const amount = calculateReward(baseAmount, state.reputation)

  state.money += amount
  state.energy -= JOB_COST
  state.reputation += JOB_REPUTATION_GAIN
  return `Подработка принесла +${amount}₽, забрала ${JOB_COST}⚡ и дала +${JOB_REPUTATION_GAIN}❤️`
}

export const shadyDeal: GameAction = (state) => {
  if (state.energy < SHADY_DEAL_COST) {
    return 'Слишком устал для темных дел'
  }

  // Гибридная система: база 2000₽, гарантировано 70%, рандом 30%, бонус при репутации > 70
  const baseAmount = 2000
  const amount = calculateReward(baseAmount, state.reputation)

  state.money += amount
  state.energy -= SHADY_DEAL_COST
  state.reputation -= SHADY_DEAL_REPUTATION_LOSS
  return `Замутил темку на +${amount}₽ (-${SHADY_DEAL_COST}⚡, -${SHADY_DEAL_REPUTATION_LOSS}❤️)`
}

export const borrowMoney: GameAction = (state) => {
  if (state.energy < BORROW_COST) {
    return 'Нет сил выпросить деньги'
  }
  if (state.reputation <= 0) {
    return 'Тебе больше никто не доверяет'
  }

  // Гибридная система: база 500₽, гарантировано 70%, рандом 30%, бонус при репутации > 70
  const baseAmount = 500
  const amount = calculateReward(baseAmount, state.reputation)

  state.money += amount
  state.energy -= BORROW_COST
  state.reputation -= 1

  return `Друг одолжил тебе ${amount}₽ (-${BORROW_COST}⚡, -1❤️)`
}

export const takeCredit: GameAction = (state) => {
  if (state.energy < CREDIT_COST) {
    return 'Нет сил на оформление кредита'
  }

  // Проверка: репутация не должна упасть ниже 0 после взятия кредита
  if (state.reputation - CREDIT_REPUTATION_LOSS < 0) {
    return 'Банк отказал в кредите из-за низкой репутации'
  }

  // Гибридная система: база 1500₽, гарантировано 70%, рандом 30%, бонус при репутации > 70
  const baseAmount = 1500
  const creditAmount = calculateReward(baseAmount, state.reputation)

  // Процент: 20-30%
  const interest = 0.2 + Math.random() * 0.1
  const debtIncrease = Math.floor(creditAmount * (1 + interest))

  state.money += creditAmount
  state.debt += debtIncrease
  state.energy -= CREDIT_COST
  state.reputation -= CREDIT_REPUTATION_LOSS

  return `Банк выдал ${creditAmount}₽, долг вырос на ${debtIncrease}₽ (-${CREDIT_COST}⚡, -${CREDIT_REPUTATION_LOSS}❤️)`
}

export const helpFriend: GameAction = (state) => {
  if (state.energy < HELP_COST) {
    return 'У тебя нет энергии, чтобы помогать'
  }

  state.energy -= HELP_COST
  state.reputation += 1
  return `Ты помог другу: +1❤️ и -${HELP_COST}⚡`
}

export const repayDebt: GameAction = (state) => {
  if (state.debt <= 0) {
    return 'Долг уже погашен'
  }
  if (state.money < REPAY_MIN_AMOUNT) {
    return 'Недостаточно средств, чтобы платить по долгам'
  }

  state.money -= REPAY_MIN_AMOUNT
  state.debt -= REPAY_MIN_AMOUNT
  if (state.debt < 0) {
    state.debt = 0
  }
  state.reputation += 1

  return `Ты закрыл ${REPAY_MIN_AMOUNT}₽ долга и поднял репутацию`
}

// Новая функция для погашения с выбором суммы
export function repayDebtWithAmount(state: CasinoState, amount: number): string | void {
  if (state.debt <= 0) {
    return 'Долг уже погашен'
  }
  if (amount < REPAY_MIN_AMOUNT) {
    return `Минимальная сумма погашения — ${REPAY_MIN_AMOUNT}₽`
  }
  if (state.money < amount) {
    return 'Недостаточно средств для погашения'
  }

  const actualAmount = Math.min(amount, state.debt)
  state.money -= actualAmount
  state.debt -= actualAmount

  // Репутация: +1 за каждые REPAY_REPUTATION_INTERVAL (1000₽)
  const reputationGain = Math.floor(actualAmount / REPAY_REPUTATION_INTERVAL)
  if (reputationGain > 0) {
    state.reputation += reputationGain
  }

  return `Ты погасил ${actualAmount}₽ долга (+${reputationGain}❤️)`
}

export const resetGame: GameAction = (state) => {
  Object.assign(state, createDefaultState())
  return 'Прогресс сброшен. Снова в бой!'
}
