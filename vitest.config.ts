import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Переиспользуем vite.config (алиас @, define __APP_VERSION__)
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      // Тесты лежат рядом с модулем: foo.ts → foo.test.ts
      include: ['src/**/*.test.ts'],
      exclude: [...configDefaults.exclude],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        include: ['src/game/**/*.ts'],
        exclude: ['src/game/**/*.test.ts'],
        // Порог для чистого ядра (ADR-009)
        thresholds: { lines: 90 }
      }
    }
  })
)
