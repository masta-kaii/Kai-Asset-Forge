"use client"

import { AppSidebar } from "@/components/layout/sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 ml-60">
        <div className="p-6 lg:p-8 max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
