import type { EventOf, GameEvent, TiltStage } from '@/game'
import { SLOT_PRIORITY, type SoundSlot } from './slots'

/**
 * Маппинг доменных событий (systems-spec §1) на слоты звуков. Чистые функции — без Web Audio.
 * Команда может вернуть пачку событий: слоты дедуплицируются, звучат максимум MAX_PER_BATCH
 * самых приоритетных (в исходном порядке), чтобы не было каши.
 */

export const MAX_PER_BATCH = 3

/** Мультипликатор, начиная с которого выигрыш — «крупный». */
export const BIG_WIN_MULT = 10

/** Звук исхода спина. LDW и возврат ставки — свои слоты, но в Витрине они совпадают с выигрышем (packs.ts). */
export function outcomeSlot(spin: Pick<EventOf<'spin'>, 'outcomeId' | 'multiplier' | 'payout' | 'ldw' | 'nearMiss'>): SoundSlot {
  if (spin.outcomeId === 'jackpot') return 'jackpot'
  if (spin.payout <= 0) return spin.nearMiss ? 'nearMiss' : 'lose'
  if (spin.ldw || spin.multiplier < 1) return 'ldw'
  if (spin.multiplier === 1) return 'push'
  if (spin.multiplier >= BIG_WIN_MULT) return 'bigWin'
  return 'win'
}

const STAGE_RANK: Record<TiltStage, number> = { calm: 0, heated: 1, tilt: 2, night: 3 }

/** Слот одного события или null (событие молчит). */
export function eventSlot(event: GameEvent): SoundSlot | null {
  switch (event.type) {
    case 'spin':
      return outcomeSlot(event)
    case 'deposit':
      return 'deposit'
    case 'withdrawRequested':
      return 'withdraw'
    case 'withdrawPaid':
    case 'billPaid':
    case 'billDeferred':
    case 'loanTaken':
    case 'itemPawned':
    case 'bonusBusted':
      return 'stamp'
    case 'billsOpened':
      return 'bill'
    case 'achievementUnlocked':
      return 'achievement'
    case 'slept':
      return 'sleep'
    case 'dayStarted':
      // Утро дня 1 приходит вместе с новым раном — его озвучивает джингл старта (useSound.playStart)
      return event.day > 1 ? 'morning' : null
    case 'casinoNight':
      return 'casinoNight'
    case 'tiltStageChanged':
      // «Ночь» озвучивает casinoNight; спуск стадии — без звука
      return event.to !== 'night' && STAGE_RANK[event.to] > STAGE_RANK[event.from] ? 'tiltStage' : null
    case 'runEnded':
      return event.endingId === 'abandoned' ? null : 'ending'
    default:
      return null
  }
}

/** Слоты для пачки событий: без дублей, ≤ MAX_PER_BATCH самых важных, порядок событий сохранён. */
export function slotsForEvents(events: readonly GameEvent[], max = MAX_PER_BATCH): SoundSlot[] {
  const unique: SoundSlot[] = []
  for (const e of events) {
    const slot = eventSlot(e)
    if (slot && !unique.includes(slot)) unique.push(slot)
  }
  if (unique.length <= max) return unique
  const keep = new Set([...unique].sort((a, b) => SLOT_PRIORITY[b] - SLOT_PRIORITY[a]).slice(0, max))
  return unique.filter((s) => keep.has(s))
}
