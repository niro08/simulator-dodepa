import { evalReels, type GameConfig, type SlotConfigV1, type SymbolId } from '../config'
import { endDay, runNight } from '../day'
import type { Rng } from '../rng'
import { addTilt, needPhase, proposeEnding, spinEnergyCost } from '../rules'
import type { CommandOf, GameEvent, RunState, SpinResult, TiltSource } from '../types'
import type { CommandHandler } from './types'

/** Символ одного барабана по весам виртуальных позиций. */
export function rollSymbol(slot: SlotConfigV1, rng: Rng): SymbolId {
  const total = slot.symbols.reduce((sum, s) => sum + slot.reelWeights[s], 0)
  let x = rng.next() * total
  for (const s of slot.symbols) {
    x -= slot.reelWeights[s]
    if (x < 0) return s
  }
  return slot.symbols[slot.symbols.length - 1] as SymbolId
}

/** Раскладка near-miss 7-7-X в случайном порядке; X не даёт выплату (economy §2.2). */
export function nearMissReels(slot: SlotConfigV1, rng: Rng): [SymbolId, SymbolId, SymbolId] {
  const { symbol, thirdFrom } = slot.nearMiss
  const reels: [SymbolId, SymbolId, SymbolId] = [symbol, symbol, symbol]
  reels[rng.int(0, 2)] = rng.pick(thirdFrom)
  return reels
}

/**
 * Исход спина (ADR-001, economy §2.2): три барабана по весам → evalReels.
 * Сигнатура не получает RunState: тильт, мета и скин не могут влиять на исход (systems-spec §2.6).
 * Near-miss — только подмена раскладки у части проигрышей; исход уже решён и остаётся `lose`.
 */
export function resolveSpin(bet: number, slot: SlotConfigV1, rng: Rng): SpinResult {
  let reels: [SymbolId, SymbolId, SymbolId] = [rollSymbol(slot, rng), rollSymbol(slot, rng), rollSymbol(slot, rng)]
  const rule = evalReels(reels, slot.paytable)
  let nearMiss = false
  if (rule.id === 'lose' && rng.next() < slot.nearMiss.shareOfLosses) {
    reels = nearMissReels(slot, rng)
    nearMiss = true
  }
  return {
    bet,
    outcomeId: rule.id,
    multiplier: rule.mult,
    payout: Math.floor(bet * rule.mult),
    reels,
    ldw: rule.mult > 0 && rule.mult < 1,
    nearMiss
  }
}

/** Потолок ставки: баланс казино и лимит активного бонуса (economy §5.2). */
export function betCap(run: RunState, config: GameConfig): number {
  const B = config.balance
  return run.bonus.state === 'active' ? Math.min(run.casino, B.BONUS_MAX_BET) : run.casino
}

/** Ставка, которая реально уйдёт в спин: min(bet, casino, BONUS_MAX_BET при бонусе). */
export function effectiveBet(run: RunState, config: GameConfig): number {
  return Math.min(run.bet, betCap(run, config))
}

/** Изменение тильта спином и доминирующий источник (наибольший |δ|, systems-spec §2.7). */
function spinTilt(mult: number, ldw: boolean, allIn: boolean, config: GameConfig): { delta: number; source: TiltSource } {
  const B = config.balance
  const parts: [number, TiltSource][] = []
  if (allIn) parts.push([B.TILT_ALLIN, 'all_in'])
  if (mult < 1) parts.push([B.TILT_LOSS, ldw ? 'spin_ldw' : 'spin_loss'])
  else if (mult >= 2) parts.push([-B.TILT_WIN_BIG, 'spin_win'])
  const delta = parts.reduce((sum, [d]) => sum + d, 0)
  const main = parts.sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]))[0]
  return { delta, source: main ? main[1] : 'spin_loss' }
}

/**
 * slot/spin — атомарно (GDD §3.5.1): ставка, исход, выплата, тильт, бонус, «Реферальная», «Ночь в казино».
 * Спин стоит 2⚡, при 🔥 ≥ 70 — 0⚡. Проигрыш больше не даёт ⚡ (B-06).
 */
export const spinHandler: CommandHandler<CommandOf<'slot/spin'>> = {
  check(state, _cmd, config) {
    const B = config.balance
    const phase = needPhase(state, 'day')
    if (phase) return phase
    if (state.location !== 'casino') return { reason: 'not_in_casino' }
    if (state.bet < B.MIN_BET) return { reason: 'bet_below_min', min: B.MIN_BET }
    if (effectiveBet(state, config) < B.MIN_BET) return { reason: 'no_money', min: B.MIN_BET }
    const cost = spinEnergyCost(state, B)
    return state.energy < cost ? { reason: 'no_energy', min: cost } : null
  },
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const bet = effectiveBet(draft, ctx.config)
    const casinoBefore = draft.casino
    const allIn = bet === casinoBefore
    const energyCost = spinEnergyCost(draft, B)
    const tiltBefore = draft.tilt
    const bonusLocked = draft.bonus.state === 'active'

    draft.energy -= energyCost
    draft.casino -= bet
    if (bonusLocked) draft.bonus.wagered += bet

    const result = resolveSpin(bet, ctx.config.slot, ctx.rng)
    draft.casino += result.payout
    draft.loseStreak = result.payout < bet ? draft.loseStreak + 1 : 0
    if (result.outcomeId === 'jackpot') draft.jackpotToday = true
    draft.peakCasino = Math.max(draft.peakCasino, draft.casino)
    draft.spinsThisWeek += 1
    draft.today.spins += 1
    draft.today.wagered += bet
    draft.today.paidOut += result.payout

    events.push({
      type: 'spin',
      ...result,
      allIn,
      energyCost,
      tiltBefore,
      casinoBefore,
      casinoAfter: draft.casino,
      bonusLocked,
      loseStreak: draft.loseStreak
    })

    // Тильт: исход + all-in одной суммой
    const tilt = spinTilt(result.multiplier, result.ldw, allIn, ctx.config)
    addTilt(draft, tilt.delta, tilt.source, events, B, true)

    // Бонус: отыгран или сгорел
    if (draft.bonus.state === 'active') {
      if (draft.bonus.wagered >= draft.bonus.wagerReq) {
        draft.bonus.state = 'done'
        events.push({ type: 'bonusCleared', released: draft.casino })
      } else if (draft.casino < B.MIN_BET) {
        draft.bonus.state = 'lost'
        events.push({ type: 'bonusBusted', balanceLeft: draft.casino, wagerLeft: draft.bonus.wagerReq - draft.bonus.wagered })
      }
    }

    // Мгновенная концовка «Реферальная программа» — только после выплаты спина
    if (draft.casino >= B.REFERRAL_CASINO) proposeEnding(draft, 'referral')

    // Тильт 100 → «Ночь в казино»: день заканчивается принудительно
    if (draft.tilt >= B.TILT_MAX) {
      draft.casinoNightPending = true
      if (draft.endingId) runNight(draft, ctx, events) // только N1: «Ночь ×3» главнее «Реферальной»
      else endDay(draft, ctx, events, true)
    }
    return events
  }
}

/**
 * bet/set — ставка нормализуется и никогда не отклоняется (GDD §3.5.4, economy §2.2):
 * шаг BET_STEP вниз, [MIN_BET; casino], ≤ BONUS_MAX_BET при активном бонусе.
 * Значение ≥ баланса казино = «ДОДЕП ВСЁ»: ставка ровно в баланс (без шага).
 */
export const setBetHandler: CommandHandler<CommandOf<'bet/set'>> = {
  check: (state) => (state.phase === 'ended' ? { reason: 'wrong_phase' } : null),
  apply(draft, cmd, ctx) {
    const B = ctx.config.balance
    const from = draft.bet
    if (!Number.isFinite(cmd.value)) return [{ type: 'betChanged', from, to: from }]
    const cap = betCap(draft, ctx.config)
    const wanted = Math.floor(cmd.value)
    let to: number
    if (cap >= B.MIN_BET && wanted >= cap) to = cap
    else to = Math.min(Math.max(B.MIN_BET, cap), Math.max(B.MIN_BET, Math.floor(wanted / B.BET_STEP) * B.BET_STEP))
    draft.bet = to
    return [{ type: 'betChanged', from, to }]
  }
}
