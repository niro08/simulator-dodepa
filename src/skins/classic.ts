import type { SymbolId } from '@/game'
import { skinSymbols } from './index'

/**
 * Базовый скин «Фруктовый» (skin:fruit): SymbolId → символ на барабане.
 * Данные всех 9 скинов — src/game/config/cosmetics.ts; выбор по экипировке — `skinSymbols(store.cosmetics.equipped.skin)`.
 */
export const SYMBOL_EMOJI: Readonly<Record<SymbolId, string>> = skinSymbols('skin:fruit')
