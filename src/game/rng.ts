/**
 * Инжектируемый детерминированный генератор случайных чисел (ADR-003).
 * В src/game/** запрещён Math.random: вся случайность идёт через Rng из GameContext.
 */
export interface Rng {
  /** Равномерное число в [0, 1). */
  next(): number
  /** Целое число в [minIncl, maxIncl]. */
  int(minIncl: number, maxIncl: number): number
  /** Случайный элемент непустого массива. */
  pick<T>(items: readonly T[]): T
  /** Внутреннее состояние (uint32) — сохраняется в сейв и восстанавливает последовательность. */
  state(): number
}

/**
 * Seeded PRNG на mulberry32: 32 бита состояния, без зависимостей.
 * Одинаковый seed → одинаковая последовательность.
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(minIncl, maxIncl) {
      const lo = Math.ceil(Math.min(minIncl, maxIncl))
      const hi = Math.floor(Math.max(minIncl, maxIncl))
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: пустой массив')
      return items[Math.floor(next() * items.length)] as (typeof items)[number]
    },
    state: () => a
  }
}
