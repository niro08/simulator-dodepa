import type { GameConfig } from '../config'
import type { Profile, RunState, Settings } from '../types'

/**
 * Текущая версия формата сейва. Меняешь форму RunState/Profile/Settings → +1 и миграция.
 * v1 — «старый» забег без дней (eb138e2 после рефакторинга ядра);
 * v2 — ран 28 дней (CD-05…CD-10), профиль по systems-spec §6, мета-валюта удалена.
 */
export const CURRENT_SAVE_VERSION = 2

export interface SaveFileV2 {
  version: 2
  savedAt: number
  /** Версия билда игры (__APP_VERSION__), для баг-репортов. */
  build: string
  /** null — нет рана (в меню только «Новая игра»). Ран с phase 'ended' хранится ради Выписки. */
  run: RunState | null
  profile: Profile
  settings: Settings
}

/** Актуальный формат. При изменениях: SaveFileV3, миграция 2 → 3 в migrations.ts. */
export type SaveFile = SaveFileV2

/** Окружение загрузки: миграции и валидация чистые, всё внешнее приходит отсюда. */
export interface SaveEnv {
  config: GameConfig
  now: number
  /** Seed для RNG рана, если в сейве его нет. */
  seed: number
}

export function createDefaultProfile(): Profile {
  return {
    stats: {},
    achievements: {},
    endings: {},
    equipped: {},
    unseenCosmetics: [],
    runHistory: [],
    flags: { tutorialDone: false, hintsSeen: [] }
  }
}

export function createDefaultSettings(): Settings {
  return {
    locale: 'ru',
    musicVolume: 1,
    sfxVolume: 1,
    reducedMotion: false,
    skipSpinAnimation: false
  }
}

export function createEmptySave(now: number): SaveFile {
  return {
    version: CURRENT_SAVE_VERSION,
    savedAt: now,
    build: '',
    run: null,
    profile: createDefaultProfile(),
    settings: createDefaultSettings()
  }
}
