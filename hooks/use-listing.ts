"use client"

import { useState, useCallback } from "react"
import { generateListing } from "@/app/actions/listings"
import type { AIProvider } from "@/lib/ai/types"

interface UseListingReturn {
  isGenerating: boolean
  error: string | null
  title: string
  description: string
  tags: string[]
  generate: (input: { platform: string; keywords: string; pricingTier: string; provider?: AIProvider }) => Promise<void>
  reset: () => void
}

export function useListing(): UseListingReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState<string[]>([])

  const generate = useCallback(async (input: Parameters<UseListingReturn["generate"]>[0]) => {
    setIsGenerating(true)
    setError(null)
    try {
      const result = await generateListing(input)
      if (!result.success) {
        setError(result.error ?? "Generation failed")
      } else {
        setTitle(result.title)
        setDescription(result.description)
        setTags(result.tags)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const reset = useCallback(() => {
    setTitle("")
    setDescription("")
    setTags([])
    setError(null)
  }, [])

  return { isGenerating, error, title, description, tags, generate, reset }
}
