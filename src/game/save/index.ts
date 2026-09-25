import { detectVersion, migrate } from './migrations'
import { CURRENT_SAVE_VERSION, createEmptySave, type SaveEnv, type SaveFile } from './schema'
import { isRecord, validateSave } from './validate'

export * from './schema'
export { MIGRATIONS, detectVersion } from './migrations'
export { validateSave } from './validate'

export type ParseResult =
  | { status: 'empty' }
  | { status: 'ok'; save: SaveFile; migratedFrom: number | null }
  /** Сейв из более новой версии игры: загружаем как можем, но не перезаписываем. */
  | { status: 'future'; save: SaveFile; version: number }
  | { status: 'corrupt'; error: string }

/** Текст сейва → SaveFile (миграции + валидация). Чистая функция. */
export function parseSave(text: string | null, env: SaveEnv): ParseResult {
  if (text === null || text.trim() === '') return { status: 'empty' }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (error) {
    return { status: 'corrupt', error: `JSON: ${String(error)}` }
  }
  if (!isRecord(data)) return { status: 'corrupt', error: 'Сейв не является объектом' }

  const version = detectVersion(data)
  if (version > CURRENT_SAVE_VERSION) {
    return { status: 'future', save: validateSave(data, env), version }
  }
  try {
    const save = validateSave(migrate(data, env), env)
    return { status: 'ok', save, migratedFrom: version < CURRENT_SAVE_VERSION ? version : null }
  } catch (error) {
    return { status: 'corrupt', error: String(error) }
  }
}

export function serializeSave(save: SaveFile, meta: { now: number; build: string }): string {
  return JSON.stringify({ ...save, version: CURRENT_SAVE_VERSION, savedAt: meta.now, build: meta.build })
}

/** Сырые тексты из хранилища. */
export interface RawSaves {
  main: string | null
  backup: string | null
  /** Legacy-ключ `dodepaSave` (веб до v1). */
  legacy: string | null
}

export type SaveSource = 'main' | 'backup' | 'legacy' | 'new'

export interface LoadOutcome {
  save: SaveFile
  source: SaveSource
  /** Сейв из будущей версии — не перезаписывать. */
  readOnly: boolean
  /** Нужно сразу записать сейв (миграция или восстановление из бэкапа/legacy). */
  needsWrite: boolean
  warnings: string[]
}

/**
 * Порядок загрузки: основной → бэкап → legacy → новый пустой сейв.
 * Битый источник пропускается с предупреждением.
 */
export function loadSave(raw: RawSaves, env: SaveEnv): LoadOutcome {
  const warnings: string[] = []
  const sources: [Exclude<SaveSource, 'new'>, string | null][] = [
    ['main', raw.main],
    ['backup', raw.backup],
    ['legacy', raw.legacy]
  ]

  for (const [source, text] of sources) {
    const result = parseSave(text, env)
    if (result.status === 'ok') {
      const needsWrite = source !== 'main' || result.migratedFrom !== null
      return { save: result.save, source, readOnly: false, needsWrite, warnings }
    }
    if (result.status === 'future') {
      warnings.push(`Сейв создан более новой версией игры (v${result.version}) — прогресс не будет сохраняться`)
      return { save: result.save, source, readOnly: true, needsWrite: false, warnings }
    }
    if (result.status === 'corrupt') warnings.push(`Сейв (${source}) повреждён: ${result.error}`)
  }

  return { save: createEmptySave(env.now), source: 'new', readOnly: false, needsWrite: false, warnings }
}
