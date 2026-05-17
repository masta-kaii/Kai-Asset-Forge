"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Globe, Tags, Sparkles, AlertTriangle } from "lucide-react"
import { useListing } from "@/hooks/use-listing"
import type { AIProvider } from "@/lib/ai/types"

const PLATFORMS = [
  { value: "itchio", label: "itch.io" },
  { value: "gumroad", label: "Gumroad" },
  { value: "kofi", label: "Ko-fi" },
  { value: "unity", label: "Unity Asset Store" },
]

const TIERS = [
  { value: "budget", label: "Budget ($0.99-$4.99)" },
  { value: "standard", label: "Standard ($4.99-$9.99)" },
  { value: "premium", label: "Premium ($9.99-$19.99)" },
]

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: "deepseek", label: "DeepSeek" },
  { value: "openai", label: "OpenAI (GPT-4o)" },
]

export default function ListingGeneratorPage() {
  const [platform, setPlatform] = useState("itchio")
  const [keywords, setKeywords] = useState("")
  const [pricingTier, setPricingTier] = useState("standard")
  const [provider, setProvider] = useState<AIProvider>("deepseek")
  const { isGenerating, error, title, description, tags, generate, reset } = useListing()

  const handleGenerate = () => {
    if (!keywords.trim()) return
    generate({ platform, keywords: keywords.trim(), pricingTier, provider })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Listing Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate marketplace-ready store listings with AI
        </p>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="size-5" />
              Listing Configuration
            </CardTitle>
            <CardDescription>
              Configure your marketplace listing parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Target Platform</Label>
              <Select value={platform} onValueChange={(v) => v && setPlatform(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input
                id="keywords"
                placeholder="pixel art, tamagotchi, rpg, creatures"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing Tier</Label>
              <Select value={pricingTier} onValueChange={(v) => v && setPricingTier(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>AI Provider</Label>
              <Select value={provider} onValueChange={(v) => v && setProvider(v as AIProvider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="gap-2 flex-1" onClick={handleGenerate} disabled={isGenerating || !keywords.trim()}>
                <Sparkles className="size-4" />
                {isGenerating ? "Generating..." : "Generate Listing"}
              </Button>
              {(title || description || tags.length > 0) && (
                <Button variant="outline" size="icon" onClick={reset}>
                  <Sparkles className="size-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="size-5" />
              Generated Listing
            </CardTitle>
            <CardDescription>
              AI-generated marketplace listing preview
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertTriangle className="size-4" />
                {error}
              </div>
            )}
            {isGenerating ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 space-y-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </div>
            ) : title || description || tags.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Title</Label>
                  <p className="text-sm font-semibold mt-0.5">{title}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{description}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tags</Label>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-16 text-center">
                <Globe className="size-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">
                  No listing generated yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure settings and generate your store listing
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tags className="size-5" />
            SEO & Keywords Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Title</Label>
              <p className="text-sm font-medium">{title || "--"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm text-muted-foreground">{description || "--"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Suggested Tags</Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {tags.length > 0 ? (
                  tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-xs">--</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
