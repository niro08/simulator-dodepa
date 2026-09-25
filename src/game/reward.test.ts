import { describe, expect, it } from 'vitest'
import { BALANCE } from './config'
import { calculateReward, guaranteedShare, rewardRange } from './reward'
import { createRng } from './rng'

const reward = BALANCE.reward

describe('reward', () => {
  it('диапазон при репутации 0 совпадает с аудитом (подработка 240–359, темка 1200–1799)', () => {
    expect(rewardRange(400, 0, reward)).toEqual([240, 359])
    expect(rewardRange(2000, 0, reward)).toEqual([1200, 1799])
  })

  it('случайные награды лежат в rewardRange', () => {
    const rng = createRng(3)
    for (const rep of [-10, 0, 10, 71, 150]) {
      const [min, max] = rewardRange(500, rep, reward)
      for (let i = 0; i < 2000; i++) {
        const r = calculateReward(500, rep, reward, rng)
        expect(Number.isInteger(r)).toBe(true)
        expect(r).toBeGreaterThanOrEqual(min)
        expect(r).toBeLessThanOrEqual(max)
      }
    }
  })

  it('награда никогда не отрицательная даже при очень низкой репутации (B-05)', () => {
    const rng = createRng(4)
    expect(guaranteedShare(-300, reward)).toBe(0)
    for (let i = 0; i < 1000; i++) expect(calculateReward(2000, -1000, reward, rng)).toBeGreaterThanOrEqual(0)
  })

  it('guaranteedMax ограничивает сверху, если задан', () => {
    expect(guaranteedShare(1000, { ...reward, guaranteedMax: 0.7 })).toBe(0.7)
    expect(guaranteedShare(1000, reward)).toBeGreaterThan(0.7)
  })

  it('бонус за репутацию выше порога', () => {
    const [minLow] = rewardRange(1000, 70, reward)
    const [minHigh] = rewardRange(1000, 71, reward)
    expect(minHigh - minLow).toBeGreaterThanOrEqual(200)
  })
})
