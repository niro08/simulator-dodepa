<template>
  <MetaScreen :title="WARDROBE.title" :counter="META.counter(ownedCount, game.cosmetics.items.length)" width="lg">
    <div class="wr">
      <div class="wr__main">
        <div class="wr__tabs" role="tablist" :aria-label="WARDROBE.tabsAria">
          <button
            v-for="k in COSMETIC_KINDS"
            :id="`wr-tab-${k}`"
            :key="k"
            type="button"
            role="tab"
            class="wr__tab"
            :aria-selected="kind === k"
            :aria-controls="`wr-panel`"
            :tabindex="kind === k ? 0 : -1"
            @click="setKind(k)"
            @keydown.right.prevent="stepKind(1)"
            @keydown.left.prevent="stepKind(-1)"
          >
            <span aria-hidden="true">{{ COSMETIC_KIND[k].icon }}</span> {{ COSMETIC_KIND[k].tab }}
            <span v-if="unseenBy[k] > 0" class="wr__tab-new" :aria-label="`${unseenBy[k]} ${WARDROBE.newAria}`">
              {{ unseenBy[k] }}
            </span>
          </button>
        </div>

        <p v-if="onlyDefaults" class="wr__empty">{{ WARDROBE.onlyDefault }}</p>

        <ul
          id="wr-panel"
          ref="gridEl"
          class="wr__grid"
          :class="`wr__grid--${kind}`"
          role="tabpanel"
          :aria-labelledby="`wr-tab-${kind}`"
          @keydown="onGridKey"
        >
          <li v-for="item in items" :key="item.id">
            <button
              type="button"
              class="wr-card paper"
              :class="{
                'wr-card--locked': !item.owned,
                'wr-card--on': item.equipped,
                'wr-card--sel': selectedId === item.id
              }"
              :aria-pressed="selectedId === item.id"
              :aria-label="cardLabel(item)"
              :data-id="item.id"
              @click="select(item.id)"
              @dblclick="item.owned && equip(item.id)"
            >
              <Badge v-if="freshIds.has(item.id)" kind="new" corner :animated="!theme.motionReduced.value" :aria-label="WARDROBE.newAria" />
              <span class="wr-card__look" aria-hidden="true">
                <SkinReels v-if="item.kind === 'skin'" :skin-id="item.id" :locked="!item.owned" />
                <ThemeSwatch v-else-if="item.kind === 'theme'" :theme-id="themeKey(item.id)" :class="{ 'wr-card__sil': !item.owned }" />
                <span v-else class="wr-card__glyph" :class="{ 'wr-card__sil': !item.owned }">
                  {{ COSMETIC_KIND[item.kind].icon }}
                </span>
              </span>
              <span class="wr-card__name">{{ COSMETIC_NAMES[item.id] }}</span>
              <span v-if="item.equipped" class="wr-card__state wr-card__state--on">{{ WARDROBE.equipped }}</span>
              <span v-else-if="!item.owned" class="wr-card__state">
                {{ WARDROBE.locked }}<template v-if="sourceTitle(item)"> · {{ sourceTitle(item) }}</template>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <aside v-if="selected" class="wr__preview paper" aria-live="polite" :aria-label="WARDROBE.preview">
        <p class="wr__preview-k">{{ WARDROBE.preview }} · {{ COSMETIC_KIND[selected.kind].one }}</p>

        <div class="wr__stage">
          <SkinReels
            v-if="selected.kind === 'skin'"
            :skin-id="selected.id"
            size="lg"
            :locked="!selected.owned"
            :aria-label="skinAria(selected.id)"
          />
          <ThemeSwatch
            v-else-if="selected.kind === 'theme'"
            :theme-id="themeKey(selected.id)"
            size="lg"
            :class="{ 'wr-card__sil': !selected.owned }"
            :aria-label="COSMETIC_NAMES[selected.id]"
          />
          <p v-else-if="selected.kind === 'title'" class="wr__title-stamp" :class="{ 'wr-card__sil': !selected.owned }">
            {{ WARDROBE.titlePrefix }} <b>🏷 {{ COSMETIC_NAMES[selected.id] }}</b>
          </p>
          <p v-else class="wr__sound">{{ WARDROBE.soundDesc[selected.id] }}</p>
        </div>

        <h2 class="wr__name">{{ COSMETIC_NAMES[selected.id] }}</h2>

        <p v-if="!selected.owned && selected.unlockedBy.length === 0" class="wr__lock wr__lock-k">
          {{ WARDROBE.locked }}. {{ WARDROBE.noSource }}
        </p>
        <div v-else-if="!selected.owned" class="wr__lock">
          <p class="wr__lock-k">{{ WARDROBE.locked }}. {{ WARDROBE.unlockBy }}</p>
          <ul class="wr__sources">
            <li v-for="(src, i) in selected.unlockedBy" :key="src.id">
              <span v-if="i > 0" class="wr__or">{{ WARDROBE.unlockOr }} </span>
              <template v-if="isSecret(src.id)">{{ WARDROBE.hiddenAch }}</template>
              <template v-else>
                <b>«{{ achievementText(src.id).title }}»</b> — {{ achievementText(src.id).condition }}
                <span v-if="progressOf(src.id)" class="wr__progress">
                  {{ ACHIEVEMENTS_SCREEN.progress(progressOf(src.id)!.current, progressOf(src.id)!.target) }}
                  {{ ACHIEVEMENTS_SCREEN.scope[progressOf(src.id)!.scope] }}
                </span>
              </template>
            </li>
          </ul>
        </div>
        <p v-else-if="selected.unlockedBy.length === 0" class="wr__src">{{ WARDROBE.default }}</p>
        <p v-else class="wr__src">✓ «{{ achievementText(selected.unlockedBy[0]!.id).title }}»</p>

        <button
          type="button"
          class="paper-btn wr__equip"
          :class="{ 'paper-btn--primary': selected.owned && !selected.equipped }"
          :aria-disabled="!selected.owned || selected.equipped"
          @click="equip(selected.id)"
        >
          <template v-if="selected.equipped">{{ WARDROBE.equipped }}</template>
          <template v-else-if="!selected.owned">🔒 {{ WARDROBE.equip }}</template>
          <template v-else>{{ WARDROBE.equip }} <kbd>Enter</kbd></template>
        </button>

        <p class="wr__honest">{{ honestLine }}</p>
      </aside>
      <p class="wr__foot">{{ honestLine }}</p>
    </div>
  </MetaScreen>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { COSMETIC_KINDS, type CosmeticItemView, type CosmeticKind } from '@/game'
import { COSMETIC_NAMES, achievementText } from '@/i18n'
import { ACHIEVEMENTS_SCREEN, COSMETIC_KIND, META, WARDROBE } from '@/i18n/ui'
import { skinDef } from '@/skins'
import { useGameStore } from '@/stores/game'
import { useTheme } from '@/composables/useTheme'
import { useToasts } from '@/composables/useToasts'
import Badge from '@/components/ui/Badge.vue'
import MetaScreen from './MetaScreen.vue'
import SkinReels from './SkinReels.vue'
import ThemeSwatch from './ThemeSwatch.vue'

/**
 * S03 Гардероб (ux-flows §6, systems-spec §5, art-bible §4). Вкладки: скины / темы / звук-паки / титулы.
 * Карточка выбирает вещь в превью, «Надеть» (или Enter / двойной клик) — store.equip, сохраняется сразу.
 * Закрытое — силуэт, 🔒 и название ачивки с условием и прогрессом (скрытая — «???»).
 * NEW: бейдж у вещей из cosmetics.unseen; при показе вкладки они помечаются просмотренными
 * (markCosmeticsSeen), но бейдж остаётся до ухода с экрана — иначе его никто не увидит.
 * Превью без демо-спина: гардероб не тренажёр слота.
 */
const game = useGameStore()
const theme = useTheme()
const toasts = useToasts()

// С тоста «В гардероб →» — сразу на вкладку и к новой вещи
const firstNew = game.cosmetics.items.find((i) => i.unseen)
const kind = ref<CosmeticKind>(firstNew?.kind ?? 'skin')
const selectedId = ref<string>(firstNew?.id ?? game.cosmetics.equipped[kind.value])
const gridEl = ref<HTMLElement | null>(null)
/** Показанные на этом визите как NEW (переживают markCosmeticsSeen). */
const freshIds = ref(new Set<string>())

const items = computed(() => game.cosmetics.items.filter((i) => i.kind === kind.value))
const selected = computed(() => items.value.find((i) => i.id === selectedId.value) ?? items.value[0] ?? null)
const ownedCount = computed(() => game.cosmetics.items.filter((i) => i.owned).length)
const onlyDefaults = computed(() => game.cosmetics.owned.length <= COSMETIC_KINDS.length)
const unseenBy = computed(() => {
  const out = { skin: 0, theme: 0, sound: 0, title: 0 } as Record<CosmeticKind, number>
  for (const i of game.cosmetics.items) if (i.unseen && i.kind !== kind.value) out[i.kind]++
  return out
})
const honestLine = computed(() =>
  kind.value === 'skin'
    ? `${WARDROBE.honest} ${WARDROBE.tiersHonest}`
    : kind.value === 'theme'
      ? WARDROBE.themeHonest
      : kind.value === 'sound'
        ? WARDROBE.soundHonest
        : WARDROBE.titleWhere
)

const themeKey = (id: string) => id.replace(/^theme:/, '')
const isSecret = (achId: string) => game.achievements.find((a) => a.id === achId)?.secret ?? true
const progressOf = (achId: string) => game.achievements.find((a) => a.id === achId)?.progress ?? null

function sourceTitle(item: CosmeticItemView): string {
  const src = item.unlockedBy[0]
  if (!src) return ''
  return isSecret(src.id) ? META.unknown : `«${achievementText(src.id).title}»`
}

function cardLabel(item: CosmeticItemView): string {
  const parts = [COSMETIC_NAMES[item.id] ?? item.id]
  if (item.equipped) parts.push(WARDROBE.equipped)
  else if (!item.owned) parts.push(META.locked)
  if (freshIds.value.has(item.id)) parts.push(WARDROBE.newAria)
  return parts.join(', ')
}

function skinAria(id: string): string {
  const s = skinDef(id)
  return s.symbols.map((sym, i) => `${WARDROBE.tiers[i]}: ${sym}`).join(', ')
}

/** Снять NEW с вещей текущей вкладки (бейдж досидит до ухода с экрана). */
function markTabSeen() {
  const ids = items.value.filter((i) => i.unseen).map((i) => i.id)
  if (ids.length === 0) return
  ids.forEach((id) => freshIds.value.add(id))
  game.markCosmeticsSeen(ids)
}

function setKind(k: CosmeticKind) {
  kind.value = k
  selectedId.value = game.cosmetics.equipped[k]
}

async function stepKind(dir: 1 | -1) {
  const i = COSMETIC_KINDS.indexOf(kind.value)
  setKind(COSMETIC_KINDS[(i + dir + COSMETIC_KINDS.length) % COSMETIC_KINDS.length] as CosmeticKind)
  await nextTick()
  document.getElementById(`wr-tab-${kind.value}`)?.focus()
}

function select(id: string) {
  selectedId.value = id
}

function equip(id: string) {
  const item = game.cosmetics.items.find((i) => i.id === id)
  if (!item || item.equipped) return
  if (!item.owned || game.equip(id) !== null) {
    toasts.push({ kind: 'error', name: WARDROBE.equipFailed })
  }
}

/** 2D-стрелки по сетке карточек; Enter на выбранной — надеть. */
function onGridKey(event: KeyboardEvent) {
  const grid = gridEl.value
  if (!grid) return
  const buttons = [...grid.querySelectorAll<HTMLButtonElement>('.wr-card')]
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
  if (i < 0) return
  if (event.key === 'Enter' && selectedId.value === buttons[i]?.dataset.id) {
    event.preventDefault()
    equip(selectedId.value)
    return
  }
  const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length || 1
  const delta: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }
  const d = delta[event.key]
  if (d === undefined) return
  event.preventDefault()
  const next = buttons[Math.min(buttons.length - 1, Math.max(0, i + d))]
  next?.focus()
  if (next?.dataset.id) select(next.dataset.id)
}

watch(kind, markTabSeen)
onMounted(markTabSeen)
</script>

<style scoped>
.wr {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--sp-4);
  align-items: start;
}
.wr__main {
  display: grid;
  gap: var(--sp-3);
  min-width: 0;
}
.wr__tabs {
  display: flex;
  gap: var(--sp-2);
  overflow-x: auto;
  scrollbar-width: thin;
  padding-bottom: 4px;
}
.wr__tab {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: var(--tap-min);
  padding: 0 var(--sp-3);
  border: 2px solid var(--ink);
  border-radius: var(--r-xs);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
  white-space: nowrap;
}
.wr__tab[aria-selected='true'] {
  background: var(--ink);
  color: var(--paper-white);
}
.wr__tab:focus-visible {
  outline: 2px solid var(--c-focus);
  outline-offset: 2px;
}
.wr__tab-new {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  border-radius: var(--r-pill);
  background: #ffff00;
  color: #0b0620;
  font-size: var(--fs-fine);
  box-shadow: 0 0 0 1px #ff2bd6;
}
.wr__empty {
  padding: var(--sp-2) var(--sp-3);
  border-left: 3px solid var(--c-gold);
  background: var(--c-panel);
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}

.wr__grid {
  display: grid;
  gap: var(--sp-3);
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
}
.wr__grid--title,
.wr__grid--sound {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}
.wr-card {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: var(--sp-2);
  width: 100%;
  height: 100%;
  min-height: 140px;
  padding: var(--sp-3) var(--sp-2);
  border: 1px solid var(--ink);
  color: var(--ink);
  text-align: center;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: transform var(--t-fast) var(--ease-out);
}
.wr-card:hover {
  transform: translateY(-2px);
}
.wr-card--locked {
  border-style: dashed;
  border-color: var(--ink-muted);
  background: var(--paper-2);
}
.wr-card--on {
  box-shadow: 3px 3px 0 var(--stamp-green);
}
.wr-card--sel {
  outline: 3px solid var(--c-gold);
  outline-offset: 2px;
}
.wr-card:focus-visible {
  outline: 3px solid var(--stamp-blue);
  outline-offset: 2px;
}
.wr-card__look {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 56px;
}
.wr-card__glyph {
  font-family: var(--font-emoji);
  font-size: 36px;
  line-height: 1;
}
.wr-card__sil {
  filter: grayscale(1) brightness(0.55) opacity(0.45);
}
.wr-card__name {
  text-wrap: balance;
  font-family: var(--font-condensed);
  font-size: var(--fs-md);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.wr-card__state {
  font-size: var(--fs-xs);
  color: var(--ink-muted);
  line-height: 1.35;
}
.wr-card__state--on {
  color: var(--stamp-green);
  font-weight: 700;
}
.wr-card :deep(.ui-badge--corner) {
  top: -14px;
  right: -12px;
}
@media (prefers-reduced-motion: reduce) {
  .wr-card {
    transition: none;
  }
  .wr-card:hover {
    transform: none;
  }
}

.wr__preview {
  position: sticky;
  top: var(--sp-4);
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-4);
  color: var(--ink);
}
.wr__preview-k {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
.wr__stage {
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: var(--sp-3);
  border-radius: var(--r-sm);
  background: #0b0620;
}
.wr__title-stamp {
  padding: var(--sp-2) var(--sp-3);
  border: 3px double var(--stamp-red);
  color: var(--stamp-red);
  background: var(--paper);
  font-family: var(--font-mono);
  font-size: var(--fs-md);
  transform: rotate(-4deg);
}
.wr__sound {
  color: #f4f1ff;
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  line-height: 1.45;
}
.wr__name {
  font-family: var(--font-condensed);
  font-size: var(--fs-xl);
  line-height: var(--lh-snug);
}
.wr__lock {
  display: grid;
  gap: 4px;
  font-size: var(--fs-sm);
}
.wr__lock-k {
  font-family: var(--font-mono);
  font-weight: 700;
}
.wr__sources {
  display: grid;
  gap: 4px;
}
.wr__or {
  color: var(--ink-muted);
}
.wr__progress {
  display: inline-block;
  margin-left: 4px;
  padding: 0 6px;
  border: 1px solid var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  white-space: nowrap;
}
.wr__src {
  font-size: var(--fs-sm);
  color: var(--ink-muted);
}
.wr__equip {
  width: 100%;
}
.wr__honest {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--ink-muted);
  line-height: 1.45;
}

.wr__foot {
  display: none;
}
@media (max-width: 899px) {
  /* Мобильный (ux-flows S03): вкладки → компактное превью, закреплённое сверху → сетка → честная строка */
  .wr {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sp-3);
  }
  .wr__main {
    display: contents;
  }
  .wr__tabs {
    order: 0;
  }
  .wr__empty {
    order: 1;
  }
  .wr__preview {
    order: 2;
    position: sticky;
    top: 0;
    z-index: 2;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'stage name'
      'stage btn'
      'lock lock';
    align-items: center;
    gap: var(--sp-2) var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    box-shadow: var(--shadow-paper);
  }
  .wr__grid {
    order: 3;
  }
  .wr__foot {
    order: 4;
    display: block;
    color: var(--c-text-muted);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .wr__preview-k,
  .wr__honest {
    display: none;
  }
  .wr__stage {
    grid-area: stage;
    min-height: 0;
    padding: var(--sp-2);
  }
  .wr__name {
    grid-area: name;
    align-self: end;
    font-size: var(--fs-md);
  }
  .wr__equip {
    grid-area: btn;
    align-self: start;
  }
  .wr__lock,
  .wr__src {
    grid-area: lock;
    font-size: var(--fs-xs);
  }
  .wr__stage :deep(.skin-reels--lg) {
    --cell: 26px;
    padding: 6px;
  }
  .wr__stage :deep(.skin-reels--lg .skin-reels__window) {
    gap: 3px;
  }
  .wr__stage :deep(.skin-reels__tier) {
    display: none;
  }
  .wr__stage :deep(.skin-reels--lg .skin-reels__cell) {
    min-height: var(--cell);
  }
  .wr__stage :deep(.swatch) {
    width: 140px;
  }
  .wr__title-stamp {
    font-size: var(--fs-xs);
  }
  .wr__sound {
    max-width: 140px;
    font-size: var(--fs-fine);
  }
}
@media (max-width: 599px) {
  .wr__grid,
  .wr__grid--title,
  .wr__grid--sound {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sp-2);
  }
  .wr__honest,
  .wr__lock {
    font-size: var(--fs-xs);
  }
}
</style>
