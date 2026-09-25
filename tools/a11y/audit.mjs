/**
 * CD-21: браузерный аудит доступности (Playwright + axe-core). Не входит в npm test.
 * Запуск: собрать и поднять превью (npx vite preview --port 5287), затем
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PW_MODULE=/opt/node22/lib/node_modules/playwright \
 *   AXE_JS=<путь к axe-core/axe.min.js> OUT=/tmp/a11y.json node tools/a11y/{audit,ringall,izn}.mjs
 * audit.mjs  — axe (WCAG 2.1 AA + best-practice), горизонтальный скролл, таргеты < 44px, заголовки,
 *              обход Tab, live-регионы при спине, AudioContext до жеста, анимации (Гц) в обычном/calm/reduced-motion.
 * ringall.mjs — контраст кольца фокуса (≥ 3:1) у каждого фокусируемого элемента во всех темах и в Изнанке.
 * izn.mjs    — эффективный контраст текста внутри .vitrina под фильтром Изнанки.
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || 'playwright')
const axeSrc = fs.readFileSync(process.env.AXE_JS || 'node_modules/axe-core/axe.min.js', 'utf8')
const URL = process.env.URL || (process.env.URL || 'http://localhost:5287/simulator-dodepa/')
const ONLY = process.env.ONLY?.split(',')
const out = { axe: {}, overflow: {}, taps: {}, anims: {}, focus: {}, audio: {}, headings: {}, live: {}, misc: [] }

const initAudio = () => {
  window.__audioLog = []
  const Orig = window.AudioContext
  if (Orig) {
    window.AudioContext = class extends Orig {
      constructor(...a) { super(...a); window.__audioLog.push({ t: 'ctx', gesture: navigator.userActivation?.hasBeenActive, state: this.state }) }
    }
  }
  const play = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function () { window.__audioLog.push({ t: 'play', src: this.src, gesture: navigator.userActivation?.hasBeenActive }); return play.call(this) }
}

async function axe(page, label, opts = {}) {
  await page.evaluate(axeSrc)
  const res = await page.evaluate(async (o) => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: o.tags || ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, rules: { region: { enabled: false } } })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, nodes: v.nodes.slice(0, 6).map((n) => n.target.join(' ') + (n.any[0]?.message ? ' :: ' + n.any[0].message.slice(0, 140) : '')) }))
  }, opts)
  out.axe[label] = res
}
async function layout(page, label) {
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth
    const over = document.documentElement.scrollWidth > vw + 1
    const wide = []
    if (over) for (const el of document.querySelectorAll('body *')) { const b = el.getBoundingClientRect(); if (b.right > vw + 1 && b.width > 0 && getComputedStyle(el).position !== 'fixed') wide.push((el.className?.toString?.() || el.tagName).slice(0, 60) + ' r=' + Math.round(b.right)) }
    const small = []
    for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"], [role="tab"], [role="switch"], summary, [tabindex="0"]')) {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue
      if (el.classList.contains('skip-link')) continue
      if (b.width < 44 || b.height < 44) small.push(`${el.tagName.toLowerCase()}.${(el.className?.toString?.() || '').split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}${el.type === 'range' || el.type === 'checkbox' ? ' ['+el.type+']' : ''}`)
    }
    const heads = [...document.querySelectorAll('h1,h2,h3,[role="heading"]')].filter((h) => h.getClientRects().length).map((h) => h.tagName + ':' + h.textContent.trim().slice(0, 40))
    return { over, sw: document.documentElement.scrollWidth, vw, wide: wide.slice(0, 8), small: [...new Set(small)], heads }
  })
  out.overflow[label] = r.over ? { sw: r.sw, vw: r.vw, wide: r.wide } : false
  out.taps[label] = r.small
  out.headings[label] = r.heads
}
async function anims(page, label) {
  out.anims[label] = await page.evaluate(() => document.getAnimations().map((a) => {
    const t = a.effect?.getComputedTiming?.() || {}
    const tg = a.effect?.target
    const name = a.animationName || a.transitionProperty || 'js'
    const d = Number(t.duration) || 0
    return { name, dur: Math.round(d), it: t.iterations, dir: t.direction, hz: d ? +(1000 / d).toFixed(2) : null, state: a.playState, target: tg ? (tg.className?.toString?.() || tg.tagName).slice(0, 50) + (a.effect.pseudoElement || '') : '' }
  }).filter((a) => a.state === 'running'))
}
async function tabWalk(page, label, n = 25) {
  const seq = []
  await page.evaluate(() => document.activeElement?.blur?.())
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    seq.push(await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return 'BODY'
      const cs = getComputedStyle(el)
      const vis = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || /rgb/.test(cs.boxShadow) && cs.boxShadow !== 'none'
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 28)
      return `${vis ? '' : '!NOFOCUSRING '}${el.tagName.toLowerCase()} "${name}"`
    }))
  }
  out.focus[label] = seq
}
const store = (page) => page.evaluateHandle(() => document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('game'))

async function run(ctxOpts, tag, fn) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext(ctxOpts)
  await ctx.addInitScript(initAudio)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => out.misc.push(`${tag} pageerror: ${e.message}`))
  await page.goto(URL); await page.waitForSelector('.menu')
  await page.waitForTimeout(400)
  try { await fn(page) } catch (e) { out.misc.push(`${tag} ERROR ${e.stack.slice(0, 400)}`) }
  await browser.close()
}

const desktop = { viewport: { width: 1280, height: 900 } }
const mobile = { viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }

async function toGame(page) {
  await page.getByRole('button', { name: /Новый ран|новый/i }).first().click()
  await page.waitForTimeout(900)
}
async function phaseTo(page, want) {
  await page.evaluate((want) => {
    const g = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('game')
    for (let i = 0; i < 400 && g.phase !== want && g.phase !== 'ended'; i++) {
      const p = g.phase
      if (p === 'day') g.execute({ type: 'day/sleep' })
      else if (p === 'event') { const o = g.pendingEvent?.options?.findIndex((x) => x.affordable); g.execute({ type: 'event/choose', option: Math.max(0, o ?? 0) }) }
      else if (p === 'daySummary' || p === 'morning' || p === 'night') g.execute({ type: 'day/wake' })
      else if (p === 'bills') g.execute({ type: 'bills/refuse' }) || g.execute({ type: 'bills/pay' })
      else if (p === 'fork') g.execute({ type: 'run/quit' }) || g.execute({ type: 'run/extend' })
      g.revealPending?.()
    }
  }, want)
  await page.waitForTimeout(600)
}

const scen = {
  async desktop(page) {
    for (const th of ['monday', 'mirror47', 'stream']) { await page.evaluate((t) => (document.documentElement.dataset.theme = t), th); await page.waitForTimeout(150); await axe(page, `D menu ${th}`, { tags: ['wcag2aa'] }) }
    await page.evaluate(() => (document.documentElement.dataset.theme = 'neon'))
    await layout(page, 'D menu'); await axe(page, 'D menu'); await anims(page, 'D menu'); await tabWalk(page, 'D menu', 12)
    out.audio['D menu before gesture'] = await page.evaluate(() => window.__audioLog.slice())
    await page.getByRole('button', { name: 'Настройки' }).click(); await page.waitForTimeout(400)
    await layout(page, 'D settings'); await axe(page, 'D settings'); await tabWalk(page, 'D settings', 20)
    await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    out.misc.push('D after Esc settings: focus=' + await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30)))
    await page.keyboard.press('F1'); await page.waitForTimeout(400)
    await axe(page, 'D howto'); await layout(page, 'D howto'); await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    for (const [btn, lbl] of [['Гардероб', 'wardrobe'], ['Достижения', 'achievements'], ['Концовки', 'endings']]) {
      await page.getByRole('button', { name: new RegExp(btn) }).first().click(); await page.waitForTimeout(500)
      await layout(page, 'D ' + lbl); await axe(page, 'D ' + lbl); await anims(page, 'D ' + lbl); await tabWalk(page, 'D ' + lbl, 12)
      await page.keyboard.press('Escape'); await page.waitForTimeout(400)
    }
    await toGame(page)
    out.misc.push('D game initial focus: ' + await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 120)))
    await layout(page, 'D game'); await axe(page, 'D game'); await anims(page, 'D game'); await tabWalk(page, 'D game', 40)
    out.live['D game'] = await page.evaluate(() => [...document.querySelectorAll('[aria-live],[role=status],[role=alert],[role=log]')].map((e) => `${e.tagName}.${e.className.toString().split(' ')[0]} live=${e.getAttribute('aria-live') || e.getAttribute('role')} atomic=${e.getAttribute('aria-atomic')} text="${e.textContent.trim().slice(0, 50)}"`))
    // Спин: считаем мутации в live-регионах
    await page.evaluate(() => {
      window.__liveMut = []
      const mo = new MutationObserver((ms) => { for (const m of ms) { const el = m.target.nodeType === 1 ? m.target : m.target.parentElement; const lr = el?.closest('[aria-live],[role=status],[role=alert],[role=log]'); if (lr && lr.getAttribute('aria-live') !== 'off') window.__liveMut.push((lr.className.toString().split(' ')[0]) + ': ' + lr.textContent.trim().slice(0, 60)) } })
      mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    })
    await page.keyboard.press('KeyD'); await page.waitForTimeout(500)
    await layout(page, 'D cashier'); await axe(page, 'D cashier'); await tabWalk(page, 'D cashier', 14)
    // хоткеи в поле ввода
    const inp = page.locator('[role=dialog] input').first()
    if (await inp.count()) { await inp.focus(); await page.keyboard.press('KeyI'); await page.keyboard.press('KeyM'); out.misc.push('D typing I/M in cashier input: layer=' + await page.evaluate(() => document.documentElement.dataset.layer) + ' value=' + await inp.inputValue()) }
    const closeAll = async () => { for (let i = 0; i < 4 && (await page.locator('[role=dialog]').count()); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300) } }
    await closeAll()
    await page.evaluate(() => { const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('game'); s.execute({ type: 'casino/enter' }); s.execute({ type: 'casino/deposit', amount: 1000, bonus: false }) })
    await page.waitForTimeout(300); await closeAll()
    await page.evaluate(() => document.activeElement?.blur())
    await page.evaluate(() => (window.__liveMut = []))
    await page.keyboard.press('Space'); await page.waitForTimeout(200); await anims(page, 'D spinning'); await page.waitForTimeout(2600)
    out.live['D spin mutations'] = await page.evaluate(() => window.__liveMut.slice(0, 40))
    out.live['D regions after'] = await page.evaluate(() => [...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].map((e) => `${e.tagName}.${e.className.toString().split(' ')[0]} ${e.getAttribute('role') || ''} live=${e.getAttribute('aria-live')} "${e.textContent.trim().slice(0, 60)}"`))
    out.audio['D after gestures'] = await page.evaluate(() => window.__audioLog.slice())
    await page.evaluate(() => document.activeElement?.blur())
    await page.keyboard.press('KeyI'); await page.waitForTimeout(500)
    out.misc.push('layer after I: ' + await page.evaluate(() => document.documentElement.dataset.layer))
    await layout(page, 'D iznanka'); await axe(page, 'D iznanka'); await anims(page, 'D iznanka'); await tabWalk(page, 'D iznanka', 30)
    await page.keyboard.press('KeyI'); await page.waitForTimeout(300)
    await page.keyboard.press('Escape'); await page.waitForTimeout(400)
    out.misc.push('pause dialogs: ' + await page.locator('[role=dialog]').count())
    await axe(page, 'D pause'); await tabWalk(page, 'D pause', 8)
    await page.getByRole('button', { name: 'Настройки' }).click(); await page.waitForTimeout(400)
    await tabWalk(page, 'D pause>settings', 10)
    await closeAll()
    for (const th of ['monday', 'mirror47', 'stream']) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), th); await page.waitForTimeout(200)
      await axe(page, `D game ${th}`, { tags: ['wcag2aa'] })
      await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('KeyI'); await page.waitForTimeout(300)
      await axe(page, `D iznanka ${th}`, { tags: ['wcag2aa'] })
      await page.keyboard.press('KeyI'); await page.waitForTimeout(200)
    }
    await page.evaluate(() => (document.documentElement.dataset.theme = 'neon'))
    await phaseTo(page, 'daySummary'); await axe(page, 'D daySummary'); await layout(page, 'D daySummary')
    await phaseTo(page, 'event'); await axe(page, 'D event'); await layout(page, 'D event')
    await phaseTo(page, 'bills'); await axe(page, 'D bills'); await layout(page, 'D bills')
    await phaseTo(page, 'fork'); await axe(page, 'D fork'); await layout(page, 'D fork')
    await phaseTo(page, 'ended'); await page.waitForTimeout(500)
    await axe(page, 'D ending'); await layout(page, 'D ending'); await tabWalk(page, 'D ending', 6); await anims(page, 'D ending')
    const st = page.getByRole('button', { name: /выписк/i }).first(); if (await st.count()) { await st.click(); await page.waitForTimeout(800); await axe(page, 'D statement'); await layout(page, 'D statement') }
  },
  async mobile(page) {
    await layout(page, 'M menu'); await axe(page, 'M menu', { tags: ['wcag2aa'] })
    await page.getByRole('button', { name: 'Настройки' }).click(); await page.waitForTimeout(400); await layout(page, 'M settings'); await page.keyboard.press('Escape'); await page.waitForTimeout(300)
    for (const [btn, lbl] of [['Гардероб', 'wardrobe'], ['Достижения', 'achievements'], ['Концовки', 'endings']]) {
      await page.getByRole('button', { name: new RegExp(btn) }).first().click(); await page.waitForTimeout(500)
      await layout(page, 'M ' + lbl); await page.keyboard.press('Escape'); await page.waitForTimeout(400)
    }
    await toGame(page); await layout(page, 'M game'); await axe(page, 'M game', { tags: ['wcag2aa'] })
    for (const t of ['Жизнь', 'Изнанка']) { const b = page.locator('.gs-tabs__tab', { hasText: t }); if (await b.count()) { await b.click(); await page.waitForTimeout(400); await layout(page, 'M tab ' + t) } }
    await page.locator('.gs-tabs__tab', { hasText: 'Казино' }).click().catch(() => {}); await page.waitForTimeout(300)
    await page.keyboard.press('KeyD'); await page.waitForTimeout(500); await layout(page, 'M cashier'); await page.keyboard.press('Escape')
    await phaseTo(page, 'ended'); await layout(page, 'M ending')
  },
  async calm(page) {
    await toGame(page); await page.waitForTimeout(500); await anims(page, 'calm(reduced-motion) game')
    await page.keyboard.press('KeyI'); await page.waitForTimeout(300); await anims(page, 'calm iznanka'); await page.keyboard.press('KeyI')
    await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Space'); await page.waitForTimeout(150); await anims(page, 'calm spinning')
    out.misc.push('calm html class: ' + await page.evaluate(() => document.documentElement.className))
  },
  async calmSetting(page) {
    await page.evaluate(() => localStorage.setItem('dodepa.ui', JSON.stringify({ calm: true }))); await page.reload(); await page.waitForSelector('.menu')
    await anims(page, 'calmSetting menu'); await toGame(page); await page.waitForTimeout(500); await anims(page, 'calmSetting game')
  },
}
const jobs = [['desktop', desktop], ['mobile', mobile], ['calm', { ...desktop, reducedMotion: 'reduce' }], ['calmSetting', desktop]]
for (const [k, o] of jobs) if (!ONLY || ONLY.includes(k)) await run(o, k, scen[k])
fs.writeFileSync(process.env.OUT || 'a11y-result.json', JSON.stringify(out, null, 1))
console.log('done')
