import { describe, expect, it } from 'vitest'
import { BACKUP_KEY, LEGACY_KEY, SAVE_KEY, createMemoryStorage, createWebStorage } from './storage'

/** Минимальная реализация Storage для node-окружения. */
function fakeLocalStorage(initial: Record<string, string> = {}, failOn?: string): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (k === failOn) throw new Error('QuotaExceededError')
      data.set(k, v)
    }
  }
}

describe('web storage adapter', () => {
  it('пишет основной ключ, предыдущий уходит в бэкап; legacy удаляется отдельно', async () => {
    const ls = fakeLocalStorage({ [LEGACY_KEY]: '{"money":1}' })
    const storage = createWebStorage(ls)
    await storage.write('v1-a')
    await storage.write('v1-b')
    expect(await storage.read()).toBe('v1-b')
    expect(await storage.readBackup()).toBe('v1-a')
    expect(await storage.readLegacy?.()).toBe('{"money":1}')
    await storage.clearLegacy?.()
    expect(ls.getItem(LEGACY_KEY)).toBeNull()
    expect(ls.getItem(SAVE_KEY)).toBe('v1-b')
    expect(ls.getItem(BACKUP_KEY)).toBe('v1-a')
  })

  it('без localStorage: чтение → null, запись → ошибка', async () => {
    const storage = createWebStorage(null)
    expect(await storage.read()).toBeNull()
    await expect(storage.write('x')).rejects.toThrow()
  })

  it('ошибка записи основного ключа пробрасывается', async () => {
    const storage = createWebStorage(fakeLocalStorage({}, SAVE_KEY))
    await expect(storage.write('x')).rejects.toThrow('QuotaExceededError')
  })

  it('memory storage ведёт себя так же', async () => {
    const storage = createMemoryStorage({ legacy: 'L' })
    await storage.write('a')
    await storage.write('b')
    await storage.clearLegacy?.()
    expect(storage.dump()).toEqual({ main: 'b', backup: 'a', legacy: null })
  })
})
