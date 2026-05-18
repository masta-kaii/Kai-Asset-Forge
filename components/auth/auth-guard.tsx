"use client"

import { useAuth } from "@/lib/auth/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { Loader2, Anvil } from "lucide-react"

const PUBLIC_PATHS = ["/login", "/signup"]

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.push("/login")
    }
    if (!loading && user && isPublic) {
      router.push("/")
    }
  }, [user, loading, isPublic])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Anvil className="size-6 text-primary" />
          </div>
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground font-mono">Loading forge...</p>
        </div>
      </div>
    )
  }

  if (!user && !isPublic) return null

  return <>{children}</>
}
