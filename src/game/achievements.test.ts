import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_TEXTS, COSMETIC_NAMES } from '@/i18n'
import { skinSymbols } from '@/skins'
import { ACHIEVEMENTS, COSMETICS, defaultConfig, SYMBOL_IDS } from './config'
import { catalogIds, equipCosmetic, equippedCosmetics, ownedCosmetics } from './cosmetics'
import { buildAchievementsView, buildCosmeticsView, buildEndingsCollection, buildProfileStats } from './meta'
import { abandonRun, applyProgress, evaluateAchievements, reconcileAchievements } from './progress'
import { ENDING_IDS } from './rules'
import { createDefaultProfile } from './save/schema'
import { playRun, STRATEGIES } from './strategies'
import { exec, newSession } from './testing'
import type { EndingId, EventOf, GameEvent, Profile } from './types'

const config = defaultConfig
const active = ACHIEVEMENTS.filter((a) => a.enabled !== false)

function runEnded(endingId: EndingId | 'abandoned'): EventOf<'runEnded'> {
  return {
    type: 'runEnded',
    endingId,
    grade: endingId === 'quit' ? 'A' : null,
    day: 28,
    weeksSurvived: 3,
    forfeitedCasino: 0,
    forfeitedWithdrawals: 0,
    itemsLost: []
  }
}

const unlockedIds = (events: readonly GameEvent[]) =>
  events.filter((e): e is EventOf<'achievementUnlocked'> => e.type === 'achievementUnlocked').map((e) => e.id)

describe('CD-13: данные достижений', () => {
  it('31 активная ачивка (systems-spec §4) + 2 резерва P1; id под Steam; тексты и награды есть', () => {
    expect(active).toHaveLength(31)
    expect(ACHIEVEMENTS.filter((a) => a.enabled === false).map((a) => a.id)).toEqual(['BOTTOM_BREACHED', 'ETERNAL_DODEP'])
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    const catalog = new Set<string>(catalogIds(COSMETICS))
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toMatch(/^[A-Z][A-Z0-9_]*$/)
      for (const r of a.rewards) expect(catalog.has(r), `${a.id} → ${r}`).toBe(true)
    }
    for (const a of active) expect(ACHIEVEMENT_TEXTS[a.id]?.title, a.id).toMatch(/\S/)
    expect(active.filter((a) => a.hidden).map((a) => a.id)).toEqual(['JACKPOT_THEN_ZERO', 'TIMER_LIES', 'ENDING_REFERRAL'])
    // У каждой концовки — своя ачивка
    for (const id of ENDING_IDS) expect(active.some((a) => a.condition.kind === 'ending' && a.condition.ending === id), id).toBe(true)
  })
})

describe('CD-13: движок (сид-сценарии)', () => {
  it('CLEAN_WEEK и ENDING_QUIT на честном ране; награды → косметика во владении и «новое»', () => {
    const { session, outcome } = playRun(STRATEGIES.honest, 3, config, true)
    expect(outcome).toBe('quit')
    expect(session.profile.achievements).toHaveProperty('CLEAN_WEEK')
    expect(session.profile.achievements).toHaveProperty('ENDING_QUIT')
    expect(session.profile.achievements.ENDING_QUIT?.runId).toBe(session.run.id)
    const owned = ownedCosmetics(session.profile, config)
    expect(owned).toEqual(expect.arrayContaining(['skin:garden', 'skin:grey_reality', 'theme:monday', 'sound:honest']))
    expect(session.profile.unseenCosmetics).toEqual(expect.arrayContaining(['skin:garden', 'theme:monday']))
    // Ачивка — в хронике рана и в событиях сессии ровно один раз
    expect(unlockedIds(session.events).filter((id) => id === 'CLEAN_WEEK')).toHaveLength(1)
  })

  it('VETERAN_500 и VALUED_CUSTOMER копятся за несколько ранов (lifetime)', () => {
    let profile: Profile = createDefaultProfile()
    let runs = 0
    for (let seed = 1; seed <= 60 && !profile.achievements.VALUED_CUSTOMER; seed++) {
      profile = playRun(STRATEGIES.ludoman, seed, config, true, profile).session.profile
      runs += 1
      if (profile.stats.spins! < 500) expect(profile.achievements.VETERAN_500).toBeUndefined()
    }
    expect(profile.stats.spins).toBeGreaterThanOrEqual(500)
    expect(profile.achievements).toHaveProperty('VETERAN_500')
    expect(profile.achievements).toHaveProperty('VALUED_CUSTOMER')
    expect(profile.stats.netLossPeak).toBeGreaterThanOrEqual(100_000)
    expect(runs).toBeGreaterThan(1)
    expect(ownedCosmetics(profile, config)).toEqual(expect.arrayContaining(['skin:bandit_90s', 'sound:hall_90s', 'skin:gold_vip']))
  }, 60_000)

  it('ALL_ENDINGS: седьмая концовка открывает «Коллекционер дна»', () => {
    let profile = createDefaultProfile()
    const s = newSession(1, config)
    const got: string[] = []
    for (const id of ENDING_IDS) {
      const next = applyProgress(s.run, profile, [runEnded(id)], config, 1)
      profile = next.profile
      got.push(...unlockedIds(next.events))
    }
    expect(got).toContain('ALL_ENDINGS')
    expect(got.indexOf('ALL_ENDINGS')).toBe(got.length - 1)
    expect(got).toEqual(expect.arrayContaining(['ENDING_JAIL', 'ENDING_LOST_WEEK', 'ENDING_REFERRAL', 'ENDING_QUIT']))
    expect(buildEndingsCollection(profile, config).every((e) => e.unlocked && e.achievementId)).toBe(true)
    expect(ownedCosmetics(profile, config)).toContain('title:all_bottoms')
  })

  it('идемпотентность: повтор условий не открывает второй раз; брошенный ран ачивок концовок не даёт', () => {
    const s = newSession(2, config)
    exec(s, { type: 'casino/enter' })
    exec(s, { type: 'casino/deposit', amount: 500, bonus: false })
    exec(s, { type: 'casino/deposit', amount: 100 })
    expect(unlockedIds(s.events)).toEqual(['FIRST_DEPOSIT'])
    const again = applyProgress(s.run, s.profile, [{ type: 'deposit', amount: 100 }], config, 5)
    expect(again.events).toEqual([])
    expect(again.profile.achievements.FIRST_DEPOSIT).toEqual(s.profile.achievements.FIRST_DEPOSIT)
    expect(evaluateAchievements(s.run, s.profile, [], config)).toEqual([])
    const abandoned = abandonRun(s.run, s.profile, config, 9)
    expect(Object.keys(abandoned.achievements).filter((id) => id.startsWith('ENDING_'))).toEqual([])
  })

  it('событийные: BEGINNERS_LUCK, JACKPOT_THEN_ZERO, ALL_IN_5000, PAWN_ALL; P1 выключены', () => {
    const s = newSession(1, config)
    const spin = (over: Partial<EventOf<'spin'>>): EventOf<'spin'> => ({
      type: 'spin',
      bet: 100,
      outcomeId: 'premium_mix',
      multiplier: 2,
      payout: 200,
      reels: ['star', 'diamond', 'seven'],
      ldw: false,
      nearMiss: false,
      allIn: false,
      energyCost: 2,
      tiltBefore: 0,
      casinoBefore: 1000,
      casinoAfter: 1100,
      bonusLocked: false,
      loseStreak: 0,
      ...over
    })
    const first = applyProgress(s.run, s.profile, [spin({})], config)
    expect(unlockedIds(first.events)).toContain('BEGINNERS_LUCK')
    const second = applyProgress(first.run, createDefaultProfile(), [spin({})], config)
    expect(unlockedIds(second.events)).not.toContain('BEGINNERS_LUCK')

    const jackpotRun = { ...s.run, jackpotToday: true, peakCasino: 20_000 }
    const zero = applyProgress(jackpotRun, createDefaultProfile(), [spin({ multiplier: 0, payout: 0, casinoAfter: 0 })], config)
    expect(unlockedIds(zero.events)).toContain('JACKPOT_THEN_ZERO')
    expect(unlockedIds(zero.events)).not.toContain('BOTTOM_BREACHED')

    const allIn = applyProgress(s.run, createDefaultProfile(), [spin({ allIn: true, bet: 5000, casinoBefore: 5000 })], config)
    expect(unlockedIds(allIn.events)).toContain('ALL_IN_5000')

    const pawned = applyProgress(s.run, createDefaultProfile(), [{ type: 'itemPawned', itemId: 'laptop', amount: 6000, ownedLeft: 0 }], config)
    expect(unlockedIds(pawned.events)).toEqual(['PAWN_ALL'])
  })

  it('TIMER_LIES и INSIGHT — от мета-событий UI; reconcile догоняет старый сейв', () => {
    const s = newSession(1, config)
    const t = applyProgress(s.run, s.profile, [{ type: 'fakeTimerExpired' }], config)
    expect(unlockedIds(t.events)).toEqual(['TIMER_LIES'])
    const u = applyProgress(s.run, s.profile, [{ type: 'timeTracked', playSec: 0, underbellySec: 300 }], config)
    expect(unlockedIds(u.events)).toEqual(['INSIGHT'])
    const old: Profile = { ...createDefaultProfile(), stats: { spins: 600, deposits: 3 } }
    const rec = reconcileAchievements(old, config, 7)
    expect(unlockedIds(rec.events).sort()).toEqual(['FIRST_DEPOSIT', 'VETERAN_500'])
    expect(rec.profile.achievements.VETERAN_500).toEqual({ unlockedAt: 7, runId: null })
  })
})

describe('CD-13: геттеры Коллекции и профиля', () => {
  it('скрытые закрытые — secret без прогресса; stat — полоска; профиль считает раны и ачивки', () => {
    const profile: Profile = { ...createDefaultProfile(), stats: { spins: 120, runsStarted: 3, runsFinished: 2 }, endings: { quit: { count: 1, firstAt: 1, bestGrade: 'B' } } }
    const view = buildAchievementsView(profile, config)
    expect(view).toHaveLength(31)
    expect(view.find((a) => a.id === 'TIMER_LIES')).toMatchObject({ secret: true, progress: null, unlocked: false })
    expect(view.find((a) => a.id === 'VETERAN_500')?.progress).toEqual({ current: 120, target: 500, scope: 'lifetime' })
    expect(view.find((a) => a.id === 'ALL_ENDINGS')?.progress).toEqual({ current: 1, target: 7, scope: 'lifetime' })
    const stats = buildProfileStats(profile, config)
    expect(stats).toMatchObject({ runsStarted: 3, runsFinished: 2, quitRate: 0.5, endingsFound: 1, spins: 120 })
  })
})

describe('CD-19: косметика (логика)', () => {
  it('каталог: 9 скинов × 8 символов, 4 темы = tokens.css, 4 звук-пака, 10 титулов', () => {
    expect(COSMETICS.skins).toHaveLength(9)
    for (const skin of COSMETICS.skins) {
      expect(skin.symbols, skin.id).toHaveLength(SYMBOL_IDS.length)
      expect(skin.stopStaggerMs).toBeGreaterThanOrEqual(80)
      expect(skin.stopStaggerMs).toBeLessThanOrEqual(200)
      const mapped = skinSymbols(skin.id)
      for (const id of SYMBOL_IDS) expect(mapped[id], `${skin.id}.${id}`).toMatch(/\S/)
    }
    expect(skinSymbols('skin:fruit')).toMatchObject({ cherry: '🍒', seven: '7️⃣', clown: '🤡' })
    const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf-8')
    const cssThemes = [...css.matchAll(/\[data-theme="([\w-]+)"\]\s*\{/g)].map((m) => m[1])
    expect(COSMETICS.themes.map((t) => t.id).sort()).toEqual([...new Set(cssThemes)].sort())
    expect(COSMETICS.sounds).toHaveLength(4)
    expect(COSMETICS.titles).toHaveLength(10)
    for (const id of catalogIds(COSMETICS)) expect(COSMETIC_NAMES[id], id).toMatch(/\S/)
  })

  it('косметика и ачивки не импортируют слот (economy §12: не влияют на исход)', () => {
    for (const file of ['./config/cosmetics.ts', './config/achievements.ts', './cosmetics.ts', './meta.ts']) {
      const code = readFileSync(new URL(file, import.meta.url), 'utf-8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/from ['"][./]*(config\/)?slot['"]/)
      expect(code, file).not.toMatch(/resolveSpin/)
    }
  })

  it('владение из ачивок, equip с проверками, умолчания при битом сейве', () => {
    const base = createDefaultProfile()
    expect(ownedCosmetics(base, config)).toEqual(['skin:fruit', 'theme:neon', 'sound:classic', 'title:client'])
    expect(equipCosmetic(base, 'skin:clown', config)).toEqual({ ok: false, reason: 'not_owned' })
    expect(equipCosmetic(base, 'hat:top', config)).toEqual({ ok: false, reason: 'unknown_cosmetic' })
    const withTilt: Profile = { ...base, achievements: { TILT_100: { unlockedAt: 1, runId: null } }, unseenCosmetics: ['skin:clown'] }
    const equipped = equipCosmetic(withTilt, 'skin:clown', config)
    expect(equipped.ok).toBe(true)
    if (!equipped.ok) return
    expect(equippedCosmetics(equipped.profile, config).skin).toBe('skin:clown')
    expect(equipped.profile.unseenCosmetics).toEqual([])
    // Чужое/не принадлежащее в сейве → умолчание
    const broken: Profile = { ...base, equipped: { skin: 'skin:clown', theme: 'sound:honest', title: 'title:newbie' } }
    expect(equippedCosmetics(broken, config)).toEqual(config.cosmetics.defaults)
    const view = buildCosmeticsView(withTilt, config)
    expect(view.items.find((i) => i.id === 'skin:clown')).toMatchObject({ owned: true, unseen: true, unlockedBy: [{ id: 'TILT_100', hidden: false }] })
    expect(view.items.find((i) => i.id === 'theme:stream')).toMatchObject({ owned: false, unlockedBy: [{ id: 'ENDING_REFERRAL', hidden: true }] })
  })
})
