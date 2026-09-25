#!/usr/bin/env node
// Монте-Карло симулятор экономики «Симулятор Додепа» (CD-02, economy-v1).
// Запуск:  node tools/balance-sim/sim.mjs [--runs 20000] [--seed 1] [--only honest,ludoman] [--json]
// Без зависимостей (Node ≥ 18). Правила — design/gdd-run-structure.md (§3–§4), числа — design/economy-v1.md.
// Ключи CFG совпадают с GDD §7 → src/game/config/balance.ts. Меняешь число здесь — меняй и в economy-v1.md.

// ───────────────────────────── CONFIG (зеркало balance.ts) ─────────────────────────────
export const CFG = {
  RUN_DAYS: 28, ENERGY_PER_DAY: 100,
  START_WALLET: 1000, START_REP: 10, START_BET: 100,
  LIVING_COST: 300,
  BILLS: [3500, 5500, 7500, 10000], BILL_DEBT_SHARE: 0.10,
  GRACE_PER_RUN: 1, GRACE_PENALTY: 0.5, ENDLESS_BILL_GROWTH: 1.35,
  MIN_BET: 50, DEPOSIT_MIN: 50, SPIN_ENERGY: 2,
  WITHDRAW_MIN: 1000, WITHDRAW_FEE: 0.05,
  BONUS_MULT: 2, BONUS_DEPOSIT_CAP: 5000, BONUS_WAGER_MULT: 40, BONUS_MAX_BET: 100,
  FREESPINS_COUNT: 50, FREESPIN_BET: 10, FREESPIN_WAGER_MULT: 40,
  TILT_LOSS: 4, TILT_ALLIN: 10, TILT_WIN_BIG: 5,
  TILT_SLEEP_DECAY: 50, TILT_FAMILY: 15, TILT_SHIFT: 10,
  TILT_SHADY_FAIL: 10, TILT_BILL_DEFERRED: 15, TILT_WITHDRAW: 5,
  TILT_T1: 40, TILT_T2: 70, TILT_MAX: 100, TILT_NON_SPIN_CAP: 99, TILT_AFTER_CASINO_NIGHT: 50,
  CASINO_NIGHT_LOSS_PCT: 0.20, CASINO_NIGHTS_FOR_ENDING: 3,
  SHIFT_ENERGY: 60, SHIFT_PAY: 900,
  SHIFT_PROMO_EVERY: 5, SHIFT_PROMO_STEP: 0.15, SHIFT_PROMO_MAX: 5,
  SHIFT_REP_BONUS_STEP: 0.01, SHIFT_REP_BONUS_CAP: 0.30, SHIFT_REP_PENALTY_MULT: 0.70,
  SHADY_ENERGY: 30, SHADY_REP: -2, SHADY_SUCCESS: 0.50,
  SHADY_REWARD_MIN: 1800, SHADY_REWARD_MAX: 2800, SHADY_FINE: 2000,
  SHADY_JAIL_REP: -10, SHADY_JAIL_CHANCE: 0.25,
  FRIEND_ENERGY: 10, FRIEND_BASE: 200, FRIEND_PER_REP: 15, FRIEND_MAX: 800,
  FRIEND_WEEKLY_DECAY: 0.5, FRIEND_REP: -3,
  FAMILY_ENERGY: 20, FAMILY_REP: 2, FAMILY_HELP_DAILY: 1,
  BANK_LOAN: 5000, BANK_RATE_DAY: 0.003, BANK_REP_MIN: 15,
  MFO_LOAN: 3000, MFO_RATE_DAY: 0.01,
  DEBT_LIMIT: 30000, REPAY_MIN: 500, REPAY_REP_STEP: 2000, FIN_ACTION_ENERGY: 0,
  PAWN_VALUE: { phone: 3000, bike: 2500, laptop: 6000, teaset: 1500, console: 4000 },
  PAWN_REDEEM_MULT: 1.30,
  REP_MIN: -15, REP_MAX: 40, REP_FAMILY_LEAVES: -15,
  EVENT_CHANCE_PER_NIGHT: 0.40, EVENT_COOLDOWN_DAYS: 7,
  MINIMALISM_MONEY: 50, REFERRAL_CASINO: 100000, QUIT_GRADE_A_REP: 20,
}

// ───────────────────────────── SLOT (зеркало slot.ts) ─────────────────────────────
// 3 одинаковых независимых барабана, 90 виртуальных позиций. Порядок символов = SYMBOL_IDS.
export const SYMBOLS = ['cherry', 'lemon', 'orange', 'melon', 'star', 'diamond', 'seven', 'clown']
export const REEL_WEIGHTS = { cherry: 4, lemon: 4, orange: 12, melon: 25, star: 18, diamond: 14, seven: 9, clown: 4 }
const FRUITS = new Set(['lemon', 'orange', 'melon'])
const PREMIUM = new Set(['star', 'diamond', 'seven'])
// Правила в порядке приоритета: первое подошедшее определяет исход.
export const PAYTABLE = [
  { id: 'jackpot',      mult: 100, test: (r) => r.every((x) => x === 'seven') },
  { id: 'diamonds',     mult: 25,  test: (r) => r.every((x) => x === 'diamond') },
  { id: 'stars',        mult: 20,  test: (r) => r.every((x) => x === 'star') },
  { id: 'fruit_triple', mult: 10,  test: (r) => FRUITS.has(r[0]) && r[0] === r[1] && r[1] === r[2] },
  { id: 'cherry_triple',mult: 5,   test: (r) => r.every((x) => x === 'cherry') },
  { id: 'clown_triple', mult: 1,   test: (r) => r.every((x) => x === 'clown') },
  { id: 'premium_mix',  mult: 2,   test: (r) => r.every((x) => PREMIUM.has(x)) },
  { id: 'fruit_mix',    mult: 1,   test: (r) => r.every((x) => FRUITS.has(x)) },
  { id: 'two_cherries', mult: 2,   test: (r) => r.filter((x) => x === 'cherry').length === 2 },
  { id: 'one_cherry',   mult: 0.5, test: (r) => r.filter((x) => x === 'cherry').length === 1 },
  { id: 'lose',         mult: 0,   test: () => true },
]
export function evalReels(r) { for (const p of PAYTABLE) if (p.test(r)) return p; }

// Точный перебор 8³ комбинаций → веса исходов в «из 90³».
export function slotAnalytics() {
  const W = SYMBOLS.map((s) => REEL_WEIGHTS[s]); const N = W.reduce((a, b) => a + b, 0)
  const counts = {}; for (const p of PAYTABLE) counts[p.id] = 0
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) for (let c = 0; c < 8; c++) {
    const o = evalReels([SYMBOLS[a], SYMBOLS[b], SYMBOLS[c]]); counts[o.id] += W[a] * W[b] * W[c]
  }
  const total = N ** 3; let rtp = 0, hit = 0, ldw = 0, push = 0, real = 0, bigwin = 0, m2 = 0
  const rows = PAYTABLE.map((p) => {
    const pr = counts[p.id] / total; rtp += pr * p.mult; m2 += pr * p.mult * p.mult
    if (p.mult > 0) hit += pr; if (p.mult > 0 && p.mult < 1) ldw += pr; if (p.mult === 1) push += pr
    if (p.mult > 1) real += pr; if (p.mult >= 2) bigwin += pr
    return { id: p.id, mult: p.mult, weight: counts[p.id], p: pr, rtpShare: pr * p.mult }
  })
  return { N, total, rows, rtp, hit, ldw, push, real, bigwin, lossLike: 1 - hit + ldw, variance: m2 - rtp * rtp }
}

// ───────────────────────────── RNG ─────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0
  const next = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)) }
}
const REEL_CUM = (() => { let c = 0; return SYMBOLS.map((s) => (c += REEL_WEIGHTS[s])) })()
const REEL_N = REEL_CUM[REEL_CUM.length - 1]
function reel(rng) { const x = rng.next() * REEL_N; for (let i = 0; i < 8; i++) if (x < REEL_CUM[i]) return SYMBOLS[i]; return SYMBOLS[7] }
export function spinOutcome(rng) { return evalReels([reel(rng), reel(rng), reel(rng)]) }

// ───────────────────────────── ENGINE (GDD §3) ─────────────────────────────
const ITEMS = ['phone', 'bike', 'laptop', 'teaset', 'console']
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

function newRun(rng) {
  return {
    rng, day: 1, energy: CFG.ENERGY_PER_DAY, wallet: CFG.START_WALLET, casino: 0, debtBank: 0, debtMfo: 0,
    rep: CFG.START_REP, tilt: 0, items: Object.fromEntries(ITEMS.map((i) => [i, 'owned'])), bet: CFG.START_BET,
    bonus: { state: 'available', wagerReq: 0, wagered: 0 }, withdrawals: [],
    bills: CFG.BILLS.map((fixed, i) => ({ week: i + 1, dueDay: 7 * (i + 1), fixed, status: 'upcoming' })),
    graceUsed: false, shiftsDone: 0, shiftsThisWeek: 0, shiftPenalty: 0, friendLoansThisWeek: 0, friendsBlocked: false, friendDebtRun: 0,
    familyHelpsToday: 0, borrowedToday: 0, repayProgress: 0, casinoNights: 0, casinoNightPending: false,
    energyModNextMorning: 0, pendingEvent: null, cooldowns: {}, onceUsed: {}, casinoBlockedDay: 0,
    spinsToday: 0, lastSpinDay: 0, withdrewToday: false, maxTiltToday: 0, dayEnded: false, flags: {},
    ending: null, grade: null,
    st: { spins: 0, wagered: 0, paid: 0, ldw: 0, nearMiss: 0, shifts: 0, shady: 0, shadyOk: 0, family: 0, friends: 0, friendMoney: 0,
      bankLoans: 0, mfoLoans: 0, interest: 0, forcedMfo: 0, pawned: 0, redeemed: 0, tiltDays70: 0, deposits: 0, withdrawn: 0,
      bonusTaken: false, bonusDone: false, freespins: 0, nightLoss: 0, actions: 0, events: 0, bills: 0, weekSpins: 0,
      spinsTo100: [], spinsSinceZero: 0, depositTotal: 0, maxCasino: 0, maxDebt: 0 },
  }
}
const debt = (s) => s.debtBank + s.debtMfo
const owned = (s) => ITEMS.filter((i) => s.items[i] === 'owned').length
function end(s, id) { if (!s.ending) s.ending = id }
function setRep(s, delta) {
  s.rep += delta
  if (s.rep <= CFG.REP_FAMILY_LEAVES) end(s, 'family_left')
  s.rep = clamp(s.rep, CFG.REP_MIN, CFG.REP_MAX)
  if (s.rep <= 0) s.friendsBlocked = true
}
function addTilt(s, delta, fromSpin = false) {
  const cap = fromSpin ? CFG.TILT_MAX : Math.max(CFG.TILT_NON_SPIN_CAP, Math.min(s.tilt, CFG.TILT_MAX))
  s.tilt = clamp(s.tilt + delta, 0, cap)
  if (s.tilt > s.maxTiltToday) s.maxTiltToday = s.tilt
}
// Обязательное списание (GDD §3.5.12): недостача → МФО сверх лимита.
function forcedPay(s, x) {
  if (s.wallet >= x) { s.wallet -= x; return }
  const short = x - s.wallet; s.wallet = 0; s.debtMfo += short; s.st.forcedMfo += short
}
function shiftPayPreview(s) {
  const promos = Math.min(CFG.SHIFT_PROMO_MAX, Math.floor(s.shiftsDone / CFG.SHIFT_PROMO_EVERY))
  const repMult = s.rep < 0 ? CFG.SHIFT_REP_PENALTY_MULT : 1 + Math.min(CFG.SHIFT_REP_BONUS_CAP, Math.max(0, s.rep - 10) * CFG.SHIFT_REP_BONUS_STEP)
  return Math.round(CFG.SHIFT_PAY * (1 + CFG.SHIFT_PROMO_STEP * promos) * repMult)
}
const A = {
  shift(s) {
    if (s.energy < CFG.SHIFT_ENERGY) return false
    s.energy -= CFG.SHIFT_ENERGY; let pay = shiftPayPreview(s)
    if (s.shiftPenalty) { pay = Math.max(0, pay - s.shiftPenalty.amount); s.shiftPenalty.n--; if (!s.shiftPenalty.n) s.shiftPenalty = 0 }
    s.wallet += pay; s.st.earnShift = (s.st.earnShift || 0) + pay; s.shiftsDone++; s.shiftsThisWeek++; s.st.shifts++; addTilt(s, -CFG.TILT_SHIFT); s.st.actions++; return true
  },
  shady(s) {
    if (s.energy < CFG.SHADY_ENERGY) return false
    s.energy -= CFG.SHADY_ENERGY; s.st.shady++; s.st.actions++; setRep(s, CFG.SHADY_REP)
    if (s.rng.next() < CFG.SHADY_SUCCESS) { s.wallet += 100 * s.rng.int(CFG.SHADY_REWARD_MIN / 100, CFG.SHADY_REWARD_MAX / 100); s.st.shadyOk++ }
    else {
      forcedPay(s, CFG.SHADY_FINE); addTilt(s, CFG.TILT_SHADY_FAIL)
      if (s.rep <= CFG.SHADY_JAIL_REP && s.rng.next() < CFG.SHADY_JAIL_CHANCE) { s.ending = null; end(s, 'jailed') }
    }
    return true
  },
  family(s) {
    if (s.energy < CFG.FAMILY_ENERGY || s.familyHelpsToday >= CFG.FAMILY_HELP_DAILY) return false
    s.energy -= CFG.FAMILY_ENERGY; s.familyHelpsToday++; setRep(s, CFG.FAMILY_REP); addTilt(s, -CFG.TILT_FAMILY); s.st.family++; s.st.actions++; return true
  },
  friendAmount(s) {
    if (s.friendsBlocked || s.items.phone !== 'owned' || s.rep <= 0) return 0
    const a = Math.round(Math.min(CFG.FRIEND_MAX, CFG.FRIEND_BASE + CFG.FRIEND_PER_REP * s.rep) * (1 - CFG.FRIEND_WEEKLY_DECAY) ** s.friendLoansThisWeek / 10) * 10
    return a < 50 ? 0 : a
  },
  borrow(s) {
    const a = A.friendAmount(s); if (!a || s.energy < CFG.FRIEND_ENERGY) return false
    s.energy -= CFG.FRIEND_ENERGY; s.wallet += a; s.friendLoansThisWeek++; s.friendDebtRun += a; setRep(s, CFG.FRIEND_REP)
    s.st.friends++; s.st.friendMoney += a; s.st.actions++; return true
  },
  canBank: (s) => s.rep >= CFG.BANK_REP_MIN && debt(s) + CFG.BANK_LOAN <= CFG.DEBT_LIMIT,
  canMfo: (s) => debt(s) + CFG.MFO_LOAN <= CFG.DEBT_LIMIT,
  bank(s) { if (!A.canBank(s)) return false; s.wallet += CFG.BANK_LOAN; s.debtBank += CFG.BANK_LOAN; s.borrowedToday += CFG.BANK_LOAN; s.st.bankLoans++; s.st.actions++; s.st.maxDebt = Math.max(s.st.maxDebt, debt(s)); return true },
  mfo(s) { if (!A.canMfo(s)) return false; s.wallet += CFG.MFO_LOAN; s.debtMfo += CFG.MFO_LOAN; s.borrowedToday += CFG.MFO_LOAN; s.st.mfoLoans++; s.st.actions++; s.st.maxDebt = Math.max(s.st.maxDebt, debt(s)); return true },
  // Гашение долга (МФО → банк) + ❤️-прогресс с антиабузом borrowedToday. fromWallet=false — для долговой части счёта (деньги уже списаны).
  repayCore(s, a) {
    const m = Math.min(a, s.debtMfo); s.debtMfo -= m; s.debtBank -= Math.min(a - m, s.debtBank)
    const eligible = Math.max(0, a - s.borrowedToday); s.borrowedToday = Math.max(0, s.borrowedToday - a)
    s.repayProgress += eligible; const g = Math.floor(s.repayProgress / CFG.REPAY_REP_STEP); s.repayProgress %= CFG.REPAY_REP_STEP; if (g) setRep(s, g)
  },
  repay(s, amount) {
    const d = debt(s); if (d <= 0) return false
    const a = Math.min(amount, s.wallet, d); if (a < CFG.REPAY_MIN && a !== d) return false
    s.wallet -= a; A.repayCore(s, a); s.st.actions++; return true
  },
  pawn(s, item) { if (s.items[item] !== 'owned') return false; s.items[item] = 'pawned'; s.wallet += CFG.PAWN_VALUE[item]; s.st.pawned++; s.st.actions++; return true },
  redeemCost: (item) => Math.ceil(CFG.PAWN_VALUE[item] * CFG.PAWN_REDEEM_MULT),
  redeem(s, item) { const c = A.redeemCost(item); if (s.items[item] !== 'pawned' || s.wallet < c) return false; s.wallet -= c; s.items[item] = 'owned'; s.st.redeemed++; s.st.actions++; return true },
  deposit(s, a, takeBonus = false) {
    a = Math.floor(a); if (a < CFG.DEPOSIT_MIN || s.wallet < a) return false
    s.wallet -= a; s.casino += a; s.st.deposits++; s.st.depositTotal += a; s.st.actions++
    if (s.bonus.state === 'available') {
      if (takeBonus) { const b = CFG.BONUS_MULT * Math.min(a, CFG.BONUS_DEPOSIT_CAP); s.casino += b; s.bonus = { state: 'active', wagerReq: CFG.BONUS_WAGER_MULT * b, wagered: 0 }; s.st.bonusTaken = true }
      else s.bonus.state = 'declined'
    }
    return true
  },
  withdraw(s, a) {
    a = Math.floor(a); if (s.bonus.state === 'active' || a < CFG.WITHDRAW_MIN || s.casino < a) return false
    s.casino -= a; s.withdrawals.push({ net: Math.floor(a * (1 - CFG.WITHDRAW_FEE)), arriveDay: s.day + 1 }); s.st.withdrawn += a; s.st.actions++
    if (!s.withdrewToday) { addTilt(s, -CFG.TILT_WITHDRAW); s.withdrewToday = true }
    return true
  },
  canSpin(s) { return !s.dayEnded && !s.ending && s.casinoBlockedDay !== s.day && s.casino >= CFG.MIN_BET && (s.tilt >= CFG.TILT_T2 || s.energy >= CFG.SPIN_ENERGY) },
  spin(s, betWanted) {
    if (!A.canSpin(s)) return null
    const cap = s.bonus.state === 'active' ? CFG.BONUS_MAX_BET : Infinity
    const bet = Math.max(CFG.MIN_BET, Math.min(Math.floor(betWanted), s.casino, cap)); const allIn = bet === s.casino
    if (s.tilt < CFG.TILT_T2) s.energy -= CFG.SPIN_ENERGY
    s.casino -= bet; if (s.bonus.state === 'active') s.bonus.wagered += bet
    const o = spinOutcome(s.rng); const payout = Math.floor(bet * o.mult); s.casino += payout
    s.st.spins++; s.st.wagered += bet; s.st.paid += payout; s.spinsToday++; s.lastSpinDay = s.day; s.st.actions++; s.st.weekSpins++
    if (o.mult > 0 && o.mult < 1) s.st.ldw++
    let dt = 0; if (allIn) dt += CFG.TILT_ALLIN; if (o.mult < 1) dt += CFG.TILT_LOSS; else if (o.mult >= 2) dt -= CFG.TILT_WIN_BIG
    const before = s.tilt; addTilt(s, dt, true)
    if (s.tilt === 0) s.st.spinsSinceZero = 0; else s.st.spinsSinceZero++
    if (s.bonus.state === 'active') { if (s.bonus.wagered >= s.bonus.wagerReq) { s.bonus.state = 'done'; s.st.bonusDone = true } else if (s.casino < CFG.MIN_BET) s.bonus.state = 'lost' }
    if (s.casino > s.st.maxCasino) s.st.maxCasino = s.casino
    if (s.casino >= CFG.REFERRAL_CASINO) end(s, 'referral')
    if (s.tilt >= CFG.TILT_MAX && before < CFG.TILT_MAX) { s.st.spinsTo100.push(s.st.spinsSinceZero); s.casinoNightPending = true; s.dayEnded = true }
    return o
  },
}

// ─────────── СОБЫТИЯ (content-pack §2 + 3 бытовые карточки economy-v1) ───────────
// Каждое: when(s) → bool, once?, w (вес), a/b: {cost?, apply(s)}. cost — ₽ из кошелька (вариант недоступен, если не хватает).
const E = (o) => o
export const EVENTS = [
  E({ id: 'mama_meds', w: 1, once: true, when: () => true, a: { cost: 2000, apply: (s) => setRep(s, 4) }, b: { apply: (s) => { setRep(s, -3); addTilt(s, 10) } } }),
  E({ id: 'push_we_miss_you', w: 1, when: (s) => s.day - s.lastSpinDay >= 2, a: { apply: (s) => freespins(s) }, b: { apply: (s) => addTilt(s, -5) } }),
  E({ id: 'seryoga_fishing', w: 1, when: (s) => s.day % 7 === 6 || s.day % 7 === 0, a: { apply: (s) => { s.energy -= 40; addTilt(s, -30); setRep(s, 2) } }, b: { apply: (s) => setRep(s, -1) } }),
  E({ id: 'eduard_call', w: 1, when: (s) => debt(s) > 0 && s.day > 7, a: { cost: 500, apply: (s) => { A.repayCore(s, 500); addTilt(s, -5) } }, b: { apply: (s) => { addTilt(s, 10); s.flags.eduard = true } } }),
  E({ id: 'eduard_visit', w: 1, when: (s) => s.flags.eduard || (debt(s) >= 15000 && s.day > 14), a: { apply: (s) => { s.energy -= 20; addTilt(s, -10) } }, b: { apply: (s) => { addTilt(s, 15); setRep(s, -1) } } }),
  E({ id: 'boss_saturday', w: 1, when: (s) => s.shiftsThisWeek >= 2, a: { apply: (s) => { s.wallet += 600; s.energy -= 30; addTilt(s, -5); s.shiftsDone++ } }, b: { apply: () => {} } }),
  E({ id: 'boss_caught', w: 1, when: (s) => s.tilt >= 40 && s.flags.spunOnShiftDay, a: { apply: (s) => { setRep(s, -1); s.shiftPenalty = { amount: Math.round(shiftPayPreview(s) * 0.3), n: 1 } } }, b: { apply: (s) => { addTilt(s, -10); setRep(s, 1) } } }),
  E({ id: 'seryoga_wants_back', w: 1, when: (s) => s.friendDebtRun > 0, a: { costFn: (s) => s.friendDebtRun, apply: (s) => { s.friendDebtRun = 0; setRep(s, 3) } }, b: { apply: (s) => { setRep(s, -2); addTilt(s, 5) } } }),
  E({ id: 'anzhelika_bonus', w: 1, when: (s) => s.st.deposits > 0, a: { apply: (s) => { s.flags.anzh = true } }, b: { apply: () => {} } }),
  E({ id: 'sms_preapproved', w: 1, when: (s) => A.canMfo(s) && s.rep < CFG.BANK_REP_MIN, a: { apply: (s) => A.mfo(s) }, b: { apply: (s) => addTilt(s, -5) } }),
  E({ id: 'signals_channel', w: 1, when: (s) => s.st.spins >= 50, a: { cost: 1000, apply: () => {} }, b: { apply: (s) => addTilt(s, -5) } }),
  E({ id: 'grandma_service', w: 1, when: (s) => s.items.teaset === 'pawned', a: { apply: (s) => { setRep(s, -1); addTilt(s, 5) } }, b: { apply: (s) => { setRep(s, -2); addTilt(s, -20) } } }),
  E({ id: 'dream_777', w: 1, when: (s) => s.flags.nearMiss3, a: { apply: (s) => addTilt(s, 15) }, b: { apply: (s) => { addTilt(s, -10); s.energy += 10 } } }),
  E({ id: 'neighbor_drill', w: 1, when: () => true, a: { apply: (s) => addTilt(s, 5) }, b: { apply: (s) => { s.energy -= 10; addTilt(s, -10) } } }),
  E({ id: 'mama_birthday', w: 1, once: true, when: (s) => s.day > 7 && s.day <= 21, a: { cost: 3000, apply: (s) => { setRep(s, 4); addTilt(s, -10) } }, b: { apply: (s) => setRep(s, -2) } }),
  E({ id: 'stream_clip', w: 1, when: (s) => s.tilt >= 30, a: { apply: (s) => addTilt(s, 15) }, b: { apply: (s) => addTilt(s, -5) } }),
  E({ id: 'seryoga_blocking', w: 1, when: (s) => s.rep <= 0 && !s.flags.blockEvt, a: { apply: (s) => { s.energy -= 20; setRep(s, 1); s.flags.blockEvt = true } }, b: { apply: (s) => { addTilt(s, 10); s.flags.blockEvt = true } } }),
  E({ id: 'mfo_robot', w: 1, when: (s) => s.debtMfo > 0, a: { cost: 500, apply: () => {} }, b: { apply: (s) => { s.energy -= 10 } } }),
  E({ id: 'withdraw_verification', w: 1, when: (s) => s.withdrawals.length > 0, a: { cost: 1000, apply: (s) => { s.casino += 1000 } }, b: { apply: () => {} } }),
  E({ id: 'seryoga_birthday', w: 1, once: true, when: (s) => s.rep > 0, a: { cost: 1000, apply: (s) => { s.energy -= 30; setRep(s, 2); addTilt(s, -20) } }, b: { apply: (s) => setRep(s, -1) } }),
  E({ id: 'insomnia_spin', w: 1, when: (s) => s.flags.sleptTilt70, a: { apply: (s) => { for (let i = 0; i < 10 && s.casino >= CFG.MIN_BET; i++) { const b = Math.min(s.bet, s.casino); s.casino -= b; const o = spinOutcome(s.rng); s.casino += Math.floor(b * o.mult); s.st.spins++; s.st.wagered += b; s.st.paid += Math.floor(b * o.mult); if (s.bonus.state === 'active') s.bonus.wagered += b } addTilt(s, 10); s.energy -= 20 } }, b: { apply: (s) => addTilt(s, -15) } }),
  E({ id: 'mama_worried', w: 1, once: true, when: (s) => s.tilt >= 40 || s.rep < 5, a: { apply: (s) => addTilt(s, 5) }, b: { apply: (s) => { addTilt(s, -30); setRep(s, 2); s.flags.mamaBlock = true } } }),
  E({ id: 'mama_blocks_site', w: 1, once: true, when: (s) => s.flags.mamaBlock, a: { apply: (s) => { s.casinoBlockedDay = s.day; addTilt(s, -20); setRep(s, 1) } }, b: { apply: (s) => { addTilt(s, 10); setRep(s, -2) } } }),
  E({ id: 'boss_advance', w: 1, when: (s) => { const b = s.bills.find((x) => x.status !== 'paid' && x.dueDay >= s.day); return b && b.dueDay - s.day <= 2 && s.wallet < b.fixed }, a: { apply: (s) => { s.wallet += 2000; s.shiftPenalty = { amount: 1000, n: 2 }; setRep(s, -1) } }, b: { apply: () => {} } }),
  E({ id: 'cashback_letter', w: 1, when: (s) => s.flags.weekLoss >= 5000, a: { apply: (s) => { s.casino += Math.floor(s.flags.weekLoss * 0.05); lockBonus(s, 10 * Math.floor(s.flags.weekLoss * 0.05)) } }, b: { apply: (s) => addTilt(s, -5) } }),
  E({ id: 'pawn_offer', w: 1, when: (s) => ITEMS.some((i) => s.items[i] === 'pawned'), a: { apply: (s) => { const i = ITEMS.find((x) => s.items[x] === 'pawned'); s.items[i] = 'sold'; s.wallet += Math.floor(CFG.PAWN_VALUE[i] * 0.2) } }, b: { apply: () => {} } }),
  // Бытовые карточки (новые, economy-v1 §6.3; тексты — writer). Обе опции стоят: ₽ или ⚡/🔥 (жизнь случается).
  E({ id: 'life_fridge', w: 1, when: () => true, a: { cost: 2500, apply: () => {} }, b: { apply: (s) => { s.energy -= 60; addTilt(s, 10) } } }),
  E({ id: 'life_tooth', w: 1, when: () => true, a: { cost: 2000, apply: () => {} }, b: { apply: (s) => { s.energy -= 60; addTilt(s, 15) } } }),
  E({ id: 'life_fine', w: 1, when: () => true, a: { cost: 1500, apply: () => {} }, b: { apply: (s) => { s.debtMfo += 2000; s.st.forcedMfo += 2000 } } }),
]
function lockBonus(s, req) {
  if (req <= 0) return
  if (s.bonus.state === 'active') s.bonus.wagerReq += req
  else s.bonus = { state: 'active', wagerReq: req, wagered: 0 }
}
function freespins(s) {
  let w = 0; for (let i = 0; i < CFG.FREESPINS_COUNT; i++) w += Math.floor(CFG.FREESPIN_BET * spinOutcome(s.rng).mult)
  s.st.freespins += w; s.casino += w; addTilt(s, 5); if (w > 0) lockBonus(s, CFG.FREESPIN_WAGER_MULT * w)
}
function eventCost(s, opt) { return opt.costFn ? opt.costFn(s) : opt.cost || 0 }

// ───────────────────────────── DAY LOOP ─────────────────────────────
function currentBill(s) { return s.bills.find((b) => b.dueDay === s.day && b.status !== 'paid') }
export function billTotal(s, b) { return b.fixed + Math.ceil(CFG.BILL_DEBT_SHARE * debt(s)) }
function payBill(s, b) {
  const total = billTotal(s, b); if (s.wallet < total) return false
  const dp = total - b.fixed; s.wallet -= total; A.repayCore(s, dp); b.status = 'paid'; s.st.bills++; return true
}
function deferBill(s, b) {
  if (s.graceUsed) return false
  s.graceUsed = true; b.status = 'deferred'; b.dueDay += 1; b.fixed = Math.ceil(b.fixed * (1 + CFG.GRACE_PENALTY)); addTilt(s, CFG.TILT_BILL_DEFERRED); return true
}
function wake(s, strat) {
  if (s.day % 7 === 1 && s.day > 1) { s.friendLoansThisWeek = 0; s.shiftsThisWeek = 0; s.flags.weekLoss = 0; s.st.weekSpins = 0 }
  s.withdrawals = s.withdrawals.filter((w) => { if (w.arriveDay <= s.day) { s.wallet += w.net; return false } return true })
  s.energy = Math.max(0, CFG.ENERGY_PER_DAY + s.energyModNextMorning); s.energyModNextMorning = 0
  s.dayEnded = false; s.spinsToday = 0; s.withdrewToday = false; s.flags.spunOnShiftDay = false; s.flags.nearMiss3 = false
  if (s.pendingEvent) {
    const ev = s.pendingEvent; s.pendingEvent = null; s.st.events++
    const canA = s.wallet >= eventCost(s, ev.a)
    let pick = canA ? strat.event(s, ev) : 'b'; if (pick === 'a' && !canA) pick = 'b'
    const opt = ev[pick]; const c = eventCost(s, opt); if (c) { s.wallet -= c; s.st.eventSpent = (s.st.eventSpent || 0) + c } opt.apply(s)
    s.energy = clamp(s.energy, 0, CFG.ENERGY_PER_DAY)
  }
  if (s.ending) return
  const noItems = ITEMS.every((i) => s.items[i] !== 'owned')
  if (s.wallet + s.casino < CFG.MINIMALISM_MONEY && noItems && !A.canBank(s) && !A.canMfo(s)) end(s, 'minimalism')
}
function sleep(s) {
  if (s.casinoNightPending) {
    const loss = Math.floor(s.casino * CFG.CASINO_NIGHT_LOSS_PCT); s.casino -= loss; s.st.nightLoss += loss; s.casinoNights++
    if (s.bonus.state === 'active' && s.casino < CFG.MIN_BET) s.bonus.state = 'lost'
    if (s.casinoNights >= CFG.CASINO_NIGHTS_FOR_ENDING) { end(s, 'casino_nights'); return }
  }
  forcedPay(s, CFG.LIVING_COST)
  if (s.maxTiltToday >= CFG.TILT_T2) s.st.tiltDays70++
  const before = debt(s)
  s.debtMfo = Math.ceil(s.debtMfo * (1 + CFG.MFO_RATE_DAY)); s.debtBank = Math.ceil(s.debtBank * (1 + CFG.BANK_RATE_DAY))
  s.st.interest += debt(s) - before; s.st.maxDebt = Math.max(s.st.maxDebt, debt(s))
  s.flags.sleptTilt70 = s.tilt >= CFG.TILT_T2
  s.tilt = s.casinoNightPending ? CFG.TILT_AFTER_CASINO_NIGHT : Math.max(0, s.tilt - CFG.TILT_SLEEP_DECAY)
  if (s.tilt === 0) s.st.spinsSinceZero = 0
  if (s.day >= 2 && s.rng.next() < CFG.EVENT_CHANCE_PER_NIGHT) {
    const pool = EVENTS.filter((e) => !(e.once && s.onceUsed[e.id]) && !(s.cooldowns[e.id] && s.day + 1 - s.cooldowns[e.id] < CFG.EVENT_COOLDOWN_DAYS) && e.when(s))
    const W = pool.reduce((a, e) => a + e.w, 0); let x = s.rng.next() * W
    for (const e of pool) { x -= e.w; if (x < 0) { s.pendingEvent = e; s.cooldowns[e.id] = s.day + 1; if (e.once) s.onceUsed[e.id] = true; break } }
  }
  s.casinoNightPending = false; s.familyHelpsToday = 0; s.borrowedToday = 0; s.maxTiltToday = s.tilt
  s.day++
}
const forkDay = (s) => s.bills[3].dueDay
export function simulateRun(strat, seed) {
  const s = newRun(mulberry32(seed)); strat.init && strat.init(s)
  for (;;) {
    wake(s, strat); if (s.ending) break
    strat.day(s)
    if (s.ending) break
    if (s.day === 28) s.st.net28 = s.wallet + s.casino - debt(s) - s.bills[3].fixed
    const b = currentBill(s)
    if (b) {
      (s.st.slack ||= [])[b.week - 1] = s.wallet - billTotal(s, b)
      strat.bill(s, b)
      if (b.status !== 'paid' && b.dueDay === s.day) {
        if (!payBill(s, b) && !deferBill(s, b)) { end(s, 'collectors'); break }
      }
    }
    if (s.day === forkDay(s) && s.bills[3].status === 'paid') {
      if (debt(s) > 0 && s.wallet > 0) A.repay(s, s.wallet)
      if (debt(s) === 0 && strat.fork) strat.fork(s)
      if (debt(s) === 0) { end(s, 'quit'); const o = owned(s); s.grade = o === 5 && s.rep >= CFG.QUIT_GRADE_A_REP ? 'A' : o === 0 ? 'C' : 'B'; break }
      end(s, 'extend_in_debt'); break // «Ещё неделю» с долгом: в P0-метрике это не победа
    }
    sleep(s); if (s.ending) break
  }
  return s
}

// ───────────────────────────── STRATEGIES ─────────────────────────────
// Вспомогательное: сколько ещё заработаем сменами до дня D (оценка без событий).
function projectedIncome(s, toDay) {
  let n = s.shiftsDone, inc = 0; const tmp = { ...s }
  for (let d = s.day; d <= toDay; d++) { tmp.shiftsDone = n; if (!(d === s.day && s.energy < CFG.SHIFT_ENERGY)) { inc += shiftPayPreview(tmp); n++ } }
  return inc
}
function nextBill(s) { return s.bills.find((b) => b.status !== 'paid') }
function reserveNeeded(s) { // сколько не хватит к следующему счёту (≤0 — хватает)
  const b = nextBill(s); if (!b) return 0
  return billTotal(s, b) + CFG.LIVING_COST * (b.dueDay - s.day) - s.wallet - projectedIncome(s, b.dueDay) + (b.week === 4 ? debt(s) : 0)
}
function coverWithLoans(s, need) { while (s.wallet < need && (A.canBank(s) ? A.bank(s) : A.mfo(s))); }
function coverWithPawn(s, need) {
  const order = ['teaset', 'bike', 'phone', 'console', 'laptop']
  while (s.wallet < need) {
    const gap = need - s.wallet; const own = order.filter((i) => s.items[i] === 'owned'); if (!own.length) return false
    const fit = own.filter((i) => CFG.PAWN_VALUE[i] >= gap).sort((a, b) => CFG.PAWN_VALUE[a] - CFG.PAWN_VALUE[b])[0]
    A.pawn(s, fit || own.sort((a, b) => CFG.PAWN_VALUE[b] - CFG.PAWN_VALUE[a])[0])
  }
  return true
}
function repaySurplus(s, buffer = 0) { if (debt(s) > 0) { const a = -reserveNeeded(s) - buffer; if (a > 0) A.repay(s, a) } }
function repayAll(s, keep = 0) { const a = Math.min(debt(s), s.wallet - keep); if (a > 0) A.repay(s, a) }
function redeemSpare(s) { // выкупить, если после выкупа всё ещё хватает на следующий счёт
  for (const i of ['teaset', 'bike', 'phone', 'console', 'laptop'].sort((a, b) => CFG.PAWN_VALUE[a] - CFG.PAWN_VALUE[b])) {
    if (s.items[i] !== 'pawned') continue
    const c = A.redeemCost(i); if (s.wallet - c > 0 && reserveNeeded({ ...s, wallet: s.wallet - c }) <= 0) A.redeem(s, i)
  }
}
const eventHonest = (s, ev) => {
  const c = eventCost(s, ev.a)
  if (['push_we_miss_you', 'anzhelika_bonus', 'sms_preapproved', 'signals_channel', 'dream_777', 'stream_clip', 'withdraw_verification', 'cashback_letter', 'insomnia_spin', 'pawn_offer', 'mfo_robot', 'boss_caught', 'mama_worried', 'mama_blocks_site'].includes(ev.id))
    return ev.id === 'mama_worried' ? 'b' : ev.id === 'mama_blocks_site' ? 'a' : 'b'
  if (ev.id === 'boss_advance') return 'b'
  if (ev.id === 'eduard_call') return 'a'
  if (ev.id.startsWith('life_')) return reserveNeeded({ ...s, wallet: s.wallet - c }) <= 0 ? 'a' : 'b'
  if (c > 0) return reserveNeeded({ ...s, wallet: s.wallet - c }) <= -500 ? 'a' : 'b'
  return 'a'
}
const eventGambler = (s, ev) => (['push_we_miss_you', 'anzhelika_bonus', 'dream_777', 'stream_clip', 'insomnia_spin', 'sms_preapproved', 'mama_worried'].includes(ev.id) ? 'a' : ev.id.startsWith('life_') ? (s.wallet > 3000 ? 'a' : 'b') : eventCost(s, ev.a) > 0 ? 'b' : 'a')

function casinoSession(s, { bet, budget, takeBonus = false, stopAtTilt = 101, allInAtTilt = 999, allInP = 0, maxSpins = 1e9, keepWallet = 0 }) {
  if (s.casinoBlockedDay === s.day) return
  if (s.casino < bet && budget > 0) A.deposit(s, Math.min(budget, s.wallet - keepWallet), takeBonus)
  let n = 0
  while (A.canSpin(s) && n < maxSpins && s.tilt < stopAtTilt) {
    const b = s.tilt >= allInAtTilt && s.rng.next() < allInP ? s.casino : bet
    const o = A.spin(s, b); if (!o) break; n++
    if (s.casino < CFG.MIN_BET) break
  }
  if (n > 0) s.flags.spunOnShiftDay = true
}

export const STRATEGIES = {
  // Смена + семья каждый день, без казино/темок/друзей. Кассовые разрывы — банк/МФО, вещи не трогает.
  honest: {
    label: 'Честный работник (без ломбарда)', event: eventHonest,
    day(s) { A.shift(s); A.family(s); repaySurplus(s) },
    bill(s, b) { const t = billTotal(s, b) + (b.week === 4 ? debt(s) : 0); if (s.wallet < t && b.week < 4) coverWithLoans(s, billTotal(s, b)) },
  },
  // То же, но при нехватке закладывает вещи (сначала мелкие), выкупает, когда есть запас.
  honest_pawn: {
    label: 'Честный + ломбард', event: eventHonest,
    day(s) { A.shift(s); A.family(s); redeemSpare(s) },
    bill(s, b) { const need = billTotal(s, b) + (b.week === 4 ? debt(s) : 0); if (s.wallet < need) coverWithPawn(s, need) || coverWithLoans(s, billTotal(s, b)) },
    fork(s) { for (const i of ['teaset', 'bike', 'phone', 'console', 'laptop']) if (s.items[i] === 'pawned') A.redeem(s, i) },
  },
  // Честный + друзья, когда не хватает к счёту (проверка эксплойта «друзья как банк»).
  honest_friends: {
    label: 'Честный + друзья', event: eventHonest,
    day(s) { A.shift(s); A.family(s); if (reserveNeeded(s) > 0) A.borrow(s) },
    bill(s, b) { if (s.wallet < billTotal(s, b) && b.week < 4) coverWithLoans(s, billTotal(s, b)) },
  },
  // CD-02: «казино каждый день, ставка 100, без ломбарда». Бонус не берёт, депозит ≤1000/день, выводит ≥2000.
  casino_daily: {
    label: 'Казино каждый день (ставка 100)', event: eventGambler,
    day(s) {
      A.shift(s)
      casinoSession(s, { bet: 100, budget: 1000, takeBonus: false })
      if (s.casino >= 2000 && s.bonus.state !== 'active') A.withdraw(s, s.casino)
      if (debt(s) > 0) repayAll(s, 0)
    },
    bill(s, b) { if (s.wallet < billTotal(s, b)) coverWithLoans(s, billTotal(s, b)) },
  },
  // Лудоман: бонус на весь кошелёк, ставка 10% баланса, при тильте ≥70 «ДОДЕП ВСЁ», додеп из займов/друзей/ломбарда.
  ludoman: {
    label: 'Лудоман (бонус, додеп, МФО, ломбард)', event: eventGambler,
    day(s) {
      A.shift(s)
      for (let round = 0; round < 4 && !s.dayEnded && !s.ending; round++) {
        if (s.casino < CFG.MIN_BET) {
          if (s.wallet < 500) { if (!A.borrow(s) && !A.mfo(s)) { const it = ITEMS.find((i) => s.items[i] === 'owned'); if (!it || !A.pawn(s, it)) break } }
          if (!A.deposit(s, s.wallet, true)) break
        }
        casinoSession(s, { bet: Math.max(100, Math.round(s.casino * 0.1 / 50) * 50), budget: 0, allInAtTilt: 70, allInP: 0.25 })
        if (s.casino >= 10000 && s.bonus.state !== 'active') { A.withdraw(s, s.casino - 1000); break }
      }
    },
    bill(s, b) { const t = billTotal(s, b); if (s.wallet < t) { coverWithLoans(s, t); if (s.wallet < t) coverWithPawn(s, t) } },
  },
  // CD-02: «темка каждый день» — смена + темка, без семьи и ломбарда.
  temshik: {
    label: 'Темщик (смена + темка каждый день)', event: eventHonest,
    day(s) { A.shift(s); A.shady(s); if (debt(s) > 0) repayAll(s, 0) },
    bill(s, b) { if (s.wallet < billTotal(s, b) && b.week < 4) coverWithLoans(s, billTotal(s, b)) },
  },
  // «Умный темщик»: темка только при ❤️ ≥ 4, иначе семья. Проверка, что темка не доминирует.
  temshik_smart: {
    label: 'Темщик осторожный (темка при ❤️≥4)', event: eventHonest,
    day(s) { A.shift(s); if (s.rep >= 4 && reserveNeeded(s) > -2000) A.shady(s); else A.family(s); if (debt(s) > 0) repayAll(s, 0) },
    bill(s, b) { if (s.wallet < billTotal(s, b) && b.week < 4) coverWithLoans(s, billTotal(s, b)) },
  },
  // Смешанная: смена; семья при 🔥≥40 или ❤️<20, иначе 10 спинов по 50 (бюджет 500/неделю); темка/друзья при нехватке; ломбард — последний шанс.
  mixed: {
    label: 'Смешанная (смена, немного казино, темка/друзья/ломбард по нужде)', event: eventHonest,
    init(s) { s.flags.weekBudget = 0 },
    day(s) {
      if (s.day % 7 === 1) s.flags.weekBudget = 500
      A.shift(s)
      if (s.tilt >= 40 || s.rep < 20) A.family(s)
      else { const dep = Math.min(s.flags.weekBudget, 500); if (s.casino < 50 && dep >= 50 && A.deposit(s, dep, false)) s.flags.weekBudget -= dep; casinoSession(s, { bet: 50, budget: 0, maxSpins: 10, stopAtTilt: 70 }); if (s.casino >= 1000) A.withdraw(s, s.casino) }
      if (reserveNeeded(s) > 0) { if (s.rep >= 8 && s.energy >= CFG.SHADY_ENERGY && s.day % 7 >= 3) A.shady(s); else A.borrow(s) }
      redeemSpare(s)
      repaySurplus(s, 1000)
    },
    bill(s, b) { const t = billTotal(s, b) + (b.week === 4 ? debt(s) : 0); if (s.wallet < t) { if (b.week < 4) coverWithLoans(s, billTotal(s, b)); if (s.wallet < t) coverWithPawn(s, t) } },
    fork(s) { for (const i of ['teaset', 'bike', 'phone', 'console', 'laptop']) if (s.items[i] === 'pawned') A.redeem(s, i) },
  },
  // CD-02: «бонус 200%» — депозит 1000 в день 1, крутит по 100 до отыгрыша/слива, в остальном честный.
  bonus_hunter: {
    label: 'Охотник за бонусом (деп 1000, ставка 100)', event: eventHonest,
    day(s) {
      A.shift(s)
      if (s.day === 1) A.deposit(s, 1000, true)
      if (s.bonus.state === 'active') casinoSession(s, { bet: 100, budget: 0 })
      else if (s.bonus.state === 'done' && s.casino >= CFG.WITHDRAW_MIN) A.withdraw(s, s.casino)
      else A.family(s)
    },
    bill(s, b) { if (s.wallet < billTotal(s, b) && b.week < 4) coverWithLoans(s, billTotal(s, b)) },
  },
}

// ───────────────────────────── REPORT ─────────────────────────────
const pct = (x) => (100 * x).toFixed(1) + '%'
const median = (a) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] }
const quant = (a, q) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * q))] }
// Время рана: утро+итог дня 35 с, действие «Жизни»/финансы 6 с, спин 2.5 с (1.2 анимация + решение), событие 15 с, счёт 10 с.
export function runMinutes(s) { const d = Math.min(s.day, 29); return (d * 35 + (s.st.actions - s.st.spins) * 6 + s.st.spins * 2.5 + s.st.events * 15 + s.st.bills * 10) / 60 }

export function runStrategy(key, runs, seed0) {
  const strat = STRATEGIES[key]; const endings = {}; const grades = { A: 0, B: 0, C: 0 }
  let wins = 0, itemsLostWin = 0, itemsLostAll = 0, nights1 = 0, bonusTaken = 0, bonusDone = 0, spinsSum = 0, wagSum = 0, paidSum = 0, pawnUsed = 0
  const acts = [], mins = [], days = [], to100 = [], endWallet = [], net28 = [], slack = [[], [], [], []]
  for (let r = 0; r < runs; r++) {
    const s = simulateRun(strat, seed0 * 1000003 + r)
    endings[s.ending] = (endings[s.ending] || 0) + 1
    const lost = ITEMS.filter((i) => s.items[i] !== 'owned').length; itemsLostAll += lost; if (s.st.pawned > 0) pawnUsed++
    if (s.ending === 'quit') { wins++; grades[s.grade]++; itemsLostWin += lost; endWallet.push(s.wallet) }
    if (s.casinoNights > 0) nights1++
    if (s.st.bonusTaken) bonusTaken++; if (s.st.bonusDone) bonusDone++
    spinsSum += s.st.spins; wagSum += s.st.wagered; paidSum += s.st.paid
    if (s.st.net28 !== undefined) net28.push(s.st.net28)
    if (s.st.slack) s.st.slack.forEach((v, i) => v !== undefined && slack[i].push(v))
    acts.push(s.st.actions); mins.push(runMinutes(s)); days.push(s.day); to100.push(...s.st.spinsTo100)
  }
  return {
    key, label: strat.label, runs, winRate: wins / runs, endings: Object.fromEntries(Object.entries(endings).map(([k, v]) => [k, v / runs])),
    grades: wins ? { A: grades.A / wins, B: grades.B / wins, C: grades.C / wins } : null,
    itemsLostPerWin: wins ? itemsLostWin / wins : 0, itemsLostPerRun: itemsLostAll / runs, pawnUsedShare: pawnUsed / runs,
    atLeastOneNight: nights1 / runs, bonusCompletion: bonusTaken ? bonusDone / bonusTaken : null,
    avgSpins: spinsSum / runs, realizedRtp: wagSum ? paidSum / wagSum : null,
    medianActions: median(acts), medianMinutes: median(mins), p10Minutes: quant(mins, 0.1), p90Minutes: quant(mins, 0.9), medianDay: median(days),
    billSlack: slack.map((a) => (a.length ? { p10: quant(a, 0.1), median: median(a), p90: quant(a, 0.9) } : null)),
    itemsLostPerPawnRun: pawnUsed ? itemsLostAll / pawnUsed : 0,
    net28: net28.length ? { reached: net28.length / runs, p10: quant(net28, 0.1), median: median(net28), p90: quant(net28, 0.9), mean: net28.reduce((a, b) => a + b, 0) / net28.length } : null,
    medianSpinsTo100: to100.length ? median(to100) : null, medianEndWalletWin: endWallet.length ? median(endWallet) : null,
  }
}

// Бонус в вакууме: деп D, бонус 2D, ставка b, крутим до отыгрыша или слива (без ⚡/тильта). + проверка формулы Изнанки.
export function bonusMath(D, bet, runs, seed) {
  const rng = mulberry32(seed); const B = CFG.BONUS_MULT * Math.min(D, CFG.BONUS_DEPOSIT_CAP); const req = CFG.BONUS_WAGER_MULT * B
  let done = 0, left = 0
  for (let r = 0; r < runs; r++) {
    let c = D + B, w = 0
    while (w < req && c >= CFG.MIN_BET) { const b = Math.min(bet, c, CFG.BONUS_MAX_BET); c -= b; w += b; c += Math.floor(b * spinOutcome(rng).mult) }
    if (w >= req) { done++; left += c }
  }
  return { D, B, req, bet, pDone: done / runs, eLeft: left / runs, formula: expectedBonusLeft(D + B, req, bet) }
}
// Формула Изнанки (economy-v1 §5.4): диффузионное приближение с поглощением в 0.
export function expectedBonusLeft(casino, wagerLeft, bet) {
  bet = Math.min(bet, CFG.BONUS_MAX_BET); const an = slotAnalytics(); const n = wagerLeft / bet; if (n <= 0) return { eLeft: casino, pDone: 1 }
  const mu = -(1 - an.rtp) * bet, sig2 = an.variance * bet * bet, T = n, m = casino + mu * T, mm = -casino + mu * T, sd = Math.sqrt(sig2 * T)
  const k = Math.exp(-2 * mu * casino / sig2)
  const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2)), phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)
  const eLeft = Math.max(0, (m * Phi(m / sd) + sd * phi(m / sd)) - k * (mm * Phi(mm / sd) + sd * phi(mm / sd)))
  const pDone = clamp(Phi(m / sd) - k * Phi(mm / sd), 0, 1)
  return { eLeft, pDone }
}
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }

// ───────────────────────────── CLI ─────────────────────────────
import { pathToFileURL } from 'node:url'
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
  const runs = +arg('runs', 20000), seed = +arg('seed', 1), only = arg('only', ''), json = process.argv.includes('--json')
  const t0 = Date.now(); const an = slotAnalytics()
  const out = { slot: an, strategies: [], bonus: [] }
  for (const k of Object.keys(STRATEGIES)) if (!only || only.split(',').includes(k)) out.strategies.push(runStrategy(k, runs, seed))
  for (const [D, b] of [[1000, 50], [1000, 100], [5000, 100]]) out.bonus.push(bonusMath(D, b, runs, seed + D + b))
  // Контроль RTP Монте-Карло 10^6 спинов
  { const rng = mulberry32(seed); let p = 0; const n = 1e6; for (let i = 0; i < n; i++) p += spinOutcome(rng).mult; out.mcRtp = p / n }
  if (json) { console.log(JSON.stringify(out, null, 2)); process.exit(0) }
  console.log(`SLOT: N=${an.N}/барабан, RTP=${an.rtp.toFixed(5)} (MC 1e6: ${out.mcRtp.toFixed(4)}), hit=${pct(an.hit)}, LDW=${pct(an.ldw)}, push=${pct(an.push)}, real win=${pct(an.real)}, P(mult<1)=${pct(an.lossLike)}, P(mult≥2)=${pct(an.bigwin)}, σ²=${an.variance.toFixed(2)}`)
  for (const r of an.rows) console.log(`  ${r.id.padEnd(14)} x${String(r.mult).padEnd(4)} w=${String(r.weight).padStart(6)}/${an.total}  p=${(100 * r.p).toFixed(3)}%  rtp=${(100 * r.rtpShare).toFixed(2)}%`)
  console.log(`\nRUNS=${runs}/стратегия, seed=${seed}`)
  for (const r of out.strategies) {
    const e = Object.entries(r.endings).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v)}`).join(', ')
    console.log(`\n[${r.key}] ${r.label}\n  WIN ${pct(r.winRate)} | ${e}` +
      (r.grades ? `\n  оценки: A ${pct(r.grades.A)} B ${pct(r.grades.B)} C ${pct(r.grades.C)} | вещей потеряно: ${r.itemsLostPerRun.toFixed(2)}/ран, ${r.itemsLostPerWin.toFixed(2)}/победу; ломбард в ${pct(r.pawnUsedShare)} ранов (${r.itemsLostPerPawnRun.toFixed(2)} вещи на такой ран)` : '') +
      `\n  ≥1 «Ночь»: ${pct(r.atLeastOneNight)} | спинов/ран ${r.avgSpins.toFixed(0)}, факт. RTP ${r.realizedRtp ? r.realizedRtp.toFixed(3) : '—'} | медиана спинов 0→100: ${r.medianSpinsTo100 ?? '—'}` +
      (r.bonusCompletion !== null ? ` | отыгрыш бонуса: ${pct(r.bonusCompletion)}` : '') +
      `\n  запас к счетам 1–4 (кошелёк − сумма, медиана [p10]): ${r.billSlack.map((x) => (x ? `${x.median} [${x.p10}]` : '—')).join(' / ')}` +
      (r.net28 ? `\n  день 28 (дошли ${pct(r.net28.reached)}): кошелёк+казино−долг−счёт4 = p10 ${r.net28.p10}, медиана ${r.net28.median}, p90 ${r.net28.p90}` : '') +
      `\n  действий (медиана) ${r.medianActions}; время: медиана ${r.medianMinutes.toFixed(1)} мин (p10 ${r.p10Minutes.toFixed(1)}, p90 ${r.p90Minutes.toFixed(1)}), медианный день конца ${r.medianDay}` + (r.medianEndWalletWin !== null ? `, медиана кошелька у победителя ${r.medianEndWalletWin}₽` : ''))
  }
  console.log('\nБОНУС в вакууме (без ⚡/тильта):')
  for (const b of out.bonus) console.log(`  деп ${b.D}, бонус ${b.B}, вейджер ${b.req}, ставка ${b.bet}: P(отыграл)=${pct(b.pDone)} [формула ${pct(b.formula.pDone)}], E[остаток]=${b.eLeft.toFixed(0)}₽ [формула ${b.formula.eLeft.toFixed(0)}₽]`)
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)} с`)
}
