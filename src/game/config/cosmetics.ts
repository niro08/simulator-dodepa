/**
 * Каталог косметики (CD-19, логика): design/systems-spec.md §5, design/art-bible.md §4.
 * `CosmeticId = \`${kind}:${id}\``. Владение вычисляется из ачивок (game/cosmetics.ts), в сейве не хранится.
 * Названия — i18n COSMETIC_NAMES. Модуль не импортирует slot.ts (economy-v1 §12): скин — только отображение.
 *
 * Скин задаёт 8 эмодзи по тирам выплат в порядке SYMBOL_IDS (art-bible §4):
 * [0] 0.5x (LDW) · [1] 1x · [2] 2x · [3] 5x · [4] 10x · [5] 25x · [6] 777/100x · [7] пустышка.
 * Сопоставление с SymbolId делает src/skins (UI); тест сверяет длину с SYMBOL_IDS.
 * Темы: id совпадают с src/styles/tokens.css (`data-theme`): neon | monday | mirror47 | stream
 * (в systems-spec — monday_morning / mirror_47 / stream_overlay).
 */

export const COSMETIC_KINDS = ['skin', 'theme', 'sound', 'title'] as const
export type CosmeticKind = (typeof COSMETIC_KINDS)[number]
export type CosmeticId = `${CosmeticKind}:${string}`

/** Приоритет разработки (systems-spec §5.6): P0 — в первом релизе, P1/P2 — данные есть, ассеты позже. */
export type CosmeticPriority = 'P0' | 'P1' | 'P2'

export interface SkinDef {
  id: string
  /** 8 эмодзи по тирам выплат (порядок SYMBOL_IDS). */
  symbols: readonly [string, string, string, string, string, string, string, string]
  frameClass: string
  /** Цвет свечения (CSS). null — без свечения. */
  glow: string | null
  reelEasing: string
  /** Задержка остановки барабанов, мс ∈ [80; 200]. */
  stopStaggerMs: number
  /** muted — без взрыва монет и шейка (одинаково для выигрыша и LDW). */
  celebrate: 'full' | 'muted'
  grayscale: boolean
  priority: CosmeticPriority
}

export interface ThemeDef {
  /** = data-theme в tokens.css. */
  id: 'neon' | 'monday' | 'mirror47' | 'stream'
  priority: CosmeticPriority
}

export interface SoundPackDef {
  id: string
  /** Все исходы спина звучат одинаково (sound:honest). Инварианты паков — CD-20. */
  honest: boolean
  priority: CosmeticPriority
}

export interface TitleDef {
  id: string
  priority: CosmeticPriority
}

export interface CosmeticsCatalog {
  skins: readonly SkinDef[]
  themes: readonly ThemeDef[]
  sounds: readonly SoundPackDef[]
  titles: readonly TitleDef[]
  /** Экипировка по умолчанию (всегда во владении). */
  defaults: Readonly<Record<CosmeticKind, CosmeticId>>
}

const EASE_DEFAULT = 'cubic-bezier(.2,.8,.2,1)'

export const COSMETICS = {
  skins: [
    {
      id: 'fruit',
      symbols: ['🍒', '🍋', '🍊', '🍉', '⭐', '💎', '7️⃣', '🤡'],
      frameClass: 'frame-neon',
      glow: 'var(--c-accent)',
      reelEasing: EASE_DEFAULT,
      stopStaggerMs: 150,
      celebrate: 'full',
      grayscale: false,
      priority: 'P0'
    },
    {
      id: 'bandit_90s',
      symbols: ['🍒', '🍋', '🔔', '⭐', '🍀', '💰', '7️⃣', 'BAR'],
      frameClass: 'frame-pixel',
      glow: '#FFB000',
      reelEasing: 'steps(8)',
      stopStaggerMs: 200,
      celebrate: 'full',
      grayscale: false,
      priority: 'P0'
    },
    {
      id: 'clown',
      symbols: ['🎈', '🥧', '🎪', '🤹', '🎭', '🃏', '🤡', '🎺'],
      frameClass: 'frame-circus',
      glow: '#FF2BD6',
      reelEasing: 'cubic-bezier(.34,1.56,.64,1)',
      stopStaggerMs: 150,
      celebrate: 'full',
      grayscale: false,
      priority: 'P0'
    },
    {
      id: 'grey_reality',
      symbols: ['🧾', '🧦', '🥫', '🚌', '🔌', '💊', '🛏️', '▫️'],
      frameClass: 'frame-paper',
      glow: null,
      reelEasing: 'linear',
      stopStaggerMs: 80,
      celebrate: 'muted',
      grayscale: true,
      priority: 'P0'
    },
    {
      id: 'pawnshop',
      symbols: ['🫖', '🚲', '📱', '🎮', '📺', '💻', '💍', '🔑'],
      frameClass: 'frame-tag',
      glow: '#B6FF6A',
      reelEasing: EASE_DEFAULT,
      stopStaggerMs: 150,
      celebrate: 'full',
      grayscale: false,
      priority: 'P1'
    },
    {
      id: 'garden',
      symbols: ['🧅', '🥔', '🥕', '🥒', '🍅', '🌻', '🫙', '🐔'],
      frameClass: 'frame-fence',
      glow: '#FFD86B',
      reelEasing: EASE_DEFAULT,
      stopStaggerMs: 150,
      celebrate: 'full',
      grayscale: false,
      priority: 'P1'
    },
    {
      id: 'gold_vip',
      symbols: ['🎩', '🥂', '💰', '🏆', '🛥️', '💍', '👑', '🧾'],
      frameClass: 'frame-gold',
      glow: '#FFC43D',
      reelEasing: EASE_DEFAULT,
      stopStaggerMs: 150,
      celebrate: 'full',
      grayscale: false,
      priority: 'P1'
    },
    {
      id: 'crypto',
      symbols: ['📉', '🐸', '🪙', '📈', '🐋', '🌕', '🚀', '🧻'],
      frameClass: 'frame-chart',
      glow: '#00FFA3',
      reelEasing: EASE_DEFAULT,
      stopStaggerMs: 150,
      celebrate: 'full',
      grayscale: false,
      priority: 'P1'
    },
    {
      id: 'neon_noir',
      symbols: ['🌧️', '🗝️', '🎷', '🥃', '🕶️', '🌃', '🎩', '🧯'],
      frameClass: 'frame-noir',
      glow: '#FF2BD6',
      reelEasing: EASE_DEFAULT,
      stopStaggerMs: 150,
      celebrate: 'full',
      grayscale: true,
      priority: 'P2'
    }
  ],
  themes: [
    { id: 'neon', priority: 'P0' },
    { id: 'monday', priority: 'P0' },
    { id: 'mirror47', priority: 'P1' },
    { id: 'stream', priority: 'P1' }
  ],
  sounds: [
    { id: 'classic', honest: false, priority: 'P0' },
    { id: 'honest', honest: true, priority: 'P0' },
    { id: 'hall_90s', honest: false, priority: 'P1' },
    { id: 'streamer', honest: false, priority: 'P1' }
  ],
  titles: [
    { id: 'client', priority: 'P0' },
    { id: 'newbie', priority: 'P0' },
    { id: 'celebrant', priority: 'P0' },
    { id: 'three_axes', priority: 'P0' },
    { id: 'lucky', priority: 'P0' },
    { id: 'shock_worker', priority: 'P0' },
    { id: 'borrower', priority: 'P0' },
    { id: 'skeptic', priority: 'P0' },
    { id: 'enlightened', priority: 'P0' },
    { id: 'all_bottoms', priority: 'P0' }
  ],
  defaults: { skin: 'skin:fruit', theme: 'theme:neon', sound: 'sound:classic', title: 'title:client' }
} as const satisfies CosmeticsCatalog
