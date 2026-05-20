"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, XCircle, Loader2, Package, Sparkles, Activity } from "lucide-react"
import type { Asset } from "@/lib/types"
import { fetchRecentAssets, fetchAssetsByStatus } from "@/app/actions/assets"

export function CuratorPanel() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "review" | "approved" | "rejected">("all")

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = filter === "all"
          ? await fetchRecentAssets(20)
          : await fetchAssetsByStatus(filter)
        setAssets(data)
      } catch { setAssets([]) }
      setLoading(false)
    }
    load()
  }, [filter])

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(["all", "review", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
              filter === f
                ? "bg-yellow-600/20 border border-yellow-600/40 text-yellow-300"
                : "bg-stone-800/50 border border-stone-700/30 text-stone-500 hover:text-stone-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Asset list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-8 w-8 mx-auto mb-2 text-stone-600" />
          <p className="font-mono text-xs text-stone-500">No assets found</p>
          <p className="font-mono text-[10px] text-stone-600 mt-1">Run FORGE to generate some!</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {assets.map((asset) => (
            <div key={asset.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-stone-700/30 bg-stone-800/30 hover:bg-stone-800/50 transition-colors"
            >
              {/* Status dot */}
              <div className={`shrink-0 h-2 w-2 rounded-full ${
                asset.status === "approved" ? "bg-emerald-500" :
                asset.status === "rejected" ? "bg-red-500" :
                asset.status === "review" ? "bg-amber-400" : "bg-stone-600"
              }`} />

              {/* Asset info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-stone-200 truncate">{asset.name || asset.id.slice(0, 12)}</p>
                <div className="flex gap-2 text-[10px] font-mono text-stone-500">
                  <span>{asset.type}</span>
                  <span>·</span>
                  <span>{asset.style}</span>
                  {asset.qualityScore > 0 && (
                    <>
                      <span>·</span>
                      <span className={asset.qualityScore >= 7 ? "text-emerald-400" : asset.qualityScore >= 5 ? "text-amber-400" : "text-red-400"}>
                        QC: {asset.qualityScore}/10
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Tags */}
              {asset.tags?.length > 0 && (
                <div className="hidden sm:flex gap-1">
                  {asset.tags.slice(0, 2).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-stone-700/30 text-[9px] font-mono text-stone-500">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* Status badge */}
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase ${
                asset.status === "approved" ? "bg-emerald-950/50 text-emerald-400 border border-emerald-700/30" :
                asset.status === "rejected" ? "bg-red-950/50 text-red-400 border border-red-700/30" :
                asset.status === "review" ? "bg-amber-950/50 text-amber-400 border border-amber-700/30" :
                "bg-stone-800 text-stone-500 border border-stone-700/30"
              }`}>
                {asset.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
