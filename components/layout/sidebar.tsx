"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard, Sparkles, Library, Package,
  Activity, Settings, Anvil, Monitor, LogOut, Crown, FileText,
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { getSidebarStats, type SidebarBadges } from "@/app/actions/sidebar"
import { useEffect, useState } from "react"

interface NavItem {
  title: string
  href: string
  icon: typeof LayoutDashboard
  badge?: (b: SidebarBadges) => { value: number; tone: "default" | "warn" | "good" } | null
}

const NAV_ITEMS: NavItem[] = [
  { title: "Masta", href: "/masta", icon: Crown },
  { title: "Cockpit", href: "/dashboard", icon: LayoutDashboard },
  { title: "Asset Generator", href: "/assets", icon: Sparkles },
  {
    title: "Asset Library",
    href: "/assets/library",
    icon: Library,
    badge: (b) => (b.pendingReview > 0 ? { value: b.pendingReview, tone: "warn" } : null),
  },
  {
    title: "Packs",
    href: "/products",
    icon: Package,
    badge: (b) => (b.readyToUpload > 0 ? { value: b.readyToUpload, tone: "default" } : null),
  },
  { title: "Listing Generator", href: "/products/listings", icon: FileText },
  { title: "Agent Monitor", href: "/agents", icon: Activity },
  { title: "Base Map", href: "/workspace", icon: Monitor },
  { title: "Settings", href: "/settings", icon: Settings },
]

const TONE_CLASSES: Record<"default" | "warn" | "good", string> = {
  default: "bg-primary/15 text-primary border-primary/20",
  warn: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  good: "bg-green-500/15 text-green-500 border-green-500/20",
}

const DEFAULT_BADGES: SidebarBadges = {
  totalAssets: 0,
  pendingReview: 0,
  readyToUpload: 0,
  liveOnStore: 0,
  stuckRun: false,
  budgetExceeded: false,
  monthlyPercent: 0,
}

export function AppSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [badges, setBadges] = useState<SidebarBadges>(DEFAULT_BADGES)

  useEffect(() => {
    const tick = () => getSidebarStats().then(setBadges).catch(() => {})
    tick()
    const interval = setInterval(tick, 30000)
    return () => clearInterval(interval)
  }, [])

  const budgetTint =
    badges.monthlyPercent >= 90
      ? "text-red-500"
      : badges.monthlyPercent >= 70
      ? "text-amber-500"
      : "text-emerald-500"

  return (
    <aside className="fixed top-0 left-0 z-40 h-screen w-60 border-r border-border bg-sidebar flex flex-col">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border shrink-0">
        <Anvil className="size-6 text-primary" />
        <span className="font-heading font-bold text-lg tracking-tight">KAI Forge</span>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            const badge = item.badge?.(badges)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "default" }),
                  "w-full justify-start gap-2.5 h-9 relative",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{item.title}</span>
                {badge && (
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 h-4 font-mono tabular-nums", TONE_CLASSES[badge.tone])}
                  >
                    {badge.value}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>

        <Separator className="my-4" />

        <div className="px-2 py-3 rounded-lg bg-sidebar-accent/50 border border-sidebar-border space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "size-1.5 rounded-full",
                badges.stuckRun
                  ? "bg-amber-500 animate-pulse"
                  : badges.budgetExceeded
                  ? "bg-red-500"
                  : "bg-emerald-500",
              )}
            />
            <p className="text-xs font-medium text-sidebar-foreground">
              {badges.stuckRun ? "Run stuck" : badges.budgetExceeded ? "Budget hit" : "All clear"}
            </p>
          </div>
          <div className="space-y-1">
            <Row label="Pending review" value={badges.pendingReview} tone={badges.pendingReview > 0 ? "warn" : null} />
            <Row label="Ready to upload" value={badges.readyToUpload} tone={badges.readyToUpload > 0 ? "default" : null} />
            <Row label="Live on store" value={badges.liveOnStore} tone={badges.liveOnStore > 0 ? "good" : null} />
            <Row label="Monthly budget" value={`${badges.monthlyPercent}%`} mono tone={null} className={budgetTint} />
          </div>
        </div>
      </ScrollArea>
      {user && (
        <div className="border-t border-border p-3 flex items-center gap-2">
          <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
            {user.email?.charAt(0).toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.email}</p>
            <p className="text-[10px] text-muted-foreground">Forge Operator</p>
          </div>
          <button
            onClick={signOut}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      )}
    </aside>
  )
}

function Row({
  label,
  value,
  tone,
  mono,
  className,
}: {
  label: string
  value: number | string
  tone: "default" | "warn" | "good" | null
  mono?: boolean
  className?: string
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-500"
      : tone === "default"
      ? "text-primary"
      : tone === "good"
      ? "text-emerald-500"
      : "text-foreground"
  return (
    <div className="flex items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("ml-auto tabular-nums", mono && "font-mono", className ?? toneClass)}>{value}</span>
    </div>
  )
}
