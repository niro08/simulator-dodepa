# Симулятор Додепа — инструкции для Claude Code

Ироничный браузерный симулятор лудомана (Vue 3 + TypeScript + Pinia + Vite).
Игра высмеивает азартные игры, а не продвигает их. Цель — релиз в Steam.

## Стек
- Vue 3 (Composition API, `<script setup lang="ts">`), Pinia, Vite
- Чистая игровая логика — `src/game/`, состояние — `src/stores/`, UI — `src/components/`
- Проверка: `npm run type-check`, сборка: `npm run build-only`

## Студия агентов
В `.claude/` установлены агенты и скиллы из
[Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
(MIT, см. `.claude/CCGS-LICENSE`). Движок-специфичные агенты (Godot/Unity/Unreal)
к этому проекту не относятся — используем web-стек выше.
Хуки из оригинального `settings.json` намеренно не подключены.

## Правила
- Отвечай на русском языке
- Дизайн-документы — в `design/`, производственные планы — в `production/`
- Игровые числа (баланс) выносить в константы/данные, не хардкодить в компонентах
