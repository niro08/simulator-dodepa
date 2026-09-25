/**
 * Геттеры мета-профиля для UI (CD-13, CD-19; systems-spec §4–§6): «Коллекция» (ачивки, концовки),
 * «Гардероб» (косметика), «За всё время» (статистика профиля). Чистые функции от Profile и конфига.
 */
import type { CosmeticId, CosmeticKind, GameConfig } from './config'
import { catalogIds, equippedCosmetics, ownedCosmetics, parseCosmeticId, unlockSourcesOf } from './cosmetics'
import { ENDING_IDS } from './rules'
import { stat } from './stats'
import type { EndingId, Grade, Profile, RunState } from './types'

export interface AchievementView {
  /** UPPER_SNAKE = Steam API Name; тексты — i18n ACHIEVEMENT_TEXTS[id]. */
  id: string
  hidden: boolean
  unlocked: boolean
  unlockedAt: number | null
  /** Закрытое скрытое показывается как «???» (systems-spec §4). */
  secret: boolean
  /** Полоска прогресса для stat-условий (null — у условия нет прогресса или скрыто). */
  progress: { current: number; target: number; scope: 'run' | 'lifetime' } | null
  rewards: CosmeticId[]
}

/** Все активные ачивки в порядке systems-spec §4. run — текущий ран (для прогресса run-скоупа). */
export function buildAchievementsView(profile: Profile, config: GameConfig, run: RunState | null = null): AchievementView[] {
  return config.achievements
    .filter((def) => def.enabled !== false)
    .map((def) => {
      const record = profile.achievements[def.id]
      const unlocked = record !== undefined
      const c = def.condition
      let progress: AchievementView['progress'] = null
      if (!(def.hidden && !unlocked)) {
        if (c.kind === 'stat') {
          const source = c.scope === 'lifetime' ? profile.stats : (run?.stats ?? {})
          progress = { current: Math.min(c.gte, source[c.stat] ?? 0), target: c.gte, scope: c.scope }
          if (unlocked) progress.current = c.gte
        } else if (c.kind === 'allEndings') {
          const got = ENDING_IDS.filter((id) => (profile.endings[id]?.count ?? 0) > 0).length
          progress = { current: got, target: ENDING_IDS.length, scope: 'lifetime' }
        }
      }
      return {
        id: def.id,
        hidden: def.hidden,
        unlocked,
        unlockedAt: record?.unlockedAt ?? null,
        secret: def.hidden && !unlocked,
        progress,
        rewards: def.rewards.filter((r): r is CosmeticId => parseCosmeticId(r) !== null)
      }
    })
}

export interface EndingCollectionEntry {
  /** Тексты — i18n ENDINGS[id] (закрытая: «???» + lockedHint). */
  id: EndingId
  unlocked: boolean
  count: number
  firstAt: number | null
  bestGrade: Grade | null
  /** Ачивка этой концовки (ENDING_*). */
  achievementId: string | null
}

/** «Коллекция концовок»: 7 концовок в порядке приоритета GDD §3.9. */
export function buildEndingsCollection(profile: Profile, config: GameConfig): EndingCollectionEntry[] {
  return ENDING_IDS.map((id) => {
    const e = profile.endings[id]
    const ach = config.achievements.find((a) => a.condition.kind === 'ending' && a.condition.ending === id)
    return {
      id,
      unlocked: (e?.count ?? 0) > 0,
      count: e?.count ?? 0,
      firstAt: e?.firstAt ?? null,
      bestGrade: e?.bestGrade ?? null,
      achievementId: ach?.id ?? null
    }
  })
}

export interface CosmeticItemView {
  id: CosmeticId
  kind: CosmeticKind
  owned: boolean
  equipped: boolean
  /** Бейдж «новое». */
  unseen: boolean
  /** Ачивки-источники (закрытый предмет: силуэт + название ачивки, скрытая — «???»). */
  unlockedBy: { id: string; hidden: boolean }[]
  priority: 'P0' | 'P1' | 'P2'
}

export interface CosmeticsView {
  owned: CosmeticId[]
  equipped: Record<CosmeticKind, CosmeticId>
  unseen: string[]
  items: CosmeticItemView[]
}

/** «Гардероб»: весь каталог с владением и экипировкой. */
export function buildCosmeticsView(profile: Profile, config: GameConfig): CosmeticsView {
  const owned = ownedCosmetics(profile, config)
  const equipped = equippedCosmetics(profile, config)
  const catalog = config.cosmetics
  const priorityOf = (id: CosmeticId): 'P0' | 'P1' | 'P2' => {
    const p = parseCosmeticId(id)
    if (!p) return 'P0'
    const list: readonly { id: string; priority: 'P0' | 'P1' | 'P2' }[] =
      p.kind === 'skin' ? catalog.skins : p.kind === 'theme' ? catalog.themes : p.kind === 'sound' ? catalog.sounds : catalog.titles
    return list.find((x) => x.id === p.id)?.priority ?? 'P0'
  }
  const items = catalogIds(catalog).map((id) => {
    const kind = parseCosmeticId(id)?.kind ?? 'skin'
    return {
      id,
      kind,
      owned: owned.includes(id),
      equipped: equipped[kind] === id,
      unseen: profile.unseenCosmetics.includes(id),
      unlockedBy: unlockSourcesOf(id, config).map((a) => ({
        id: a,
        hidden: config.achievements.find((d) => d.id === a)?.hidden ?? false
      })),
      priority: priorityOf(id)
    }
  })
  return { owned, equipped, unseen: [...profile.unseenCosmetics], items }
}

export interface ProfileStatsView {
  runsStarted: number
  runsFinished: number
  /** Концовок «Завязал» / завершённых ранов (0…1; null — ещё не было). */
  quitRate: number | null
  endingsFound: number
  endingsTotal: number
  achievementsUnlocked: number
  achievementsTotal: number
  playSec: number
  spins: number
  totalWagered: number
  totalPaidOut: number
  /** Итог слота за всё время: выплаты − ставки (≤ 0 почти всегда). */
  casinoNet: number
  biggestPayout: number
  maxDebt: number
  interestPaid: number
  itemsLost: number
  shifts: number
  daysPlayed: number
  /** Доля ранов из истории, закрытых с казино в плюсе (0…1; null — истории нет). */
  runsInPlusShare: number | null
  runHistory: Profile['runHistory']
}

/** «За всё время» (systems-spec §6): lifetime-статистика и история ранов. */
export function buildProfileStats(profile: Profile, config: GameConfig): ProfileStatsView {
  const s = profile.stats
  const finished = stat(s, 'runsFinished')
  const quits = profile.endings.quit?.count ?? 0
  const history = profile.runHistory
  const active = config.achievements.filter((a) => a.enabled !== false)
  return {
    runsStarted: stat(s, 'runsStarted'),
    runsFinished: finished,
    quitRate: finished > 0 ? quits / finished : null,
    endingsFound: ENDING_IDS.filter((id) => (profile.endings[id]?.count ?? 0) > 0).length,
    endingsTotal: ENDING_IDS.length,
    achievementsUnlocked: active.filter((a) => profile.achievements[a.id]).length,
    achievementsTotal: active.length,
    playSec: stat(s, 'playSec'),
    spins: stat(s, 'spins'),
    totalWagered: stat(s, 'totalWagered'),
    totalPaidOut: stat(s, 'totalPaidOut'),
    casinoNet: stat(s, 'totalPaidOut') - stat(s, 'totalWagered'),
    biggestPayout: stat(s, 'biggestPayout'),
    maxDebt: stat(s, 'maxDebt'),
    interestPaid: stat(s, 'interestPaid'),
    itemsLost: stat(s, 'itemsLost'),
    shifts: stat(s, 'shifts'),
    daysPlayed: stat(s, 'daysPlayed'),
    runsInPlusShare: history.length > 0 ? history.filter((r) => r.casinoNetFinal > 0).length / history.length : null,
    runHistory: history.map((r) => ({ ...r }))
  }
}
