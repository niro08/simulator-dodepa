import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  type CasinoState,
  type PersistedCasinoState,
  createDefaultState,
  clampStateValues,
  normalizeLogs,
  playCasino,
  workJob,
  borrowMoney,
  takeCredit,
  helpFriend,
  repayDebt,
  resetGame,
  LOG_LIMIT,
  MIN_BET
} from '@/game/casinoGame'

const STORAGE_KEY = 'dodepaSave'
const hasStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

function loadStateFromStorage(): PersistedCasinoState {
  const saved = hasStorage ? window.localStorage.getItem(STORAGE_KEY) : null
  if (!saved) {
    return { ...createDefaultState(), logs: [] }
  }

  try {
    const parsed = JSON.parse(saved) as Partial<PersistedCasinoState>
    const state: CasinoState = clampStateValues({
      money: parsed.money ?? 1000,
      energy: parsed.energy ?? 50,
      reputation: parsed.reputation ?? 10,
      debt: parsed.debt ?? 0,
      bet: parsed.bet ?? 100
    })
    const logs = normalizeLogs(parsed.logs)
    return { ...state, logs }
  } catch (error) {
    console.warn('Failed to parse save, starting fresh', error)
    return { ...createDefaultState(), logs: [] }
  }
}

export const useCasinoStore = defineStore('casino', () => {
  const baseState = loadStateFromStorage()
  const money = ref(baseState.money)
  const energy = ref(baseState.energy)
  const reputation = ref(baseState.reputation)
  const debt = ref(baseState.debt)
  const bet = ref(baseState.bet)
  const logs = ref<string[]>(baseState.logs)

  function persist() {
    if (!hasStorage) return
    const payload: PersistedCasinoState = {
      money: money.value,
      energy: energy.value,
      reputation: reputation.value,
      debt: debt.value,
      bet: bet.value,
      logs: logs.value
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  function appendLog(entry: string | void) {
    if (!entry) return
    logs.value = [entry, ...logs.value].slice(0, LOG_LIMIT)
  }

  function runAction(action: (state: CasinoState) => string | void) {
    const state: CasinoState = {
      money: money.value,
      energy: energy.value,
      reputation: reputation.value,
      debt: debt.value,
      bet: bet.value
    }

    const logEntry = action(state)

    money.value = state.money
    energy.value = state.energy
    reputation.value = state.reputation
    debt.value = state.debt
    bet.value = state.bet

    appendLog(logEntry)
    persist()

    return logEntry
  }

  const actions = {
    playCasino: () => runAction(playCasino),
    workJob: () => runAction(workJob),
    borrowMoney: () => runAction(borrowMoney),
    takeCredit: () => runAction(takeCredit),
    helpFriend: () => runAction(helpFriend),
    repayDebt: () => runAction(repayDebt),
    resetGame: () => {
      const logEntry = runAction(resetGame)
      logs.value = logEntry ? [logEntry] : []
      if (hasStorage) {
        window.localStorage.removeItem(STORAGE_KEY)
      }
      persist()
    }
  }

  function setBet(value: number) {
    const numeric = Number.isFinite(value) ? value : MIN_BET
    const normalized = Math.max(MIN_BET, Math.floor(numeric))
    bet.value = normalized
    persist()
  }

  const stats = computed(() => ({
    money: money.value,
    energy: energy.value,
    reputation: reputation.value,
    debt: debt.value,
    bet: bet.value
  }))

  return {
    money,
    energy,
    reputation,
    debt,
    bet,
    logs,
    stats,
    setBet,
    ...actions
  }
})
