"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Library, Search, SlidersHorizontal, Grid3X3, List, AlertTriangle, Sparkles, Check, X } from "lucide-react"
import { useAssets } from "@/hooks/use-assets"
import type { AssetType } from "@/lib/types"

const FILTER_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "creature", label: "Creatures" },
  { value: "item", label: "Items" },
  { value: "weapon", label: "Weapons" },
  { value: "food", label: "Food" },
  { value: "accessory", label: "Accessories" },
  { value: "material", label: "Materials" },
  { value: "animation", label: "Animations" },
  { value: "ui-icon", label: "UI Icons" },
]

export default function AssetLibraryPage() {
  const { assets, loading, error, filterByType, refresh, approve, reject } = useAssets()
  const [activeFilter, setActiveFilter] = useState("all")
  const [search, setSearch] = useState("")

  const handleApprove = async (assetId: string) => {
    await approve(assetId)
  }

  const handleReject = async (assetId: string) => {
    await reject(assetId)
  }

  const handleFilter = (filter: string) => {
    setActiveFilter(filter)
    if (filter === "all") {
      refresh()
    } else {
      filterByType(filter)
    }
  }

  const filteredAssets = assets.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q))
    )
  })

  const statusColor: Record<string, string> = {
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    review: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    draft: "bg-muted text-muted-foreground border-border",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Asset Library
        </h1>
        <p className="text-muted-foreground mt-1">
          Browse, search, and manage your generated assets
        </p>
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <SlidersHorizontal className="size-4" />
        </Button>
        <div className="border rounded-lg flex">
          <Button variant="ghost" size="icon" className="rounded-r-none">
            <Grid3X3 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-l-none">
            <List className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTER_TYPES.map((t) => (
          <Badge
            key={t.value}
            variant={activeFilter === t.value ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => handleFilter(t.value)}
          >
            {t.label}
          </Badge>
        ))}
      </div>

      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="py-4 flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle className="size-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-square rounded-none" />
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAssets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            {search || activeFilter !== "all" ? (
              <>
                <Search className="size-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No assets match your filter</p>
                <p className="text-xs text-muted-foreground mt-1">Try a different search or category</p>
              </>
            ) : (
              <>
                <Library className="size-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No assets yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate some assets to see them here
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {filteredAssets.map((asset) => (
            <Card
              key={asset.id}
              className="overflow-hidden group hover:border-primary/50 transition-colors p-0"
            >
              <div className="aspect-square pixel-bg relative">
                {asset.previewUrl ? (
                  <Image
                    src={asset.previewUrl}
                    alt={asset.name}
                    fill
                    className="object-contain pixel-img p-1"
                    sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12vw"
                    unoptimized
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Sparkles className="size-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-1 left-1 right-1 flex items-start justify-between gap-1">
                  <div className="flex flex-col gap-1">
                    {asset.pixelSize && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4 font-mono bg-background/80 backdrop-blur-sm border-border"
                      >
                        {asset.pixelSize}px
                      </Badge>
                    )}
                    {asset.paletteSize ? (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4 font-mono bg-background/80 backdrop-blur-sm border-border"
                      >
                        {asset.paletteSize}c
                      </Badge>
                    ) : null}
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 h-4 ${statusColor[asset.status] ?? ""}`}
                  >
                    {asset.status}
                  </Badge>
                </div>
                {asset.status === "review" && (
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-background/95 via-background/70 to-transparent">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 text-[10px] gap-1 bg-green-500/20 hover:bg-green-500/30 text-green-500 flex-1"
                      onClick={() => handleApprove(asset.id)}
                    >
                      <Check className="size-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 text-[10px] gap-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 flex-1"
                      onClick={() => handleReject(asset.id)}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                )}
              </div>
              <CardContent className="p-2 border-t border-border">
                <p className="text-[11px] font-medium truncate leading-tight">{asset.name}</p>
                <p className="text-[9px] text-muted-foreground capitalize">{asset.type}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
