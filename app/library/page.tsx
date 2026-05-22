"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { X, Search, Grid3X3, ChevronLeft, Sparkles, Loader2 } from "lucide-react"
import "../workstation/kairosoft-theme.css"

interface AssetCategory {
  id: string
  label: string
  icon: string
  count: number
}

interface AssetEntry {
  name: string
  category: string
  type: "spritesheet" | "frame" | "item"
  filename: string
  url: string
  siblingFrames?: { name: string; url: string }[]
}

/** Single asset card with sprite sheet preview */
function AssetCard({ asset, onClick }: { asset: AssetEntry; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group bg-stone-800/60 border border-stone-700/40 rounded-lg overflow-hidden hover:border-amber-600/50 hover:bg-stone-800/90 transition-all p-2 flex flex-col items-center gap-2"
    >
      <div className="relative w-full aspect-square flex items-center justify-center bg-stone-900/80 rounded p-1">
        <Image
          src={asset.url}
          alt={asset.name}
          width={120}
          height={120}
          className="object-contain pixelated max-w-full max-h-full"
          unoptimized
        />
        {asset.type === "spritesheet" && (
          <div className="absolute top-1 right-1 bg-emerald-900/80 text-emerald-400 text-[8px] font-mono px-1 rounded border border-emerald-700/40">
            sheet
          </div>
        )}
      </div>
      <span className="font-mono text-[10px] text-stone-300 group-hover:text-amber-300 transition-colors truncate w-full text-center">
        {asset.name}
      </span>
    </button>
  )
}

/** Full asset detail modal */
function AssetDetail({ asset, onClose }: { asset: AssetEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="kairosoft-window max-w-lg w-[95vw] max-h-[90vh] flex flex-col animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="window-title flex items-center justify-between px-3 py-2 rounded-t-lg">
          <div className="flex items-center gap-2 text-sm font-mono text-yellow-300">
            <Sparkles className="h-4 w-4" />
            <span>{asset.name}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-red-900/50 text-stone-400 hover:text-red-400">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="window-body p-4 overflow-y-auto">
          {/* Main preview */}
          <div className="flex items-center justify-center bg-stone-950/80 rounded-lg p-4 mb-4 border border-stone-700/30">
            <Image
              src={asset.url}
              alt={asset.name}
              width={300}
              height={300}
              className="object-contain pixelated max-h-[300px]"
              unoptimized
            />
          </div>

          {/* Animation frames (for spritesheets) */}
          {asset.siblingFrames && asset.siblingFrames.length > 0 && (
            <div>
              <p className="font-mono text-[10px] text-stone-400 uppercase tracking-wider mb-2">Animation Frames</p>
              <div className="grid grid-cols-3 gap-2">
                {asset.siblingFrames.map((frame, i) => (
                  <div key={i} className="flex flex-col items-center gap-1 bg-stone-800/40 rounded-lg p-2 border border-stone-700/20">
                    <Image
                      src={frame.url}
                      alt={frame.name}
                      width={64}
                      height={64}
                      className="object-contain pixelated"
                      unoptimized
                    />
                    <span className="font-mono text-[9px] text-stone-500">{frame.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="bg-stone-800/40 rounded p-2 border border-stone-700/20">
              <span className="text-stone-500">Category</span>
              <p className="text-stone-300">{asset.category}</p>
            </div>
            <div className="bg-stone-800/40 rounded p-2 border border-stone-700/20">
              <span className="text-stone-500">Type</span>
              <p className="text-stone-300">{asset.type}</p>
            </div>
            <div className="col-span-2 bg-stone-800/40 rounded p-2 border border-stone-700/20">
              <span className="text-stone-500">Filename</span>
              <p className="text-stone-400 text-[9px] break-all">{asset.filename}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LibraryPage() {
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [activeCategory, setActiveCategory] = useState("all")
  const [assets, setAssets] = useState<Record<string, AssetEntry[]>>({})
  const [selectedAsset, setSelectedAsset] = useState<AssetEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/forge/assets?category=${activeCategory}`)
        const data = await res.json()
        if (data.assets) setAssets(data.assets)
        if (data.categories) setCategories(data.categories)
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    setLoading(true)
    load()
  }, [activeCategory])

  // Flatten assets for display
  const allAssets = Object.values(assets).flat()
  const filtered = search
    ? allAssets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : allAssets

  const totalCount = Object.values(assets).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col">
      {/* Kairosoft Header */}
      <div className="shrink-0 flex items-center gap-4 px-4 py-2 bg-stone-900/95 border-b border-amber-900/30 font-mono">
        <Link href="/workstation" className="flex items-center gap-2 text-stone-400 hover:text-amber-400 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          <span className="text-[10px]">Back to Forge</span>
        </Link>
        <div className="w-px h-4 bg-amber-900/40" />
        <h1 className="text-sm text-amber-400 font-bold tracking-wider flex items-center gap-2">
          <Grid3X3 className="h-4 w-4" />
          ASSET LIBRARY
        </h1>
        <div className="w-px h-4 bg-amber-900/40" />
        <span className="text-[9px] text-stone-500">{totalCount} assets</span>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-stone-600" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-stone-800/80 border border-stone-700/40 rounded pl-7 pr-3 py-1 font-mono text-[10px] text-stone-300 w-40 focus:border-amber-600/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-2 bg-stone-900/70 border-b border-stone-800 overflow-x-auto">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1 rounded font-mono text-[10px] transition-all whitespace-nowrap ${
            activeCategory === "all"
              ? "bg-amber-900/30 text-amber-300 border border-amber-700/40"
              : "text-stone-500 hover:text-stone-300 border border-transparent"
          }`}
        >
          📦 All ({totalCount})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-3 py-1 rounded font-mono text-[10px] transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? "bg-amber-900/30 text-amber-300 border border-amber-700/40"
                : "text-stone-500 hover:text-stone-300 border border-transparent"
            }`}
          >
            {cat.icon} {cat.label} ({cat.count})
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-stone-600 font-mono text-sm gap-2">
            <Grid3X3 className="h-8 w-8" />
            <p>No assets found</p>
            {search && <p className="text-xs">Try a different search term</p>}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {filtered.map((asset, i) => (
              <AssetCard
                key={`${asset.category}-${asset.filename}-${i}`}
                asset={asset}
                onClick={() => setSelectedAsset(asset)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Kairosoft bottom bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5 bg-stone-900/95 border-t border-amber-900/20 font-mono text-[9px] text-stone-600">
        <span>KAI ASSET FORGE — Library</span>
        <span>{totalCount} assets · CC0 License</span>
      </div>

      {/* Detail Modal */}
      {selectedAsset && (
        <AssetDetail asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  )
}
