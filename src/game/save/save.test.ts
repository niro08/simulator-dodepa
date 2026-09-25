import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../config'
import { executeCommand } from '../reducer'
import { createRun } from '../state'
import { newSession, exec } from '../testing'
import { CURRENT_SAVE_VERSION, createEmptySave, loadSave, parseSave, serializeSave, type SaveFile } from '.'
import { migrate } from './migrations'

const env = { config: defaultConfig, now: 1_700_000_000_000, seed: 123 }
const meta = { now: env.now, build: 'test' }

// Фикстуры legacy-сейвов формата eb138e2 (ключ dodepaSave)
const LEGACY_NORMAL = JSON.stringify({
  money: 2350,
  energy: 15,
  reputation: -4,
  debt: 1234,
  bet: 150,
  logs: ['Ты помог другу: +1❤️ и -5⚡', '🎰 ДЖЕКПОТ 777! Выигрыш: 700₽']
})

// Фикстура сейва v1 (ядро b6a56f5): забег без дней, профиль с мета-валютой
const V1_SAVE = JSON.stringify({
  version: 1,
  savedAt: 1_690_000_000_000,
  build: '0.0.0',
  run: {
    id: 'run-old',
    startedAt: 1,
    money: 5000,
    energy: 40,
    reputation: 12,
    debt: 800,
    bet: 100,
    rngState: 42,
    flags: {},
    stats: { spins: 3 },
    log: [{ id: 1, t: 1, event: { type: 'job', delta: { money: 300 } } }],
    nextLogId: 2
  },
  profile: {
    stats: { spins: 30, totalWagered: 3000 },
    achievements: { FIRST_DEPOSIT: { unlockedAt: 10 } },
    cosmetics: { owned: ['skin:clown'], equipped: { theme: 'neon' } },
    meta: { currency: 500, upgrades: { luck: 2 } }
  },
  settings: { locale: 'ru', musicVolume: 0.4, sfxVolume: 0.3, reducedMotion: true, skipSpinAnimation: false }
})

function ok(text: string | null) {
  const result = parseSave(text, env)
  if (result.status !== 'ok') throw new Error(`ожидался ok, получили ${result.status}`)
  return result
}

describe('save: миграции до v2', () => {
  it('legacy v0 → v2: старый забег сбрасывается (новый ран — «Новая игра»), настройки по умолчанию', () => {
    const { save, migratedFrom } = ok(LEGACY_NORMAL)
    expect(migratedFrom).toBe(0)
    expect(save.version).toBe(CURRENT_SAVE_VERSION)
    expect(save.run).toBeNull()
    expect(save.profile.stats).toEqual({})
    expect(save.settings.locale).toBe('ru')
  })

  it('v1 → v2: забег сбрасывается, lifetime-статистика и ачивки сохраняются, мета-валюта удалена', () => {
    const { save, migratedFrom } = ok(V1_SAVE)
    expect(migratedFrom).toBe(1)
    expect(save.run).toBeNull()
    expect(save.profile).toEqual({
      stats: { spins: 30, totalWagered: 3000 },
      achievements: { FIRST_DEPOSIT: { unlockedAt: 10, runId: null } },
      endings: {},
      equipped: { theme: 'neon' },
      unseenCosmetics: [],
      runHistory: [],
      flags: { tutorialDone: false, hintsSeen: [] }
    })
    expect('meta' in save.profile).toBe(false)
    expect(save.settings).toMatchObject({ musicVolume: 0.4, reducedMotion: true })
  })

  it('migrate: legacy без version считается v0 и доводится до текущей версии', () => {
    expect(migrate({ money: 5 }, env).version).toBe(CURRENT_SAVE_VERSION)
    expect(migrate({ version: 1 }, env).version).toBe(CURRENT_SAVE_VERSION)
  })
})

describe('save: v2', () => {
  it('round-trip serialize → parse сохраняет ран в любой фазе (F5 не меняет ран, AC 12)', () => {
    const s = newSession(42)
    exec(s, { type: 'casino/enter' })
    exec(s, { type: 'casino/deposit', amount: 500 })
    exec(s, { type: 'slot/spin' })
    exec(s, { type: 'mfo/loan' })
    exec(s, { type: 'pawn/pawn', item: 'console' })
    exec(s, { type: 'casino/withdraw', amount: 1000 })
    const states = [s.run]
    exec(s, { type: 'day/sleep' })
    states.push(s.run)
    for (const run of states) {
      const save: SaveFile = { ...createEmptySave(env.now), run, profile: s.profile }
      const { save: loaded, migratedFrom } = ok(serializeSave(save, meta))
      expect(migratedFrom).toBeNull()
      expect(loaded.run).toEqual(run)
      expect(loaded.profile).toEqual(s.profile)
      expect(loaded.build).toBe('test')
    }
  })

  it('ран с событием, счётом и концовкой переживает перезагрузку', () => {
    const base = createRun(defaultConfig, 1, env.now)
    const cases = [
      { ...base, phase: 'event' as const, pendingEventId: 'life_fridge', eventCooldowns: { life_fridge: 4 } },
      { ...base, phase: 'bills' as const, day: 7, forcedEnd: true, casinoNightPending: true },
      { ...base, phase: 'ended' as const, endingId: 'quit' as const, grade: 'B' as const }
    ]
    for (const run of cases) {
      const loaded = ok(serializeSave({ ...createEmptySave(env.now), run }, meta)).save.run
      expect(loaded).toEqual(run)
    }
  })

  it('битые поля рана чинятся по одному, форма восстанавливается', () => {
    const text = JSON.stringify({
      version: 2,
      run: {
        wallet: 'abc',
        casino: -5,
        energy: 1e999,
        rep: -100,
        tilt: 250,
        phase: 'nonsense',
        items: { phone: 'stolen', laptop: 'pawned' },
        bills: 'нет',
        bonus: { state: 'mega', wagerReq: -1 },
        withdrawals: [{ amount: 1000, net: 950, arriveDay: 3 }, 'x'],
        endingId: 'win',
        log: [{ id: 9, t: 1, event: { type: 'alien' } }, { id: 8, t: 1, event: { type: 'runStarted', runId: 'r', seed: 1 } }],
        nextLogId: 2
      }
    })
    const run = ok(text).save.run
    expect(run).toMatchObject({ wallet: 1000, casino: 0, energy: 100, rep: -15, tilt: 100, phase: 'day', endingId: null, friendsBlocked: true })
    expect(run?.items).toEqual({ phone: 'owned', bike: 'owned', laptop: 'pawned', teaset: 'owned', console: 'owned' })
    expect(run?.bills).toHaveLength(4)
    expect(run?.bonus).toEqual({ state: 'available', wagerReq: 0, wagered: 0 })
    expect(run?.withdrawals).toEqual([{ amount: 1000, net: 950, arriveDay: 3 }])
    expect(run?.log.map((e) => e.id)).toEqual([8])
    expect(run?.nextLogId).toBe(9)
  })

  it('профиль и настройки валидируются по полям', () => {
    const text = JSON.stringify({
      version: 2,
      run: null,
      profile: {
        stats: { spins: 5, bad: 'x' },
        achievements: { FIRST_DEPOSIT: { unlockedAt: 10, runId: 'r1' }, BROKEN: 1 },
        endings: { quit: { count: 2, firstAt: 5, bestGrade: 'A' }, alien: { count: 1 }, jail: { count: 'x', bestGrade: 'Z' } },
        equipped: { theme: 'neon', skin: 3 },
        unseenCosmetics: ['skin:clown', 5],
        runHistory: [{ runId: 'r1', endingId: 'quit', grade: 'A', days: 28 }, 'x'],
        flags: { tutorialDone: true, hintsSeen: ['welcome', 1] }
      },
      settings: { locale: 'de', musicVolume: 5, sfxVolume: 0.3, reducedMotion: true, skipSpinAnimation: 'yes' }
    })
    const { save } = ok(text)
    expect(save.run).toBeNull()
    expect(save.profile).toMatchObject({
      stats: { spins: 5 },
      achievements: { FIRST_DEPOSIT: { unlockedAt: 10, runId: 'r1' } },
      endings: { quit: { count: 2, firstAt: 5, bestGrade: 'A' }, jail: { count: 1, firstAt: 0, bestGrade: null } },
      equipped: { theme: 'neon' },
      unseenCosmetics: ['skin:clown'],
      flags: { tutorialDone: true, hintsSeen: ['welcome'] }
    })
    expect(save.profile.runHistory).toHaveLength(1)
    expect(save.profile.runHistory[0]).toMatchObject({ runId: 'r1', endingId: 'quit', grade: 'A', days: 28, casinoNetFinal: 0 })
    expect(save.settings).toEqual({ locale: 'ru', musicVolume: 1, sfxVolume: 0.3, reducedMotion: true, skipSpinAnimation: false })
  })

  it('пустой и битый текст', () => {
    expect(parseSave(null, env).status).toBe('empty')
    expect(parseSave('  ', env).status).toBe('empty')
    expect(parseSave('{oops', env).status).toBe('corrupt')
    expect(parseSave('[1,2]', env).status).toBe('corrupt')
    expect(parseSave('null', env).status).toBe('corrupt')
  })

  it('сейв из будущей версии не мигрируется и помечается', () => {
    const result = parseSave(JSON.stringify({ version: 99, run: { wallet: 5000 } }), env)
    expect(result.status).toBe('future')
    if (result.status === 'future') expect(result.save.run?.wallet).toBe(5000)
  })
})

describe('loadSave: порядок источников', () => {
  const run = executeCommand(createRun(defaultConfig, 1, env.now), { type: 'day/wake' }, { config: defaultConfig, now: env.now }).state
  const v2 = serializeSave({ ...createEmptySave(env.now), run }, meta)

  it('основной сейв', () => {
    const out = loadSave({ main: v2, backup: null, legacy: LEGACY_NORMAL }, env)
    expect(out).toMatchObject({ source: 'main', readOnly: false, needsWrite: false })
  })

  it('битый основной → бэкап (и перезапись)', () => {
    const out = loadSave({ main: '{broken', backup: v2, legacy: null }, env)
    expect(out).toMatchObject({ source: 'backup', needsWrite: true })
    expect(out.warnings).toHaveLength(1)
  })

  it('основной v1 → миграция и перезапись', () => {
    const out = loadSave({ main: V1_SAVE, backup: null, legacy: null }, env)
    expect(out).toMatchObject({ source: 'main', needsWrite: true })
  })

  it('нет v2 → legacy с миграцией', () => {
    const out = loadSave({ main: null, backup: null, legacy: LEGACY_NORMAL }, env)
    expect(out).toMatchObject({ source: 'legacy', needsWrite: true })
    expect(out.save.run).toBeNull()
  })

  it('всё битое → новый пустой сейв', () => {
    const out = loadSave({ main: '{', backup: '{', legacy: 'nope' }, env)
    expect(out).toMatchObject({ source: 'new', needsWrite: false })
    expect(out.save.run).toBeNull()
    expect(out.warnings).toHaveLength(3)
  })

  it('будущая версия → только чтение', () => {
    const out = loadSave({ main: JSON.stringify({ version: 3 }), backup: v2, legacy: null }, env)
    expect(out).toMatchObject({ source: 'main', readOnly: true, needsWrite: false })
  })
})
