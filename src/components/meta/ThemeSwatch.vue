<template>
  <div class="swatch" :class="`swatch--${size}`" :data-theme="themeId" role="img" :aria-label="ariaLabel">
    <div class="swatch__bar">
      <span class="swatch__logo">ДОДЕП</span>
      <span v-if="size === 'lg'" class="swatch__pill">🎰 {{ WARDROBE.themeSample.balance }}</span>
      <span class="swatch__cta">{{ WARDROBE.themeSample.cta }}</span>
    </div>
    <div class="swatch__body">
      <span class="swatch__panel">
        <span class="swatch__hot">{{ WARDROBE.themeSample.hot }}</span>
        <span class="swatch__win">{{ WARDROBE.themeSample.win }}</span>
      </span>
      <span v-if="size === 'lg'" class="swatch__text">{{ WARDROBE.themeSample.text }}</span>
      <span class="swatch__chips" aria-hidden="true">
        <i style="background: var(--c-accent)" />
        <i style="background: var(--c-accent-2)" />
        <i style="background: var(--c-gold)" />
        <i style="background: var(--c-win)" />
        <i style="background: var(--c-lose)" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WARDROBE } from '@/i18n/ui'

/**
 * Плашка темы (Гардероб): кусочек Витрины на токенах самой темы — `data-theme` на элементе
 * переопределяет --c-* локально (tokens.css задаёт темы селектором атрибута, не :root).
 */
withDefaults(defineProps<{ themeId: string; size?: 'sm' | 'lg'; ariaLabel?: string }>(), {
  size: 'sm',
  ariaLabel: undefined
})
</script>

<style scoped>
.swatch {
  display: grid;
  width: 100%;
  overflow: hidden;
  border-radius: var(--r-sm);
  background: var(--c-page-fx), var(--c-page);
  color: var(--c-text);
  box-shadow: inset 0 0 0 1px var(--c-line);
  font-family: var(--font-body);
}
.swatch__bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--c-panel);
  border-bottom: 2px solid var(--c-line-neon);
}
.swatch__logo {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--fs-xs);
  text-transform: var(--tt-display);
  color: var(--c-gold);
}
.swatch__pill {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: var(--r-pill);
  background: var(--c-panel-2);
  font-size: var(--fs-fine);
}
.swatch__cta {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--c-cta-bg);
  color: var(--c-cta-text);
  font-family: var(--font-condensed);
  font-weight: 700;
  font-size: var(--fs-fine);
}
.swatch__pill + .swatch__cta {
  margin-left: 0;
}
.swatch__body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px;
}
.swatch__panel {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--radius-card);
  background: var(--c-panel);
  box-shadow: var(--shadow-card);
}
.swatch__hot {
  padding: 0 6px;
  border-radius: var(--r-pill);
  background: var(--c-badge-hot-bg);
  color: var(--c-badge-hot-text);
  font-family: var(--font-condensed);
  font-weight: 700;
  font-size: var(--fs-fine);
}
.swatch__win {
  color: var(--c-win);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--fs-xs);
}
.swatch__text {
  flex-basis: 100%;
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
}
.swatch__chips {
  display: inline-flex;
  gap: 3px;
  margin-left: auto;
}
.swatch__chips i {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
}
.swatch--lg .swatch__bar {
  padding: 8px 10px;
}
.swatch--lg .swatch__logo {
  font-size: var(--fs-md);
}
.swatch--lg .swatch__body {
  padding: 12px;
}
</style>
