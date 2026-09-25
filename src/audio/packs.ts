import type { PresetId } from './presets'
import { OUTCOME_SLOTS, type SoundSlot } from './slots'

/**
 * Звук-паки (systems-spec §5.4, id = cosmetics.sounds). Инварианты проверяет audio.test.ts:
 * - все, кроме honest: `ldw === win` (Витрина празднует LDW как выигрыш), в classic ещё `push === win`;
 * - honest: все исходы спина и депозит — `dry_click`, ачивка — null;
 * - проигрыш в Витрине — null: казино проигрыш не озвучивает (пародия).
 * Правило Изнанки: в режиме «Снять очки» OUTCOME_SLOTS берутся из honest при любом паке.
 */

export type SoundPackId = 'classic' | 'honest' | 'hall_90s' | 'streamer'
export type SoundPack = Readonly<Record<SoundSlot, PresetId | null>>

export const DEFAULT_PACK: SoundPackId = 'classic'

export const SOUND_PACKS: Readonly<Record<SoundPackId, SoundPack>> = {
  classic: {
    click: 'sq_click',
    spinStart: 'sq_spin',
    reelTick: 'sq_tick',
    reelStop: 'sq_stop',
    nearMiss: 'sq_aaah',
    win: 'sq_fanfare',
    ldw: 'sq_fanfare',
    push: 'sq_fanfare',
    bigWin: 'sq_bigwin',
    jackpot: 'sq_jackpot',
    lose: null,
    deposit: 'sq_kaching',
    withdraw: 'office_stamp',
    stamp: 'stamp_thud',
    achievement: 'sq_achievement',
    sleep: 'sq_sleep',
    morning: 'sq_morning',
    bill: 'bill_printer',
    tiltStage: 'sq_tilt',
    casinoNight: 'sq_casino_night',
    ending: 'soft_ending',
    runStart: 'sq_start'
  },
  honest: {
    click: 'soft_click',
    spinStart: null,
    reelTick: null,
    reelStop: null,
    nearMiss: 'dry_click',
    win: 'dry_click',
    ldw: 'dry_click',
    push: 'dry_click',
    bigWin: 'dry_click',
    jackpot: 'dry_click',
    lose: 'dry_click',
    deposit: 'dry_click',
    withdraw: 'office_stamp',
    stamp: 'stamp_thud',
    achievement: null,
    sleep: 'honest_sleep',
    morning: 'honest_morning',
    bill: 'bill_printer',
    tiltStage: null,
    casinoNight: null,
    ending: null,
    runStart: null
  },
  hall_90s: {
    click: 'relay_click',
    spinStart: 'motor_spin',
    reelTick: 'ratchet_tick',
    reelStop: 'clunk_stop',
    nearMiss: 'motor_groan',
    win: 'bell_coins',
    ldw: 'bell_coins',
    push: 'bell_coins',
    bigWin: 'bell_coins_big',
    jackpot: 'bell_jackpot',
    lose: null,
    deposit: 'register_90s',
    withdraw: 'office_stamp',
    stamp: 'stamp_thud',
    achievement: 'bell_achievement',
    sleep: 'bell_sleep',
    morning: 'bell_alarm',
    bill: 'bill_printer',
    tiltStage: 'clunk_tilt',
    casinoNight: 'sq_casino_night',
    ending: 'soft_ending',
    runStart: 'hall_start'
  },
  streamer: {
    click: 'pop_click',
    spinStart: 'whoosh_spin',
    reelTick: 'pop_tick',
    reelStop: 'boom_stop',
    nearMiss: 'sad_trombone',
    win: 'airhorn',
    ldw: 'airhorn',
    push: 'airhorn',
    bigWin: 'airhorn_big',
    jackpot: 'airhorn_jackpot',
    lose: null,
    deposit: 'kaching_bass',
    withdraw: 'office_stamp',
    stamp: 'stamp_thud',
    achievement: 'sub_alert',
    sleep: 'lofi_sleep',
    morning: 'stream_start',
    bill: 'bill_printer',
    tiltStage: 'growl_tilt',
    casinoNight: 'sq_casino_night',
    ending: 'soft_ending',
    runStart: 'horn_short'
  }
}

function isPackId(id: string): id is SoundPackId {
  return Object.prototype.hasOwnProperty.call(SOUND_PACKS, id)
}

/** `'sound:hall_90s'` | `'hall_90s'` → id пака; неизвестный/пустой → classic. */
export function packIdFromCosmetic(cosmeticId: string | null | undefined): SoundPackId {
  if (!cosmeticId) return DEFAULT_PACK
  const id = cosmeticId.startsWith('sound:') ? cosmeticId.slice('sound:'.length) : cosmeticId
  return isPackId(id) ? id : DEFAULT_PACK
}

const OUTCOMES = new Set<SoundSlot>(OUTCOME_SLOTS)

/** Какой пресет играет слот с учётом пака и режима «Снять очки». */
export function resolvePreset(pack: SoundPackId, slot: SoundSlot, underbelly = false): PresetId | null {
  const source = underbelly && OUTCOMES.has(slot) ? SOUND_PACKS.honest : SOUND_PACKS[pack]
  return source[slot]
}
