/**
 * Хранилище сейва (ADR-008). Интерфейс асинхронный ради файлового IPC в Electron/Steam Cloud;
 * веб-реализация на localStorage фактически синхронная: write() пишет до возврата промиса.
 */
export interface StorageAdapter {
  read(): Promise<string | null>
  /** Атомарная запись; предыдущий сейв уходит в бэкап. */
  write(data: string): Promise<void>
  readBackup(): Promise<string | null>
  /** Legacy-сейв до v1 (только веб). */
  readLegacy?(): Promise<string | null>
  /** Удалить legacy-сейв — только после успешной записи v1. */
  clearLegacy?(): Promise<void>
}

export const SAVE_KEY = 'dodepa.save'
export const BACKUP_KEY = 'dodepa.save.bak'
export const LEGACY_KEY = 'dodepaSave'

function getLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    // Приватный режим / запрет cookies: доступ к localStorage бросает исключение.
    return null
  }
}

function safeGet(storage: Storage | null, key: string): string | null {
  try {
    return storage ? storage.getItem(key) : null
  } catch {
    return null
  }
}

/** localStorage-адаптер. Ошибки чтения → null; ошибки записи (QuotaExceeded) пробрасываются. */
export function createWebStorage(storage: Storage | null = getLocalStorage()): StorageAdapter {
  return {
    read: async () => safeGet(storage, SAVE_KEY),
    readBackup: async () => safeGet(storage, BACKUP_KEY),
    readLegacy: async () => safeGet(storage, LEGACY_KEY),
    async write(data) {
      if (!storage) throw new Error('localStorage недоступен')
      const previous = safeGet(storage, SAVE_KEY)
      if (previous !== null && previous !== data) {
        try {
          storage.setItem(BACKUP_KEY, previous)
        } catch {
          // Бэкап — best effort: основной сейв важнее.
        }
      }
      storage.setItem(SAVE_KEY, data)
    },
    async clearLegacy() {
      try {
        storage?.removeItem(LEGACY_KEY)
      } catch {
        // игнорируем: попробуем при следующей загрузке
      }
    }
  }
}

/** Хранилище в памяти — для тестов и окружений без localStorage. */
export function createMemoryStorage(initial: { main?: string; backup?: string; legacy?: string } = {}): StorageAdapter & {
  dump(): { main: string | null; backup: string | null; legacy: string | null }
} {
  let main = initial.main ?? null
  let backup = initial.backup ?? null
  let legacy = initial.legacy ?? null
  return {
    read: async () => main,
    readBackup: async () => backup,
    readLegacy: async () => legacy,
    async write(data) {
      if (main !== null && main !== data) backup = main
      main = data
    },
    async clearLegacy() {
      legacy = null
    },
    dump: () => ({ main, backup, legacy })
  }
}
