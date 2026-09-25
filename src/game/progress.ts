import type { GameConfig } from './config'
import { casinoNetFinal } from './statement'
import { reduceStats, stat } from './stats'
import type { EventOf, GameEvent, Profile, RunState, RunSummary } from './types'

/**
 * Мета-прогресс: стор вызывает после каждой команды с её событиями (systems-spec §6, жизненный цикл).
 * 1. reduceStats на run.stats и profile.stats (lifetime) — одной функцией;
 * 2. runEnded → коллекция концовок и история ранов;
 * 3. точка для evaluateAchievements (CD-13): ачивки смотрят события + run/profile после этого шага.
 * Всё возвращается новыми объектами → стор пишет run+profile одним сейвом (атомарно).
 */
export function applyProgress(
  run: RunState,
  profile: Profile,
  events: readonly GameEvent[],
  config: GameConfig,
  now = 0
): { run: RunState; profile: Profile } {
  if (events.length === 0) return { run, profile }
  const nextRun: RunState = { ...run, stats: reduceStats(run.stats, events, run) }
  let nextProfile: Profile = { ...profile, stats: reduceStats(profile.stats, events, run) }

  const ended = events.find((e): e is EventOf<'runEnded'> => e.type === 'runEnded')
  if (ended) nextProfile = recordRunEnd(nextRun, nextProfile, ended, config, now)

  // CD-13: nextProfile = evaluateAchievements(nextRun, nextProfile, events, config, now)
  return { run: nextRun, profile: nextProfile }
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
    forfeitedCasino: run.casino,
    forfeitedWithdrawals: run.withdrawals.reduce((sum, w) => sum + w.net, 0),
    itemsLost: []
  }
  return applyProgress(run, profile, [event], config, now).profile
}
