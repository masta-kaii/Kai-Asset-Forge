"use server"

import { getAssetCount } from "@/lib/firebase/assets"
import { getReadyPacks } from "@/lib/firebase/packs"
import { getActiveWorkflows } from "@/lib/firebase/workflows"

export async function getSidebarStats(): Promise<{
  assetsToday: number
  readyPacks: number
  activeAgents: number
}> {
  const [totalAssets, readyPacks, active] = await Promise.all([
    getAssetCount().catch(() => 0),
    getReadyPacks().catch(() => 0),
    getActiveWorkflows().then((w) => w.length).catch(() => 0),
  ])
  return { assetsToday: totalAssets, readyPacks, activeAgents: active }
}
