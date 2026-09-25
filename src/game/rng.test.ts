import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('rng', () => {
  it('одинаковый seed → одинаковая последовательность', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 100 }, () => a.next())
    const seqB = Array.from({ length: 100 }, () => b.next())
    expect(seqA).toEqual(seqB)
    expect(createRng(43).next()).not.toBe(seqA[0])
  })

  it('state() восстанавливает последовательность', () => {
    const a = createRng(7)
    a.next()
    a.next()
    const b = createRng(a.state())
    expect(Array.from({ length: 10 }, () => a.next())).toEqual(Array.from({ length: 10 }, () => b.next()))
  })

  it('next() в [0, 1), int() в границах включительно', () => {
    const rng = createRng(1)
    const seen = new Set<number>()
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next()
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      const n = rng.int(3, 7)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(7)
      seen.add(n)
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7])
  })

  it('распределение next() в 10 бакетах ±2% на 10⁵ выборках', () => {
    const rng = createRng(2024)
    const buckets = new Array<number>(10).fill(0)
    const n = 100_000
    for (let i = 0; i < n; i++) buckets[Math.floor(rng.next() * 10)]! += 1
    for (const count of buckets) expect(Math.abs(count / n - 0.1)).toBeLessThan(0.02)
  })

  it('pick() берёт элементы массива и падает на пустом', () => {
    const rng = createRng(5)
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items))
    expect(() => rng.pick([])).toThrow()
  })
})
