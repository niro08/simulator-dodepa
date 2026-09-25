import { describe, expect, it, vi } from 'vitest'
import type { EventOf, GameEvent } from '@/game'
import {
  OUTCOME_SLOTS,
  PRESETS,
  SOUND_PACKS,
  SOUND_SLOTS,
  SfxEngine,
  SoundDirector,
  UNDERBELLY_GAIN,
  eventSlot,
  outcomeSlot,
  packIdFromCosmetic,
  presetDuration,
  resolvePreset,
  slotsForEvents,
  type Preset,
  type SoundContext,
  type SoundPackId
} from '@/audio'
import { COSMETICS } from '@/game/config/cosmetics'

// ─── Мок Web Audio: только то, что зовёт движок ───
class FakeParam {
  value = 0
  setValueAtTime(v: number) {
    this.value = v
    return this
  }
  linearRampToValueAtTime(v: number) {
    this.value = v
    return this
  }
  exponentialRampToValueAtTime(v: number) {
    if (!(v > 0)) throw new RangeError('exponential ramp to non-positive value')
    this.value = v
    return this
  }
  setTargetAtTime(v: number) {
    this.value = v
    return this
  }
  cancelScheduledValues() {
    return this
  }
}
class FakeNode {
  connected: unknown[] = []
  connect(node: unknown) {
    this.connected.push(node)
    return node
  }
  disconnect() {
    this.connected = []
  }
}
class FakeSource extends FakeNode {
  onended: (() => void) | null = null
  started = false
  stopped = false
  start() {
    this.started = true
  }
  stop() {
    this.stopped = true
  }
}
class FakeOsc extends FakeSource {
  type = 'sine'
  frequency = new FakeParam()
  detune = new FakeParam()
}
class FakeBufferSource extends FakeSource {
  buffer: unknown = null
  loop = false
}
class FakeCtx {
  currentTime = 0
  sampleRate = 100
  state: 'running' | 'suspended' = 'suspended'
  destination = new FakeNode()
  oscillators: FakeOsc[] = []
  compressors = 0
  resume = vi.fn(() => {
    this.state = 'running'
    return Promise.resolve()
  })
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() })
  }
  createOscillator() {
    const o = new FakeOsc()
    this.oscillators.push(o)
    return o
  }
  createBufferSource() {
    return new FakeBufferSource()
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() })
  }
  createDynamicsCompressor() {
    this.compressors++
    const p = () => new FakeParam()
    return Object.assign(new FakeNode(), { threshold: p(), knee: p(), ratio: p(), attack: p(), release: p() })
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
}

function fakeEngine(maxVoices?: number) {
  const ctx = new FakeCtx()
  const factory = vi.fn(() => ctx as unknown as AudioContext)
  const engine = new SfxEngine({ createContext: factory, maxVoices })
  return { ctx, factory, engine }
}

function spin(p: Partial<EventOf<'spin'>>): EventOf<'spin'> {
  return {
    type: 'spin',
    bet: 100,
    outcomeId: 'lose',
    multiplier: 0,
    payout: 0,
    reels: ['cherry', 'lemon', 'melon'],
    ldw: false,
    nearMiss: false,
    allIn: false,
    energyCost: 5,
    tiltBefore: 0,
    casinoBefore: 1000,
    casinoAfter: 900,
    bonusLocked: false,
    loseStreak: 1,
    ...p
  } as EventOf<'spin'>
}

const LDW = spin({ outcomeId: 'one_cherry', multiplier: 0.5, payout: 50, ldw: true })
const WIN = spin({ outcomeId: 'two_cherries', multiplier: 2, payout: 200 })
const PUSH = spin({ outcomeId: 'fruit_mix', multiplier: 1, payout: 100 })
const BIG = spin({ outcomeId: 'fruit_triple', multiplier: 10, payout: 1000 })
const JACKPOT = spin({ outcomeId: 'jackpot', multiplier: 100, payout: 10000 })
const LOSE = spin({})
const NEAR = spin({ nearMiss: true, reels: ['seven', 'seven', 'lemon'] })

describe('маппинг событие → слот', () => {
  it('исходы спина', () => {
    expect(outcomeSlot(LOSE)).toBe('lose')
    expect(outcomeSlot(NEAR)).toBe('nearMiss')
    expect(outcomeSlot(LDW)).toBe('ldw')
    expect(outcomeSlot(PUSH)).toBe('push')
    expect(outcomeSlot(WIN)).toBe('win')
    expect(outcomeSlot(BIG)).toBe('bigWin')
    expect(outcomeSlot(JACKPOT)).toBe('jackpot')
  })

  it('экономика, сон, ачивки, концовка', () => {
    expect(eventSlot({ type: 'deposit', amount: 500 })).toBe('deposit')
    expect(eventSlot({ type: 'withdrawRequested', gross: 1, fee: 0, net: 1, arriveDay: 3 })).toBe('withdraw')
    expect(eventSlot({ type: 'achievementUnlocked', id: 'X', hidden: false, rewards: [] })).toBe('achievement')
    expect(eventSlot({ type: 'slept', day: 2, casinoNight: false, tilt70: false, cleanWeek: false, noSpins: false })).toBe('sleep')
    expect(eventSlot({ type: 'dayStarted', day: 3, week: 1 })).toBe('morning')
    expect(eventSlot({ type: 'dayStarted', day: 1, week: 1 })).toBeNull() // озвучен джинглом старта
    expect(eventSlot({ type: 'billsOpened', week: 1, total: 1, forced: false })).toBe('bill')
    expect(eventSlot({ type: 'tiltStageChanged', from: 'calm', to: 'heated' })).toBe('tiltStage')
    expect(eventSlot({ type: 'tiltStageChanged', from: 'tilt', to: 'heated' })).toBeNull()
    expect(eventSlot({ type: 'betChanged', from: 10, to: 20 })).toBeNull()
    const ended = { type: 'runEnded', grade: null, day: 9, weeksSurvived: 1, forfeitedCasino: 0, forfeitedWithdrawals: 0, itemsLost: [] }
    expect(eventSlot({ ...ended, endingId: 'jail' } as GameEvent)).toBe('ending')
    expect(eventSlot({ ...ended, endingId: 'abandoned' } as GameEvent)).toBeNull()
  })

  it('пачка: без дублей, не больше 3, важные остаются, порядок сохранён', () => {
    const events: GameEvent[] = [
      { type: 'deposit', amount: 1 },
      LOSE,
      LOSE,
      { type: 'tiltStageChanged', from: 'calm', to: 'heated' },
      { type: 'billsOpened', week: 1, total: 1, forced: false },
      { type: 'achievementUnlocked', id: 'X', hidden: false, rewards: [] }
    ]
    expect(slotsForEvents(events)).toEqual(['deposit', 'lose', 'achievement'])
  })
})

describe('звук-паки', () => {
  const packIds = Object.keys(SOUND_PACKS) as SoundPackId[]

  it('совпадают с каталогом косметики и покрывают все слоты существующими пресетами', () => {
    expect(packIds.sort()).toEqual(COSMETICS.sounds.map((s) => s.id).sort())
    for (const id of packIds) {
      for (const slot of SOUND_SLOTS) {
        const preset = SOUND_PACKS[id][slot]
        if (preset !== null) expect(PRESETS[preset], `${id}.${slot}`).toBeDefined()
      }
    }
  })

  it('Витрина: LDW звучит как выигрыш во всех нечестных паках, проигрыш молчит', () => {
    for (const id of packIds.filter((p) => p !== 'honest')) {
      expect(SOUND_PACKS[id].ldw).toBe(SOUND_PACKS[id].win)
      expect(SOUND_PACKS[id].push).toBe(SOUND_PACKS[id].win)
      expect(SOUND_PACKS[id].lose).toBeNull()
      expect(SOUND_PACKS[id].win).not.toBeNull()
    }
  })

  it('honest: все исходы и депозит — сухой щелчок, ачивка молчит', () => {
    const h = SOUND_PACKS.honest
    for (const slot of [...OUTCOME_SLOTS, 'deposit'] as const) expect(h[slot]).toBe('dry_click')
    expect(h.achievement).toBeNull()
    expect(h.reelTick).toBeNull()
  })

  it('Изнанка: исходы из honest при любом паке, остальное — из выбранного', () => {
    for (const id of packIds) {
      for (const slot of OUTCOME_SLOTS) expect(resolvePreset(id, slot, true)).toBe('dry_click')
      expect(resolvePreset(id, 'deposit', true)).toBe(SOUND_PACKS[id].deposit)
    }
    expect(resolvePreset('streamer', 'ldw', false)).toBe('airhorn')
  })

  it('выбор пака по CosmeticId', () => {
    expect(packIdFromCosmetic('sound:hall_90s')).toBe('hall_90s')
    expect(packIdFromCosmetic('sound:honest')).toBe('honest')
    expect(packIdFromCosmetic('streamer')).toBe('streamer')
    expect(packIdFromCosmetic('sound:nope')).toBe('classic')
    expect(packIdFromCosmetic(undefined)).toBe('classic')
  })

  it('пресеты конечны и не громче 0.4 на ноту', () => {
    for (const [id, preset] of Object.entries(PRESETS) as [string, Preset][]) {
      expect(presetDuration(preset), id).toBeLessThan(3.5)
      for (const n of preset) {
        expect(n.gain, id).toBeLessThanOrEqual(0.4)
        expect(n.dur, id).toBeGreaterThan(0)
      }
    }
  })
})

describe('SfxEngine', () => {
  it('без Web Audio — noop', () => {
    const engine = new SfxEngine({ createContext: () => null })
    expect(engine.unlock()).toBe(false)
    expect(engine.play(PRESETS.dry_click)).toBe(false)
    expect(engine.ready).toBe(false)
  })

  it('дефолтная фабрика в node (нет AudioContext) не падает', () => {
    const engine = new SfxEngine()
    expect(engine.unlock()).toBe(false)
    expect(engine.play(PRESETS.sq_fanfare)).toBe(false)
  })

  it('контекст создаётся лениво — только в unlock(), один раз; лимитер на мастере', () => {
    const { ctx, factory, engine } = fakeEngine()
    expect(engine.play(PRESETS.dry_click)).toBe(false)
    expect(factory).not.toHaveBeenCalled()
    expect(engine.unlock()).toBe(true)
    expect(engine.unlock()).toBe(true)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(ctx.resume).toHaveBeenCalled()
    expect(ctx.compressors).toBe(1)
    expect(engine.play(PRESETS.sq_fanfare)).toBe(true)
    expect(ctx.oscillators.every((o) => o.started && o.stopped)).toBe(true)
  })

  it('громкость 0 — не играет', () => {
    const { engine } = fakeEngine()
    engine.unlock()
    engine.setVolume(0)
    expect(engine.play(PRESETS.dry_click)).toBe(false)
    engine.setVolume(2)
    expect(engine.getVolume()).toBe(1)
  })

  it('лимит голосов: старые вытесняются', () => {
    const { engine } = fakeEngine(4)
    engine.unlock()
    for (let i = 0; i < 9; i++) engine.play(PRESETS.sq_jackpot)
    expect(engine.activeVoices).toBe(4)
    engine.stopAll()
    expect(engine.activeVoices).toBe(0)
  })
})

describe('SoundDirector', () => {
  function setup(context: SoundContext) {
    const ctxRef = { ...context }
    const play = vi.fn((_: Preset, __?: { delay?: number; gain?: number }) => true)
    let t = 0
    const director = new SoundDirector({ play }, () => ctxRef, () => (t += 100))
    return { director, play, ctxRef }
  }

  it('LDW в Витрине = фанфары выигрыша, в Изнанке = сухой щелчок и приглушение', () => {
    const { director, play, ctxRef } = setup({ pack: 'classic', underbelly: false })
    director.handleEvents([LDW])
    director.handleEvents([WIN])
    expect(play.mock.calls[0]?.[0]).toBe(PRESETS.sq_fanfare)
    expect(play.mock.calls[1]?.[0]).toBe(play.mock.calls[0]?.[0])
    expect(play.mock.calls[0]?.[1]?.gain).toBe(1)

    ctxRef.underbelly = true
    director.handleEvents([LDW])
    expect(play.mock.calls[2]?.[0]).toBe(PRESETS.dry_click)
    expect(play.mock.calls[2]?.[1]?.gain).toBe(UNDERBELLY_GAIN)
  })

  it('проигрыш в Витрине молчит, near-miss — «ааах»', () => {
    const { director, play } = setup({ pack: 'classic', underbelly: false })
    director.handleEvents([LOSE])
    expect(play).not.toHaveBeenCalled()
    director.handleEvents([NEAR])
    expect(play).toHaveBeenCalledWith(PRESETS.sq_aaah, expect.anything())
  })

  it('пак берётся из контекста на момент звука', () => {
    const { director, play, ctxRef } = setup({ pack: 'hall_90s', underbelly: false })
    director.handleEvents([{ type: 'deposit', amount: 1 }])
    ctxRef.pack = 'streamer'
    director.handleEvents([{ type: 'deposit', amount: 1 }])
    expect(play.mock.calls.map((c) => c[0])).toEqual([PRESETS.register_90s, PRESETS.kaching_bass])
  })

  it('пачка событий разнесена во времени', () => {
    const { director, play } = setup({ pack: 'classic', underbelly: false })
    director.handleEvents([{ type: 'deposit', amount: 1 }, { type: 'achievementUnlocked', id: 'X', hidden: false, rewards: [] }])
    expect(play.mock.calls.map((c) => c[1]?.delay)).toEqual([0, expect.any(Number)])
    expect(play.mock.calls[1]?.[1]?.delay).toBeGreaterThan(0)
  })

  it('барабаны: старт + тики + стоп каждого одним голосом; в honest тишина', () => {
    const { director, play, ctxRef } = setup({ pack: 'classic', underbelly: false })
    expect(director.reels([800, 1000, 1200])).toBe(true)
    const notes = play.mock.calls[0]?.[0] ?? []
    const stops = notes.filter((n) => n.wave === 'square' && n.freq === 196)
    expect(stops.map((n) => n.at)).toEqual([0.8, 1, 1.2])
    expect(notes.filter((n) => n.freq === 1760).length).toBeGreaterThan(5)

    ctxRef.pack = 'honest'
    expect(director.reels([800, 1000, 1200])).toBe(false)
  })

  it('клик с защитой от дребезга', () => {
    const play = vi.fn(() => true)
    const director = new SoundDirector({ play }, () => ({ pack: 'classic', underbelly: false }), () => 1000)
    expect(director.play('click')).toBe(true)
    expect(director.play('click')).toBe(false)
  })
})
