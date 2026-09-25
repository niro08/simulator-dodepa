import type { SymbolId } from '@/game'

/**
 * Временный скин «эмодзи»: SymbolId → символ на барабане.
 * `satisfies` гарантирует, что скин покрывает все символы слота.
 * Полноценные скины с ассетами — TD-13/TD-21.
 */
export const SYMBOL_EMOJI = {
  cherry: '🍒',
  lemon: '🍋',
  orange: '🍊',
  melon: '🍉',
  star: '⭐',
  diamond: '💎',
  seven: '7️⃣',
  clown: '🤡'
} as const satisfies Record<SymbolId, string>
