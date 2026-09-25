<template>
  <component
    :is="href ? 'a' : 'div'"
    class="ui-logo"
    :class="[`ui-logo--${size}`, { 'ui-logo--compact': compact }]"
    :href="href"
    :role="href ? undefined : 'img'"
    :aria-label="ariaLabel"
  >
    <span class="ui-logo__mark" aria-hidden="true">
      <svg class="ui-logo__crown" viewBox="0 0 32 22" focusable="false">
        <defs>
          <linearGradient :id="`${uid}-crown`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#FFF6C8" />
            <stop offset=".5" stop-color="#FFC43D" />
            <stop offset="1" stop-color="#B8860B" />
          </linearGradient>
        </defs>
        <path
          d="M2 20 L4 6 L11 13 L16 2 L21 13 L28 6 L30 20 Z"
          :fill="`url(#${uid}-crown)`"
          stroke="#7A4A00"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
        <circle cx="16" cy="2.5" r="2" fill="#FF2BD6" />
        <circle cx="4" cy="6" r="1.6" fill="#00E5FF" />
        <circle cx="28" cy="6" r="1.6" fill="#00E5FF" />
      </svg>
      <span class="ui-logo__word">
        <span class="ui-logo__letters">Д</span>
        <span class="ui-logo__coin">
          <!-- Витрина: монета с ₽ и зубчатым краем -->
          <svg class="ui-logo__coin-face" viewBox="0 0 40 40" focusable="false">
            <defs>
              <radialGradient :id="`${uid}-coin`" cx=".35" cy=".3" r=".8">
                <stop offset="0" stop-color="#FFF6C8" />
                <stop offset=".45" stop-color="#FFC43D" />
                <stop offset="1" stop-color="#B8860B" />
              </radialGradient>
            </defs>
            <circle cx="20" cy="20" r="18.5" fill="#8A5A00" />
            <circle cx="20" cy="20" r="18.5" fill="none" stroke="#FFD34D" stroke-width="2.4" stroke-dasharray="2.2 1.4" />
            <circle cx="20" cy="20" r="15.5" :fill="`url(#${uid}-coin)`" />
            <circle cx="20" cy="20" r="12.5" fill="none" stroke="#B8860B" stroke-width="1" />
            <path
              d="M16 11 h6.5 a5 5 0 0 1 0 10 H16 M16 11 V30 M13 21 h3 M13 25.5 h10"
              fill="none"
              stroke="#7A4A00"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <!-- Изнанка: пунктирная дырка «0₽» -->
          <svg class="ui-logo__coin-hole" viewBox="0 0 40 40" focusable="false">
            <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 3" />
            <text x="20" y="25" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor" class="ui-logo__zero">0₽</text>
          </svg>
        </span>
        <span class="ui-logo__letters">ДЕП</span>
      </span>
    </span>
    <span v-if="!compact" class="ui-logo__casino" aria-hidden="true">КАЗИНО</span>
    <span v-if="!compact && slogan" class="ui-logo__slogan" aria-hidden="true">{{ slogan }}</span>
  </component>
</template>

<script setup lang="ts">
/**
 * Логотип-пародия «ДОДЕП КАЗИНО» (art-bible §3.1). Реальных брендов нет.
 * «О» — монета с ₽; в Изнанке (html[data-layer="iznanka"]) монета становится
 * пунктирной дыркой «0₽», корона падает на строку ниже (статично, rotate 40°).
 * compact — мобильный вариант: только монета с короной + «ДОДЕП».
 */
import { useId } from 'vue'

withDefaults(
  defineProps<{
    compact?: boolean
    size?: 'sm' | 'md' | 'lg'
    slogan?: string
    /** Если задан — логотип становится ссылкой. */
    href?: string
    ariaLabel?: string
  }>(),
  {
    compact: false,
    size: 'md',
    slogan: 'Удача любит смелых*',
    href: undefined,
    ariaLabel: 'ДОДЕП казино'
  }
)

const uid = `logo-${useId()}`
</script>

<style scoped>
.ui-logo {
  --logo-fs: 34px;
  display: inline-grid;
  grid-template-columns: auto;
  justify-items: start;
  row-gap: 2px;
  color: inherit;
  text-decoration: none;
  line-height: 1;
}
.ui-logo--sm { --logo-fs: 22px; }
.ui-logo--lg { --logo-fs: 56px; }
.ui-logo:focus-visible { outline: 3px solid var(--c-focus); outline-offset: 4px; border-radius: var(--r-xs); }

.ui-logo__mark {
  position: relative;
  display: inline-block;
  padding-top: calc(var(--logo-fs) * .42);
}
.ui-logo__crown {
  position: absolute;
  top: 0;
  left: calc(var(--logo-fs) * .02);
  width: calc(var(--logo-fs) * .62);
  height: auto;
  transform: rotate(-12deg);
  transform-origin: 30% 100%;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, .5));
}
.ui-logo__word {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--logo-fs);
  letter-spacing: .01em;
  text-transform: uppercase;
}
.ui-logo__letters {
  background: var(--gold-emboss);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  /* Обводка 1.5px через drop-shadow: -webkit-text-stroke рисует внутренние контуры Unbounded */
  filter: drop-shadow(1px 0 0 var(--neon-magenta)) drop-shadow(-1px 0 0 var(--neon-magenta))
    drop-shadow(0 1px 0 var(--neon-magenta)) drop-shadow(0 -1px 0 var(--neon-magenta))
    drop-shadow(0 0 6px rgba(255, 43, 214, .55));
}
.ui-logo__coin {
  position: relative;
  display: inline-block;
  width: .86em;
  height: .86em;
  margin: 0 .04em;
}
.ui-logo__coin svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.ui-logo__coin-face { filter: drop-shadow(0 0 5px rgba(255, 196, 61, .6)); }
.ui-logo__coin-hole { display: none; color: var(--c-text-muted); }
.ui-logo__zero { font-family: var(--font-mono); }

.ui-logo__casino {
  padding-left: .1em;
  font-family: var(--font-condensed);
  font-weight: 500;
  font-size: calc(var(--logo-fs) * .36);
  letter-spacing: .5em;
  color: var(--c-accent-2);
  text-transform: uppercase;
}
.ui-logo__slogan {
  font-family: var(--font-script);
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}

.ui-logo--compact .ui-logo__mark { padding-top: calc(var(--logo-fs) * .38); }

/* Тема «Утро понедельника»: без свечений и обводки */
:root[data-theme="monday"] .ui-logo__letters {
  background: none;
  color: var(--c-text);
  -webkit-text-fill-color: var(--c-text);
  filter: none;
}
:root[data-theme="monday"] .ui-logo__coin-face,
:root[data-theme="monday"] .ui-logo__crown { filter: none; }

/* Изнанка */
:root[data-layer="iznanka"] .ui-logo__coin-face { display: none; }
:root[data-layer="iznanka"] .ui-logo__coin-hole { display: block; }
:root[data-layer="iznanka"] .ui-logo__letters { filter: none; }
:root[data-layer="iznanka"] .ui-logo__crown {
  top: auto;
  bottom: calc(var(--logo-fs) * -.08);
  left: calc(100% + 2px);
  transform: rotate(40deg);
  filter: none;
}
</style>
