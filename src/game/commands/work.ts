import {
  addTilt,
  changeRep,
  forcedPay,
  halfShiftPay,
  needEnergy,
  needEvening,
  needEveningFeature,
  needLife,
  needPhase,
  needWork,
  overtimePay,
  proposeEnding,
  shiftPay,
  shiftPayNet,
  shiftPromos
} from '../rules'
import type { BalanceV1 } from '../config'
import { CONTACT_SALT_DEAL, contactsOn, findOffer, heldOffer, jailRiskOpen, needContactsFeature, offerItemOk, pEff } from '../contacts'
import { createRng, deriveSeed, fnv1a } from '../rng'
import type { CommandOf, GameEvent, RunState } from '../types'
import type { CommandHandler } from './types'

/** Общая часть смены и переработки: оплата, вычет, счётчики смен, повышение. */
function workShift(draft: RunState, B: BalanceV1, overtime: boolean, events: GameEvent[]): void {
  const promosBefore = shiftPromos(draft, B)
  const gross = overtime ? Math.round(shiftPay(draft, B) * B.OVERTIME_PAY_MULT) : shiftPay(draft, B)
  const pay = overtime ? overtimePay(draft, B) : shiftPayNet(draft, B)
  const deducted = gross - pay
  draft.eventState.shiftDeductions.shift() // вычет карточки сна (аванс / «вишенки на экране») — по одному на смену
  draft.energy -= overtime ? B.OVERTIME_ENERGY : B.SHIFT_ENERGY
  draft.wallet += pay
  draft.today.earned += pay
  draft.today.shifts += 1
  draft.eventState.shiftsThisWeek += 1
  draft.shiftsDone += 1
  const promoted = draft.shiftsDone % B.SHIFT_PROMO_EVERY === 0 && promosBefore < B.SHIFT_PROMO_MAX
  events.push({
    type: 'shiftWorked',
    pay,
    promoted,
    repPenalty: draft.rep < 0,
    ...(deducted > 0 ? { deducted } : {}),
    ...(overtime ? { overtime: true as const } : {})
  })
  addTilt(draft, -(overtime ? B.TILT_OVERTIME : B.TILT_SHIFT), 'shift', events, B)
}

/**
 * work/shift — смена (GDD §3.5.5, economy §3): 630…2048₽, повышение каждые 5 смен, 🔥 −10.
 * При FEATURE_EVENING_FIX — одна работа в день (quick-fix-evening §3.2).
 */
export const shiftHandler: CommandHandler<CommandOf<'work/shift'>> = {
  check: (state, _cmd, config) =>
    needPhase(state, 'day') ??
    needLife(state) ??
    needWork(state, config.balance) ??
    needEnergy(state, config.balance.SHIFT_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    workShift(draft, B, false, events)
    if (B.FEATURE_EVENING_FIX) draft.workToday = 'shift'
    return events
  }
}

/**
 * work/half — полсмены (quick-fix-evening §3.2): 45% оплаты без вычетов, не идёт в смены и повышение, 🔥 −5.
 */
export const halfShiftHandler: CommandHandler<CommandOf<'work/half'>> = {
  check: (state, _cmd, config) =>
    needEveningFeature(config.balance) ??
    needPhase(state, 'day') ??
    needLife(state) ??
    needWork(state, config.balance) ??
    needEnergy(state, config.balance.HALF_SHIFT_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const pay = halfShiftPay(draft, B)
    draft.energy -= B.HALF_SHIFT_ENERGY
    draft.wallet += pay
    draft.today.earned += pay
    draft.workToday = 'half'
    events.push({ type: 'halfShiftWorked', pay })
    addTilt(draft, -B.TILT_HALF_SHIFT, 'shift', events, B)
    return events
  }
}

/**
 * work/overtime — переработка (quick-fix-evening §3.2): смена ×1.25 за 80⚡, занимает и работу, и вечер; 🔥 −5.
 */
export const overtimeHandler: CommandHandler<CommandOf<'work/overtime'>> = {
  check: (state, _cmd, config) =>
    needEveningFeature(config.balance) ??
    needPhase(state, 'day') ??
    needLife(state) ??
    needWork(state, config.balance) ??
    needEvening(state, config.balance) ??
    needEnergy(state, config.balance.OVERTIME_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    workShift(draft, B, true, events)
    draft.workToday = 'overtime'
    draft.eveningUsed = 'overtime'
    return events
  }
}

/**
 * work/shady — темка (GDD §3.5.6): ❤️ −2 всегда и первым делом; 50% успех 1800–2800₽;
 * провал — штраф (недостача → МФО), 🔥 +10, при ❤️ ≤ −10 — 25% «Сел». Порядок бросков фиксирован.
 */
export const shadyHandler: CommandHandler<CommandOf<'work/shady'>> = {
  check: (state, _cmd, config) =>
    // contacts-shady §4.3: при контактах кнопка «Темка» заменена предложениями
    (contactsOn(config.balance) ? { reason: 'feature_disabled' as const } : null) ??
    needPhase(state, 'day') ??
    needLife(state) ??
    needEvening(state, config.balance) ??
    needEnergy(state, config.balance.SHADY_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    if (B.FEATURE_EVENING_FIX) draft.eveningUsed = 'shady'
    draft.energy -= B.SHADY_ENERGY
    changeRep(draft, B.SHADY_REP, events, B)
    if (ctx.rng.next() < B.SHADY_SUCCESS) {
      const step = B.SHADY_REWARD_STEP
      const amount = step * ctx.rng.int(B.SHADY_REWARD_MIN / step, B.SHADY_REWARD_MAX / step)
      draft.wallet += amount
      draft.today.earned += amount
      events.push({ type: 'schemeResolved', success: true, amount, fine: 0, jailed: false })
      return events
    }
    const jailed = draft.rep <= B.SHADY_JAIL_REP && ctx.rng.next() < B.SHADY_JAIL_CHANCE
    events.push({ type: 'schemeResolved', success: false, amount: 0, fine: B.SHADY_FINE, jailed })
    forcedPay(draft, B.SHADY_FINE, 'shady_fine', events)
    addTilt(draft, B.TILT_SHADY_FAIL, 'scheme_fail', events, B)
    if (jailed) proposeEnding(draft, 'jail')
    return events
  }
}

/**
 * work/offer — сделка по предложению контакта (design/contacts-shady.md §4.3), вечерняя.
 * ❤️ списывается всегда и первым делом; развод просто забирает цену; иначе бросок успеха из подпотока
 * deriveSeed(seed, day, CONTACT_SALT_DEAL ^ fnv1a(id)) с шансом pEff от засвета ДО сделки, при провале —
 * штраф, 🔥, контакт сгорает и (если риск открыт) бросок ареста. Затем засвет растёт.
 */
export const offerHandler: CommandHandler<CommandOf<'work/offer'>> = {
  check(state, cmd, config) {
    const B = config.balance
    const base = needContactsFeature(B) ?? needPhase(state, 'day') ?? needLife(state)
    if (base) return base
    const def = heldOffer(state, cmd.offerId) ? findOffer(config, cmd.offerId) : undefined
    if (!def) return { reason: 'no_offer' }
    if (!offerItemOk(state, def)) return { reason: 'item_not_owned' }
    const rest = needEvening(state, B) ?? needEnergy(state, def.energy)
    if (rest) return rest
    if (def.scam && state.wallet < def.scam.price) return { reason: 'no_money', min: def.scam.price }
    return null
  },
  apply(draft, cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const c = draft.contacts
    const held = heldOffer(draft, cmd.offerId)
    const def = findOffer(ctx.config, cmd.offerId)
    if (!c || !held || !def) return events
    // 1. Вечер, ⚡, ❤️, предложение гаснет навсегда
    draft.eveningUsed = 'shady'
    draft.energy -= def.energy
    changeRep(draft, def.rep, events, B)
    c.offers = c.offers.filter((o) => o.id !== def.id)
    c.used.push(def.id)
    // 2. Развод: только цена. Засвет не растёт, lastDealDay не ставится
    if (def.scam) {
      draft.wallet -= def.scam.price
      if (def.scam.fakeLuckDays) c.fakeLuckUntil = draft.day + def.scam.fakeLuckDays
      events.push({ type: 'scamPaid', offerId: def.id, price: def.scam.price })
      return events
    }
    // 3. Бросок: успех, потом арест (порядок фиксирован)
    const deal = createRng(deriveSeed(draft.seed, draft.day, (CONTACT_SALT_DEAL ^ fnv1a(def.id)) >>> 0))
    const p = pEff(def, c.heat, B)
    if (deal.next() < p) {
      draft.wallet += held.reward
      draft.today.earned += held.reward
      events.push({ type: 'schemeResolved', success: true, amount: held.reward, fine: 0, jailed: false, offerId: def.id })
    } else {
      const jailed = jailRiskOpen(draft, B) && deal.next() < def.jail
      events.push({ type: 'schemeResolved', success: false, amount: 0, fine: def.fine, jailed, offerId: def.id })
      forcedPay(draft, def.fine, 'shady_fine', events)
      addTilt(draft, def.tiltFail, 'scheme_fail', events, B)
      if (!c.burned.includes(def.contact)) c.burned.push(def.contact)
      if (jailed) proposeEnding(draft, 'jail')
    }
    // 4. Засвет после броска
    c.heat = Math.min(B.CONTACT_HEAT_MAX, c.heat + def.heat)
    c.lastDealDay = draft.day
    return events
  }
}
