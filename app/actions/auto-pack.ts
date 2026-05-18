"use server"

import { getAssetsByStatus, updateAssetStatus } from "@/lib/firebase/assets"
import { createPack, getPacks } from "@/lib/firebase/packs"
import { buildPackDeliverable } from "@/app/actions/pack-builder"
import { generatePackItchListing } from "@/app/actions/itchio-listing"
import type { Asset, AssetType, AssetStyle } from "@/lib/types"

export interface AutoPackResult {
  created: { packId: string; title: string; assetCount: number; ready: boolean }[]
  skipped: { reason: string; key?: string; count?: number }[]
}

const STYLE_LABEL: Record<AssetStyle, string> = {
  "pixel-art": "Pixel-Art",
  "cute-retro": "Cute Retro",
  "pastel-cyber-fantasy": "Pastel Cyber Fantasy",
  "tamagotchi": "Tamagotchi",
}

const TYPE_LABEL: Record<AssetType, string> = {
  creature: "Creatures",
  accessory: "Accessories",
  item: "Items",
  weapon: "Weapons",
  food: "Food",
  material: "Materials",
  animation: "Animations",
  "ui-icon": "UI Icons",
}

function envInt(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function packTitle(type: AssetType, style: AssetStyle, volume: number): string {
  return `${STYLE_LABEL[style]} ${TYPE_LABEL[type]} Pack — Vol. ${volume}`
}

/**
 * Group approved-but-unpacked assets by (type, style). For each group big
 * enough to ship, mint a pack, build its deliverable, and draft its itch.io
 * listing — so it lands on the cockpit as "ready to upload" without any
 * further operator clicks.
 *
 * Bounded by AUTO_PACK_MIN_BATCH (default 4), AUTO_PACK_MAX_BATCH (default 8),
 * and AUTO_PACK_MAX_PER_TICK (default 2) so a single autonomous tick can't
 * burn the LLM budget on listings.
 */
export async function autoPackApproved(): Promise<AutoPackResult> {
  const minBatch = envInt("AUTO_PACK_MIN_BATCH", 4, 1, 50)
  const maxBatch = envInt("AUTO_PACK_MAX_BATCH", 8, 1, 50)
  const maxPerTick = envInt("AUTO_PACK_MAX_PER_TICK", 2, 1, 10)

  const created: AutoPackResult["created"] = []
  const skipped: AutoPackResult["skipped"] = []

  const [approved, allPacks] = await Promise.all([
    getAssetsByStatus("approved").catch(() => [] as Asset[]),
    getPacks().catch(() => []),
  ])
  const packedIds = new Set(allPacks.flatMap((p) => p.assets ?? []))
  const unpacked = approved.filter((a) => !packedIds.has(a.id))

  if (unpacked.length === 0) {
    skipped.push({ reason: "No unpacked approved assets" })
    return { created, skipped }
  }

  // Group by (type, style).
  const groups = new Map<string, Asset[]>()
  for (const a of unpacked) {
    const key = `${a.type}:${a.style}`
    const list = groups.get(key) ?? []
    list.push(a)
    groups.set(key, list)
  }

  // Sort groups largest-first so the biggest backlog ships first.
  const sortedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)

  for (const [key, assets] of sortedGroups) {
    if (created.length >= maxPerTick) break
    if (assets.length < minBatch) {
      skipped.push({ reason: "Under min batch", key, count: assets.length })
      continue
    }

    const [type, style] = key.split(":") as [AssetType, AssetStyle]
    const batch = assets.slice(0, maxBatch)
    const volume =
      allPacks.filter((p) => (p.title ?? "").startsWith(`${STYLE_LABEL[style]} ${TYPE_LABEL[type]}`)).length + 1
    const title = packTitle(type, style, volume)
    const description = `Auto-packaged ${batch.length} approved ${TYPE_LABEL[type].toLowerCase()} sprites in the ${STYLE_LABEL[style]} style.`

    try {
      const pack = await createPack({
        title,
        description,
        assets: batch.map((a) => a.id),
        price: 4.99,
        status: "review",
        previewUrl: batch[0]?.previewUrl ?? "",
      })

      // Flip assets to draft so they don't get re-picked into another pack.
      await Promise.all(batch.map((a) => updateAssetStatus(a.id, "draft").catch(() => {})))

      const built = await buildPackDeliverable(pack.id)
      let ready = built.success
      if (built.success) {
        const listing = await generatePackItchListing(pack.id)
        ready = listing.success
        if (!listing.success) {
          skipped.push({ reason: `Listing failed: ${listing.error}`, key })
        }
      } else {
        skipped.push({ reason: `Deliverable failed: ${built.error}`, key })
      }

      created.push({ packId: pack.id, title, assetCount: batch.length, ready })
    } catch (err) {
      skipped.push({ reason: err instanceof Error ? err.message : "createPack failed", key })
    }
  }

  return { created, skipped }
}
