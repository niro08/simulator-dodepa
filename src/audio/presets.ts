/**
 * Библиотека синт-пресетов (CD-20): только осцилляторы, шум, фильтры и огибающие — без файлов.
 * Пресет — список нот; движок (engine.ts) играет его как один голос. Время в секундах.
 * Громкости нот ≤ 0.4: сумма пиков пака держится ниже 0 dBFS ещё до лимитера на мастере.
 * Описание звуков — design/audio/sfx-spec.md.
 */

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle'

export interface NoteFilter {
  type: 'lowpass' | 'highpass' | 'bandpass'
  freq: number
  /** Свип частоты среза к концу ноты. */
  to?: number
  q?: number
}

export interface Note {
  /** Сдвиг от начала пресета, с. */
  at: number
  /** Длительность до полного затухания, с. */
  dur: number
  /** osc — осциллятор (по умолчанию), noise — белый шум. */
  src?: 'osc' | 'noise'
  wave?: Wave
  freq?: number
  /** Экспоненциальный глайд частоты к концу ноты. */
  to?: number
  detune?: number
  /** Пиковая громкость 0..1. */
  gain: number
  /** Атака, с (по умолчанию 4 мс — без щелчков на старте). */
  attack?: number
  filter?: NoteFilter
}

export type Preset = readonly Note[]

// ─── Ноты ───
const N = {
  G3: 196,
  C4: 261.63,
  E4: 329.63,
  G4: 392,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880,
  C6: 1046.5,
  E6: 1318.5,
  G6: 1568,
  C7: 2093,
  E7: 2637
} as const

// ─── Строительные блоки ───
function tone(at: number, freq: number, dur: number, wave: Wave, gain: number, extra: Partial<Note> = {}): Note {
  return { at, dur, wave, freq, gain, ...extra }
}

function noise(at: number, dur: number, gain: number, filter?: NoteFilter, attack?: number): Note {
  return { at, dur, src: 'noise', gain, filter, attack }
}

function arp(start: number, freqs: readonly number[], step: number, dur: number, wave: Wave, gain: number): Note[] {
  return freqs.map((f, i) => tone(start + i * step, f, dur, wave, gain))
}

/** Колокол: негармонические парциалы синуса. */
function bell(at: number, freq: number, dur: number, gain: number): Note[] {
  return [
    tone(at, freq, dur, 'sine', gain, { attack: 0.002 }),
    tone(at, freq * 2.76, dur * 0.6, 'sine', gain * 0.45, { attack: 0.002 }),
    tone(at, freq * 5.4, dur * 0.35, 'sine', gain * 0.2, { attack: 0.002 })
  ]
}

/** Монеты в лоток: короткие металлические «цзынь» с псевдослучайной (детерминированной) высотой. */
function coins(start: number, count: number, step: number, gain: number): Note[] {
  const out: Note[] = []
  for (let i = 0; i < count; i++) {
    const at = start + i * step + ((i * 37) % 7) * 0.004
    const f = 2800 + ((i * 523) % 1900)
    out.push(tone(at, f, 0.07, 'sine', gain, { attack: 0.001 }))
    out.push(noise(at, 0.02, gain * 0.5, { type: 'highpass', freq: 5000 }, 0.001))
  }
  return out
}

/** Воздушный горн стримера: детюн-пила через лоупасс, лёгкий подъём высоты. */
function horn(at: number, dur: number, gain: number, root = 466): Note[] {
  const f: NoteFilter = { type: 'lowpass', freq: 2600, q: 1 }
  return [
    tone(at, root, dur, 'sawtooth', gain, { to: root * 1.03, attack: 0.01, filter: f }),
    tone(at, root, dur, 'sawtooth', gain, { to: root * 1.03, detune: 14, attack: 0.01, filter: f }),
    tone(at, root * 1.5, dur, 'sawtooth', gain * 0.7, { to: root * 1.545, attack: 0.01, filter: f })
  ]
}

function kick(at: number, gain: number, dur = 0.18): Note {
  return tone(at, 130, dur, 'sine', gain, { to: 40, attack: 0.002 })
}

function repeat(start: number, count: number, step: number, make: (at: number, i: number) => Note[]): Note[] {
  return Array.from({ length: count }, (_, i) => make(start + i * step, i)).flat()
}

// ─── Общие (честные и бюрократические) ───
const common = {
  /** Честный пак: один сухой щелчок и тишина. */
  dry_click: [noise(0, 0.03, 0.32, { type: 'bandpass', freq: 2400, q: 1.2 }, 0.001)],
  soft_click: [noise(0, 0.018, 0.14, { type: 'bandpass', freq: 3200, q: 1.5 }, 0.001)],
  /** Вывод: скучный штамп «шлёп… шлёп». Одинаков во всех паках — бюрократия не темизируется. */
  office_stamp: [
    tone(0, 120, 0.16, 'sine', 0.38, { to: 45, attack: 0.002 }),
    noise(0, 0.07, 0.2, { type: 'lowpass', freq: 900 }, 0.001),
    tone(0.42, 110, 0.14, 'sine', 0.28, { to: 45, attack: 0.002 }),
    noise(0.42, 0.06, 0.14, { type: 'lowpass', freq: 800 }, 0.001)
  ],
  stamp_thud: [tone(0, 110, 0.14, 'sine', 0.32, { to: 45, attack: 0.002 }), noise(0, 0.06, 0.16, { type: 'lowpass', freq: 900 }, 0.001)],
  /** Счёт: матричный принтер и отрыв чека. */
  bill_printer: [
    ...repeat(0, 8, 0.045, (at) => [noise(at, 0.03, 0.1, { type: 'bandpass', freq: 1600, q: 3 }, 0.002)]),
    noise(0.42, 0.16, 0.12, { type: 'highpass', freq: 2500, to: 5000 }, 0.01)
  ],
  honest_sleep: [tone(0, N.E4, 0.7, 'sine', 0.1, { to: N.C4, attack: 0.05 })],
  honest_morning: [tone(0, N.A5 / 2, 0.35, 'sine', 0.08, { attack: 0.03 })]
} satisfies Record<string, Preset>

// ─── Классика: неон-аркада, квадратная волна, «динь-динь» ───
const classic = {
  sq_click: [tone(0, 1320, 0.035, 'square', 0.07, { filter: { type: 'lowpass', freq: 4000 }, attack: 0.001 })],
  sq_spin: [tone(0, 330, 0.16, 'square', 0.08, { to: 990 }), tone(0.02, 495, 0.14, 'square', 0.04, { to: 1485 })],
  sq_tick: [tone(0, 1760, 0.018, 'square', 0.035, { attack: 0.001 })],
  sq_stop: [tone(0, 196, 0.08, 'square', 0.12, { to: 98, attack: 0.001 }), noise(0, 0.04, 0.1, { type: 'lowpass', freq: 1200 }, 0.001)],
  /** Выигрыш = LDW = возврат ставки (пиллар 1: Витрина празднует потерю так же, как выигрыш). */
  sq_fanfare: [
    ...arp(0, [N.C5, N.E5, N.G5, N.C6], 0.07, 0.14, 'square', 0.09),
    tone(0.3, N.C6, 0.45, 'square', 0.05),
    tone(0.3, N.E6, 0.45, 'square', 0.04),
    tone(0.3, N.G6, 0.45, 'square', 0.035),
    tone(0.3, N.C4, 0.45, 'triangle', 0.14),
    tone(0.55, N.C7, 0.12, 'square', 0.03),
    tone(0.66, N.C7, 0.2, 'square', 0.03)
  ],
  sq_bigwin: [
    ...arp(0, [N.C5, N.E5, N.G5, N.C6], 0.06, 0.12, 'square', 0.09),
    ...arp(0.24, [N.E5, N.G5, N.C6, N.E6], 0.06, 0.12, 'square', 0.09),
    tone(0.5, N.C6, 0.8, 'square', 0.05),
    tone(0.5, N.E6, 0.8, 'square', 0.04),
    tone(0.5, N.G6, 0.8, 'square', 0.035),
    tone(0.5, N.C4, 0.8, 'triangle', 0.16),
    ...repeat(0.6, 6, 0.09, (at, i) => [tone(at, i % 2 ? N.G6 : N.C7, 0.08, 'square', 0.03)])
  ],
  sq_jackpot: [
    ...repeat(0, 12, 0.09, (at, i) => [tone(at, i % 2 ? N.G6 : N.C7, 0.08, 'square', 0.04)]),
    ...arp(0.1, [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6], 0.08, 0.16, 'square', 0.08),
    tone(1.1, N.C6, 1.2, 'square', 0.05),
    tone(1.1, N.E6, 1.2, 'square', 0.04),
    tone(1.1, N.G6, 1.2, 'square', 0.035),
    tone(1.1, N.C4, 1.2, 'triangle', 0.18),
    tone(1.1, N.G3, 1.2, 'triangle', 0.1)
  ],
  /** Near-miss: разочарованное «ааах» зала — нисходящий глайд + шум толпы. */
  sq_aaah: [
    tone(0, 520, 0.75, 'triangle', 0.12, { to: 250, attack: 0.06 }),
    tone(0, 523, 0.75, 'sawtooth', 0.04, { to: 252, attack: 0.06, filter: { type: 'lowpass', freq: 1800, to: 450 } }),
    noise(0, 0.75, 0.06, { type: 'bandpass', freq: 900, to: 380, q: 0.8 }, 0.08)
  ],
  /** Депозит: «ка» (ящик кассы) + «чинг» (звонок). */
  sq_kaching: [
    noise(0, 0.05, 0.18, { type: 'bandpass', freq: 3000, q: 2 }, 0.001),
    ...bell(0.06, N.C7, 0.6, 0.12),
    ...bell(0.06, N.E7, 0.5, 0.07),
    noise(0.1, 0.25, 0.07, { type: 'lowpass', freq: 400 }, 0.02)
  ],
  sq_achievement: [...arp(0, [N.G5, N.C6, N.E6, N.G6], 0.08, 0.2, 'square', 0.07), tone(0.32, N.C7, 0.5, 'triangle', 0.08)],
  sq_sleep: arp(0, [N.E5, N.C5, N.G4], 0.22, 0.4, 'triangle', 0.1),
  sq_morning: repeat(0, 2, 0.34, (at) => repeat(at, 3, 0.08, (t) => [tone(t, 2000, 0.05, 'square', 0.035, { attack: 0.001 })])),
  sq_tilt: [
    tone(0, 110, 0.14, 'square', 0.1, { to: 70, filter: { type: 'lowpass', freq: 600 } }),
    tone(0.18, 110, 0.14, 'square', 0.08, { to: 70, filter: { type: 'lowpass', freq: 600 } })
  ],
  sq_casino_night: [
    tone(0, 220, 1.2, 'sawtooth', 0.1, { to: 110, filter: { type: 'lowpass', freq: 900, to: 200 } }),
    tone(0, 330, 1.2, 'sawtooth', 0.06, { to: 165, filter: { type: 'lowpass', freq: 900, to: 200 } })
  ],
  sq_start: arp(0, [N.G4, N.C5, N.E5, N.G5], 0.06, 0.14, 'square', 0.07),
  /** Концовка: тихая каденция без праздника («Выписка молчит» — после неё звука нет). */
  soft_ending: [
    tone(0, N.G4, 0.6, 'triangle', 0.07),
    tone(0, N.B4, 0.6, 'triangle', 0.05),
    tone(0, N.D5, 0.6, 'triangle', 0.04),
    tone(0.55, N.C4, 1.1, 'triangle', 0.08, { attack: 0.02 }),
    tone(0.55, N.E4, 1.1, 'triangle', 0.05, { attack: 0.02 }),
    tone(0.55, N.G4, 1.1, 'triangle', 0.04, { attack: 0.02 })
  ]
} satisfies Record<string, Preset>

// ─── Зал 90-х: электромеханика, реле, колокол, монеты в лоток ───
const hall = {
  relay_click: [noise(0, 0.012, 0.22, { type: 'bandpass', freq: 3500, q: 4 }, 0.001)],
  motor_spin: [
    tone(0, 55, 0.3, 'sawtooth', 0.1, { to: 95, filter: { type: 'lowpass', freq: 320 } }),
    noise(0, 0.012, 0.2, { type: 'bandpass', freq: 3500, q: 4 }, 0.001)
  ],
  ratchet_tick: [noise(0, 0.01, 0.1, { type: 'bandpass', freq: 1400, q: 6 }, 0.001)],
  clunk_stop: [tone(0, 150, 0.1, 'sine', 0.28, { to: 60, attack: 0.001 }), noise(0, 0.06, 0.16, { type: 'lowpass', freq: 600 }, 0.001)],
  bell_coins: [...bell(0, N.E6, 0.5, 0.12), ...bell(0.18, N.E6, 0.5, 0.12), ...coins(0.32, 10, 0.07, 0.05)],
  bell_coins_big: [...repeat(0, 4, 0.16, (at) => bell(at, N.E6, 0.45, 0.11)), ...coins(0.5, 22, 0.05, 0.05)],
  bell_jackpot: [...repeat(0, 24, 0.06, (at, i) => bell(at, i % 2 ? N.G6 : N.E6, 0.12, 0.07)), ...coins(0.4, 34, 0.045, 0.045)],
  /** Near-miss: мотор «сдувается» — электромеханическое «ааах». */
  motor_groan: [
    tone(0, 210, 0.85, 'sawtooth', 0.12, { to: 55, filter: { type: 'lowpass', freq: 800, to: 160 } }),
    tone(0, 140, 0.85, 'square', 0.04, { to: 40, filter: { type: 'lowpass', freq: 500 } })
  ],
  register_90s: [
    ...repeat(0, 4, 0.03, (at) => [noise(at, 0.02, 0.14, { type: 'bandpass', freq: 1800, q: 5 }, 0.001)]),
    ...bell(0.14, N.E7, 0.8, 0.12)
  ],
  bell_achievement: [...bell(0, N.G6, 0.5, 0.1), ...bell(0.15, N.C7, 0.7, 0.1)],
  bell_sleep: [...bell(0, N.C5, 0.9, 0.07), ...bell(0.35, N.G4, 1.1, 0.06)],
  bell_alarm: repeat(0, 14, 0.045, (at) => bell(at, N.E7, 0.05, 0.05)),
  clunk_tilt: [
    tone(0, 150, 0.1, 'sine', 0.24, { to: 60 }),
    tone(0.2, 150, 0.1, 'sine', 0.2, { to: 60 })
  ],
  hall_start: [...bell(0, N.G5, 0.4, 0.09), ...bell(0.14, N.C6, 0.6, 0.09)]
} satisfies Record<string, Preset>

// ─── Стример: гиперболизированные «ДОДЕП!»-горны, бас-дропы, грустный тромбон ───
const streamer = {
  pop_click: [tone(0, 900, 0.05, 'sine', 0.16, { to: 200, attack: 0.001 })],
  whoosh_spin: [
    noise(0, 0.3, 0.12, { type: 'bandpass', freq: 400, to: 3000, q: 1.2 }, 0.05),
    tone(0, 200, 0.25, 'sawtooth', 0.04, { to: 800, filter: { type: 'lowpass', freq: 1500 } })
  ],
  pop_tick: [tone(0, 1200, 0.025, 'sine', 0.05, { to: 600, attack: 0.001 })],
  boom_stop: [kick(0, 0.32)],
  /** «ДО-ДЕП-ДЕЕЕП!» — три горна. Выигрыш = LDW = возврат. */
  airhorn: [kick(0, 0.3), ...horn(0, 0.12, 0.06), ...horn(0.16, 0.12, 0.06), ...horn(0.32, 0.55, 0.06)],
  airhorn_big: [
    kick(0, 0.3),
    ...horn(0, 0.12, 0.06),
    ...horn(0.16, 0.12, 0.06),
    ...horn(0.32, 0.6, 0.06),
    tone(0.32, 80, 1, 'sine', 0.32, { to: 35 })
  ],
  airhorn_jackpot: [
    ...repeat(0, 2, 0.5, (at) => [kick(at, 0.3), ...horn(at, 0.12, 0.055), ...horn(at + 0.16, 0.25, 0.055, 554)]),
    ...repeat(1.0, 3, 0.3, (at) => [tone(at, 600, 0.3, 'sawtooth', 0.04, { to: 1200, filter: { type: 'lowpass', freq: 3000 } })]),
    tone(1.0, 80, 1.3, 'sine', 0.32, { to: 32 }),
    ...horn(1.9, 0.6, 0.06, 699)
  ],
  /** Near-miss: грустный тромбон «ва-ва-ва-вааа». */
  sad_trombone: [
    tone(0, 392, 0.3, 'sawtooth', 0.07, { to: 370, filter: { type: 'lowpass', freq: 1200 }, attack: 0.02 }),
    tone(0.32, 370, 0.3, 'sawtooth', 0.07, { to: 349, filter: { type: 'lowpass', freq: 1200 }, attack: 0.02 }),
    tone(0.64, 349, 0.3, 'sawtooth', 0.07, { to: 330, filter: { type: 'lowpass', freq: 1200 }, attack: 0.02 }),
    tone(0.96, 330, 0.9, 'sawtooth', 0.07, { to: 300, filter: { type: 'lowpass', freq: 1200, to: 400 }, attack: 0.02 })
  ],
  kaching_bass: [
    kick(0, 0.3),
    noise(0, 0.05, 0.18, { type: 'bandpass', freq: 3000, q: 2 }, 0.001),
    ...bell(0.06, N.C7, 0.6, 0.12),
    ...bell(0.06, N.E7, 0.5, 0.07)
  ],
  sub_alert: [...arp(0, [N.C6, N.E6, N.G6, N.C7], 0.05, 0.18, 'triangle', 0.1), ...bell(0.22, N.C7, 0.6, 0.08)],
  lofi_sleep: arp(0, [N.E5, N.D5, N.C5, N.G4], 0.2, 0.45, 'triangle', 0.08),
  stream_start: repeat(0, 3, 0.12, (at, i) => [tone(at, 500 + i * 250, 0.08, 'sine', 0.12, { to: 250 + i * 120, attack: 0.001 })]),
  growl_tilt: [kick(0, 0.3), tone(0, 70, 0.4, 'sawtooth', 0.08, { to: 55, filter: { type: 'lowpass', freq: 400 } })],
  horn_short: [...horn(0, 0.1, 0.05), ...horn(0.13, 0.25, 0.05, 554)]
} satisfies Record<string, Preset>

export const PRESETS = { ...common, ...classic, ...hall, ...streamer } as const satisfies Record<string, Preset>

export type PresetId = keyof typeof PRESETS

/** Длительность пресета, с. */
export function presetDuration(preset: Preset): number {
  return preset.reduce((max, n) => Math.max(max, n.at + n.dur), 0)
}

/** Сдвиг пресета во времени (для склейки последовательностей в один голос). */
export function shiftPreset(preset: Preset, offset: number): Note[] {
  return preset.map((n) => ({ ...n, at: n.at + offset }))
}
