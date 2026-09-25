/**
 * Слот-машина: таблица исходов с весами (ADR-001) и тайминги.
 * Символы — id, а не эмодзи: как их рисовать, решает скин в UI.
 */

export const SYMBOL_IDS = ['cherry', 'lemon', 'orange', 'melon', 'star', 'diamond', 'seven', 'clown'] as const
export type SymbolId = (typeof SYMBOL_IDS)[number]

/** Id исхода — строка, чтобы новые исходы добавлялись данными. */
export type SlotOutcomeId = string

export interface SlotOutcomeDef {
  id: SlotOutcomeId
  /** Относительный вес исхода. Вероятность = weight / сумма весов. */
  weight: number
  /** Множитель ставки: равномерно в [min, max]; выплата = floor(ставка × множитель). */
  multiplier: { min: number; max: number }
  /** Изменение энергии за этот исход. */
  energyDelta: number
  /** Символы для «три в ряд». Если не задано — раскладка без трёх одинаковых (проигрыш). */
  symbols?: readonly SymbolId[]
}

export interface SlotConfig {
  symbols: readonly SymbolId[]
  outcomes: readonly SlotOutcomeDef[]
  /** Тайминги анимации, мс (UI; на исход не влияют). */
  timing: {
    reelBaseMs: number
    reelStaggerMs: number
    revealDelayMs: number
  }
}

export const SLOT = {
  symbols: SYMBOL_IDS,
  outcomes: [
    // P(win) = 10%, из них джекпот 10% → как в eb138e2.
    { id: 'lose', weight: 900, multiplier: { min: 0, max: 0 }, energyDelta: 5 },
    {
      id: 'triple',
      weight: 90,
      multiplier: { min: 1.5, max: 4.5 },
      energyDelta: 0,
      symbols: ['cherry', 'lemon', 'orange', 'melon', 'star', 'diamond', 'clown']
    },
    { id: 'jackpot', weight: 10, multiplier: { min: 7, max: 7 }, energyDelta: 0, symbols: ['seven'] }
  ],
  timing: { reelBaseMs: 2000, reelStaggerMs: 300, revealDelayMs: 300 }
} as const satisfies SlotConfig

function totalWeight(slot: SlotConfig): number {
  return slot.outcomes.reduce((sum, o) => sum + o.weight, 0)
}

/** Вероятность исхода по id (0, если такого нет). */
export function outcomeProbability(slot: SlotConfig, id: SlotOutcomeId): number {
  const total = totalWeight(slot)
  const outcome = slot.outcomes.find((o) => o.id === id)
  return outcome && total > 0 ? outcome.weight / total : 0
}

/** Вероятность любого выигрыша (исход с множителем > 0). */
export function winProbability(slot: SlotConfig): number {
  const total = totalWeight(slot)
  const winWeight = slot.outcomes.filter((o) => o.multiplier.max > 0).reduce((s, o) => s + o.weight, 0)
  return total > 0 ? winWeight / total : 0
}

/** Аналитический RTP (без учёта округления вниз): Σ p_i × E[множитель_i]. */
export function expectedRtp(slot: SlotConfig): number {
  const total = totalWeight(slot)
  if (total <= 0) return 0
  return slot.outcomes.reduce(
    (sum, o) => sum + (o.weight / total) * ((o.multiplier.min + o.multiplier.max) / 2),
    0
  )
}
