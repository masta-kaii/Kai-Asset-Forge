"use server"

import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { forgeStepScout, forgeStepGenerate, forgeStepFinalize } from "@/app/actions/pipeline-steps"
import type { AssetStyle, AssetType } from "@/lib/types"

const COLLECTION = "pipeline_runs"

export interface PipelineStepEntry {
  step: string
  status: "pending" | "running" | "completed" | "failed"
  summary: string
  error?: string
  cost: number
}

export interface PipelineRun {
  id: string
  status: "running" | "completed" | "failed"
  steps: PipelineStepEntry[]
  theme: string
  startedAt: string
  completedAt?: string
  totalCost: number
  error?: string
}

export async function startForgePipeline(input: {
  theme?: string
}): Promise<{ runId: string; error?: string }> {
  try {
    const theme = input.theme ?? "fantasy creatures"
    const runId = `forge-${Date.now()}`
    const db = getDb()

    const run: PipelineRun = {
      id: runId, status: "running", theme,
      startedAt: new Date().toISOString(), totalCost: 0, steps: [],
    }

    await setDoc(doc(db, COLLECTION, runId), run)
    await runForgePipeline(runId, theme)
    return { runId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Pipeline crashed"
    console.error("startForgePipeline error:", msg)
    return { runId: "", error: msg }
  }
}

async function runForgePipeline(runId: string, theme: string) {
  const db = getDb()
  const ref = doc(db, COLLECTION, runId)
  let currentCost = 0

  const addStep = async (entry: Omit<PipelineStepEntry, "cost">) => {
    const step: PipelineStepEntry = { ...entry, cost: 0 }
    await updateDoc(ref, {
      steps: [...(await getDoc(ref)).data()?.steps ?? [], step],
    })
    return step
  }

  const report = async (result: { step: string; status: string; summary: string; error?: string }) => {
    await addStep({
      step: result.step,
      status: result.status as "completed" | "failed",
      summary: result.summary,
      error: result.error,
    })
  }

  try {
    // Step 0: Scout (market research)
    const s0 = await forgeStepScout({ theme })
    await report(s0)
    if (s0.status === "failed") { await updateDoc(ref, { status: "failed", completedAt: new Date().toISOString(), error: s0.error }); return }
    const proposal = (s0.data as Record<string, unknown>)?.proposal as Record<string, unknown> | undefined

    // Step 1: Generate 1 asset
    const prompt = `Generate a ${proposal?.theme ?? theme} pixel art game asset. ${proposal?.styleAnchor ?? "32px, limited palette, dark outline"}. Game-ready.`
    const s1 = await forgeStepGenerate({
      artDirection: prompt,
      assetType: (proposal?.assetType as AssetType) ?? "creature",
      style: (proposal?.style as AssetStyle) ?? "pixel-art",
      imageProvider: "openai",
    })
    await report(s1)
    const assetId = (s1.data as Record<string, unknown>)?.assetId as string
    if (!assetId) {
      await updateDoc(ref, { status: "failed", completedAt: new Date().toISOString(), error: "Generation failed" })
      return
    }

    // Step 2: Finalize (approve, pack, listing)
    const s2 = await forgeStepFinalize({ assetIds: [assetId], theme })
    await report(s2)

    await updateDoc(ref, { status: "completed", completedAt: new Date().toISOString() })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    console.error("Pipeline error:", msg)
    try {
      await updateDoc(ref, { status: "failed", completedAt: new Date().toISOString(), error: msg })
    } catch {}
  }
}

export async function getPipelineRun(runId: string): Promise<PipelineRun | null> {
  const db = getDb()
  const snap = await getDoc(doc(db, COLLECTION, runId))
  if (!snap.exists()) return null
  return snap.data() as PipelineRun
}
