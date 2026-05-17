"use client"

import { useState, useEffect, useCallback } from "react"
import { getRecentAssets, getAssetsByType } from "@/lib/firebase/assets"
import type { Asset } from "@/lib/types"

interface UseAssetsReturn {
  assets: Asset[]
  loading: boolean
  error: string | null
  filterByType: (type: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useAssets(): UseAssetsReturn {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getRecentAssets(24)
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets")
    } finally {
      setLoading(false)
    }
  }, [])

  const filterByType = useCallback(async (type: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAssetsByType(type)
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to filter assets")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { assets, loading, error, filterByType, refresh }
}
