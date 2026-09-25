import type { BalanceConfig } from './config'
import type { Rng } from './rng'

/** Доля базы, которая гарантирована при данной репутации (зажата конфигом, B-05). */
export function guaranteedShare(reputation: number, reward: BalanceConfig['reward']): number {
  const raw = reward.guaranteedBase + reputation / reward.reputationDivisor
  const capped = reward.guaranteedMax === null ? raw : Math.min(reward.guaranteedMax, raw)
  return Math.max(reward.guaranteedMin, capped)
}

function fixedPart(baseAmount: number, reputation: number, reward: BalanceConfig['reward']): number {
  const bonus = reputation > reward.highRepThreshold ? baseAmount * reward.highRepBonus : 0
  return baseAmount * guaranteedShare(reputation, reward) + bonus
}

/**
 * Гибридная награда: гарантированная часть (зависит от репутации)
 * + случайная часть + бонус за высокую репутацию. Всегда целое ≥ 0.
 */
export function calculateReward(
  baseAmount: number,
  reputation: number,
  reward: BalanceConfig['reward'],
  rng: Rng
): number {
  const random = baseAmount * rng.next() * reward.randomShare
  return Math.max(0, Math.floor(fixedPart(baseAmount, reputation, reward) + random))
}

/** Диапазон награды [min, max] при данной репутации — для подписей и «Как играть». */
export function rewardRange(
  baseAmount: number,
  reputation: number,
  reward: BalanceConfig['reward']
): [number, number] {
  const fixed = fixedPart(baseAmount, reputation, reward)
  const min = Math.max(0, Math.floor(fixed))
  // rng.next() < 1, поэтому верхняя граница не достигается ровно.
  const max = Math.max(min, Math.ceil(fixed + baseAmount * reward.randomShare) - 1)
  return [min, max]
}
