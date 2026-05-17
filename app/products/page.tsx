import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Package, Plus, Download, FileArchive, Image as ImageIcon } from "lucide-react"

export default function ProductBuilderPage() {
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
        <Button className="gap-2">
          <Plus className="size-4" />
          New Pack
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
              <Input id="pack-title" placeholder="e.g. Tamagotchi Creature Pack Vol.1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pack-desc">Description</Label>
              <Textarea
                id="pack-desc"
                placeholder="Describe your asset pack..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input id="price" type="number" min={0} placeholder="4.99" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Badge variant="secondary" className="w-full justify-center py-2">
                  Draft
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 flex-1">
                <ImageIcon className="size-4" />
                Generate Preview
              </Button>
              <Button variant="outline" className="gap-2 flex-1">
                <FileArchive className="size-4" />
                Export ZIP
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Selected Assets</CardTitle>
            <CardDescription>
              Drag assets from the library to include in this pack
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center py-20 text-center">
              <Download className="size-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">
                Drag assets here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                or select from the Asset Library
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="size-5" />
            Recent Packs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            No packs created yet. Start building your first asset pack!
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
