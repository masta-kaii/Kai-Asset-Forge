"use client"

import { AuthProvider } from "@/lib/auth/auth-context"
import { AuthGuard } from "@/components/auth/auth-guard"
import { AppShell } from "@/components/layout/app-shell"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { usePathname } from "next/navigation"
import { type ReactNode } from "react"

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname === "/login"

  return (
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        {isAuthPage ? (
          children
        ) : (
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        )}
      </TooltipProvider>
    </AuthProvider>
  )
}
