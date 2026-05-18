import { doc, getDoc, setDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"

const COLLECTION = "config/prompts"

const DEFAULTS = {
  scout: `You are Scout, a market analyst for a pixel-art game asset store.
Research trending game asset types based on the given theme.
Avoid repeating recently generated types.
Return a concrete JSON proposal with theme, assetType, style, count, styleAnchor, targetPrice, rationale, trendingScore.`,
  forge: `Generate pixel art game assets with: 32x32 true pixel art style, limited 16-color palette, sharp pixel edges, no anti-aliasing, no smooth shading, blocky retro aesthetic, transparent background, game-ready sprite.`,
  lister: `You are a marketplace listing expert. Generate SEO-optimized store listings for game asset packs. Include compelling title, persuasive description, and relevant tags. Always disclose AI involvement.`,
}

export async function getPrompt(name: "scout" | "forge" | "lister"): Promise<string> {
  try {
    const db = getDb()
    const snap = await getDoc(doc(db, COLLECTION, name))
    if (!snap.exists()) return DEFAULTS[name]
    return (snap.data().text as string) ?? DEFAULTS[name]
  } catch {
    return DEFAULTS[name]
  }
}

export async function updatePrompt(name: "scout" | "forge" | "lister", delta: string): Promise<void> {
  const db = getDb()
  const current = await getPrompt(name)
  const updated = `${current.trim()}\n\nReflection update (${new Date().toISOString().slice(0, 10)}):\n${delta}`
  await setDoc(doc(db, COLLECTION, name), {
    name,
    text: updated,
    version: ((await getDoc(doc(db, COLLECTION, name))).data()?.version ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  })
}

export async function resetPrompt(name: "scout" | "forge" | "lister"): Promise<void> {
  const db = getDb()
  await setDoc(doc(db, COLLECTION, name), {
    name,
    text: DEFAULTS[name],
    version: 1,
    updatedAt: new Date().toISOString(),
  })
}
