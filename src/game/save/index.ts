import { detectVersion, migrate } from './migrations'
import { CURRENT_SAVE_VERSION, createEmptySave, type SaveEnv, type SaveFile } from './schema'
import { isRecord, validateSave } from './validate'

export * from './schema'
export { MIGRATIONS, detectVersion } from './migrations'
export { validateSave } from './validate'

export type ParseResult =
  | { status: 'empty' }
  /** droppedRun — миграция закрыла старый забег (v0/v1 → v2, TD-07): игроку нужно об этом сказать (QA-05). */
  | { status: 'ok'; save: SaveFile; migratedFrom: number | null; droppedRun: boolean }
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
    return {
      status: 'ok',
      save,
      migratedFrom: version < CURRENT_SAVE_VERSION ? version : null,
      droppedRun: hadRunDroppedByMigration(data, version)
    }
  } catch (error) {
    return { status: 'corrupt', error: String(error) }
  }
}

/** Миграция v1 → v2 сбрасывает забег: v0 — это всегда забег, v1 — если в нём был `run`. */
function hadRunDroppedByMigration(data: Record<string, unknown>, version: number): boolean {
  if (version === 0) return true
  return version === 1 && isRecord(data.run)
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

/** Одноразовые сообщения игроку по итогам загрузки. `legacy_run_reset` — старый забег закрыт миграцией. */
export type SaveNotice = 'legacy_run_reset'

export interface LoadOutcome {
  save: SaveFile
  source: SaveSource
  /** Сейв из будущей версии — не перезаписывать. */
  readOnly: boolean
  /** Нужно сразу записать сейв (миграция или восстановление из бэкапа/legacy). */
  needsWrite: boolean
  warnings: string[]
  notices: SaveNotice[]
}

/**
 * Порядок загрузки: основной → бэкап → legacy → новый пустой сейв.
 * Битый источник пропускается с предупреждением.
 */
export function loadSave(raw: RawSaves, env: SaveEnv): LoadOutcome {
  const warnings: string[] = []
  const notices: SaveNotice[] = []
  const sources: [Exclude<SaveSource, 'new'>, string | null][] = [
    ['main', raw.main],
    ['backup', raw.backup],
    ['legacy', raw.legacy]
  ]

  for (const [source, text] of sources) {
    const result = parseSave(text, env)
    if (result.status === 'ok') {
      const needsWrite = source !== 'main' || result.migratedFrom !== null
      if (result.droppedRun) notices.push('legacy_run_reset')
      return { save: result.save, source, readOnly: false, needsWrite, warnings, notices }
    }
    if (result.status === 'future') {
      warnings.push(`Сейв создан более новой версией игры (v${result.version}) — прогресс не будет сохраняться`)
      return { save: result.save, source, readOnly: true, needsWrite: false, warnings, notices }
    }
    if (result.status === 'corrupt') warnings.push(`Сейв (${source}) повреждён: ${result.error}`)
  }

  // Битый legacy при пустых основном слоте и бэкапе: пишем пустой сейв, чтобы старый ключ можно было удалить
  // (иначе warning при каждой загрузке, QA-05). Битые основной/бэкап не затираем до первой записи (R-10).
  const onlyLegacyBroken = raw.legacy !== null && isBlank(raw.main) && isBlank(raw.backup)
  return { save: createEmptySave(env.now), source: 'new', readOnly: false, needsWrite: onlyLegacyBroken, warnings, notices }
}

function isBlank(text: string | null): boolean {
  return text === null || text.trim() === ''
}
