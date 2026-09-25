/**
 * Слоты звуков (systems-spec §5.4 + расширение CD-20). Пак = Record<SoundSlot, PresetId | null>.
 * null — тишина (например, проигрыш в Витрине: казино проигрыш не озвучивает).
 */
export const SOUND_SLOTS = [
  'click',
  'spinStart',
  'reelTick',
  'reelStop',
  'nearMiss',
  'win',
  'ldw',
  'push',
  'bigWin',
  'jackpot',
  'lose',
  'deposit',
  'withdraw',
  'stamp',
  'achievement',
  'sleep',
  'morning',
  'bill',
  'tiltStage',
  'casinoNight',
  'ending',
  'runStart'
] as const

export type SoundSlot = (typeof SOUND_SLOTS)[number]

/** Исходы спина. В режиме «Снять очки» они всегда играются из `sound:honest` (systems-spec §5.4). */
export const OUTCOME_SLOTS: readonly SoundSlot[] = ['nearMiss', 'win', 'ldw', 'push', 'bigWin', 'jackpot', 'lose']

/** Приоритет при отсечении: команда может породить много событий, звучат максимум 3 самых важных. */
export const SLOT_PRIORITY: Readonly<Record<SoundSlot, number>> = {
  click: 0,
  reelTick: 0,
  spinStart: 1,
  reelStop: 1,
  stamp: 2,
  bill: 3,
  tiltStage: 3,
  sleep: 4,
  morning: 4,
  deposit: 5,
  withdraw: 5,
  lose: 5,
  push: 6,
  ldw: 6,
  win: 6,
  nearMiss: 6,
  bigWin: 7,
  achievement: 7,
  runStart: 7,
  casinoNight: 8,
  jackpot: 9,
  ending: 10
}
