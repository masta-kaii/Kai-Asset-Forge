"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard, Sparkles, Library, Package, FileText,
  Activity, Settings, Anvil, Monitor, LogOut, Eye, Cpu, MessagesSquare,
} from "lucide-react"
import { useAuth } from "@/lib/auth/auth-context"
import { getSidebarStats } from "@/app/actions/sidebar"
import { useEffect, useState } from "react"

const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Asset Generator",
    href: "/assets",
    icon: Sparkles,
  },
  {
    title: "Asset Library",
    href: "/assets/library",
    icon: Library,
  },
  {
    title: "Review Queue",
    href: "/assets/review",
    icon: Eye,
  },
  {
    title: "Product Builder",
    href: "/products",
    icon: Package,
  },
  {
    title: "Listing Generator",
    href: "/products/listings",
    icon: FileText,
  },
  {
    title: "Agent Monitor",
    href: "/agents",
    icon: Activity,
  },
  {
    title: "Sim Workstation",
    href: "/workstation",
    icon: Cpu,
  },
  {
    title: "Hermes Chat",
    href: "/hermes-chat",
    icon: MessagesSquare,
  },
  {
    title: "Base Map",
    href: "/workspace",
    icon: Monitor,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const [stats, setStats] = useState({ assetsToday: 0, readyPacks: 0, activeAgents: 0 })

  useEffect(() => {
    getSidebarStats().then(setStats).catch(() => {})
    const interval = setInterval(() => {
      getSidebarStats().then(setStats).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <aside className="fixed top-0 left-0 z-40 h-screen w-60 border-r border-border bg-sidebar flex flex-col">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-border shrink-0">
        <Anvil className="size-6 text-primary" />
        <span className="font-heading font-bold text-lg tracking-tight">
          KAI Asset Forge
        </span>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: isActive ? "secondary" : "ghost",
                    size: "default",
                  }),
                  "w-full justify-start gap-2.5 h-9",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>
        <Separator className="my-4" />
        <div className="px-2 py-3 rounded-lg bg-sidebar-accent/50 border border-sidebar-border">
          <p className="text-xs font-medium text-sidebar-foreground mb-1">
            Pipeline Status
          </p>
          <div className="space-y-1.5">
            {[
              { label: "Assets Today", value: `${stats.assetsToday}`, color: "bg-emerald-400" },
              { label: "Ready Packs", value: `${stats.readyPacks}`, color: "bg-violet-400" },
              { label: "Active Agents", value: `${stats.activeAgents}/7`, color: "bg-amber-400" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 text-xs">
                <div className={cn("size-1.5 rounded-full", stat.color)} />
                <span className="text-muted-foreground">{stat.label}</span>
                <span className="ml-auto font-mono tabular-nums">{stat.value}</span>
              </div>
            ))}
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
          <button onClick={signOut} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title="Sign out">
            <LogOut className="size-3.5" />
          </button>
        </div>
      )}
    </aside>
  )
}
