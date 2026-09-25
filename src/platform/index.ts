/**
 * Всё, что зависит от окружения (веб / Electron / Steam), — только здесь.
 * Выбор реализации по import.meta.env.VITE_PLATFORM появится с десктоп-сборкой (TD-22/23).
 */
import { createWebStorage, type StorageAdapter } from './storage'

export { randomSeed } from './random'
export type { StorageAdapter } from './storage'

/** Версия билда из package.json (define в vite.config.ts). */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'

export function createPlatformStorage(): StorageAdapter {
  return createWebStorage()
}
