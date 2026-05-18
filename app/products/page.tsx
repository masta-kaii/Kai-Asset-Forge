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
import Link from "next/link"
import { Package, Plus, ImageIcon, Check, Sparkles, Download, Loader2, Wrench, ArrowUpRight, CheckCircle2, Boxes } from "lucide-react"
import { fetchAssetsByStatus } from "@/app/actions/assets"
import { fetchPacks, createNewPack } from "@/app/actions/packs"
import { buildPackDeliverable } from "@/app/actions/pack-builder"
import { autoPackApproved } from "@/app/actions/auto-pack"
import { toast } from "sonner"
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
  const [buildingId, setBuildingId] = useState<string | null>(null)
  const [autoPacking, setAutoPacking] = useState(false)

  const handleAutoPack = async () => {
    if (autoPacking) return
    setAutoPacking(true)
    toast.info("Auto-packing approved assets...")
    try {
      const result = await autoPackApproved()
      if (result.created.length === 0) {
        toast.message(result.skipped[0]?.reason ?? "Nothing to pack — need more approved assets")
      } else {
        const refreshed = await fetchPacks().catch(() => packs)
        setPacks(refreshed)
        const ready = result.created.filter((c) => c.ready).length
        toast.success(
          `Auto-packed ${result.created.length}${ready < result.created.length ? ` (${ready} fully ready)` : ""}`,
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-pack failed")
    } finally {
      setAutoPacking(false)
    }
  }

  const handleBuildDeliverable = async (pack: AssetPack) => {
    setBuildingId(pack.id)
    try {
      const result = await buildPackDeliverable(pack.id)
      if (result.success && result.zipUrl) {
        setPacks((prev) =>
          prev.map((p) =>
            p.id === pack.id
              ? {
                  ...p,
                  zipUrl: result.zipUrl,
                  coverUrl: result.coverUrl,
                  previewGridUrl: result.previewGridUrl,
                  previewUrl: result.previewGridUrl ?? p.previewUrl,
                  slug: result.slug,
                }
              : p,
          ),
        )
        toast.success(`ZIP built — ${result.assetCount} assets packaged`)
      } else {
        toast.error(result.error ?? "Build failed")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Build failed")
    } finally {
      setBuildingId(null)
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Packs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Bundle approved assets into commercial packs and prepare them for itch.io.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleAutoPack}
          disabled={autoPacking || approvedAssets.length === 0}
          title="Group approved assets by type+style and ship as many packs as possible"
        >
          {autoPacking ? <Loader2 className="size-4 animate-spin" /> : <Boxes className="size-4" />}
          {autoPacking ? "Packing..." : "Auto-pack approved"}
        </Button>
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
                    <div key={id} className="aspect-square pixel-bg rounded-md overflow-hidden relative ring-1 ring-border">
                      {asset.previewUrl && (
                        <Image
                          src={asset.previewUrl}
                          alt={asset.name}
                          fill
                          className="object-contain pixel-img p-1"
                          sizes="25vw"
                          unoptimized
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
                  className={`aspect-square pixel-bg rounded-md overflow-hidden relative ring-1 ring-border border-2 transition-colors ${
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
                      className="object-contain pixel-img p-1"
                      sizes="12.5vw"
                      unoptimized
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
                  <div className="size-10 pixel-bg rounded-md flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                    {pack.previewUrl ? (
                      <Image src={pack.previewUrl} alt={pack.title} width={40} height={40} className="object-cover" />
                    ) : (
                      <Package className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pack.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {pack.assets.length} assets · ${pack.price.toFixed(2)}
                      {pack.zipUrl && " · ZIP ready"}
                      {pack.storeUrl && " · uploaded"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!pack.zipUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleBuildDeliverable(pack)}
                        disabled={buildingId === pack.id || !pack.assets.length}
                      >
                        {buildingId === pack.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Wrench className="size-3" />
                        )}
                        Build ZIP
                      </Button>
                    )}
                    {pack.zipUrl && pack.storeUrl ? (
                      <Badge className="text-xs gap-1 bg-green-500/10 text-green-500 border-green-500/20">
                        <CheckCircle2 className="size-2.5" />
                        Live
                      </Badge>
                    ) : pack.zipUrl ? (
                      <Button asChild variant="default" size="sm" className="h-7 text-xs gap-1">
                        <Link href={`/products/upload/${pack.id}`}>
                          Prepare upload
                          <ArrowUpRight className="size-3" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
