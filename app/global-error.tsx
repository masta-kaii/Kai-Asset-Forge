"use client"

import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCw } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Global error:", error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center bg-background">
        <Card className="border-red-500/20 bg-red-500/5 max-w-md mx-4">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-4">
            <AlertTriangle className="size-12 text-red-500/50" />
            <div>
              <p className="text-sm font-semibold text-red-500">Something went wrong</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {error.message || "An unexpected error occurred."}
              </p>
              {error.digest && (
                <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">
                  Digest: {error.digest}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={reset}>
              <RotateCw className="size-3" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </body>
    </html>
  )
}
