/**
 * Производные метрики честной статистики и Выписка (design/systems-spec.md §3.2–§3.5).
 * Геттеры не хранятся в сейве: считаются из run.stats / profile.stats и конфига. UI только рендерит.
 */
import { slotMetrics, type GameConfig, type ItemId } from './config'
import { lostItems } from './rules'
import { stat } from './stats'
import type { EndingId, Grade, PlayerStats, Profile, RunState } from './types'

/** Фактический RTP игрока; null — спинов не было. */
export function rtpActual(stats: PlayerStats): number | null {
  const wagered = stat(stats, 'totalWagered')
  return wagered > 0 ? stat(stats, 'totalPaidOut') / wagered : null
}

/** Итог казино: выведено (дошедшее) − внесено. < 0 — казино в плюсе. Баланс на сайте — «не твоё». */
export function casinoNetFinal(stats: PlayerStats): number {
  return stat(stats, 'withdrawnNet') - stat(stats, 'withdrawalsForfeited') - stat(stats, 'deposited')
}

/** Итог «если вывести всё сейчас» (Изнанка): + баланс к выводу за вычетом комиссии. */
export function casinoNetLive(run: RunState, config: GameConfig): number {
  // withdrawnNet уже включает выводы «на рассмотрении» (считаются в момент заказа)
  const withdrawable = run.bonus.state === 'active' ? 0 : run.casino
  return (
    stat(run.stats, 'withdrawnNet') +
    Math.floor(withdrawable * (1 - config.balance.WITHDRAW_FEE)) -
    stat(run.stats, 'deposited')
  )
}

export interface LuckReport {
  expectedLoss: number
  actualLoss: number
  /** > 0 — повезло больше среднего. */
  luck: number
}

export function luckReport(stats: PlayerStats, config: GameConfig): LuckReport {
  const wagered = stat(stats, 'totalWagered')
  const expectedLoss = Math.round(wagered * (1 - slotMetrics(config.slot).rtp))
  const actualLoss = wagered - stat(stats, 'totalPaidOut')
  return { expectedLoss, actualLoss, luck: expectedLoss - actualLoss }
}

/** Эквиваленты «потеряно в пересчёте на…» (systems-spec §3.3): первые N с n ≥ 1. */
export function equivalents(lost: number, config: GameConfig): { id: string; n: number; price: number }[] {
  const S = config.stats
  const out: { id: string; n: number; price: number }[] = []
  for (const eq of S.EQUIVALENTS) {
    const price = typeof eq.price === 'number' ? eq.price : config.balance[eq.price]
    const n = price > 0 ? Math.floor(lost / price) : 0
    if (n >= 1) out.push({ id: eq.id, n, price })
    if (out.length >= S.EQUIVALENTS_SHOWN) break
  }
  return out
}

/** Внутриигровые часы в казино и «не заметил» (спины 0⚡ при тильте), до 0.1 ч. */
export function casinoHours(stats: PlayerStats, config: GameConfig): { casinoHours: number; unnoticedHours: number } {
  const B = config.balance
  const S = config.stats
  const perEnergy = S.AWAKE_HOURS / B.ENERGY_PER_DAY
  const unnoticed = stat(stats, 'spinsFree') * B.SPIN_ENERGY * perEnergy
  const total = stat(stats, 'casinoEnergySpent') * perEnergy + unnoticed + stat(stats, 'casinoNights') * S.NIGHT_HOURS
  const round1 = (x: number) => Math.round(x * 10) / 10
  return { casinoHours: round1(total), unnoticedHours: round1(unnoticed) }
}

export interface Statement {
  runId: string
  endingId: EndingId | null
  grade: Grade | null
  days: number
  extraWeeks: number
  weeksSurvived: number
  /** Экипированный титул (CD-13), null — нет. */
  title: string | null
  playSec: number
  casinoHours: number
  unnoticedHours: number
  deposited: number
  withdrawnNet: number
  withdrawFees: number
  /** Сгорело у казино: баланс + выводы, которые не пришли. */
  forfeited: number
  casinoNetFinal: number
  /** Проиграно казино L = max(0, −casinoNetFinal). */
  lostToCasino: number
  rtpDeclared: number
  rtpActual: number | null
  expectedLoss: number
  actualLoss: number
  luck: number
  spins: number
  winsShowcase: number
  winsReal: number
  ldw: number
  nearMiss: number
  jackpots: number
  casinoNights: number
  casinoNightLoss: number
  daysTilt70: number
  interestPaid: number
  billPenalties: number
  schemeFines: number
  redeemPremium: number
  forcedMfo: number
  /** Полная цена рана C = L + проценты + штрафы счёта + штрафы темок + наценка выкупа. */
  fullCost: number
  itemsLost: ItemId[]
  friendsBlocked: boolean
  equivalents: { id: string; n: number; price: number }[]
  lifetime: { runs: number; casinoNetFinal: number; spins: number; rtpActual: number | null }
  /** Ачивки, открытые в этом ране (CD-13). */
  newAchievements: string[]
}

/** Данные Выписки (systems-spec §3.5). Чистая функция; работает и для незаконченного рана. */
export function buildStatement(run: RunState, profile: Profile, config: GameConfig): Statement {
  const s = run.stats
  const net = casinoNetFinal(s)
  const lost = Math.max(0, -net)
  const luck = luckReport(s, config)
  const hours = casinoHours(s, config)
  const interestPaid = stat(s, 'interestPaid')
  const billPenalties = stat(s, 'billPenalties')
  const schemeFines = stat(s, 'schemeFines')
  const redeemPremium = stat(s, 'redeemPremium')
  const ended = run.phase === 'ended'
  return {
    runId: run.id,
    endingId: run.endingId,
    grade: run.grade,
    days: run.day,
    extraWeeks: run.extraWeeks,
    weeksSurvived: Math.max(0, Math.ceil(run.day / 7) - 1),
    title: profile.equipped.title ?? null,
    playSec: stat(s, 'playSec'),
    ...hours,
    deposited: stat(s, 'deposited'),
    withdrawnNet: stat(s, 'withdrawnNet'),
    withdrawFees: stat(s, 'withdrawFees'),
    forfeited: ended
      ? stat(s, 'casinoBalanceForfeited') + stat(s, 'withdrawalsForfeited')
      : run.casino + run.withdrawals.reduce((sum, w) => sum + w.net, 0),
    casinoNetFinal: net,
    lostToCasino: lost,
    rtpDeclared: slotMetrics(config.slot).rtp,
    rtpActual: rtpActual(s),
    ...luck,
    spins: stat(s, 'spins'),
    winsShowcase: stat(s, 'winsShowcase'),
    winsReal: stat(s, 'winsReal'),
    ldw: stat(s, 'ldw'),
    nearMiss: stat(s, 'nearMiss'),
    jackpots: stat(s, 'jackpots'),
    casinoNights: stat(s, 'casinoNights'),
    casinoNightLoss: stat(s, 'casinoNightLoss'),
    daysTilt70: stat(s, 'daysTilt70'),
    interestPaid,
    billPenalties,
    schemeFines,
    redeemPremium,
    forcedMfo: stat(s, 'forcedMfo'),
    fullCost: lost + interestPaid + billPenalties + schemeFines + redeemPremium,
    itemsLost: lostItems(run),
    friendsBlocked: run.friendsBlocked,
    equivalents: equivalents(lost, config),
    lifetime: {
      runs: stat(profile.stats, 'runsFinished'),
      casinoNetFinal: casinoNetFinal(profile.stats),
      spins: stat(profile.stats, 'spins'),
      rtpActual: rtpActual(profile.stats)
    },
    newAchievements: Object.entries(profile.achievements)
      .filter(([, a]) => a.runId === run.id)
      .map(([id]) => id)
  }
}
