import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '@/stores/game'
import { useShell } from './useShell'

/**
 * QA (Task 6): попап выхода S14 — один раз на (ран, игровой день) при 🔥 ≥ TILT_T2.
 * Тильт/день подставляются в state рана напрямую: гнать тильт до 70 через спины — долго и зависит от RNG.
 */

function fakeLocalStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k)
  }
}

async function setup() {
  vi.stubGlobal('window', { localStorage: fakeLocalStorage() })
  setActivePinia(createPinia())
  const game = useGameStore()
  await game.load()
  return game
}

type Game = ReturnType<typeof useGameStore>

function patchRun(game: Game, patch: Record<string, unknown>) {
  game.run = { ...game.run!, ...patch } as typeof game.run
}

/** Новый ран, вход в казино, тильт выставлен. */
function startInCasino(game: Game, tilt: number) {
  game.newGame()
  game.execute({ type: 'casino/enter' })
  patchRun(game, { tilt })
  expect(game.phase).toBe('day')
  expect(game.hud?.location).toBe('casino')
  expect(game.hud?.tilt).toBe(tilt)
}

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => {}))
afterEach(() => {
  useShell().exitStay()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useShell: выход из казино при тильте (S14)', () => {
  it('ниже порога — модалки нет, действие выполняется, из казино вышли', async () => {
    const game = await setup()
    startInCasino(game, game.config.balance.TILT_T2 - 1)
    const shell = useShell()
    const action = vi.fn()
    shell.viaLife(action)
    expect(shell.exitStep.value).toBe(0)
    expect(action).toHaveBeenCalledTimes(1)
    expect(game.hud?.location).not.toBe('casino')
  })

  it('раз на (ран, день): первый выход — модалка; второй в тот же день — нет; следующий день и новый ран — снова', async () => {
    const game = await setup()
    const T2 = game.config.balance.TILT_T2
    startInCasino(game, T2)
    const shell = useShell()

    // 1. Первое действие «Жизни» — модалка, действие отложено, всё ещё в казино
    const a1 = vi.fn()
    shell.viaLife(a1)
    expect(shell.exitStep.value).toBe(1)
    expect(shell.anyDialogOpen.value).toBe(true)
    expect(a1).not.toHaveBeenCalled()
    expect(game.hud?.location).toBe('casino')

    // 2. «Уйти» — действие выполнено, модалка закрыта, вышли из казино
    shell.exitLeave()
    expect(shell.exitStep.value).toBe(0)
    expect(a1).toHaveBeenCalledTimes(1)
    expect(game.hud?.location).not.toBe('casino')

    // 3. Снова в казино в тот же день, тильт ещё выше — без модалки
    game.execute({ type: 'casino/enter' })
    patchRun(game, { tilt: T2 + 10 })
    expect(game.hud?.location).toBe('casino')
    const a2 = vi.fn()
    shell.viaLife(a2)
    expect(shell.exitStep.value).toBe(0)
    expect(a2).toHaveBeenCalledTimes(1)
    expect(game.hud?.location).not.toBe('casino')

    // 4. Следующий день (подставлен) — модалка снова
    const day = game.hud!.day
    game.execute({ type: 'casino/enter' })
    patchRun(game, { tilt: T2, day: day + 1 })
    expect(game.hud?.day).toBe(day + 1)
    const a3 = vi.fn()
    shell.viaLife(a3)
    expect(shell.exitStep.value).toBe(1)
    expect(a3).not.toHaveBeenCalled()

    // «Остаться» — действие отброшено, остаёмся в казино
    shell.exitStay()
    expect(shell.exitStep.value).toBe(0)
    expect(a3).not.toHaveBeenCalled()
    expect(game.hud?.location).toBe('casino')

    // тот же день после «Остаться»: модалка уже была — второй раз не показывается
    const a4 = vi.fn()
    shell.viaLife(a4)
    expect(shell.exitStep.value).toBe(0)
    expect(a4).toHaveBeenCalledTimes(1)

    // 5. Новый ран с тем же номером дня — модалка снова
    const firstRunId = game.run!.id
    startInCasino(game, T2)
    patchRun(game, { day: day + 1 })
    expect(game.run!.id).not.toBe(firstRunId)
    const a5 = vi.fn()
    shell.viaLife(a5)
    expect(shell.exitStep.value).toBe(1)
    expect(a5).not.toHaveBeenCalled()
  })

  it('вне казино при высоком тильте — без модалки', async () => {
    const game = await setup()
    game.newGame()
    patchRun(game, { tilt: 90 })
    expect(game.hud?.location).not.toBe('casino')
    const shell = useShell()
    const action = vi.fn()
    shell.viaLife(action)
    expect(shell.exitStep.value).toBe(0)
    expect(action).toHaveBeenCalledTimes(1)
  })
})
