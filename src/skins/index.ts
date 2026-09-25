import { COSMETICS, SYMBOL_IDS, type SkinDef, type SymbolId } from '@/game'

/**
 * Скины слота для UI (CD-19): данные — src/game/config/cosmetics.ts (8 эмодзи по тирам выплат в порядке SYMBOL_IDS,
 * art-bible §4). Здесь только сопоставление SymbolId → символ. Скин не влияет на исход: он получает готовую раскладку.
 */
export type SkinSymbols = Record<SymbolId, string>

const FALLBACK = COSMETICS.skins[0] as SkinDef

/** Определение скина по id (`fruit`) или CosmeticId (`skin:fruit`); неизвестный — базовый «Фруктовый». */
export function skinDef(id: string): SkinDef {
  const bare = id.startsWith('skin:') ? id.slice(5) : id
  return (COSMETICS.skins as readonly SkinDef[]).find((s) => s.id === bare) ?? FALLBACK
}

/** SymbolId → эмодзи выбранного скина. */
export function skinSymbols(id: string): SkinSymbols {
  const skin = skinDef(id)
  return Object.fromEntries(SYMBOL_IDS.map((symbol, i) => [symbol, skin.symbols[i] ?? '?'])) as SkinSymbols
}
