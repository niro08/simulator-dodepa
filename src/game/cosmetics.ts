/**
 * Косметика (CD-19, логика; systems-spec §5.1): владение вычисляется из ачивок, экипировка — в profile.equipped.
 * Косметика не влияет на исходы: этот модуль не импортирует slot.ts и ничего не передаёт в resolveSpin.
 */
import { COSMETIC_KINDS, type CosmeticId, type CosmeticKind, type CosmeticsCatalog, type GameConfig } from './config'
import type { Profile } from './types'

export type EquipRejectReason = 'unknown_cosmetic' | 'not_owned'

/** Разбор `kind:id`; null — не CosmeticId. */
export function parseCosmeticId(value: string): { kind: CosmeticKind; id: string } | null {
  const i = value.indexOf(':')
  if (i <= 0) return null
  const kind = value.slice(0, i)
  const id = value.slice(i + 1)
  return (COSMETIC_KINDS as readonly string[]).includes(kind) && id ? { kind: kind as CosmeticKind, id } : null
}

/** Все CosmeticId каталога текущего билда (порядок: скины, темы, звук, титулы). */
export function catalogIds(catalog: CosmeticsCatalog): CosmeticId[] {
  return [
    ...catalog.skins.map((x) => `skin:${x.id}` as const),
    ...catalog.themes.map((x) => `theme:${x.id}` as const),
    ...catalog.sounds.map((x) => `sound:${x.id}` as const),
    ...catalog.titles.map((x) => `title:${x.id}` as const)
  ]
}

export function isCatalogCosmetic(id: string, catalog: CosmeticsCatalog): id is CosmeticId {
  return (catalogIds(catalog) as string[]).includes(id)
}

/** Ачивки, которые открывают предмет (для «Гардероба»: силуэт + название ачивки). */
export function unlockSourcesOf(id: CosmeticId, config: GameConfig): string[] {
  return config.achievements.filter((a) => a.enabled !== false && a.rewards.includes(id)).map((a) => a.id)
}

/**
 * owned(profile) = DEFAULTS ∪ { rewards(a) | a ∈ profile.achievements } ∩ каталог (systems-spec §5.1).
 * Награды P1, заработанные раньше, появятся сами, как только предмет попадёт в каталог.
 */
export function ownedCosmetics(profile: Profile, config: GameConfig): CosmeticId[] {
  const catalog = config.cosmetics
  const owned = new Set<string>(Object.values(catalog.defaults))
  for (const def of config.achievements) {
    if (profile.achievements[def.id]) def.rewards.forEach((r) => owned.add(r))
  }
  return catalogIds(catalog).filter((id) => owned.has(id))
}

/** Экипировка с умолчаниями: пустой/чужой/не принадлежащий слот → default. */
export function equippedCosmetics(profile: Profile, config: GameConfig): Record<CosmeticKind, CosmeticId> {
  const owned = new Set<string>(ownedCosmetics(profile, config))
  const out = { ...config.cosmetics.defaults } as Record<CosmeticKind, CosmeticId>
  for (const kind of COSMETIC_KINDS) {
    const value = profile.equipped[kind]
    if (value && owned.has(value) && parseCosmeticId(value)?.kind === kind) out[kind] = value as CosmeticId
  }
  return out
}

/**
 * Экипировать предмет (systems-spec §5.1 `meta/equip`): предмет из каталога и во владении; слот = kind.
 * Снимает бейдж «новое» с предмета. Чистая функция: новый профиль или причина отказа.
 */
export function equipCosmetic(
  profile: Profile,
  id: string,
  config: GameConfig
): { ok: true; profile: Profile } | { ok: false; reason: EquipRejectReason } {
  const parsed = parseCosmeticId(id)
  if (!parsed || !isCatalogCosmetic(id, config.cosmetics)) return { ok: false, reason: 'unknown_cosmetic' }
  if (!ownedCosmetics(profile, config).includes(id)) return { ok: false, reason: 'not_owned' }
  return {
    ok: true,
    profile: {
      ...profile,
      equipped: { ...profile.equipped, [parsed.kind]: id },
      unseenCosmetics: profile.unseenCosmetics.filter((x) => x !== id)
    }
  }
}

/** Снять бейдж «новое» (все или перечисленные). */
export function markCosmeticsSeen(profile: Profile, ids?: readonly string[]): Profile {
  if (profile.unseenCosmetics.length === 0) return profile
  const unseen = ids ? profile.unseenCosmetics.filter((x) => !ids.includes(x)) : []
  return { ...profile, unseenCosmetics: unseen }
}
