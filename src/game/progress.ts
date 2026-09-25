import type { AchievementDef, GameConfig } from './config'
import { ownedCosmetics } from './cosmetics'
import { appendLog } from './log'
import { ENDING_IDS, forfeitOnEnd } from './rules'
import { casinoNetFinal } from './statement'
import { reduceStats, stat } from './stats'
import type { EventOf, GameEvent, Profile, RunState, RunSummary } from './types'

export interface ProgressResult {
  run: RunState
  profile: Profile
  /** Мета-события прогресса (achievementUnlocked) — для тостов, звука и платформенного адаптера. */
  events: GameEvent[]
}

/**
 * Мета-прогресс: стор вызывает после каждой команды с её событиями (systems-spec §6, жизненный цикл).
 * 1. reduceStats на run.stats и profile.stats (lifetime) — одной функцией;
 * 2. runEnded → коллекция концовок и история ранов;
 * 3. evaluateAchievements (CD-13): события + run/profile после шагов 1–2 → новые ачивки, косметика «новое»,
 *    событие achievementUnlocked (в хронику рана и в результат — для тоста).
 * Всё возвращается новыми объектами → стор пишет run+profile одним сейвом (атомарно).
 */
export function applyProgress(
  run: RunState,
  profile: Profile,
  events: readonly GameEvent[],
  config: GameConfig,
  now = 0
): ProgressResult {
  if (events.length === 0) return { run, profile, events: [] }
  let nextRun: RunState = { ...run, stats: reduceStats(run.stats, events, run) }
  let nextProfile: Profile = { ...profile, stats: reduceStats(profile.stats, events, run) }

  const ended = events.find((e): e is EventOf<'runEnded'> => e.type === 'runEnded')
  if (ended) nextProfile = recordRunEnd(nextRun, nextProfile, ended, config, now)

  const unlocked = evaluateAchievements(nextRun, nextProfile, events, config)
  if (unlocked.length === 0) return { run: nextRun, profile: nextProfile, events: [] }
  const result = unlockAchievements(nextProfile, unlocked, nextRun.id, config, now)
  nextProfile = result.profile
  nextRun = appendLog(nextRun, result.events, now, config.balance.LOG_LIMIT)
  return { run: nextRun, profile: nextProfile, events: result.events }
}

/** Выполнено ли условие ачивки (без учёта того, открыта ли она уже). */
export function achievementMet(
  def: AchievementDef,
  run: RunState | null,
  profile: Profile,
  events: readonly GameEvent[],
  config: GameConfig
): boolean {
  const c = def.condition
  switch (c.kind) {
    case 'stat':
      return (c.scope === 'lifetime' ? (profile.stats[c.stat] ?? 0) : (run?.stats[c.stat] ?? 0)) >= c.gte
    case 'ending':
      return events.some((e) => e.type === 'runEnded' && e.endingId === c.ending)
    case 'allEndings':
      return ENDING_IDS.every((id) => (profile.endings[id]?.count ?? 0) > 0)
    case 'event':
      return run !== null && events.some((e) => c.match(e, { run, profile, balance: config.balance }))
  }
}

/**
 * Новые ачивки после команды (ADR-006): чистая и идемпотентная — открытые и выключенные (P1) не возвращаются.
 * stat-условия проверяются всегда (догоняют старые сейвы), event/ending — только на событиях этой команды.
 */
export function evaluateAchievements(
  run: RunState | null,
  profile: Profile,
  events: readonly GameEvent[],
  config: GameConfig
): AchievementDef[] {
  return config.achievements.filter(
    (def) => def.enabled !== false && !profile.achievements[def.id] && achievementMet(def, run, profile, events, config)
  )
}

/** Записывает ачивки в профиль, отмечает новую косметику и строит события achievementUnlocked. */
export function unlockAchievements(
  profile: Profile,
  defs: readonly AchievementDef[],
  runId: string | null,
  config: GameConfig,
  now: number
): { profile: Profile; events: EventOf<'achievementUnlocked'>[] } {
  const ownedBefore = new Set(ownedCosmetics(profile, config))
  const achievements = { ...profile.achievements }
  for (const def of defs) achievements[def.id] = { unlockedAt: now, runId }
  const next: Profile = { ...profile, achievements }
  const fresh = ownedCosmetics(next, config).filter((id) => !ownedBefore.has(id) && !profile.unseenCosmetics.includes(id))
  const events = defs.map((def) => ({
    type: 'achievementUnlocked' as const,
    id: def.id,
    hidden: def.hidden,
    rewards: def.rewards.filter((r) => (fresh as string[]).includes(r))
  }))
  return { profile: { ...next, unseenCosmetics: [...profile.unseenCosmetics, ...fresh] }, events }
}

/** Коллекция концовок (count, firstAt, bestGrade) и история ранов (FIFO). */
export function recordRunEnd(
  run: RunState,
  profile: Profile,
  ended: EventOf<'runEnded'>,
  config: GameConfig,
  now: number
): Profile {
  const endings = { ...profile.endings }
  if (ended.endingId !== 'abandoned') {
    const prev = endings[ended.endingId]
    endings[ended.endingId] = {
      count: (prev?.count ?? 0) + 1,
      firstAt: prev?.firstAt ?? now,
      bestGrade: bestGrade(prev?.bestGrade ?? null, ended.grade)
    }
  }
  const summary: RunSummary = {
    runId: run.id,
    startedAt: run.startedAt,
    endedAt: now,
    endingId: ended.endingId,
    grade: ended.grade,
    days: ended.day,
    extraWeeks: run.extraWeeks,
    casinoNetFinal: casinoNetFinal(run.stats),
    totalWagered: stat(run.stats, 'totalWagered'),
    totalPaidOut: stat(run.stats, 'totalPaidOut'),
    playSec: stat(run.stats, 'playSec')
  }
  const runHistory = [summary, ...profile.runHistory].slice(0, config.stats.RUN_HISTORY_LIMIT)
  return { ...profile, endings, runHistory }
}

function bestGrade(a: 'A' | 'B' | 'C' | null, b: 'A' | 'B' | 'C' | null): 'A' | 'B' | 'C' | null {
  if (!a) return b
  if (!b) return a
  return a < b ? a : b
}

/**
 * Брошенный ран («Новая игра» при активном ране) = runEnded('abandoned'):
 * статистика уже учтена, концовка не засчитывается (systems-spec §6 п.4).
 */
export function abandonRun(run: RunState, profile: Profile, config: GameConfig, now: number): Profile {
  if (run.phase === 'ended') return profile
  const event: EventOf<'runEnded'> = {
    type: 'runEnded',
    endingId: 'abandoned',
    grade: null,
    day: run.day,
    weeksSurvived: Math.max(0, Math.ceil(run.day / 7) - 1),
    forfeitedCasino: forfeitOnEnd(run).casino,
    forfeitedWithdrawals: forfeitOnEnd(run).withdrawals,
    itemsLost: []
  }
  return applyProgress(run, profile, [event], config, now).profile
}

/**
 * Досчитать ачивки по уже накопленной статистике без новых событий (загрузка старого сейва, новые ачивки в билде).
 * Только stat/allEndings: событийные нельзя восстановить задним числом.
 */
export function reconcileAchievements(profile: Profile, config: GameConfig, now: number): { profile: Profile; events: GameEvent[] } {
  const defs = evaluateAchievements(null, profile, [], config).filter(
    (d) => (d.condition.kind === 'stat' && d.condition.scope === 'lifetime') || d.condition.kind === 'allEndings'
  )
  if (defs.length === 0) return { profile, events: [] }
  return unlockAchievements(profile, defs, null, config, now)
}
