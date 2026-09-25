import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_KEY, LEGACY_KEY, SAVE_KEY } from '@/platform/storage'
import { useGameStore } from './game'
import { useUiStore } from './ui'

function fakeLocalStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k)
  }
}

let ls: ReturnType<typeof fakeLocalStorage>

function setup(initial: Record<string, string> = {}) {
  ls = fakeLocalStorage(initial)
  vi.stubGlobal('window', { localStorage: ls })
  setActivePinia(createPinia())
  return useGameStore()
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('game store', () => {
  it('legacy dodepaSave мигрирует в v1, старый ключ удаляется после записи', async () => {
    const game = setup({ [LEGACY_KEY]: JSON.stringify({ money: 4321, energy: 7, reputation: 3, debt: 0, bet: 100, logs: ['x'] }) })
    await game.load()
    expect(game.hasSave).toBe(true)
    expect(game.view.money).toBe(4321)
    expect(ls.data.has(LEGACY_KEY)).toBe(false)
    expect(JSON.parse(ls.data.get(SAVE_KEY)!).version).toBe(1)
  })

  it('без сейва — нет забега; newGame создаёт и сохраняет', async () => {
    const game = setup()
    await game.load()
    expect(game.hasSave).toBe(false)
    expect(game.execute({ type: 'work/job' })).toBeNull()
    game.newGame()
    expect(game.hasSave).toBe(true)
    expect(JSON.parse(ls.data.get(SAVE_KEY)!).run.money).toBe(1000)
  })

  it('спин атомарен: сейв записан до анимации, показ отложен до revealPending (B-04)', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    const logBefore = game.log.length
    const outcome = game.spin()
    expect(outcome?.spin).toBeDefined()
    const payout = outcome!.spin!.payout

    // Сейв уже содержит итог спина
    expect(JSON.parse(ls.data.get(SAVE_KEY)!).run.money).toBe(1000 - 100 + payout)
    // UI пока видит только списанную ставку и старую хронику
    expect(game.view.money).toBe(900)
    expect(game.log.length).toBe(logBefore)

    const presented: string[] = []
    game.onPresent((events) => presented.push(...events.map((e) => e.type)))
    game.revealPending()
    expect(game.view.money).toBe(1000 - 100 + payout)
    expect(game.log.length).toBe(logBefore + 1)
    expect(presented).toEqual(['spin'])
    expect(useUiStore().held).toBeNull()
  })

  it('перезагрузка после спина восстанавливает результат; бэкап хранит прошлый сейв', async () => {
    const first = setup()
    await first.load()
    first.newGame()
    first.spin()
    const money = first.run!.money
    const saved = Object.fromEntries(ls.data)
    expect(saved[BACKUP_KEY]).toBeDefined()

    const second = setup(saved)
    await second.load()
    expect(second.view.money).toBe(money)
  })

  it('отказ спина не прячет результат и пишется в хронику', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    game.setBet(5000)
    const outcome = game.spin()
    expect(outcome?.rejection).toMatchObject({ reason: 'noMoney' })
    expect(game.log[0]?.event.type).toBe('rejected')
    expect(useUiStore().held).toBeNull()
  })

  it('onEvents получает события команды; canExecute отражает доступность', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    const seen: string[] = []
    const off = game.onEvents((events) => seen.push(...events.map((e) => e.type)))
    game.execute({ type: 'friends/help' })
    off()
    game.execute({ type: 'friends/help' })
    expect(seen).toEqual(['help'])
    expect(game.canExecute({ type: 'bank/repay', amount: 1000 })).toMatchObject({ reason: 'noDebt' })
  })

  it('сейв из будущей версии не перезаписывается', async () => {
    const future = JSON.stringify({ version: 42, run: { money: 777 } })
    const game = setup({ [SAVE_KEY]: future })
    await game.load()
    expect(game.readOnly).toBe(true)
    game.execute({ type: 'friends/help' })
    expect(ls.data.get(SAVE_KEY)).toBe(future)
  })
})
