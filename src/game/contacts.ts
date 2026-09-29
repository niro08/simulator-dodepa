/**
 * Контакты вместо кнопки «Темка» (design/contacts-shady.md §4–§5). Чистые правила над RunState:
 * глубина круга, генерация утром (свой подпоток RNG от сида и дня), шанс с засветом, EV, проверки команды.
 * Мутирует только refreshContacts / decayContactHeat — их зовут wake / ночь внутри dispatch.
 */
import type { BalanceV1, GameConfig } from './config'
import type { ContactId, OfferDef } from './content/contacts'
import { createRng, deriveSeed } from './rng'
import { debtOf } from './rules'
import type { ContactsState, HeldOffer, Rejection, RunState } from './types'

/** Соли подпотоков (§4.2 п.4). */
export const CONTACT_SALT_GEN = 0xc0a7ac75
export const CONTACT_SALT_DEAL = 0x5ca1ab1e

/** Пакет включён: только вместе с «Быстрым фиксом» (сделка занимает вечер). */
export function contactsOn(B: BalanceV1): boolean {
  return B.FEATURE_CONTACTS && B.FEATURE_EVENING_FIX
}

export function needContactsFeature(B: BalanceV1): Rejection | null {
  return contactsOn(B) ? null : { reason: 'feature_disabled' }
}

export function findOffer(config: GameConfig, id: string): OfferDef | undefined {
  return config.contacts.offers.find((o) => o.id === id)
}

export function freshContacts(): ContactsState {
  return { offers: [], used: [], burned: [], heat: 0 }
}

/** used + предложения сгоревших контактов, которых нет в used (§3.2). */
export function burnedCount(run: Pick<RunState, 'contacts'>, config: GameConfig): number {
  const c = run.contacts
  if (!c) return 0
  const extra = config.contacts.offers.filter((o) => c.burned.includes(o.contact) && !c.used.includes(o.id)).length
  return c.used.length + extra
}

/** Глубина круга 1…3 (§4.1). */
export function contactDepth(run: RunState, config: GameConfig): 1 | 2 | 3 {
  const B = config.balance
  const burned = burnedCount(run, config)
  const debt = debtOf(run)
  if (run.day >= B.CONTACT_DEPTH3_DAY || burned >= B.CONTACT_DEPTH3_BURNED || debt >= B.CONTACT_DEPTH3_DEBT || run.rep <= B.CONTACT_DEPTH3_REP) return 3
  if (run.day >= B.CONTACT_DEPTH2_DAY || burned >= B.CONTACT_DEPTH2_BURNED || debt >= B.CONTACT_DEPTH2_DEBT || run.rep <= B.CONTACT_DEPTH2_REP) return 2
  return 1
}

/** Вещь на месте (или не нужна). */
export function offerItemOk(run: Pick<RunState, 'items'>, def: OfferDef): boolean {
  return !def.requiresItem || run.items[def.requiresItem] === 'owned'
}

/** Условия появления: вещь, долг, «после предложения», контакт не сгорел. */
function offerConditionsOk(run: RunState, c: ContactsState, def: OfferDef): boolean {
  if (c.burned.includes(def.contact)) return false
  if (!offerItemOk(run, def)) return false
  if (def.minDebt !== undefined && debtOf(run) < def.minDebt) return false
  if (def.afterOffer !== undefined && !c.used.includes(def.afterOffer)) return false
  return true
}

/** Вес предложения в пуле на текущей глубине: вес яруса × weight. */
export function offerWeight(def: OfferDef, depth: 1 | 2 | 3, B: BalanceV1): number {
  return (B.CONTACT_TIER_WEIGHTS[depth - 1]?.[def.tier - 1] ?? 0) * (def.weight ?? 1)
}

/** Кандидаты генерации в порядке контента (§4.2 п.3). */
export function offerCandidates(run: RunState, config: GameConfig): { def: OfferDef; weight: number }[] {
  const c = run.contacts
  if (!c) return []
  const depth = contactDepth(run, config)
  return config.contacts.offers
    .filter((def) => !c.used.includes(def.id) && !c.offers.some((o) => o.id === def.id) && offerConditionsOk(run, c, def))
    .map((def) => ({ def, weight: offerWeight(def, depth, config.balance) }))
    .filter((x) => x.weight > 0)
}

/**
 * M4½ утра (§4.2): создать состояние при первом wake, выкинуть протухшее и недоступное, добрать слоты
 * взвешенным выбором из подпотока deriveSeed(seed, day, CONTACT_SALT_GEN). Основной RNG не трогается.
 */
export function refreshContacts(draft: RunState, config: GameConfig): void {
  const B = config.balance
  if (!contactsOn(B)) return
  const c = draft.contacts ?? freshContacts()
  draft.contacts = c
  const sub = createRng(deriveSeed(draft.seed, draft.day, CONTACT_SALT_GEN))
  c.offers = c.offers.filter((o) => {
    const def = findOffer(config, o.id)
    if (!def || o.expiresDay < draft.day || c.burned.includes(def.contact)) return false
    if (!offerItemOk(draft, def)) return false
    return def.minDebt === undefined || debtOf(draft) >= def.minDebt
  })
  const slots = draft.day <= 7 ? B.CONTACT_SLOTS_WEEK1 : B.CONTACT_SLOTS
  const step = B.CONTACT_REWARD_STEP
  while (c.offers.length < slots) {
    const pool = offerCandidates(draft, config)
    const total = pool.reduce((sum, x) => sum + x.weight, 0)
    if (total <= 0) break
    let x = sub.next() * total
    let picked = pool[pool.length - 1]!.def
    for (const p of pool) {
      x -= p.weight
      if (x < 0) {
        picked = p.def
        break
      }
    }
    const reward = step * sub.int(picked.rewardMin / step, picked.rewardMax / step)
    c.offers.push({ id: picked.id, reward, expiresDay: draft.day + picked.expiry })
  }
}

/** Ночь, N7 (§4.4): день без сделки — засвет спадает; в день сделки нет. */
export function decayContactHeat(draft: RunState, B: BalanceV1): void {
  const c = draft.contacts
  if (!c || !contactsOn(B)) return
  if (c.lastDealDay !== draft.day) c.heat = Math.max(0, c.heat - B.CONTACT_HEAT_DECAY_QUIET)
}

/** Шанс сделки с засветом (§5): clamp(p − heat × PENALTY, P_MIN, P_MAX). */
export function pEff(def: OfferDef, heat: number, B: BalanceV1): number {
  return Math.min(B.CONTACT_P_MAX, Math.max(B.CONTACT_P_MIN, def.successChance - heat * B.CONTACT_HEAT_PENALTY))
}

/**
 * EV₽ сделки (§5): p·R − (1 − p)·F; у развода −price. reward — брошенная сумма на руках;
 * без неё — середина диапазона R̄ (таблица §5 и тест контента).
 */
export function offerEv(def: OfferDef, heat: number, B: BalanceV1, reward?: number): number {
  if (def.scam) return -def.scam.price
  const p = pEff(def, heat, B)
  const r = reward ?? (def.rewardMin + def.rewardMax) / 2
  return p * r - (1 - p) * def.fine
}

/** Риск ареста открыт (§4.4): ❤️ ≤ SHADY_JAIL_REP или засвет ≥ CONTACT_HEAT_JAIL. */
export function jailRiskOpen(run: Pick<RunState, 'rep' | 'contacts'>, B: BalanceV1): boolean {
  return run.rep <= B.SHADY_JAIL_REP || (run.contacts?.heat ?? 0) >= B.CONTACT_HEAT_JAIL
}

export function heldOffer(run: Pick<RunState, 'contacts'>, offerId: string): HeldOffer | undefined {
  return run.contacts?.offers.find((o) => o.id === offerId)
}

export function isContactId(x: unknown, ids: readonly string[]): x is ContactId {
  return typeof x === 'string' && ids.includes(x)
}
