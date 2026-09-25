import type { GameEvent } from '@/game'
import type { SfxEngine } from './engine'
import { slotsForEvents } from './events'
import { resolvePreset, type SoundPackId } from './packs'
import { PRESETS, shiftPreset, type Note, type PresetId } from './presets'
import type { SoundSlot } from './slots'

/**
 * Режиссёр звука: слот → пресет (пак + правило Изнанки) → движок. Не знает про Vue и стор:
 * пак и слой он спрашивает у колбэка, поэтому тестируется с мок-движком.
 */

export interface SoundContext {
  pack: SoundPackId
  /** Режим «Снять очки»: исходы спина — из honest, общий уровень приглушён. */
  underbelly: boolean
}

type EnginePort = Pick<SfxEngine, 'play'>

/** Приглушение всего звука в Изнанке. */
export const UNDERBELLY_GAIN = 0.55
/** Пауза между звуками одной пачки событий, с. */
export const BATCH_STAGGER = 0.12
/** Минимальный интервал между повторами одного слота, мс (дребезг кликов). */
const COOLDOWN_MS: Partial<Record<SoundSlot, number>> = { click: 40, reelTick: 20, reelStop: 20 }

export class SoundDirector {
  private lastPlayed = new Map<SoundSlot, number>()

  constructor(
    private readonly engine: EnginePort,
    private readonly context: () => SoundContext,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Какой пресет прозвучит для слота прямо сейчас. */
  presetFor(slot: SoundSlot): PresetId | null {
    const { pack, underbelly } = this.context()
    return resolvePreset(pack, slot, underbelly)
  }

  play(slot: SoundSlot, delay = 0): boolean {
    const id = this.presetFor(slot)
    if (!id) return false
    const cooldown = COOLDOWN_MS[slot]
    const t = this.now()
    if (cooldown !== undefined && t - (this.lastPlayed.get(slot) ?? -Infinity) < cooldown) return false
    const ok = this.engine.play(PRESETS[id], { delay, gain: this.gain() })
    if (ok) this.lastPlayed.set(slot, t)
    return ok
  }

  /** Пачка событий из стора (onPresent). Возвращает слоты, которые пытались сыграть. */
  handleEvents(events: readonly GameEvent[]): SoundSlot[] {
    const slots = slotsForEvents(events)
    let delay = 0
    for (const slot of slots) {
      if (this.play(slot, delay)) delay += BATCH_STAGGER
    }
    return slots
  }

  /**
   * Вращение барабанов одним голосом: старт, тики, пока крутится хоть один барабан, и стоп каждого.
   * stopsMs — моменты остановки барабанов от старта, мс (как в анимации SlotPanel).
   */
  reels(stopsMs: readonly number[]): boolean {
    const start = this.presetFor('spinStart')
    const tick = this.presetFor('reelTick')
    const stop = this.presetFor('reelStop')
    const stops = [...stopsMs].map((ms) => Math.max(0, ms) / 1000).sort((a, b) => a - b)
    const notes: Note[] = []
    if (start) notes.push(...PRESETS[start])
    if (tick && stops.length > 0) {
      const last = stops[stops.length - 1] ?? 0
      let t = 0.06
      while (t < last - 0.03) {
        const stillSpinning = stops.filter((s) => s > t).length
        notes.push(...shiftPreset(PRESETS[tick], t))
        // Чем меньше барабанов крутится, тем реже тики — «замедление» на слух
        t += 0.06 + (stops.length - stillSpinning) * 0.025
      }
    }
    if (stop) for (const s of stops) notes.push(...shiftPreset(PRESETS[stop], s))
    if (notes.length === 0) return false
    return this.engine.play(notes, { gain: this.gain() })
  }

  private gain(): number {
    return this.context().underbelly ? UNDERBELLY_GAIN : 1
  }
}
