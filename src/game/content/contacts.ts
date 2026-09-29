/**
 * Контакты: предложения «темок» от конкретных людей (design/contacts-shady.md §3.1, §5, §10).
 * Числа — прямо в данных (как карточки сна); меняются вместе с таблицей EV §5 и зеркалом в tools/balance-sim/sim.mjs.
 * Тексты — i18n CONTACT_TEXTS (src/i18n/ru.ts).
 */
import type { ItemId } from '../config/balance'

export const CONTACT_IDS = ['neighbor', 'tolik', 'vadik', 'lyoha', 'valera', 'mentor', 'dima', 'gosha', 'kirill', 'eduard'] as const
export type ContactId = (typeof CONTACT_IDS)[number]

export interface OfferDef {
  id: string
  contact: ContactId
  tier: 1 | 2 | 3
  /** ⚡ */
  energy: number
  /** p до засвета, 0…1 */
  successChance: number
  /** Кратно CONTACT_REWARD_STEP. */
  rewardMin: number
  rewardMax: number
  /** Штраф при провале, через forcedPay (недостача → МФО). */
  fine: number
  /** ❤️, списывается всегда и первым делом (≤ 0). */
  rep: number
  /** 🔥 при провале. */
  tiltFail: number
  /** Засвет после сделки. */
  heat: number
  /** Шанс «Сел» при провале, если открыт риск ареста (§4.4). */
  jail: number
  /** Дней жизни: 0 «только сегодня», 1 «до завтра», 2. */
  expiry: number
  /** Вес в пуле, по умолчанию 1. */
  weight?: number
  /** Без вещи в статусе owned не выпадает и не выполняется. */
  requiresItem?: ItemId
  /** Выпадает только при debtOf ≥ minDebt. */
  minDebt?: number
  /** Выпадает только если это предложение уже брали. */
  afterOffer?: string
  /**
   * Развод: успеха нет, списывается price. fakeLuckDays — «прокачка удачи» (§4.3 п.2: luck_boost ставит
   * fakeLuckUntil = day + 3; вынесено в данные, чтобы ядро не сравнивало id).
   */
  scam?: { price: number; fakeLuckDays?: number }
}

type Normal = Omit<OfferDef, 'id' | 'contact' | 'tier' | 'scam'>
const t1 = (id: string, contact: ContactId, o: Omit<Normal, 'tiltFail' | 'jail' | 'expiry' | 'heat'> & Partial<Normal>): OfferDef => ({
  id, contact, tier: 1, tiltFail: 10, heat: 10, jail: 0.1, expiry: 1, ...o
})
const t2 = (id: string, contact: ContactId, o: Omit<Normal, 'tiltFail' | 'jail' | 'expiry' | 'heat'> & Partial<Normal>): OfferDef => ({
  id, contact, tier: 2, tiltFail: 15, heat: 20, jail: 0.25, expiry: 1, ...o
})
const t3 = (id: string, contact: ContactId, o: Omit<Normal, 'tiltFail' | 'expiry'> & Partial<Normal>): OfferDef => ({
  id, contact, tier: 3, tiltFail: 20, expiry: 0, ...o
})
const scam = (
  id: string,
  contact: ContactId,
  tier: 1 | 2 | 3,
  energy: number,
  price: number,
  extra: Partial<OfferDef> = {}
): OfferDef => ({
  id, contact, tier, energy, successChance: 0, rewardMin: 0, rewardMax: 0, fine: 0, rep: 0, tiltFail: 0, heat: 0, jail: 0,
  expiry: 2, scam: { price }, ...extra
})

/** Порядок = порядок кандидатов при генерации (детерминизм, §4.2 п.3). */
export const CONTACT_OFFERS: readonly OfferDef[] = [
  // Ярус 1 — «знакомый»
  t1('neighbor_boxes', 'neighbor', { energy: 20, successChance: 0.85, rewardMin: 300, rewardMax: 500, fine: 1500, rep: -1 }),
  t1('valera_pallets', 'valera', { energy: 20, successChance: 0.8, rewardMin: 400, rewardMax: 600, fine: 1500, rep: -1 }),
  t1('tolik_wash', 'tolik', { energy: 30, successChance: 0.8, rewardMin: 700, rewardMax: 900, fine: 2000, rep: -1 }),
  t1('lyoha_courier', 'lyoha', { energy: 30, successChance: 0.75, rewardMin: 800, rewardMax: 1000, fine: 2000, rep: -1, requiresItem: 'bike' }),
  t1('vadik_truck', 'vadik', { energy: 40, successChance: 0.8, rewardMin: 800, rewardMax: 1000, fine: 2000, rep: -2 }),
  scam('mentor_course', 'mentor', 1, 20, 1500),
  // Ярус 2 — «мутный»
  t2('dima_mirrors', 'dima', { energy: 40, successChance: 0.6, rewardMin: 1800, rewardMax: 2400, fine: 2500, rep: -3, requiresItem: 'laptop' }),
  t2('gosha_phones', 'gosha', { energy: 30, successChance: 0.55, rewardMin: 1500, rewardMax: 2100, fine: 2000, rep: -2 }),
  t2('vadik_card', 'vadik', { energy: 20, successChance: 0.6, rewardMin: 1450, rewardMax: 2050, fine: 2500, rep: -3 }),
  t2('tolik_car', 'tolik', { energy: 40, successChance: 0.55, rewardMin: 2400, rewardMax: 3000, fine: 3000, rep: -3 }),
  { ...scam('luck_boost', 'kirill', 2, 10, 2000), scam: { price: 2000, fakeLuckDays: 3 } },
  scam('mentor_pro', 'mentor', 2, 20, 3000, { afterOffer: 'mentor_course' }),
  // Ярус 3 — «совсем»
  t3('eduard_tv', 'eduard', { energy: 40, successChance: 0.5, rewardMin: 2500, rewardMax: 3500, fine: 3000, rep: -5, heat: 10, jail: 0.25, minDebt: 10000 }),
  t3('gosha_safe', 'gosha', { energy: 50, successChance: 0.4, rewardMin: 5500, rewardMax: 6500, fine: 4000, rep: -4, heat: 30, jail: 0.4 }),
  t3('vadik_point', 'vadik', { energy: 40, successChance: 0.45, rewardMin: 4000, rewardMax: 5000, fine: 4000, rep: -4, heat: 30, jail: 0.4 }),
  scam('kirill_match', 'kirill', 3, 10, 5000)
]
