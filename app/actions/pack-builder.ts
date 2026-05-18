"use server"

import { getAssetById } from "@/lib/firebase/assets"
import { getPackById, updatePackDeliverable } from "@/lib/firebase/packs"
import { uploadAssetBuffer } from "@/lib/firebase/storage"
import { buildPack, slugify, type PackAssetInput } from "@/lib/pack/builder"

export interface PackDeliverableResult {
  success: boolean
  packId: string
  slug?: string
  zipUrl?: string
  coverUrl?: string
  previewGridUrl?: string
  assetCount?: number
  error?: string
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

/**
 * Build the buyer-facing deliverable for a pack: organized ZIP, preview grid,
 * itch.io cover, README. Uploads to Firebase Storage and writes the URLs back
 * onto the pack document.
 */
export async function buildPackDeliverable(packId: string): Promise<PackDeliverableResult> {
  try {
    const pack = await getPackById(packId)
    if (!pack) return { success: false, packId, error: "Pack not found" }
    if (!pack.assets || pack.assets.length === 0) {
      return { success: false, packId, error: "Pack has no assets" }
    }

    const slug = pack.slug ?? slugify(pack.title || `pack-${packId}`)

    // Fetch all asset records.
    const assetRecords = await Promise.all(pack.assets.map((id) => getAssetById(id)))
    const present = assetRecords.filter((a): a is NonNullable<typeof a> => a !== null)
    if (present.length === 0) {
      return { success: false, packId, error: "None of the pack's assets could be loaded" }
    }

    // Download raw + preview buffers.
    const inputs: PackAssetInput[] = await Promise.all(
      present.map(async (a) => {
        const rawUrl = a.rawAssetUrl || a.previewUrl
        const previewUrl = a.previewUrl || a.rawAssetUrl
        const [raw, preview] = await Promise.all([fetchBuffer(rawUrl), fetchBuffer(previewUrl)])
        return {
          raw,
          preview,
          filename: a.name,
          type: a.type,
          pixelSize: a.pixelSize,
        }
      }),
    )

    const built = await buildPack(
      {
        title: pack.title,
        description: pack.description,
        slug,
        price: pack.price,
        aiDisclosure: true,
      },
      inputs,
    )

    const stamp = Date.now()
    const [zipUrl, coverUrl, previewGridUrl] = await Promise.all([
      uploadAssetBuffer(
        new Uint8Array(built.zip),
        `packs/${slug}/${stamp}-${slug}.zip`,
        "application/zip",
      ),
      uploadAssetBuffer(
        new Uint8Array(built.cover),
        `packs/${slug}/${stamp}-cover.png`,
        "image/png",
      ),
      uploadAssetBuffer(
        new Uint8Array(built.previewGrid),
        `packs/${slug}/${stamp}-preview.png`,
        "image/png",
      ),
    ])

    await updatePackDeliverable(packId, {
      slug,
      zipUrl,
      coverUrl,
      previewGridUrl,
      previewUrl: previewGridUrl,
      readmeText: built.readmeText,
    })

    return {
      success: true,
      packId,
      slug,
      zipUrl,
      coverUrl,
      previewGridUrl,
      assetCount: inputs.length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build pack deliverable"
    console.error("buildPackDeliverable error:", message)
    return { success: false, packId, error: message }
  }
}
