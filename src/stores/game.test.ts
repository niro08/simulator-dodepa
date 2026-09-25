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

const saved = () => JSON.parse(ls.data.get(SAVE_KEY)!)

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('game store', () => {
  it('legacy dodepaSave мигрирует в v2 (старый забег сброшен), старый ключ удаляется после записи', async () => {
    const game = setup({ [LEGACY_KEY]: JSON.stringify({ money: 4321, energy: 7, reputation: 3, debt: 0, bet: 100, logs: ['x'] }) })
    await game.load()
    expect(game.hasSave).toBe(false)
    expect(ls.data.has(LEGACY_KEY)).toBe(false)
    expect(saved().version).toBe(2)
  })

  it('без сейва — нет рана; newGame создаёт ран, утро дня 1 уже наступило, сейв записан', async () => {
    const game = setup()
    await game.load()
    expect(game.hasSave).toBe(false)
    expect(game.hud).toBeNull()
    expect(game.execute({ type: 'work/shift' })).toBeNull()
    expect(game.canExecute({ type: 'work/shift' })).toEqual({ reason: 'wrong_phase' })
    game.newGame()
    expect(game.hasSave).toBe(true)
    expect(game.phase).toBe('day')
    expect(game.hud).toMatchObject({ day: 1, wallet: 1000, energy: 100 })
    expect(saved().run.phase).toBe('day')
    expect(game.profile.stats.runsStarted).toBe(1)
  })

  it('actions: доступность кнопок из ядра; execute меняет ран и статистику', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    expect(game.actions.shift).toBeNull()
    expect(game.actions.spin).toEqual({ reason: 'not_in_casino' })
    expect(game.actions.payBill).toEqual({ reason: 'not_due', min: 6 })
    game.execute({ type: 'work/shift' })
    expect(game.hud?.wallet).toBe(1900)
    expect(game.run?.stats.shifts).toBe(1)
    expect(game.profile.stats.shifts).toBe(1)
  })

  it('спин атомарен: сейв записан до анимации, показ (HUD, хроника, onPresent) отложен до revealPending (B-04)', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    game.execute({ type: 'casino/enter' })
    game.execute({ type: 'casino/deposit', amount: 1000, bonus: false })
    const logBefore = game.log.length
    const outcome = game.spin()
    expect(outcome?.spin).toBeDefined()
    const payout = outcome!.spin!.payout

    expect(saved().run.casino).toBe(1000 - 100 + payout)
    expect(game.hud?.casino).toBe(900)
    expect(game.hud?.energy).toBe(98)
    expect(game.log.length).toBe(logBefore)

    const presented: string[] = []
    game.onPresent((events) => presented.push(...events.map((e) => e.type)))
    game.revealPending()
    expect(game.hud?.casino).toBe(1000 - 100 + payout)
    expect(game.log.length).toBeGreaterThan(logBefore)
    expect(presented).toContain('spin')
    expect(useUiStore().held).toBeNull()
  })

  it('перезагрузка после спина восстанавливает результат; бэкап хранит прошлый сейв', async () => {
    const first = setup()
    await first.load()
    first.newGame()
    first.execute({ type: 'casino/enter' })
    first.execute({ type: 'casino/deposit', amount: 500 })
    first.spin()
    const casino = first.run!.casino
    const snapshot = Object.fromEntries(ls.data)
    expect(snapshot[BACKUP_KEY]).toBeDefined()

    const second = setup(snapshot)
    await second.load()
    expect(second.hud?.casino).toBe(casino)
    expect(second.hud?.bonus.state).toBe('active')
  })

  it('отказ спина не прячет результат и пишется в хронику', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    game.execute({ type: 'casino/enter' })
    const outcome = game.spin()
    expect(outcome?.rejection).toMatchObject({ reason: 'no_money' })
    expect(game.log[0]?.event.type).toBe('rejected')
    expect(useUiStore().held).toBeNull()
  })

  it('adjustBet: ½ / ×2 / MIN / ДОДЕП ВСЁ', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    game.execute({ type: 'casino/deposit', amount: 777, bonus: false })
    game.adjustBet('double')
    expect(game.hud?.bet).toBe(200)
    game.adjustBet('half')
    expect(game.hud?.bet).toBe(100)
    game.adjustBet('all')
    expect(game.hud?.bet).toBe(777)
    game.adjustBet('min')
    expect(game.hud?.bet).toBe(50)
  })

  it('день: сон → итог дня → утро; Изнанка и HUD доступны', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    game.execute({ type: 'day/sleep' })
    expect(game.phase).toBe('daySummary')
    expect(game.daySummary).toMatchObject({ day: 1, livingCost: 300 })
    game.execute({ type: 'day/wake' })
    expect(game.hud).toMatchObject({ day: 2, wallet: 700 })
    expect(game.underbelly?.slot.tickerLossesPerWin).toBe(7)
    expect(game.statement).toBeNull()
    expect(game.pendingEvent).toBeNull()
  })

  it('новая игра при активном ране засчитывает его как брошенный', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    const firstId = game.run!.id
    game.newGame()
    expect(game.profile.runHistory[0]).toMatchObject({ runId: firstId, endingId: 'abandoned' })
    expect(game.profile.stats.runsStarted).toBe(2)
  })

  it('trackTime: время копится (кап 15 с за вызов), без рана — игнор', async () => {
    const game = setup()
    await game.load()
    game.trackTime(10)
    game.newGame()
    game.trackTime(10, 3)
    game.trackTime(100)
    game.trackTime(Number.NaN)
    expect(game.run?.stats).toMatchObject({ playSec: 25, underbellySec: 3 })
    expect(game.profile.stats.playSec).toBe(25)
  })

  it('onEvents получает события команды; отписка работает', async () => {
    const game = setup()
    await game.load()
    game.newGame()
    const seen: string[] = []
    const off = game.onEvents((events) => seen.push(...events.map((e) => e.type)))
    game.execute({ type: 'family/help' })
    off()
    game.execute({ type: 'work/shift' })
    expect(seen).toContain('familyHelped')
    expect(seen).not.toContain('shiftWorked')
  })

  it('сейв из будущей версии не перезаписывается', async () => {
    const future = JSON.stringify({ version: 42, run: { wallet: 777 } })
    const game = setup({ [SAVE_KEY]: future })
    await game.load()
    expect(game.readOnly).toBe(true)
    game.execute({ type: 'work/shift' })
    game.updateSettings({ musicVolume: 0.1 })
    expect(ls.data.get(SAVE_KEY)).toBe(future)
  })
})
