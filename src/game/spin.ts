/**
 * Исход спина (ADR-001, economy §2.2) и учёт спина в состоянии рана — общие для slot/spin и карточек сна
 * (insomnia_spin, фриспины). Отдельный модуль, чтобы day.ts не импортировал commands (цикл).
 */
import { evalReels, type BalanceV1, type SlotConfigV1, type SymbolId } from './config'
import type { Rng } from './rng'
import type { GameEvent, RunState, SpinResult } from './types'

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

/**
 * Учёт спина в ране (ставка уже списана, выплата уже зачислена): серии, джекпот дня, пик баланса,
 * дневные/недельные счётчики и счётчики карточек сна. Тильт, ⚡ и бонус — у вызывающего.
 */
export function recordSpin(draft: RunState, result: SpinResult): void {
  const { bet, payout } = result
  draft.loseStreak = payout < bet ? draft.loseStreak + 1 : 0
  if (result.outcomeId === 'jackpot') draft.jackpotToday = true
  draft.peakCasino = Math.max(draft.peakCasino, draft.casino)
  draft.spinsThisWeek += 1
  draft.today.spins += 1
  draft.today.wagered += bet
  draft.today.paidOut += payout
  if (result.nearMiss) draft.today.nearMiss += 1
  draft.eventState.spins += 1
  draft.eventState.lastSpinDay = draft.day
  draft.eventState.weekCasinoNet += payout - bet
}

/** Блокировка бонуса вейджером (фриспины, кэшбэк, бонус Анжелики): к активному — добавляется. */
export function lockBonus(draft: RunState, wagerRequired: number): void {
  if (wagerRequired <= 0) return
  if (draft.bonus.state === 'active') draft.bonus.wagerReq += wagerRequired
  else draft.bonus = { state: 'active', wagerReq: wagerRequired, wagered: 0 }
}

/** Проверка бонуса после спина: отыгран / сгорел. Возвращает, что случилось. */
export function settleBonus(draft: RunState, B: BalanceV1): 'cleared' | 'busted' | null {
  if (draft.bonus.state !== 'active') return null
  if (draft.bonus.wagered >= draft.bonus.wagerReq) {
    draft.bonus.state = 'done'
    return 'cleared'
  }
  if (draft.casino < B.MIN_BET) {
    draft.bonus.state = 'lost'
    return 'busted'
  }
  return null
}

/** Отыгрыш/слив бонуса после спина → события bonusCleared / bonusBusted. */
export function pushBonusSettle(draft: RunState, B: BalanceV1, events: GameEvent[]): void {
  const wagerLeftBefore = draft.bonus.wagerReq - draft.bonus.wagered
  const settled = settleBonus(draft, B)
  if (settled === 'cleared') events.push({ type: 'bonusCleared', released: draft.casino })
  else if (settled === 'busted') events.push({ type: 'bonusBusted', balanceLeft: draft.casino, wagerLeft: wagerLeftBefore })
}
