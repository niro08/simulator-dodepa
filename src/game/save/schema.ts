import type { GameConfig } from '../config'
import type { Profile, RunState, Settings } from '../types'

/** Текущая версия формата сейва. Меняешь форму RunState/Profile/Settings → +1 и миграция. */
export const CURRENT_SAVE_VERSION = 1

export interface SaveFileV1 {
  version: 1
  savedAt: number
  /** Версия билда игры (__APP_VERSION__), для баг-репортов. */
  build: string
  /** null — нет активного забега (в меню только «Новая игра»). */
  run: RunState | null
  profile: Profile
  settings: Settings
}

/** Актуальный формат. При изменениях: SaveFileV2, миграция 1 → 2 в migrations.ts. */
export type SaveFile = SaveFileV1

/** Окружение загрузки: миграции и валидация чистые, всё внешнее приходит отсюда. */
export interface SaveEnv {
  config: GameConfig
  now: number
  /** Seed для RNG забега, если в сейве его нет (legacy). */
  seed: number
}

export function createDefaultProfile(): Profile {
  return {
    stats: {},
    achievements: {},
    cosmetics: { owned: [], equipped: {} },
    meta: { currency: 0, upgrades: {} }
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
