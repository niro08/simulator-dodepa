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
export const JOB_COST = 12
export const JOB_REPUTATION_GAIN = 1
export const SHADY_DEAL_COST = 14
export const SHADY_DEAL_REPUTATION_LOSS = 4
export const BORROW_COST = 8
export const BORROW_REPUTATION_LOSS = 2
export const BORROW_MIN_REPUTATION = 3
export const CREDIT_COST = 18
export const CREDIT_REPUTATION_LOSS = 3
export const CREDIT_MAX_DEBT_FOR_NEW_LOAN = 5000
export const HELP_COST = 6
export const HELP_REPUTATION_GAIN = 1
export const REPAY_MIN_AMOUNT = 500
export const REPAY_REPUTATION_INTERVAL = 1500
export const LOG_LIMIT = 20

export const SLOT_WIN_CHANCE = 0.36
export const SLOT_BASE_MIN_MULTIPLIER = 1.3
export const SLOT_BASE_MAX_MULTIPLIER = 2.8
export const SLOT_LOSS_ENERGY_GAIN = 2
export const SLOT_ENERGY_GAIN_MIN_BET = 100
export const SLOT_JACKPOT_SYMBOL = '7️⃣'
export const SLOT_JACKPOT_MULTIPLIER = 7
export const SLOT_JACKPOT_CHANCE_ON_WIN = 0.03

export const MIN_REPUTATION = -10
export const GUIDE_MAX_REPUTATION = 100

export const REWARD_GUARANTEED_BASE_PERCENT = 0.45
export const REWARD_GUARANTEED_REPUTATION_DIVISOR = 400
export const REWARD_RANDOM_MAX_PERCENT = 0.25
export const REWARD_REPUTATION_BONUS_THRESHOLD = 60
export const REWARD_REPUTATION_BONUS_PERCENT = 0.1

export const WORK_BASE_AMOUNT = 450
export const SHADY_DEAL_BASE_AMOUNT = 1100
export const BORROW_BASE_AMOUNT = 350
export const CREDIT_BASE_AMOUNT = 1200

export const CREDIT_INTEREST_MIN = 0.3
export const CREDIT_INTEREST_MAX = 0.45

function calculateRewardMinAmount(baseAmount: number, reputation: number): number {
  const guaranteedPercent = REWARD_GUARANTEED_BASE_PERCENT + (reputation / REWARD_GUARANTEED_REPUTATION_DIVISOR)
  return Math.floor(baseAmount * guaranteedPercent)
}

function calculateRewardMaxAmount(baseAmount: number, reputation: number): number {
  const guaranteedPercent = REWARD_GUARANTEED_BASE_PERCENT + (reputation / REWARD_GUARANTEED_REPUTATION_DIVISOR)
  const guaranteed = baseAmount * guaranteedPercent
  const random = baseAmount * REWARD_RANDOM_MAX_PERCENT
  const reputationBonus = reputation > REWARD_REPUTATION_BONUS_THRESHOLD ? baseAmount * REWARD_REPUTATION_BONUS_PERCENT : 0

  return Math.floor(guaranteed + random + reputationBonus)
}

export const WORK_REWARD_MIN = calculateRewardMinAmount(WORK_BASE_AMOUNT, MIN_REPUTATION)
export const WORK_REWARD_MAX = calculateRewardMaxAmount(WORK_BASE_AMOUNT, GUIDE_MAX_REPUTATION)

export const SHADY_DEAL_REWARD_MIN = calculateRewardMinAmount(SHADY_DEAL_BASE_AMOUNT, MIN_REPUTATION)
export const SHADY_DEAL_REWARD_MAX = calculateRewardMaxAmount(SHADY_DEAL_BASE_AMOUNT, GUIDE_MAX_REPUTATION)

export const BORROW_REWARD_MIN = calculateRewardMinAmount(BORROW_BASE_AMOUNT, BORROW_MIN_REPUTATION)
export const BORROW_REWARD_MAX = calculateRewardMaxAmount(BORROW_BASE_AMOUNT, GUIDE_MAX_REPUTATION)

export const CREDIT_REWARD_MIN = calculateRewardMinAmount(CREDIT_BASE_AMOUNT, BORROW_MIN_REPUTATION)
export const CREDIT_REWARD_MAX = calculateRewardMaxAmount(CREDIT_BASE_AMOUNT, GUIDE_MAX_REPUTATION)

export const CREDIT_DEBT_PERCENT_MIN = Math.floor((1 + CREDIT_INTEREST_MIN) * 100)
export const CREDIT_DEBT_PERCENT_MAX = Math.floor((1 + CREDIT_INTEREST_MAX) * 100)

export function calculateSlotWinAmount(bet: number, isJackpot = false): number {
  if (isJackpot) {
    return Math.floor(bet * SLOT_JACKPOT_MULTIPLIER)
  }

  const spread = SLOT_BASE_MAX_MULTIPLIER - SLOT_BASE_MIN_MULTIPLIER
  return Math.floor(bet * (SLOT_BASE_MIN_MULTIPLIER + Math.random() * spread))
}

// Гибридная система расчета вознаграждения
// Итог = Гарантировано + Рандом + бонус за высокую репутацию
//
// Тюнинг после ребаланса:
// - guaranteed: 45% + reputation/400
// - random: до 25% от базы
// - bonus: +10% от базы при reputation > 60
function calculateReward(baseAmount: number, reputation: number): number {
  // 1. Гарантированная часть (45-70% от базы) - зависит от репутации
  const guaranteedPercent = REWARD_GUARANTEED_BASE_PERCENT + (reputation / REWARD_GUARANTEED_REPUTATION_DIVISOR)
  const guaranteed = baseAmount * guaranteedPercent

  // 2. Случайная часть (0-25% от базы)
  const random = baseAmount * Math.random() * REWARD_RANDOM_MAX_PERCENT

  // 3. Бонус за высокую репутацию (если репутация > 60)
  const reputationBonus = reputation > REWARD_REPUTATION_BONUS_THRESHOLD ? baseAmount * REWARD_REPUTATION_BONUS_PERCENT : 0

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
    reputation: Math.max(MIN_REPUTATION, state.reputation),
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
  const isWin = Math.random() < SLOT_WIN_CHANCE

  if (isWin) {
    const isJackpot = Math.random() < SLOT_JACKPOT_CHANCE_ON_WIN
    const win = calculateSlotWinAmount(state.bet, isJackpot)
    state.money += win

    if (isJackpot) {
      return `ДЖЕКПОТ ${SLOT_JACKPOT_SYMBOL}${SLOT_JACKPOT_SYMBOL}${SLOT_JACKPOT_SYMBOL}! +${win}₽`
    }

    return `Ты вытащил ${win}₽!`
  }

  if (state.bet >= SLOT_ENERGY_GAIN_MIN_BET) {
    state.energy += SLOT_LOSS_ENERGY_GAIN
    return `Проигрыш... но азарт даёт +${SLOT_LOSS_ENERGY_GAIN}⚡`
  }

  return 'Проигрыш...'
}

export const workJob: GameAction = (state) => {
  if (state.energy < JOB_COST) {
    return 'Слишком устал для подработки'
  }

  const amount = calculateReward(WORK_BASE_AMOUNT, state.reputation)

  state.money += amount
  state.energy -= JOB_COST
  state.reputation += JOB_REPUTATION_GAIN
  return `Подработка принесла +${amount}₽, забрала ${JOB_COST}⚡ и дала +${JOB_REPUTATION_GAIN}❤️`
}

export const shadyDeal: GameAction = (state) => {
  if (state.energy < SHADY_DEAL_COST) {
    return 'Слишком устал для темных дел'
  }

  const amount = calculateReward(SHADY_DEAL_BASE_AMOUNT, state.reputation)

  state.money += amount
  state.energy -= SHADY_DEAL_COST
  state.reputation -= SHADY_DEAL_REPUTATION_LOSS
  return `Замутил темку на +${amount}₽ (-${SHADY_DEAL_COST}⚡, -${SHADY_DEAL_REPUTATION_LOSS}❤️)`
}

export const borrowMoney: GameAction = (state) => {
  if (state.energy < BORROW_COST) {
    return 'Нет сил выпросить деньги'
  }
  if (state.reputation < BORROW_MIN_REPUTATION) {
    return `Слишком низкая репутация: нужно минимум ${BORROW_MIN_REPUTATION}❤️`
  }

  const amount = calculateReward(BORROW_BASE_AMOUNT, state.reputation)

  state.money += amount
  state.energy -= BORROW_COST
  state.reputation -= BORROW_REPUTATION_LOSS

  return `Друг одолжил тебе ${amount}₽ (-${BORROW_COST}⚡, -${BORROW_REPUTATION_LOSS}❤️)`
}

export const takeCredit: GameAction = (state) => {
  if (state.energy < CREDIT_COST) {
    return 'Нет сил на оформление кредита'
  }

  if (state.debt > CREDIT_MAX_DEBT_FOR_NEW_LOAN) {
    return `Банк отказал: сначала сократи долг ниже ${CREDIT_MAX_DEBT_FOR_NEW_LOAN}₽`
  }

  // Проверка: репутация не должна упасть ниже 0 после взятия кредита
  if (state.reputation - CREDIT_REPUTATION_LOSS < 0) {
    return 'Банк отказал в кредите из-за низкой репутации'
  }

  const creditAmount = calculateReward(CREDIT_BASE_AMOUNT, state.reputation)

  // Процент: 30-45%
  const interestSpread = CREDIT_INTEREST_MAX - CREDIT_INTEREST_MIN
  const interest = CREDIT_INTEREST_MIN + Math.random() * interestSpread
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
  state.reputation += HELP_REPUTATION_GAIN
  return `Ты помог другу: +${HELP_REPUTATION_GAIN}❤️ и -${HELP_COST}⚡`
}

export const repayDebt: GameAction = (state) => {
  return repayDebtWithAmount(state, REPAY_MIN_AMOUNT)
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

  // Репутация: +1 за каждые REPAY_REPUTATION_INTERVAL
  const reputationGain = Math.floor(actualAmount / REPAY_REPUTATION_INTERVAL)
  if (reputationGain > 0) {
    state.reputation += reputationGain
  }

  if (reputationGain > 0) {
    return `Ты погасил ${actualAmount}₽ долга (+${reputationGain}❤️)`
  }

  return `Ты погасил ${actualAmount}₽ долга`
}

export const resetGame: GameAction = (state) => {
  Object.assign(state, createDefaultState())
  return 'Прогресс сброшен. Снова в бой!'
}
