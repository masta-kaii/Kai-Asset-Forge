import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Globe, Tags, Sparkles, Copy } from "lucide-react"

const PLATFORMS = [
  { value: "itchio", label: "itch.io" },
  { value: "gumroad", label: "Gumroad" },
  { value: "kofi", label: "Ko-fi" },
  { value: "unity", label: "Unity Asset Store" },
]

export default function ListingGeneratorPage() {
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
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select platform" />
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricing-tier">Pricing Tier</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Budget ($0.99-$4.99)</SelectItem>
                  <SelectItem value="standard">Standard ($4.99-$9.99)</SelectItem>
                  <SelectItem value="premium">Premium ($9.99-$19.99)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gap-2">
              <Sparkles className="size-4" />
              Generate Listing
            </Button>
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
            <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-16 text-center">
              <Globe className="size-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">
                No listing generated yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure settings and generate your store listing
              </p>
            </div>
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
              <p className="text-sm font-medium">--</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm text-muted-foreground">--</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Suggested Tags</Label>
              <div className="flex gap-1.5 flex-wrap mt-1">
                <Badge variant="outline" className="text-xs">--</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
