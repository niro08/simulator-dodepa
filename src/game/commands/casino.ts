import { addTilt, needPhase, normalizeAmount } from '../rules'
import type { CommandOf, GameEvent } from '../types'
import type { CommandHandler } from './types'

/** casino/enter — открыть сайт казино (спины только здесь). */
export const enterHandler: CommandHandler<CommandOf<'casino/enter'>> = {
  check: (state) => needPhase(state, 'day') ?? (state.location === 'casino' ? { reason: 'in_casino' } : null),
  apply(draft) {
    draft.location = 'casino'
    return [{ type: 'casinoEntered' }]
  }
}

/** casino/leave — выйти. Двойное подтверждение при 🔥 ≥ 70 — только UI (логике одно). */
export const leaveHandler: CommandHandler<CommandOf<'casino/leave'>> = {
  check: (state) => needPhase(state, 'day') ?? (state.location !== 'casino' ? { reason: 'not_in_casino' } : null),
  apply(draft) {
    draft.location = 'life'
    return [{ type: 'casinoLeft' }]
  }
}

/**
 * casino/deposit — кошелёк → баланс казино, мгновенно (GDD §3.5.2–3.5.3).
 * Первый депозит рана предлагает бонус 200%: принят — весь баланс заблокирован до оборота ×40 от бонуса.
 */
export const depositHandler: CommandHandler<CommandOf<'casino/deposit'>> = {
  check(state, cmd, config) {
    const B = config.balance
    const phase = needPhase(state, 'day')
    if (phase) return phase
    const amount = normalizeAmount(cmd.amount)
    if (amount === null) return { reason: 'invalid_amount' }
    if (amount < B.DEPOSIT_MIN) return { reason: 'amount_below_min', min: B.DEPOSIT_MIN }
    if (state.wallet < amount) return { reason: 'no_money', min: amount }
    return null
  },
  apply(draft, cmd, ctx) {
    const B = ctx.config.balance
    const amount = normalizeAmount(cmd.amount) ?? 0
    const events: GameEvent[] = []
    draft.wallet -= amount
    draft.casino += amount
    events.push({ type: 'deposit', amount })
    if (draft.bonus.state === 'available') {
      if (cmd.bonus === false) {
        draft.bonus.state = 'declined'
        events.push({ type: 'bonusDeclined' })
      } else {
        const bonus = B.BONUS_MULT * Math.min(amount, B.BONUS_DEPOSIT_CAP)
        draft.casino += bonus
        draft.bonus = { state: 'active', wagerReq: B.BONUS_WAGER_MULT * bonus, wagered: 0 }
        events.push({ type: 'bonusGranted', deposit: amount, bonus, wagerRequired: draft.bonus.wagerReq })
      }
    }
    draft.peakCasino = Math.max(draft.peakCasino, draft.casino)
    return events
  }
}

/** Остаток оборота бонуса (0, если бонус не активен). */
export function wagerLeft(bonus: { state: string; wagerReq: number; wagered: number }): number {
  return bonus.state === 'active' ? Math.max(0, bonus.wagerReq - bonus.wagered) : 0
}

/**
 * casino/withdraw — вывод: мин. 1000₽, комиссия 5% (floor), деньги придут утром следующего дня.
 * Недоступен, пока бонус не отыгран. Первый вывод за день: 🔥 −5.
 */
export const withdrawHandler: CommandHandler<CommandOf<'casino/withdraw'>> = {
  check(state, cmd, config) {
    const B = config.balance
    const phase = needPhase(state, 'day')
    if (phase) return phase
    if (state.bonus.state === 'active') return { reason: 'bonus_locked', min: wagerLeft(state.bonus) }
    const amount = normalizeAmount(cmd.amount)
    if (amount === null) return { reason: 'invalid_amount' }
    if (amount < B.WITHDRAW_MIN) return { reason: 'amount_below_min', min: B.WITHDRAW_MIN }
    if (state.casino < amount) return { reason: 'no_money', min: amount }
    return null
  },
  apply(draft, cmd, ctx) {
    const B = ctx.config.balance
    const gross = normalizeAmount(cmd.amount) ?? 0
    const net = Math.floor(gross * (1 - B.WITHDRAW_FEE))
    const arriveDay = draft.day + 1
    draft.casino -= gross
    draft.withdrawals.push({ amount: gross, net, arriveDay })
    const events: GameEvent[] = [{ type: 'withdrawRequested', gross, fee: gross - net, net, arriveDay }]
    if (!draft.withdrewToday) {
      draft.withdrewToday = true
      addTilt(draft, -B.TILT_WITHDRAW, 'withdraw', events, B)
    }
    return events
  }
}
