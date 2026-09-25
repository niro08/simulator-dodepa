/** Процедурный звук (CD-20): Web Audio без файлов. Фасад для UI — composables/useSound.ts. */
export { SfxEngine, defaultContextFactory, DEFAULT_MAX_VOICES, type EngineOptions, type PlayOptions } from './engine'
export { SoundDirector, UNDERBELLY_GAIN, BATCH_STAGGER, type SoundContext } from './director'
export { SOUND_PACKS, DEFAULT_PACK, packIdFromCosmetic, resolvePreset, type SoundPack, type SoundPackId } from './packs'
export { PRESETS, presetDuration, shiftPreset, type Note, type Preset, type PresetId } from './presets'
export { eventSlot, outcomeSlot, slotsForEvents, BIG_WIN_MULT, MAX_PER_BATCH } from './events'
export { SOUND_SLOTS, OUTCOME_SLOTS, SLOT_PRIORITY, type SoundSlot } from './slots'
