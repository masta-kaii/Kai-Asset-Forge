"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { useAssets } from "@/hooks/use-assets"
import { Check, X, SkipForward, CheckCheck, XCircle, AlertTriangle, Sparkles } from "lucide-react"

export default function ReviewPage() {
  const { assets, loading, error, refresh, approve, reject } = useAssets()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reviewIndex, setReviewIndex] = useState(0)

  const reviewAssets = assets.filter((a) => a.status === "review")

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApprove = async (id: string) => {
    await approve(id)
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    toast.success("Approved")
  }

  const handleReject = async (id: string) => {
    await reject(id)
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next })
    toast.info("Rejected")
  }

  const handleBatchApprove = async () => {
    for (const id of selected) await approve(id)
    setSelected(new Set())
    toast.success(`Approved ${selected.size} assets`)
  }

  const handleBatchReject = async () => {
    for (const id of selected) await reject(id)
    setSelected(new Set())
    toast.info(`Rejected ${selected.size} assets`)
  }

  const nextAsset = () => setReviewIndex((p) => Math.min(p + 1, reviewAssets.length - 1))
  const prevAsset = () => setReviewIndex((p) => Math.max(p - 1, 0))

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (reviewAssets.length === 0) return
      const current = reviewAssets[reviewIndex]
      if (!current) return
      if (e.key === "a" || e.key === "A") { e.preventDefault(); handleApprove(current.id) }
      if (e.key === "r" || e.key === "R") { e.preventDefault(); handleReject(current.id) }
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); nextAsset() }
      if (e.key === "ArrowLeft") { e.preventDefault(); prevAsset() }
    },
    [reviewIndex, reviewAssets]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">Approval Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review, approve, or reject generated assets — <kbd className="text-[10px] bg-muted px-1 rounded">A</kbd> approve · <kbd className="text-[10px] bg-muted px-1 rounded">R</kbd> reject · <kbd className="text-[10px] bg-muted px-1 rounded">→</kbd> next
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="outline" size="sm" className="gap-1 text-green-500" onClick={handleBatchApprove}>
                <CheckCheck className="size-3.5" />
                Approve {selected.size}
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-red-500" onClick={handleBatchReject}>
                <XCircle className="size-3.5" />
                Reject {selected.size}
              </Button>
            </>
          )}
          <Badge variant="secondary" className="text-xs">
            {reviewAssets.length} in queue
          </Badge>
        </div>
      </div>

      <Separator />

      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="py-4 flex items-center gap-2 text-sm text-red-500">
            <AlertTriangle className="size-4" />{error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : reviewAssets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <Check className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium">Queue is empty</p>
            <p className="text-xs text-muted-foreground mt-1">Generate assets to see them here for review</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Focus View */}
          {reviewAssets[reviewIndex] && (
            <Card className="overflow-hidden border-primary/20">
              <CardContent className="p-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden relative">
                    {reviewAssets[reviewIndex].previewUrl ? (
                      <Image
                        src={reviewAssets[reviewIndex].previewUrl}
                        alt={reviewAssets[reviewIndex].name}
                        fill
                        className="object-contain"
                        sizes="50vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Sparkles className="size-12 text-muted-foreground/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-between">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Name</p>
                        <p className="text-lg font-semibold">{reviewAssets[reviewIndex].name}</p>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <Badge variant="secondary" className="text-xs mt-0.5 capitalize">{reviewAssets[reviewIndex].type}</Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Style</p>
                          <Badge variant="outline" className="text-xs mt-0.5 capitalize">{reviewAssets[reviewIndex].style}</Badge>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Dimensions</p>
                          <p className="text-sm font-mono">{reviewAssets[reviewIndex].dimensions.width}×{reviewAssets[reviewIndex].dimensions.height}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Queue</p>
                          <p className="text-sm font-mono">{reviewIndex + 1} / {reviewAssets.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 text-red-500 border-red-500/20 hover:bg-red-500/10"
                        onClick={() => handleReject(reviewAssets[reviewIndex].id)}
                      >
                        <X className="size-4" />Reject (R)
                      </Button>
                      <Button variant="outline" size="icon" onClick={prevAsset} disabled={reviewIndex === 0}>
                        ←
                      </Button>
                      <Button variant="outline" size="icon" onClick={nextAsset} disabled={reviewIndex === reviewAssets.length - 1}>
                        →
                      </Button>
                      <Button
                        className="flex-1 gap-2 bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                        onClick={() => handleApprove(reviewAssets[reviewIndex].id)}
                      >
                        <Check className="size-4" />Approve (A)
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grid View */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>All Pending ({reviewAssets.length})</span>
                <span className="text-xs text-muted-foreground font-normal">Click to select · Use batch buttons above</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {reviewAssets.map((asset, i) => (
                  <button
                    key={asset.id}
                    onClick={() => setReviewIndex(i)}
                    className={`aspect-square bg-muted rounded-lg overflow-hidden relative border-2 transition-colors ${
                      i === reviewIndex
                        ? "border-primary ring-2 ring-primary/20"
                        : selected.has(asset.id)
                        ? "border-green-500/50 ring-1 ring-green-500/20"
                        : "border-transparent hover:border-primary/30"
                    }`}
                  >
                    {asset.previewUrl ? (
                      <Image src={asset.previewUrl} alt={asset.name} fill className="object-cover" sizes="12.5vw" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Sparkles className="size-5 text-muted-foreground/20" />
                      </div>
                    )}
                    {selected.has(asset.id) && (
                      <div className="absolute top-1 right-1 size-4 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="size-2.5 text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-background/90 to-transparent">
                      <p className="text-[9px] font-medium truncate">{asset.name.split("-").slice(0, 2).join("-")}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
