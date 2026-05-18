"use client"

import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { ImagePlus, AlertTriangle } from "lucide-react"
import type { AssetType, AssetStyle } from "@/lib/types"

interface GeneratedAsset {
  id: string
  name: string
  type: AssetType
  style: AssetStyle
  previewUrl: string
  status: string
}

interface PreviewGalleryProps {
  assets: GeneratedAsset[] | null
  isGenerating: boolean
  error: string | null
}

export function PreviewGallery({ assets, isGenerating, error }: PreviewGalleryProps) {
  if (error) {
    return (
      <div className="border-2 border-dashed border-destructive/30 rounded-lg flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="size-12 text-destructive/40 mb-3" />
        <p className="text-sm text-destructive font-medium">Generation failed</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">{error}</p>
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-16 text-center">
        <div className="size-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3" />
        <p className="text-sm text-muted-foreground font-medium">Generating assets...</p>
        <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
      </div>
    )
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-16 text-center">
        <ImagePlus className="size-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground font-medium">No assets generated yet</p>
        <p className="text-xs text-muted-foreground mt-1">Configure your settings and hit Generate to start creating</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      {assets.map((asset) => (
        <Card key={asset.id} className="overflow-hidden group p-0">
          <CardContent className="p-0">
            <div className="aspect-square pixel-bg relative">
              <Image
                src={asset.previewUrl}
                alt={asset.name}
                fill
                className="object-contain pixel-img p-2"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                unoptimized
              />
            </div>
            <div className="p-2 border-t border-border">
              <p className="text-xs font-medium truncate">{asset.name}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{asset.type} · {asset.style.replace(/-/g, " ")}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
