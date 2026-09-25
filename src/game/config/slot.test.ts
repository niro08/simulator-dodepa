import { describe, expect, it } from 'vitest'
import { SLOT, SYMBOL_IDS, expectedRtp, outcomeProbability, winProbability } from './slot'
import { SYMBOL_EMOJI } from '@/skins/classic'

describe('config/slot', () => {
  it('RTP текущего баланса = 0.34 (до правок economy-designer)', () => {
    expect(expectedRtp(SLOT)).toBeCloseTo(0.34, 10)
  })

  it('шанс выигрыша 10%, джекпота 1%', () => {
    expect(winProbability(SLOT)).toBeCloseTo(0.1, 10)
    expect(outcomeProbability(SLOT, 'jackpot')).toBeCloseTo(0.01, 10)
    expect(outcomeProbability(SLOT, 'нет-такого')).toBe(0)
  })

  it('символы исходов входят в набор символов слота', () => {
    for (const outcome of SLOT.outcomes) {
      for (const symbol of ('symbols' in outcome ? outcome.symbols : [])) expect(SYMBOL_IDS).toContain(symbol)
    }
  })

  it('скин покрывает ровно все символы слота', () => {
    expect(Object.keys(SYMBOL_EMOJI).sort()).toEqual([...SYMBOL_IDS].sort())
  })

  it('пустая таблица исходов не ломает расчёты', () => {
    const empty = { ...SLOT, outcomes: [] }
    expect(expectedRtp(empty)).toBe(0)
    expect(winProbability(empty)).toBe(0)
  })
})
