"use client"

import { useEffect, useState, use } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  Download,
  Copy,
  CheckCircle2,
  ExternalLink,
  Wrench,
  Sparkles,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { getPackForUploadView } from "@/app/actions/packs"
import { buildPackDeliverable } from "@/app/actions/pack-builder"
import {
  generatePackItchListing,
  markPackUploaded,
} from "@/app/actions/itchio-listing"
import type { AssetPack } from "@/lib/types"

interface PageProps {
  params: Promise<{ packId: string }>
}

export default function PackUploadPage({ params }: PageProps) {
  const { packId } = use(params)
  const [pack, setPack] = useState<AssetPack | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<null | "build" | "listing" | "uploaded">(null)
  const [uploadedUrl, setUploadedUrl] = useState("")

  const load = async () => {
    const p = await getPackForUploadView(packId)
    setPack(p)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [packId])

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Copied ${label}`)
    } catch {
      toast.error("Clipboard blocked — select and copy manually")
    }
  }

  const buildZip = async () => {
    setBusy("build")
    try {
      const r = await buildPackDeliverable(packId)
      if (r.success) {
        toast.success("ZIP built")
        await load()
      } else {
        toast.error(r.error ?? "Build failed")
      }
    } finally {
      setBusy(null)
    }
  }

  const generateListing = async () => {
    setBusy("listing")
    try {
      const r = await generatePackItchListing(packId)
      if (r.success) {
        toast.success("Listing generated")
        await load()
      } else {
        toast.error(r.error ?? "Listing failed")
      }
    } finally {
      setBusy(null)
    }
  }

  const markUploaded = async () => {
    if (!uploadedUrl.trim()) {
      toast.error("Paste the itch.io URL first")
      return
    }
    setBusy("uploaded")
    try {
      const r = await markPackUploaded(packId, uploadedUrl.trim())
      if (r.success) {
        toast.success("Marked as uploaded")
        await load()
      } else {
        toast.error(r.error ?? "Failed")
      }
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!pack) {
    return (
      <div className="space-y-4">
        <Link href="/products" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" /> Back to packs
        </Link>
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Pack not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasZip = !!pack.zipUrl
  const hasListing = !!pack.listing
  const isUploaded = !!pack.storeUrl

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Link href="/products" className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="size-3" /> Back to packs
          </Link>
          <h1 className="text-2xl font-heading font-bold tracking-tight truncate">{pack.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pack.assets.length} assets · ${pack.price.toFixed(2)}
          </p>
        </div>
        {isUploaded ? (
          <Badge className="text-xs gap-1 bg-green-500/10 text-green-500 border-green-500/20 shrink-0">
            <CheckCircle2 className="size-3" />
            Live on itch.io
          </Badge>
        ) : hasZip && hasListing ? (
          <Badge className="text-xs gap-1 bg-amber-500/10 text-amber-500 border-amber-500/20 shrink-0">
            Ready to upload
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs shrink-0">
            In progress
          </Badge>
        )}
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Cover preview + ZIP */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Deliverable</CardTitle>
            <CardDescription>What buyers will download.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="aspect-[630/500] bg-muted rounded-md overflow-hidden relative">
              {pack.coverUrl ? (
                <Image src={pack.coverUrl} alt="Pack cover" fill className="object-cover" sizes="33vw" />
              ) : pack.previewGridUrl ? (
                <Image src={pack.previewGridUrl} alt="Pack preview" fill className="object-cover" sizes="33vw" />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                  No cover yet — build ZIP first
                </div>
              )}
            </div>
            {hasZip ? (
              <Button asChild className="w-full gap-2">
                <a href={pack.zipUrl!} download={`${pack.slug ?? pack.title}.zip`}>
                  <Download className="size-4" />
                  Download ZIP
                </a>
              </Button>
            ) : (
              <Button onClick={buildZip} disabled={busy === "build"} className="w-full gap-2">
                {busy === "build" ? <Loader2 className="size-4 animate-spin" /> : <Wrench className="size-4" />}
                Build ZIP
              </Button>
            )}
            {pack.coverUrl && (
              <Button asChild variant="outline" size="sm" className="w-full gap-2">
                <a href={pack.coverUrl} download={`${pack.slug ?? pack.title}-cover.png`}>
                  <Download className="size-3.5" />
                  Download cover only
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Middle + right: Listing copy */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">itch.io Listing</CardTitle>
              <CardDescription>Title, description, and tags to paste into the itch.io upload form.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={generateListing}
              disabled={busy === "listing"}
              className="gap-2"
            >
              {busy === "listing" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {hasListing ? "Regenerate" : "Generate"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasListing ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Title</label>
                    <button
                      onClick={() => copy("title", pack.listing!.title)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Copy className="size-3" /> Copy
                    </button>
                  </div>
                  <p className="text-sm font-semibold">{pack.listing!.title}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Description</label>
                    <button
                      onClick={() => copy("description", pack.listing!.description)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Copy className="size-3" /> Copy
                    </button>
                  </div>
                  <Textarea
                    value={pack.listing!.description}
                    readOnly
                    rows={10}
                    className="resize-none font-mono text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Tags</label>
                    <button
                      onClick={() => copy("tags", pack.listing!.tags.join(", "))}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Copy className="size-3" /> Copy as CSV
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pack.listing!.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm border-t border-border pt-3">
                  <span className="text-muted-foreground">Suggested price</span>
                  <span className="font-mono font-semibold">${pack.listing!.suggestedPrice.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="size-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No listing yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click Generate above to draft itch.io title, description, and tags.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload to itch.io</CardTitle>
          <CardDescription>itch.io requires a human click for new projects — here are the steps.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="size-5 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">1</span>
              <span>
                Open{" "}
                <a
                  href="https://itch.io/new-project"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                >
                  itch.io/new-project <ExternalLink className="size-3" />
                </a>
                . Set <em>Kind of project</em> to "Assets".
              </span>
            </li>
            <li className="flex gap-3">
              <span className="size-5 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">2</span>
              <span>Paste the title, description, and tags above into the matching fields.</span>
            </li>
            <li className="flex gap-3">
              <span className="size-5 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">3</span>
              <span>Upload the ZIP as the file, the cover image as the project cover.</span>
            </li>
            <li className="flex gap-3">
              <span className="size-5 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">4</span>
              <span>Set price to <span className="font-mono">${pack.listing?.suggestedPrice.toFixed(2) ?? pack.price.toFixed(2)}</span>, tick <em>This project was made with AI</em>, save, and publish.</span>
            </li>
            <li className="flex gap-3">
              <span className="size-5 rounded-full bg-muted text-xs flex items-center justify-center shrink-0">5</span>
              <span>Paste the live URL below so Masta can track it.</span>
            </li>
          </ol>

          {isUploaded ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/5 border border-green-500/20">
              <CheckCircle2 className="size-4 text-green-500" />
              <a
                href={pack.storeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-500 hover:underline inline-flex items-center gap-1 truncate"
              >
                {pack.storeUrl} <ExternalLink className="size-3 shrink-0" />
              </a>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={uploadedUrl}
                onChange={(e) => setUploadedUrl(e.target.value)}
                placeholder="https://yourname.itch.io/your-pack"
              />
              <Button
                onClick={markUploaded}
                disabled={busy === "uploaded" || !uploadedUrl.trim()}
                className="gap-2"
              >
                {busy === "uploaded" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Mark uploaded
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
