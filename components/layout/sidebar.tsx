"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  LayoutDashboard,
  Sparkles,
  Library,
  Package,
  FileText,
  Activity,
  Settings,
  Anvil,
} from "lucide-react"

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
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

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
              { label: "Assets Today", value: "--", color: "bg-emerald-400" },
              { label: "Ready Packs", value: "--", color: "bg-violet-400" },
              { label: "Active Agents", value: "0/7", color: "bg-amber-400" },
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
    </aside>
  )
}
