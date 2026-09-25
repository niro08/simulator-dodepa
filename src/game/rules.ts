/**
 * Общие правила рана (design/gdd-run-structure.md §3.4–§3.9, §4; числа — economy-v1 §14).
 * Чистые функции над RunState: их используют и обработчики команд, и ночь/утро, и геттеры UI.
 * Мутирующие хелперы (changeRep, addTilt, forcedPay…) работают только с draft внутри dispatch.
 */
import { ITEM_IDS, type BalanceV1, type GameConfig, type ItemId } from './config'
import type {
  Bill,
  EndingId,
  GameEvent,
  Grade,
  Rejection,
  RunState,
  TiltSource,
  TiltStage
} from './types'

// ─── Базовые величины ───────────────────────────────────────────────────────

export const debtOf = (run: Pick<RunState, 'debtBank' | 'debtMfo'>): number => run.debtBank + run.debtMfo
export const weekOf = (day: number): number => Math.ceil(day / 7)
export const ownedItems = (run: Pick<RunState, 'items'>): ItemId[] => ITEM_IDS.filter((i) => run.items[i] === 'owned')
export const lostItems = (run: Pick<RunState, 'items'>): ItemId[] => ITEM_IDS.filter((i) => run.items[i] !== 'owned')
export const isItemId = (x: unknown): x is ItemId => typeof x === 'string' && (ITEM_IDS as readonly string[]).includes(x)

/** Приоритет концовок при одновременном срабатывании (GDD §3.9): меньше — главнее. */
export const ENDING_PRIORITY: Record<EndingId, number> = {
  jail: 1,
  collectors: 2,
  family_left: 3,
  casino_nights: 4,
  minimalism: 5,
  referral: 6,
  quit: 7
}
export const ENDING_IDS = Object.keys(ENDING_PRIORITY) as EndingId[]

/** Отказ «не та фаза», если фаза не из списка. */
export function needPhase(run: RunState, ...phases: RunState['phase'][]): Rejection | null {
  return phases.includes(run.phase) ? null : { reason: 'wrong_phase' }
}

/** Действия «Жизни» (L) недоступны из казино. */
export function needLife(run: RunState): Rejection | null {
  return run.location === 'life' ? null : { reason: 'in_casino' }
}

export function needEnergy(run: RunState, cost: number): Rejection | null {
  return run.energy < cost ? { reason: 'no_energy', min: cost } : null
}

/** Нормализация суммы из ввода: конечное целое > 0 или null. */
export function normalizeAmount(raw: number): number | null {
  if (!Number.isFinite(raw)) return null
  const n = Math.floor(raw)
  return n > 0 ? n : null
}

// ─── Концовки ───────────────────────────────────────────────────────────────

/** Предложить концовку; побеждает более приоритетная. Финализирует dispatch (finishRun). */
export function proposeEnding(draft: RunState, id: EndingId): void {
  if (!draft.endingId || ENDING_PRIORITY[id] < ENDING_PRIORITY[draft.endingId]) draft.endingId = id
}

/** Оценка «Завязал» (GDD §3.9). */
export function quitGrade(run: RunState, B: BalanceV1): Grade {
  const owned = ownedItems(run).length
  if (owned === ITEM_IDS.length && run.rep >= B.QUIT_GRADE_A_REP) return 'A'
  if (owned === 0) return 'C'
  return 'B'
}

/** Закрывает ран, если в транзакции предложена концовка: фаза ended, событие runEnded. */
export function finishRun(draft: RunState, events: GameEvent[], config: GameConfig): void {
  if (!draft.endingId || draft.phase === 'ended') return
  draft.phase = 'ended'
  draft.grade = draft.endingId === 'quit' ? quitGrade(draft, config.balance) : null
  draft.casinoNightPending = false
  events.push({
    type: 'runEnded',
    endingId: draft.endingId,
    grade: draft.grade,
    day: draft.day,
    weeksSurvived: Math.max(0, weekOf(draft.day) - 1),
    forfeitedCasino: draft.casino,
    forfeitedWithdrawals: draft.withdrawals.reduce((sum, w) => sum + w.net, 0),
    itemsLost: lostItems(draft)
  })
}

// ─── ❤️ и 🔥 ─────────────────────────────────────────────────────────────────

/**
 * Любое изменение ❤️ (GDD §3.8): «Семья ушла» проверяется до клампа,
 * ❤️ ≤ 0 навсегда блокирует друзей.
 */
export function changeRep(draft: RunState, delta: number, events: GameEvent[], B: BalanceV1): void {
  if (delta === 0) return
  draft.rep += delta
  if (draft.rep <= B.REP_FAMILY_LEAVES) proposeEnding(draft, 'family_left')
  draft.rep = Math.min(B.REP_MAX, Math.max(B.REP_MIN, draft.rep))
  if (draft.rep <= 0 && !draft.friendsBlocked) {
    draft.friendsBlocked = true
    events.push({ type: 'friendsBlocked' })
  }
}

export function tiltStage(tilt: number, B: BalanceV1): TiltStage {
  if (tilt >= B.TILT_MAX) return 'night'
  if (tilt >= B.TILT_T2) return 'tilt'
  if (tilt >= B.TILT_T1) return 'heated'
  return 'calm'
}

/** Ставит тильт и пишет tiltChanged/tiltStageChanged (если значение изменилось). */
export function setTilt(draft: RunState, value: number, source: TiltSource, events: GameEvent[], B: BalanceV1): void {
  const before = draft.tilt
  const next = Math.min(B.TILT_MAX, Math.max(0, Math.round(value)))
  if (next === before) return
  draft.tilt = next
  draft.maxTiltToday = Math.max(draft.maxTiltToday, next)
  events.push({ type: 'tiltChanged', value: next, delta: next - before, source })
  const from = tiltStage(before, B)
  const to = tiltStage(next, B)
  if (from !== to) events.push({ type: 'tiltStageChanged', from, to })
}

/**
 * Изменение тильта. Не-спиновые источники не поднимают выше TILT_NON_SPIN_CAP (99):
 * «Ночь в казино» случается только в казино (GDD §3.5.10).
 */
export function addTilt(
  draft: RunState,
  delta: number,
  source: TiltSource,
  events: GameEvent[],
  B: BalanceV1,
  fromSpin = false
): void {
  if (delta === 0) return
  const cap = fromSpin ? B.TILT_MAX : Math.min(B.TILT_MAX, Math.max(B.TILT_NON_SPIN_CAP, draft.tilt))
  setTilt(draft, Math.min(cap, draft.tilt + delta), source, events, B)
}

/** Стоимость спина в ⚡: при 🔥 ≥ T2 — 0 (systems-spec §2.5 A). Исход от тильта не зависит. */
export function spinEnergyCost(run: RunState, B: BalanceV1): number {
  return run.tilt >= B.TILT_T2 ? 0 : B.SPIN_ENERGY
}

// ─── Деньги ─────────────────────────────────────────────────────────────────

/**
 * Обязательное списание (GDD §3.5.12): при нехватке кошелёк → 0, недостача → debtMfo сверх лимита.
 * Кошелёк никогда не бывает отрицательным.
 */
export function forcedPay(
  draft: RunState,
  amount: number,
  reason: 'living' | 'shady_fine' | 'event',
  events: GameEvent[]
): number {
  if (draft.wallet >= amount) {
    draft.wallet -= amount
    return 0
  }
  const short = amount - draft.wallet
  draft.wallet = 0
  draft.debtMfo += short
  events.push({ type: 'forcedMfo', amount: short, reason })
  return short
}

/**
 * Гашение долга: сначала МФО, потом банк. ❤️ за погашение — только за деньги,
 * взятые не сегодня (антиабуз «взял-вернул», GDD §3.5.8). Возвращает прирост ❤️.
 */
export function repayCore(draft: RunState, amount: number, events: GameEvent[], B: BalanceV1): number {
  const fromMfo = Math.min(amount, draft.debtMfo)
  draft.debtMfo -= fromMfo
  draft.debtBank -= Math.min(amount - fromMfo, draft.debtBank)
  const eligible = Math.max(0, amount - draft.borrowedToday)
  draft.borrowedToday = Math.max(0, draft.borrowedToday - amount)
  draft.repayProgress += eligible
  const gain = Math.floor(draft.repayProgress / B.REPAY_REP_STEP)
  draft.repayProgress %= B.REPAY_REP_STEP
  changeRep(draft, gain, events, B)
  return gain
}

/** Проценты за ближайшую ночь (для «≈ N₽ за ночь» в UI). */
export function interestTonight(run: RunState, B: BalanceV1): number {
  return (
    Math.ceil(run.debtMfo * (1 + B.MFO_RATE_DAY)) - run.debtMfo + Math.ceil(run.debtBank * (1 + B.BANK_RATE_DAY)) - run.debtBank
  )
}

export function checkBankLoan(run: RunState, B: BalanceV1): Rejection | null {
  if (run.rep < B.BANK_REP_MIN) return { reason: 'rep_too_low', min: B.BANK_REP_MIN }
  if (debtOf(run) + B.BANK_LOAN > B.DEBT_LIMIT) return { reason: 'debt_limit', min: B.DEBT_LIMIT }
  return null
}

export function checkMfoLoan(run: RunState, B: BalanceV1): Rejection | null {
  if (debtOf(run) + B.MFO_LOAN > B.DEBT_LIMIT) return { reason: 'debt_limit', min: B.DEBT_LIMIT }
  return null
}

export function redeemCost(item: ItemId, B: BalanceV1): number {
  return Math.ceil(B.PAWN_VALUE[item] * B.PAWN_REDEEM_MULT)
}

// ─── Работа и люди (economy-v1 §3, §14.3) ───────────────────────────────────

export function shiftPromos(run: RunState, B: BalanceV1): number {
  return Math.min(B.SHIFT_PROMO_MAX, Math.floor(run.shiftsDone / B.SHIFT_PROMO_EVERY))
}

export function repMult(rep: number, B: BalanceV1): number {
  return rep < 0
    ? B.SHIFT_REP_PENALTY_MULT
    : 1 + Math.min(B.SHIFT_REP_BONUS_CAP, Math.max(0, rep - 10) * B.SHIFT_REP_BONUS_STEP)
}

/** Мама поставила блокировку сайтов (mama_blocks_site): казино закрыто сегодня. */
export function casinoBlocked(run: Pick<RunState, 'day' | 'eventState'>): boolean {
  return run.eventState.casinoBlockedUntil >= run.day
}

/** Оплата следующей смены с учётом вычетов карточек сна (boss_caught, boss_advance), ≥ 0. */
export function shiftPayNet(run: RunState, B: BalanceV1): number {
  return Math.max(0, shiftPay(run, B) - (run.eventState.shiftDeductions[0] ?? 0))
}

/** Оплата следующей смены: 630…2048₽ при ❤️ ∈ [−15; 40] (регресс B-05). */
export function shiftPay(run: RunState, B: BalanceV1): number {
  return Math.round(B.SHIFT_PAY * (1 + B.SHIFT_PROMO_STEP * shiftPromos(run, B)) * repMult(run.rep, B))
}

/** Сумма займа у друзей: {0} ∪ [50; 800]. 0 — занять нельзя (блок, нет телефона, «самим не хватает»). */
export function friendAmount(run: RunState, B: BalanceV1): number {
  if (run.friendsBlocked || run.items.phone !== 'owned' || run.rep <= 0) return 0
  const base = Math.min(B.FRIEND_MAX, B.FRIEND_BASE + B.FRIEND_PER_REP * run.rep)
  const amount = Math.round((base * (1 - B.FRIEND_WEEKLY_DECAY) ** run.friendLoansThisWeek) / 10) * 10
  return amount < B.FRIEND_MIN_AMOUNT ? 0 : amount
}

// ─── Счета и развилка (GDD §3.6, §3.7) ──────────────────────────────────────

/** Сумма к оплате: фикс + ceil(10% долга). Долговая часть гасит долг. */
export function billTotal(run: RunState, bill: Bill, B: BalanceV1): number {
  return bill.fixed + Math.ceil(B.BILL_DEBT_SHARE * debtOf(run))
}

/** Счёт, который можно (и нужно) оплатить сегодня. */
export function billDueToday(run: RunState): Bill | undefined {
  return run.bills.find((b) => b.dueDay === run.day && b.status !== 'paid')
}

/** Ближайший неоплаченный счёт (для счётчика «До счёта N дн.»). */
export function nextUnpaidBill(run: RunState): Bill | undefined {
  return run.bills.filter((b) => b.status !== 'paid').sort((a, b) => a.dueDay - b.dueDay)[0]
}

/** Счёт дня развилки: недели ≥ 4 со сроком сегодня. */
export function forkBillToday(run: RunState): Bill | undefined {
  return run.bills.find((b) => b.week >= 4 && b.dueDay === run.day)
}

/** День развилки наступил: счёт недели ≥ 4 со сроком сегодня оплачен. */
export function isForkOpen(run: RunState): boolean {
  return forkBillToday(run)?.status === 'paid'
}

/** Счёт недели w в режиме «Ещё неделю»: round100(BILLS[4] × GROWTH^(w−4)). */
export function endlessBillFixed(week: number, B: BalanceV1): number {
  const base = B.BILLS[B.BILLS.length - 1] ?? 0
  return Math.round((base * B.ENDLESS_BILL_GROWTH ** (week - B.BILLS.length)) / 100) * 100
}

export function initialBills(B: BalanceV1): Bill[] {
  return B.BILLS.map((fixed, i) => ({ week: i + 1, dueDay: 7 * (i + 1), fixed, status: 'upcoming' as const }))
}

// ─── Концовка «Минимализм» (GDD §3.9 #5) ────────────────────────────────────

export function isMinimalism(run: RunState, B: BalanceV1): boolean {
  return (
    run.wallet + run.casino < B.MINIMALISM_MONEY &&
    ownedItems(run).length === 0 &&
    checkBankLoan(run, B) !== null &&
    checkMfoLoan(run, B) !== null
  )
}
