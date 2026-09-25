import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../config'
import { executeCommand } from '../reducer'
import { createRun } from '../state'
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
const LEGACY_STRINGS = '{"money":"abc","energy":"20","reputation":10,"debt":0,"bet":100,"logs":"не массив"}'
const LEGACY_NAN = '{"money":null,"energy":1e999,"reputation":-100,"debt":-5,"bet":0.5,"logs":[1, "", "ok"]}'

function ok(text: string | null) {
  const result = parseSave(text, env)
  if (result.status !== 'ok') throw new Error(`ожидался ok, получили ${result.status}`)
  return result
}

describe('save: миграция legacy v0 → v1', () => {
  it('нормальный legacy-сейв переносится без потерь', () => {
    const { save, migratedFrom } = ok(LEGACY_NORMAL)
    expect(migratedFrom).toBe(0)
    expect(save.version).toBe(CURRENT_SAVE_VERSION)
    expect(save.run).toMatchObject({ money: 2350, energy: 15, reputation: -4, debt: 1234, bet: 150, rngState: 123 })
    expect(save.run?.log.map((e) => e.event)).toEqual([
      { type: 'legacyText', text: 'Ты помог другу: +1❤️ и -5⚡' },
      { type: 'legacyText', text: '🎰 ДЖЕКПОТ 777! Выигрыш: 700₽' }
    ])
    expect(save.run?.nextLogId).toBe(3)
    expect(save.profile.stats).toEqual({})
  })

  it('"money":"abc" → дефолт только для этого поля', () => {
    const { save } = ok(LEGACY_STRINGS)
    expect(save.run).toMatchObject({ money: 1000, energy: 20, reputation: 10 })
    expect(save.run?.log).toEqual([])
  })

  it('NaN/null/отрицательные/дроби нормализуются инвариантами', () => {
    const { save } = ok(LEGACY_NAN)
    expect(save.run).toMatchObject({ money: 1000, energy: 50, reputation: -10, debt: 0, bet: 50 })
    expect(save.run?.log.map((e) => e.event)).toEqual([{ type: 'legacyText', text: 'ok' }])
  })

  it('пустой объект legacy — забег с дефолтами', () => {
    expect(ok('{}').save.run).toMatchObject(defaultConfig.balance.start)
  })
})

describe('save: v1', () => {
  it('round-trip serialize → parse сохраняет состояние (F5 не меняет забег)', () => {
    let run = createRun(defaultConfig, 42, env.now)
    run = executeCommand(run, { type: 'slot/spin' }, { config: defaultConfig, now: env.now }).state
    run = executeCommand(run, { type: 'bank/credit' }, { config: defaultConfig, now: env.now }).state
    const save: SaveFile = { ...createEmptySave(env.now), run }
    const { save: loaded, migratedFrom } = ok(serializeSave(save, meta))
    expect(migratedFrom).toBeNull()
    expect(loaded.run).toEqual(run)
    expect(loaded.build).toBe('test')
  })

  it('профиль и настройки валидируются по полям', () => {
    const text = JSON.stringify({
      version: 1,
      run: null,
      profile: {
        stats: { spins: 5, bad: 'x' },
        achievements: { FIRST_SPIN: { unlockedAt: 10 }, BROKEN: 1 },
        cosmetics: { owned: ['neon', 5], equipped: { theme: 'neon', skin: 3 } },
        meta: { currency: -5, upgrades: { luck: 2 } }
      },
      settings: { locale: 'de', musicVolume: 5, sfxVolume: 0.3, reducedMotion: true, skipSpinAnimation: 'yes' }
    })
    const { save } = ok(text)
    expect(save.run).toBeNull()
    expect(save.profile).toEqual({
      stats: { spins: 5 },
      achievements: { FIRST_SPIN: { unlockedAt: 10 } },
      cosmetics: { owned: ['neon'], equipped: { theme: 'neon' } },
      meta: { currency: 0, upgrades: { luck: 2 } }
    })
    expect(save.settings).toEqual({ locale: 'ru', musicVolume: 1, sfxVolume: 0.3, reducedMotion: true, skipSpinAnimation: false })
  })

  it('неизвестные события хроники отбрасываются, nextLogId не отстаёт', () => {
    const text = JSON.stringify({
      version: 1,
      run: { money: 1, log: [{ id: 9, t: 1, event: { type: 'alien' } }, { id: 8, t: 1, event: { type: 'runStarted' } }], nextLogId: 2 }
    })
    const run = ok(text).save.run
    expect(run?.log.map((e) => e.id)).toEqual([8])
    expect(run?.nextLogId).toBe(9)
  })

  it('пустой и битый текст', () => {
    expect(parseSave(null, env).status).toBe('empty')
    expect(parseSave('  ', env).status).toBe('empty')
    expect(parseSave('{oops', env).status).toBe('corrupt')
    expect(parseSave('[1,2]', env).status).toBe('corrupt')
    expect(parseSave('null', env).status).toBe('corrupt')
  })

  it('сейв из будущей версии не мигрируется и помечается', () => {
    const result = parseSave(JSON.stringify({ version: 99, run: { money: 5000 } }), env)
    expect(result.status).toBe('future')
    if (result.status === 'future') expect(result.save.run?.money).toBe(5000)
  })

  it('migrate: legacy без version считается v0 и доводится до текущей версии', () => {
    expect(migrate({ money: 5 }, env).version).toBe(CURRENT_SAVE_VERSION)
  })
})

describe('loadSave: порядок источников', () => {
  const v1 = serializeSave({ ...createEmptySave(env.now), run: createRun(defaultConfig, 1, env.now) }, meta)

  it('основной сейв', () => {
    const out = loadSave({ main: v1, backup: null, legacy: LEGACY_NORMAL }, env)
    expect(out).toMatchObject({ source: 'main', readOnly: false, needsWrite: false })
  })

  it('битый основной → бэкап (и перезапись)', () => {
    const out = loadSave({ main: '{broken', backup: v1, legacy: null }, env)
    expect(out).toMatchObject({ source: 'backup', needsWrite: true })
    expect(out.warnings).toHaveLength(1)
  })

  it('нет v1 → legacy с миграцией', () => {
    const out = loadSave({ main: null, backup: null, legacy: LEGACY_NORMAL }, env)
    expect(out).toMatchObject({ source: 'legacy', needsWrite: true })
    expect(out.save.run?.money).toBe(2350)
  })

  it('всё битое → новый пустой сейв', () => {
    const out = loadSave({ main: '{', backup: '{', legacy: 'nope' }, env)
    expect(out).toMatchObject({ source: 'new', needsWrite: false })
    expect(out.save.run).toBeNull()
    expect(out.warnings).toHaveLength(3)
  })

  it('будущая версия → только чтение', () => {
    const out = loadSave({ main: JSON.stringify({ version: 2 }), backup: v1, legacy: null }, env)
    expect(out).toMatchObject({ source: 'main', readOnly: true, needsWrite: false })
  })
})
