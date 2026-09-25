/**
 * Все числа баланса (ADR-004). Единственное место, где они живут:
 * ядро, подписи кнопок и «Как играть» читают их отсюда (через ctx.config / useGameConfig).
 * Значения — текущий баланс (eb138e2); правки утверждает economy-designer.
 */

/** Параметры действия, которое тратит энергию и даёт деньги с поправкой на репутацию. */
export interface RewardActionConfig {
  energyCost: number
  /** База награды, ₽ (см. reward.ts: calculateReward). */
  baseReward: number
  reputationDelta: number
}

export interface BalanceConfig {
  /** Стартовое состояние забега. */
  start: {
    money: number
    energy: number
    reputation: number
    debt: number
    bet: number
  }
  /** Инварианты состояния (applyInvariants). null — без ограничения. */
  limits: {
    minBet: number
    reputationMin: number
    reputationMax: number | null
    energyMax: number | null
    /** Сколько записей хроники хранится в забеге. */
    logLimit: number
  }
  /**
   * Формула награды: base × clamp(guaranteedBase + rep / reputationDivisor)
   * + base × U(0, randomShare) + (rep > highRepThreshold ? base × highRepBonus : 0).
   */
  reward: {
    guaranteedBase: number
    reputationDivisor: number
    guaranteedMin: number
    guaranteedMax: number | null
    randomShare: number
    highRepThreshold: number
    highRepBonus: number
  }
  work: {
    job: RewardActionConfig
    shady: RewardActionConfig
  }
  friends: {
    /** Занять можно только при репутации ≥ minReputation. */
    borrow: RewardActionConfig & { minReputation: number }
    help: { energyCost: number; reputationDelta: number }
  }
  bank: {
    /** Кредит выдаётся, если репутация после списания останется ≥ minReputationAfter. */
    credit: RewardActionConfig & {
      minReputationAfter: number
      interestMin: number
      interestMax: number
    }
    repay: {
      /** Минимальная сумма погашения (если долг меньше — можно погасить остаток целиком). */
      minAmount: number
      /** +1❤️ за каждые reputationPerAmount ₽ погашения. */
      reputationPerAmount: number
    }
  }
}

export const BALANCE = {
  start: { money: 1000, energy: 50, reputation: 10, debt: 0, bet: 100 },
  limits: {
    minBet: 50,
    // Раньше -10 применялось только при загрузке (B-07) — теперь инвариант всегда.
    reputationMin: -10,
    reputationMax: null,
    energyMax: null,
    logLimit: 20
  },
  reward: {
    guaranteedBase: 0.6,
    reputationDivisor: 300,
    guaranteedMin: 0,
    guaranteedMax: null,
    randomShare: 0.3,
    highRepThreshold: 70,
    highRepBonus: 0.2
  },
  work: {
    job: { energyCost: 10, baseReward: 400, reputationDelta: 1 },
    shady: { energyCost: 10, baseReward: 2000, reputationDelta: -3 }
  },
  friends: {
    borrow: { energyCost: 5, baseReward: 500, reputationDelta: -1, minReputation: 1 },
    help: { energyCost: 5, reputationDelta: 1 }
  },
  bank: {
    credit: {
      energyCost: 15,
      baseReward: 1500,
      reputationDelta: -2,
      minReputationAfter: 0,
      interestMin: 0.2,
      interestMax: 0.3
    },
    repay: { minAmount: 1000, reputationPerAmount: 1000 }
  }
} as const satisfies BalanceConfig
