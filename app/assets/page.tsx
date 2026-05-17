import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, ImagePlus, Zap, Settings2 } from "lucide-react"
import type { AssetStyle, AssetType } from "@/lib/types"

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

export default function AssetGeneratorPage() {
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
              <Select>
                <SelectTrigger id="asset-type">
                  <SelectValue placeholder="Select type" />
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
              <Select>
                <SelectTrigger id="style">
                  <SelectValue placeholder="Select style" />
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
              <Input id="count" type="number" min={1} max={20} defaultValue={4} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                placeholder="Describe your asset in detail..."
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 gap-2">
                <Zap className="size-4" />
                Generate
              </Button>
              <Button variant="outline" size="icon">
                <ImagePlus className="size-4" />
              </Button>
            </div>
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
            <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-16 text-center">
              <ImagePlus className="size-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">
                No assets generated yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure your settings and hit Generate to start creating
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Generations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Your generation history will appear here
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
