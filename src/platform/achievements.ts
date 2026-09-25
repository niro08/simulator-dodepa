/**
 * Платформенный адаптер достижений (ADR-006, ADR-010). Ядро открывает ачивки само (progress.ts);
 * адаптер только зеркалит их на платформу: в вебе — ничего, в Steam (Electron main + IPC) —
 * steamworks.js `achievement.activate(apiName)`. id ачивки = Steam API Name (UPPER_SNAKE).
 */

export interface AchievementsAdapter {
  /** Платформа поддерживает достижения (Steam) — UI может показать «откроется и в Steam». */
  readonly available: boolean
  /** Открыть достижение на платформе. Идемпотентно; ошибки глотает (офлайн → reconcile при следующем старте). */
  unlock(apiName: string): Promise<void>
  /**
   * При старте: повторно активировать все локально открытые (игрок мог открыть их офлайн или в веб-версии).
   * Идемпотентно.
   */
  reconcile(apiNames: readonly string[]): Promise<void>
  /** Steam Stats для полосок прогресса (progressStat). В вебе — noop. */
  setStat(name: string, value: number): Promise<void>
}

/** Веб: достижения живут только в профиле игры. */
export function createWebAchievements(): AchievementsAdapter {
  return {
    available: false,
    unlock: async () => {},
    reconcile: async () => {},
    setStat: async () => {}
  }
}

/**
 * Мост к Steam через preload (TD-22/23): `window.dodepaSteam` выставляет Electron preload,
 * вызовы уходят в main-процесс по IPC. Без моста — поведение веба.
 */
interface SteamBridge {
  activateAchievement(apiName: string): Promise<unknown>
  setStat?(name: string, value: number): Promise<unknown>
}

export function createSteamAchievements(bridge: SteamBridge): AchievementsAdapter {
  const safe = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (error) {
      console.warn('Steam: не удалось синхронизировать достижение', error)
    }
  }
  return {
    available: true,
    unlock: (apiName) => safe(() => bridge.activateAchievement(apiName)),
    reconcile: async (apiNames) => {
      for (const name of apiNames) await safe(() => bridge.activateAchievement(name))
    },
    setStat: (name, value) => safe(() => bridge.setStat?.(name, value) ?? Promise.resolve())
  }
}

/** Выбор адаптера по окружению: Steam-мост из preload, иначе веб. */
export function createPlatformAchievements(): AchievementsAdapter {
  const bridge = (globalThis as { dodepaSteam?: SteamBridge }).dodepaSteam
  return bridge ? createSteamAchievements(bridge) : createWebAchievements()
}
