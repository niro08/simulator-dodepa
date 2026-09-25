import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Правило слоя (architecture.md §1): ядро чистое. Временная замена ESLint-правила до TD-18.
const GAME_DIR = fileURLToPath(new URL('.', import.meta.url))
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random/, 'Math.random'],
  [/\bwindow\./, 'window'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bdocument\./, 'document'],
  [/from ['"](vue|pinia)['"]/, 'импорт vue/pinia'],
  [/from ['"]@\/(platform|components|stores)/, 'импорт platform/components/stores']
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : []
  })
}

describe('чистота src/game', () => {
  it.each(sourceFiles(GAME_DIR))('%s без запрещённых зависимостей', (file) => {
    // Комментарии не проверяем: в них правила слоя упоминаются словами
    const code = readFileSync(file, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    for (const [pattern, name] of FORBIDDEN) expect(code, `${name} в ${file}`).not.toMatch(pattern)
  })
})
