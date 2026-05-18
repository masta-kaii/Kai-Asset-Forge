"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Zap, Settings2 } from "lucide-react"
import { PreviewGallery } from "@/components/assets/preview-gallery"
import { useGeneration } from "@/hooks/use-generation"
import type { AssetStyle, AssetType } from "@/lib/types"
import type { AIProvider } from "@/lib/ai/types"

const STYLES: { value: AssetStyle; label: string }[] = [
  { value: "pixel-art", label: "Pixel Art" },
  { value: "cute-retro", label: "Cute Retro" },
  { value: "pastel-cyber-fantasy", label: "Pastel Cyber Fantasy" },
  { value: "tamagotchi", label: "Tamagotchi" },
]

const TYPES: { value: AssetType; label: string }[] = [
  { value: "creature", label: "Creatures" },
  { value: "accessory", label: "Accessories" },
  { value: "item", label: "Items" },
  { value: "weapon", label: "Weapons" },
  { value: "food", label: "Food" },
  { value: "material", label: "Materials" },
  { value: "animation", label: "Animations" },
  { value: "ui-icon", label: "UI Icons" },
]

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: "openai", label: "OpenAI (GPT Image)" },
]

export default function AssetGeneratorPage() {
  const [assetType, setAssetType] = useState<AssetType>("creature")
  const [style, setStyle] = useState<AssetStyle>("pastel-cyber-fantasy")
  const [batchCount, setBatchCount] = useState(4)
  const [prompt, setPrompt] = useState("")
  const [provider, setProvider] = useState<AIProvider>("openai")
  const { isGenerating, error, results, generate } = useGeneration()

  const handleGenerate = () => {
    if (!prompt.trim()) return
    generate({
      prompt: prompt.trim(),
      assetType,
      style,
      batchCount: Math.min(Math.max(batchCount, 1), 10),
      provider,
      quality: "auto",
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Asset Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Generate game assets with AI-powered agents
          </p>
        </div>
        <Button variant="outline" size="icon">
          <Settings2 className="size-4" />
        </Button>
      </div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings2 className="size-4" />
              Generation Settings
            </CardTitle>
            <CardDescription>
              Configure your asset generation parameters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="asset-type">Asset Type</Label>
              <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                <SelectTrigger id="asset-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style">Art Style</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as AssetStyle)}>
                <SelectTrigger id="style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="count">Batch Count</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={10}
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">AI Provider</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as AIProvider)}>
                <SelectTrigger id="provider">
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

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Describe your asset in detail..."
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
            >
              <Zap className="size-4" />
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="size-4" />
              Preview Gallery
            </CardTitle>
            <CardDescription>
              Generated assets will appear here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreviewGallery
              assets={results}
              isGenerating={isGenerating}
              error={error}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Generations</CardTitle>
        </CardHeader>
        <CardContent>
          {results && results.length > 0 ? (
            <div className="space-y-2">
              {results.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between text-sm py-1">
                  <span className="font-medium truncate">{asset.name}</span>
                  <span className="text-muted-foreground text-xs capitalize">{asset.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Your generation history will appear here
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
