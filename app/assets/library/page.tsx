import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Library, Search, SlidersHorizontal, Grid3X3, List } from "lucide-react"

export default function AssetLibraryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Asset Library
        </h1>
        <p className="text-muted-foreground mt-1">
          Browse, search, and manage your generated assets
        </p>
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search assets..." className="pl-9" />
        </div>
        <Button variant="outline" size="icon">
          <SlidersHorizontal className="size-4" />
        </Button>
        <div className="border rounded-lg flex">
          <Button variant="ghost" size="icon" className="rounded-r-none">
            <Grid3X3 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-l-none">
            <List className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["All", "Creatures", "Items", "Weapons", "Food", "UI Icons"].map(
          (tag) => (
            <Badge
              key={tag}
              variant={tag === "All" ? "default" : "secondary"}
              className="cursor-pointer"
            >
              {tag}
            </Badge>
          )
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors">
            <div className="aspect-square bg-muted flex items-center justify-center">
              <Library className="size-10 text-muted-foreground/30" />
            </div>
            <CardContent className="p-3">
              <p className="text-xs font-medium truncate">Empty Slot</p>
              <p className="text-[10px] text-muted-foreground">--</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
