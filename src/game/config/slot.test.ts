import { describe, expect, it } from 'vitest'
import { SYMBOL_EMOJI } from '@/skins/classic'
import { enumerateOutcomes, evalReels, expectedRtp, SLOT_V1, slotMetrics, SYMBOL_IDS } from './slot'

describe('config/slot (economy-v1 §2, §14.4)', () => {
  it('RTP аналитически = 656062 / 729000 = 0.89995 ровно', () => {
    expect(expectedRtp(SLOT_V1)).toBe(656062 / 729000)
    expect(expectedRtp(SLOT_V1)).toBeCloseTo(0.89995, 5)
    expect(SLOT_V1.expected.rtpNumerator / SLOT_V1.expected.total).toBe(expectedRtp(SLOT_V1))
  })

  it('таблица outcomes совпадает с перебором барабанов, Σ весов = 90³', () => {
    const enumerated = enumerateOutcomes(SLOT_V1)
    for (const o of SLOT_V1.outcomes) expect(enumerated.get(o.id), o.id).toBe(o.weight)
    expect(SLOT_V1.outcomes.reduce((s, o) => s + o.weight, 0)).toBe(90 ** 3)
    expect(Object.values(SLOT_V1.reelWeights).reduce((s, w) => s + w, 0)).toBe(90)
  })

  it('производные метрики: hit 31.7%, LDW 12.2%, push 7.1%, реальный плюс 12.4%, джекпот 1:1000, тикер 1:7', () => {
    const m = slotMetrics(SLOT_V1)
    expect(m.hit).toBeCloseTo(SLOT_V1.expected.hit, 4)
    expect(m.ldw).toBeCloseTo(SLOT_V1.expected.ldw, 4)
    expect(m.push).toBeCloseTo(SLOT_V1.expected.push, 4)
    expect(m.realWin).toBeCloseTo(SLOT_V1.expected.realWin, 4)
    expect(m.variance).toBeCloseTo(SLOT_V1.expected.variance, 1)
    expect(m.jackpot).toBeCloseTo(0.001, 6)
    expect(m.lossLike).toBeCloseTo(0.8051, 3)
    expect(m.tickerLossesPerWin).toBe(7)
    expect(slotMetrics(SLOT_V1)).toBe(m) // кэш
  })

  it('evalReels: правила по приоритету', () => {
    expect(evalReels(['seven', 'seven', 'seven']).id).toBe('jackpot')
    expect(evalReels(['melon', 'melon', 'melon']).id).toBe('fruit_triple')
    expect(evalReels(['star', 'seven', 'diamond']).id).toBe('premium_mix')
    expect(evalReels(['lemon', 'melon', 'orange']).id).toBe('fruit_mix')
    expect(evalReels(['cherry', 'cherry', 'clown']).id).toBe('two_cherries')
    expect(evalReels(['cherry', 'star', 'clown']).id).toBe('one_cherry')
    expect(evalReels(['clown', 'clown', 'clown']).id).toBe('clown_triple')
    expect(evalReels(['star', 'clown', 'melon']).id).toBe('lose')
    expect(() => evalReels(['star', 'star', 'star'], [])).toThrow()
  })

  it('near-miss раскладка 7-7-X всегда проигрыш', () => {
    const { symbol, thirdFrom } = SLOT_V1.nearMiss
    for (const x of thirdFrom) {
      expect(evalReels([symbol, symbol, x]).id).toBe('lose')
      expect(evalReels([x, symbol, symbol]).id).toBe('lose')
      expect(evalReels([symbol, x, symbol]).id).toBe('lose')
    }
  })

  it('скин покрывает ровно все символы слота', () => {
    expect(Object.keys(SYMBOL_EMOJI).sort()).toEqual([...SYMBOL_IDS].sort())
  })
})
