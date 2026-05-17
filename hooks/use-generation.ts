"use client"

import { useState, useCallback } from "react"
import { generateAssets } from "@/app/actions/generate"
import type { AssetType, AssetStyle, Asset } from "@/lib/types"

interface UseGenerationReturn {
  isGenerating: boolean
  error: string | null
  results: { id: string; name: string; type: AssetType; style: AssetStyle; previewUrl: string; status: string }[] | null
  generate: (input: { prompt: string; assetType: AssetType; style: AssetStyle; batchCount: number; quality?: "low" | "medium" | "high" | "auto" }) => Promise<void>
  reset: () => void
}

export function useGeneration(): UseGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<UseGenerationReturn["results"]>(null)

  const generate = useCallback(async (input: Parameters<UseGenerationReturn["generate"]>[0]) => {
    setIsGenerating(true)
    setError(null)
    setResults(null)
    try {
      const result = await generateAssets(input)
      if (!result.success) {
        setError(result.error ?? "Generation failed")
      } else {
        setResults(result.assets)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResults(null)
    setError(null)
  }, [])

  return { isGenerating, error, results, generate, reset }
}
