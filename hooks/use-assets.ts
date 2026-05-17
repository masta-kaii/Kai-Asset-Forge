"use client"

import { useState, useEffect, useCallback } from "react"
import { fetchRecentAssets, fetchAssetsByType, approveAsset, rejectAsset } from "@/app/actions/assets"
import type { Asset } from "@/lib/types"

interface UseAssetsReturn {
  assets: Asset[]
  loading: boolean
  error: string | null
  filterByType: (type: string) => Promise<void>
  refresh: () => Promise<void>
  approve: (assetId: string) => Promise<void>
  reject: (assetId: string) => Promise<void>
}

export function useAssets(): UseAssetsReturn {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRecentAssets(24)
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
      const data = await fetchAssetsByType(type)
      setAssets(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to filter assets")
    } finally {
      setLoading(false)
    }
  }, [])

  const approve = useCallback(async (assetId: string) => {
    try {
      await approveAsset(assetId)
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: "approved" as const } : a))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve asset")
    }
  }, [])

  const reject = useCallback(async (assetId: string) => {
    try {
      await rejectAsset(assetId)
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: "rejected" as const } : a))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject asset")
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { assets, loading, error, filterByType, refresh, approve, reject }
}
