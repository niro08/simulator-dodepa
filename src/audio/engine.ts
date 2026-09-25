import type { Note, Preset } from './presets'

/**
 * Движок SFX на Web Audio (CD-20). Граф:
 *   голос (gain) ─┐
 *   голос (gain) ─┼─> bus (громкость master) ─> компрессор-лимитер ─> destination
 *   …            ─┘
 * - AudioContext создаётся лениво и только в unlock() — его зовут из жеста пользователя.
 *   До unlock() play() молчит; нет Web Audio (SSR, тесты, старый браузер) — всё noop.
 * - Лимит одновременных голосов: при переполнении самый старый голос гасится за ~10 мс.
 * - Без клиппинга: запас по уровню на шине + лимитер (DynamicsCompressor, ratio 20, порог −10 dB).
 */

export type ContextFactory = () => AudioContext | null

export interface EngineOptions {
  maxVoices?: number
  /** Подмена конструктора контекста (тесты). По умолчанию — window.AudioContext / webkitAudioContext. */
  createContext?: ContextFactory
}

export interface PlayOptions {
  /** Задержка старта, с. */
  delay?: number
  /** Множитель громкости голоса. */
  gain?: number
}

interface Voice {
  gain: GainNode
  sources: AudioScheduledSourceNode[]
  end: number
}

export const DEFAULT_MAX_VOICES = 10
/** Запас по уровню шины: даже несколько громких голосов не упираются в лимитер. */
const BUS_HEADROOM = 0.8
const SILENT = 0.0001

export function defaultContextFactory(): AudioContext | null {
  const g = globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor({ latencyHint: 'interactive' })
  } catch {
    return null
  }
}

export class SfxEngine {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private voices: Voice[] = []
  private volume = 1
  private unavailable = false
  private readonly maxVoices: number
  private readonly createContext: ContextFactory

  constructor(options: EngineOptions = {}) {
    this.maxVoices = Math.max(1, options.maxVoices ?? DEFAULT_MAX_VOICES)
    this.createContext = options.createContext ?? defaultContextFactory
  }

  /** Контекст создан (был жест пользователя и Web Audio доступен). */
  get ready(): boolean {
    return this.ctx !== null
  }

  get activeVoices(): number {
    this.prune()
    return this.voices.length
  }

  /** Звать из обработчика жеста: создаёт контекст (один раз) и будит его, если браузер усыпил. */
  unlock(): boolean {
    if (!this.ctx && !this.unavailable) {
      const ctx = this.createContext()
      if (!ctx) {
        this.unavailable = true
        return false
      }
      this.ctx = ctx
      this.buildGraph(ctx)
    }
    const ctx = this.ctx
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    return ctx !== null
  }

  /** Громкость master 0..1 (перцептивная кривая — квадрат). */
  setVolume(value: number) {
    this.volume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
    if (this.ctx && this.bus) {
      this.bus.gain.setTargetAtTime(this.busLevel(), this.ctx.currentTime, 0.02)
    }
  }

  getVolume(): number {
    return this.volume
  }

  /** Играет пресет одним голосом. false — не прозвучало (нет контекста, громкость 0, пустой пресет). */
  play(preset: Preset, options: PlayOptions = {}): boolean {
    const ctx = this.ctx
    const bus = this.bus
    if (!ctx || !bus || this.volume <= 0 || preset.length === 0) return false
    this.prune()
    while (this.voices.length >= this.maxVoices) this.steal()

    const t0 = ctx.currentTime + 0.005 + Math.max(0, options.delay ?? 0)
    const voiceGain = ctx.createGain()
    voiceGain.gain.value = Math.max(0, options.gain ?? 1)
    voiceGain.connect(bus)

    const voice: Voice = { gain: voiceGain, sources: [], end: t0 }
    let pending = 0
    const onEnded = () => {
      pending--
      if (pending <= 0) this.release(voice)
    }
    for (const note of preset) {
      const source = this.scheduleNote(ctx, note, t0, voiceGain)
      if (!source) continue
      pending++
      source.onended = onEnded
      voice.sources.push(source)
      voice.end = Math.max(voice.end, t0 + note.at + note.dur)
    }
    if (voice.sources.length === 0) {
      voiceGain.disconnect()
      return false
    }
    this.voices.push(voice)
    return true
  }

  /** Мгновенно (с коротким фейдом) глушит всё. */
  stopAll() {
    while (this.voices.length > 0) this.steal()
  }

  private busLevel(): number {
    return this.volume * this.volume * BUS_HEADROOM
  }

  private buildGraph(ctx: AudioContext) {
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.12
    limiter.connect(ctx.destination)

    const bus = ctx.createGain()
    bus.gain.value = this.busLevel()
    bus.connect(limiter)
    this.bus = bus

    // Секунда белого шума: из неё берутся все шумовые ноты (со случайного смещения)
    const length = Math.max(1, Math.floor(ctx.sampleRate))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buffer
  }

  private scheduleNote(ctx: AudioContext, note: Note, t0: number, out: AudioNode): AudioScheduledSourceNode | null {
    if (note.dur <= 0 || note.gain <= 0) return null
    const start = t0 + Math.max(0, note.at)
    const end = start + note.dur

    let source: AudioScheduledSourceNode
    if (note.src === 'noise') {
      if (!this.noiseBuffer) return null
      const buf = ctx.createBufferSource()
      buf.buffer = this.noiseBuffer
      buf.loop = true
      source = buf
    } else {
      const osc = ctx.createOscillator()
      osc.type = note.wave ?? 'sine'
      const freq = note.freq ?? 440
      osc.frequency.setValueAtTime(freq, start)
      if (note.to && note.to > 0) osc.frequency.exponentialRampToValueAtTime(note.to, end)
      if (note.detune) osc.detune.value = note.detune
      source = osc
    }

    const env = ctx.createGain()
    const attack = Math.min(Math.max(0.001, note.attack ?? 0.004), note.dur * 0.5)
    const peak = Math.min(1, note.gain)
    env.gain.setValueAtTime(SILENT, start)
    env.gain.linearRampToValueAtTime(peak, start + attack)
    env.gain.exponentialRampToValueAtTime(SILENT, end)
    env.connect(out)

    if (note.filter) {
      const filter = ctx.createBiquadFilter()
      filter.type = note.filter.type
      filter.frequency.setValueAtTime(note.filter.freq, start)
      if (note.filter.to && note.filter.to > 0) filter.frequency.exponentialRampToValueAtTime(note.filter.to, end)
      if (note.filter.q !== undefined) filter.Q.value = note.filter.q
      source.connect(filter)
      filter.connect(env)
    } else {
      source.connect(env)
    }

    if (note.src === 'noise') {
      ;(source as AudioBufferSourceNode).start(start, Math.random() * 0.9)
    } else {
      source.start(start)
    }
    source.stop(end + 0.02)
    return source
  }

  /** Убирает отзвучавшие голоса (страховка, если onended не пришёл). */
  private prune() {
    const ctx = this.ctx
    if (!ctx) return
    const now = ctx.currentTime
    this.voices = this.voices.filter((v) => {
      if (v.end + 0.05 > now) return true
      v.gain.disconnect()
      return false
    })
  }

  private steal() {
    const voice = this.voices.shift()
    const ctx = this.ctx
    if (!voice || !ctx) return
    const now = ctx.currentTime
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0, now, 0.01)
    for (const s of voice.sources) {
      try {
        s.stop(now + 0.06)
      } catch {
        /* уже остановлен */
      }
    }
  }

  private release(voice: Voice) {
    const i = this.voices.indexOf(voice)
    if (i >= 0) this.voices.splice(i, 1)
    voice.gain.disconnect()
  }
}
