/**
 * Слот v1 (design/economy-v1.md §2, §14.2): 3 одинаковых независимых барабана по 90 позиций,
 * таблица выплат из 11 правил. RTP = 656 062 / 729 000 = 0.89995 (точно, перебором).
 * Символы — id, а не эмодзи: как их рисовать, решает скин в UI.
 * Состояние рана сюда не передаётся: тильт/мета/скин не могут влиять на исход (systems-spec §2.6).
 */

export const SYMBOL_IDS = ['cherry', 'lemon', 'orange', 'melon', 'star', 'diamond', 'seven', 'clown'] as const
export type SymbolId = (typeof SYMBOL_IDS)[number]
export type Reels = readonly [SymbolId, SymbolId, SymbolId]

/** Id исхода = id правила таблицы выплат. */
export type SlotOutcomeId =
  | 'jackpot'
  | 'diamonds'
  | 'stars'
  | 'fruit_triple'
  | 'cherry_triple'
  | 'clown_triple'
  | 'premium_mix'
  | 'fruit_mix'
  | 'two_cherries'
  | 'one_cherry'
  | 'lose'

/** Правило выплаты. Проверяются по порядку, первое подошедшее = исход. */
export type PayRule =
  | { id: SlotOutcomeId; mult: number; kind: 'triple'; symbol: SymbolId } // три одинаковых symbol
  | { id: SlotOutcomeId; mult: number; kind: 'triple_any'; of: readonly SymbolId[] } // три одинаковых из набора
  | { id: SlotOutcomeId; mult: number; kind: 'all_in'; of: readonly SymbolId[] } // все три из набора (любой микс)
  | { id: SlotOutcomeId; mult: number; kind: 'count'; symbol: SymbolId; count: number } // ровно count штук symbol
  | { id: SlotOutcomeId; mult: number; kind: 'else' }

export interface SlotConfigV1 {
  symbols: readonly SymbolId[]
  /** Веса виртуальных позиций; барабаны одинаковые и независимые. Σ = 90. */
  reelWeights: Readonly<Record<SymbolId, number>>
  paytable: readonly PayRule[]
  /** Производная таблица (из 90³ = 729000) — для Изнанки и тестов. Должна совпадать с перебором reelWeights×paytable. */
  outcomes: readonly { id: SlotOutcomeId; weight: number; mult: number; ldw: boolean }[]
  /** Near-miss: чисто визуальная раскладка части проигрышей (7-7-X), исход остаётся `lose`. */
  nearMiss: { shareOfLosses: number; symbol: SymbolId; thirdFrom: readonly SymbolId[] }
  /** Аналитические константы (тест сверяет с перебором). */
  expected: { rtpNumerator: number; total: number; hit: number; ldw: number; push: number; realWin: number; variance: number }
  /** Тайминги анимации, мс (UI; на исход не влияют). fastSpinMs — «быстрый спин» (CD-07). */
  timing: { reelBaseMs: number; reelStaggerMs: number; revealDelayMs: number; fastSpinMs: number }
}

/** Старое имя типа — для компонентов, которые не различают версии конфига. */
export type SlotConfig = SlotConfigV1

const FRUITS = ['lemon', 'orange', 'melon'] as const
const PREMIUM = ['star', 'diamond', 'seven'] as const

export const SLOT_V1 = {
  symbols: SYMBOL_IDS,
  reelWeights: { cherry: 4, lemon: 4, orange: 12, melon: 25, star: 18, diamond: 14, seven: 9, clown: 4 },
  paytable: [
    { id: 'jackpot', mult: 100, kind: 'triple', symbol: 'seven' },
    { id: 'diamonds', mult: 25, kind: 'triple', symbol: 'diamond' },
    { id: 'stars', mult: 20, kind: 'triple', symbol: 'star' },
    { id: 'fruit_triple', mult: 10, kind: 'triple_any', of: FRUITS },
    { id: 'cherry_triple', mult: 5, kind: 'triple', symbol: 'cherry' },
    { id: 'clown_triple', mult: 1, kind: 'triple', symbol: 'clown' },
    { id: 'premium_mix', mult: 2, kind: 'all_in', of: PREMIUM },
    { id: 'fruit_mix', mult: 1, kind: 'all_in', of: FRUITS },
    { id: 'two_cherries', mult: 2, kind: 'count', symbol: 'cherry', count: 2 },
    { id: 'one_cherry', mult: 0.5, kind: 'count', symbol: 'cherry', count: 1 },
    { id: 'lose', mult: 0, kind: 'else' }
  ],
  outcomes: [
    { id: 'jackpot', weight: 729, mult: 100, ldw: false },
    { id: 'diamonds', weight: 2744, mult: 25, ldw: false },
    { id: 'stars', weight: 5832, mult: 20, ldw: false },
    { id: 'fruit_triple', weight: 17417, mult: 10, ldw: false },
    { id: 'cherry_triple', weight: 64, mult: 5, ldw: false },
    { id: 'clown_triple', weight: 64, mult: 1, ldw: false },
    { id: 'premium_mix', weight: 59616, mult: 2, ldw: false },
    { id: 'fruit_mix', weight: 51504, mult: 1, ldw: false },
    { id: 'two_cherries', weight: 4128, mult: 2, ldw: false },
    { id: 'one_cherry', weight: 88752, mult: 0.5, ldw: true },
    { id: 'lose', weight: 498150, mult: 0, ldw: false }
  ],
  nearMiss: { shareOfLosses: 0.25, symbol: 'seven', thirdFrom: ['lemon', 'orange', 'melon', 'clown'] },
  expected: { rtpNumerator: 656062, total: 729000, hit: 0.31667, ldw: 0.12174, push: 0.07074, realWin: 0.12418, variance: 17.58 },
  // CV §5.1: 1.2 с; не влияет на исход
  timing: { reelBaseMs: 1200, reelStaggerMs: 150, revealDelayMs: 200, fastSpinMs: 400 }
} as const satisfies SlotConfigV1

export function evalReels(r: Reels, rules: readonly PayRule[] = SLOT_V1.paytable): PayRule {
  for (const p of rules) {
    switch (p.kind) {
      case 'triple':
        if (r[0] === p.symbol && r[1] === p.symbol && r[2] === p.symbol) return p
        break
      case 'triple_any':
        if (r[0] === r[1] && r[1] === r[2] && p.of.includes(r[0])) return p
        break
      case 'all_in':
        if (r.every((s) => p.of.includes(s))) return p
        break
      case 'count':
        if (r.filter((s) => s === p.symbol).length === p.count) return p
        break
      case 'else':
        return p
    }
  }
  throw new Error('paytable without else')
}

/** Перебор 8³ комбинаций символов: вес каждого исхода из 90³. Не принимает состояние. */
export function enumerateOutcomes(slot: SlotConfigV1 = SLOT_V1): Map<SlotOutcomeId, number> {
  const out = new Map<SlotOutcomeId, number>()
  const { symbols, reelWeights: w } = slot
  for (const a of symbols) {
    for (const b of symbols) {
      for (const c of symbols) {
        const rule = evalReels([a, b, c], slot.paytable)
        out.set(rule.id, (out.get(rule.id) ?? 0) + w[a] * w[b] * w[c])
      }
    }
  }
  return out
}

function reelTotal(slot: SlotConfigV1): number {
  return slot.symbols.reduce((sum, s) => sum + slot.reelWeights[s], 0)
}

/** Точный RTP перебором 8³ комбинаций. Тест: === 656062/729000. Тильт/мета не могут влиять. */
export function expectedRtp(slot: SlotConfigV1 = SLOT_V1): number {
  let acc = 0
  for (const [id, weight] of enumerateOutcomes(slot)) acc += weight * multOf(slot, id)
  return acc / reelTotal(slot) ** 3
}

function multOf(slot: SlotConfigV1, id: SlotOutcomeId): number {
  return slot.paytable.find((p) => p.id === id)?.mult ?? 0
}

/** Производные метрики таблицы (Изнанка, серый тикер, тексты «Как играть»). */
export interface SlotMetrics {
  rtp: number
  /** payout > 0 — «Витрина празднует». */
  hit: number
  /** 0 < x < 1. */
  ldw: number
  /** x = 1. */
  push: number
  /** x > 1 — реальный плюс. */
  realWin: number
  /** x < 1 — проигрыш или LDW (тильт растёт). */
  lossLike: number
  jackpot: number
  variance: number
  /** Серый тикер: проигрышей на 1 реальную победу, round((1 − P_REAL_WIN) / P_REAL_WIN). */
  tickerLossesPerWin: number
}

const metricsCache = new WeakMap<SlotConfigV1, SlotMetrics>()

/** Метрики считаются перебором один раз на объект конфига. */
export function slotMetrics(slot: SlotConfigV1 = SLOT_V1): SlotMetrics {
  const cached = metricsCache.get(slot)
  if (cached) return cached
  const metrics = computeSlotMetrics(slot)
  metricsCache.set(slot, metrics)
  return metrics
}

function computeSlotMetrics(slot: SlotConfigV1): SlotMetrics {
  const total = reelTotal(slot) ** 3
  let hit = 0
  let ldw = 0
  let push = 0
  let realWin = 0
  let jackpot = 0
  let m1 = 0
  let m2 = 0
  for (const [id, weight] of enumerateOutcomes(slot)) {
    const x = multOf(slot, id)
    const p = weight / total
    if (x > 0) hit += p
    if (x > 0 && x < 1) ldw += p
    if (x === 1) push += p
    if (x > 1) realWin += p
    if (id === 'jackpot') jackpot += p
    m1 += p * x
    m2 += p * x * x
  }
  return {
    rtp: m1,
    hit,
    ldw,
    push,
    realWin,
    lossLike: 1 - hit + ldw,
    jackpot,
    variance: m2 - m1 * m1,
    tickerLossesPerWin: realWin > 0 ? Math.round((1 - realWin) / realWin) : 0
  }
}
