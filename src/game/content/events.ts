import { EVENTS_BALANCE as E } from '../config/balance'
import type { SleepEventDef } from '../types'

/**
 * Бытовые карточки сна (economy-v1 §9.2): единственный источник дисперсии честного рана.
 * Обе опции чего-то стоят: либо ₽, либо ⚡/🔥 (вариант без ₽ есть всегда — правило контента GDD §3.5.11).
 * Полный пул (26 карточек content-pack §2 + эти 3) собирает CD-12; до тех пор в defaultConfig пул пуст.
 * Тексты — i18n (плейсхолдеры до writer).
 */
export const LIFE_EVENTS: readonly SleepEventDef[] = [
  {
    id: 'life_fridge',
    weight: 1,
    options: [
      { cost: E.EVT_LIFE_FRIDGE_COST, effect: {} },
      { effect: { energyToday: E.EVT_LIFE_FRIDGE_ENERGY, tilt: E.EVT_LIFE_FRIDGE_TILT } }
    ]
  },
  {
    id: 'life_tooth',
    weight: 1,
    options: [
      { cost: E.EVT_LIFE_TOOTH_COST, effect: {} },
      { effect: { energyToday: E.EVT_LIFE_TOOTH_ENERGY, tilt: E.EVT_LIFE_TOOTH_TILT } }
    ]
  },
  {
    id: 'life_fine',
    weight: 1,
    options: [{ cost: E.EVT_LIFE_FINE_COST, effect: {} }, { effect: { debtMfo: E.EVT_LIFE_FINE_DEBT } }]
  }
]
