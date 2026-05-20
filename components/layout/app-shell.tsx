"use client"

import { AppSidebar } from "@/components/layout/sidebar"
import { usePathname } from "next/navigation"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isWorkstation = pathname === "/workstation"

  return (
    <div className="flex min-h-screen">
      {/* Sidebar only shows for non-workstation pages */}
      {!isWorkstation && <AppSidebar />}
      <main className={isWorkstation ? "flex-1" : "flex-1 ml-60 p-6 lg:p-8 max-w-7xl"}>
        {children}
      </main>
    </div>
  )
}
