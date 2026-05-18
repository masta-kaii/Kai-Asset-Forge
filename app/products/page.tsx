"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Package, Plus, ImageIcon, Check, Sparkles, Globe, Loader2 } from "lucide-react"
import { fetchAssetsByStatus } from "@/app/actions/assets"
import { fetchPacks, createNewPack } from "@/app/actions/packs"
import { publishPack } from "@/app/actions/marketplace"
import type { Asset, AssetPack } from "@/lib/types"

export default function ProductBuilderPage() {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("4.99")
  const [approvedAssets, setApprovedAssets] = useState<Asset[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [packs, setPacks] = useState<AssetPack[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set())

  const handlePublishPack = async (pack: AssetPack) => {
    setPublishingId(pack.id)
    try {
      const results = await publishPack(pack)
      results.forEach((r) => {
        if (r.success) setPublishedIds((prev) => new Set([...prev, pack.id]))
      })
    } finally {
      setPublishingId(null)
    }
  }

  useEffect(() => {
    Promise.all([
      fetchAssetsByStatus("approved").then(setApprovedAssets).catch(() => {}),
      fetchPacks().then(setPacks).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const toggleAsset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreatePack = async () => {
    if (!title.trim() || selectedIds.size === 0) return
    setSaving(true)
    setError(null)
    try {
      const pack = await createNewPack({
        title: title.trim(),
        description: description.trim(),
        assets: Array.from(selectedIds),
        price: parseFloat(price) || 4.99,
        previewUrl: approvedAssets.find((a) => selectedIds.has(a.id))?.previewUrl ?? "",
      })
      setPacks((prev) => [pack, ...prev])
      setTitle("")
      setDescription("")
      setPrice("4.99")
      setSelectedIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pack")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Product Builder
          </h1>
          <p className="text-muted-foreground mt-1">
            Create commercial asset packs for marketplace selling
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pack Details</CardTitle>
            <CardDescription>
              Configure your asset pack for distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pack-title">Pack Title</Label>
              <Input
                id="pack-title"
                placeholder="e.g. Tamagotchi Creature Pack Vol.1"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack-desc">Description</Label>
              <Textarea
                id="pack-desc"
                placeholder="Describe your asset pack..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="4.99"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Assets Selected</Label>
                <Badge variant="secondary" className="w-full justify-center py-2">
                  {selectedIds.size} assets
                </Badge>
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button
              className="w-full gap-2"
              onClick={handleCreatePack}
              disabled={saving || !title.trim() || selectedIds.size === 0}
            >
              <Plus className="size-4" />
              {saving ? "Creating..." : "Create Pack"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selected Assets</CardTitle>
            <CardDescription>
              Choose from approved assets below
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedIds.size === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-16 text-center">
                <Package className="size-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  No assets selected
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Select assets from the grid below to include in this pack
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {Array.from(selectedIds).map((id) => {
                  const asset = approvedAssets.find((a) => a.id === id)
                  if (!asset) return null
                  return (
                    <div key={id} className="aspect-square bg-muted rounded-md overflow-hidden relative">
                      {asset.previewUrl && (
                        <Image
                          src={asset.previewUrl}
                          alt={asset.name}
                          fill
                          className="object-cover"
                          sizes="25vw"
                        />
                      )}
                      <div className="absolute top-1 right-1">
                        <div className="size-4 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="size-3 text-white" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="size-5" />
            Approved Assets
          </CardTitle>
          <CardDescription>
            Click to select assets for your pack ({approvedAssets.length} available)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : approvedAssets.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No approved assets yet. Approve assets in the Asset Library first.
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {approvedAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  className={`aspect-square bg-muted rounded-md overflow-hidden relative border-2 transition-colors ${
                    selectedIds.has(asset.id)
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  {asset.previewUrl ? (
                    <Image
                      src={asset.previewUrl}
                      alt={asset.name}
                      fill
                      className="object-cover"
                      sizes="12.5vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Sparkles className="size-6 text-muted-foreground/30" />
                    </div>
                  )}
                  {selectedIds.has(asset.id) && (
                    <div className="absolute top-1 right-1">
                      <div className="size-5 bg-primary rounded-full flex items-center justify-center">
                        <Check className="size-3 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-background/90 to-transparent">
                    <p className="text-[9px] font-medium truncate">{asset.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="size-5" />
            Recent Packs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {packs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              No packs created yet. Start building your first asset pack!
            </div>
          ) : (
            <div className="space-y-3">
              {packs.map((pack) => (
                <div key={pack.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="size-10 bg-muted rounded-md flex items-center justify-center shrink-0">
                    <Package className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pack.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {pack.assets.length} assets · ${pack.price.toFixed(2)}
                      {publishedIds.has(pack.id) && " · published"}
                    </p>
                  </div>
                  {publishedIds.has(pack.id) ? (
                    <Badge className="text-xs shrink-0 bg-green-500/10 text-green-500 border-green-500/20 gap-1">
                      <Globe className="size-2.5" />
                      Live
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 shrink-0"
                      onClick={() => handlePublishPack(pack)}
                      disabled={publishingId === pack.id}
                    >
                      {publishingId === pack.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Globe className="size-3" />
                      )}
                      Publish
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
