"use client"

import { Component, type ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-3">
            <AlertTriangle className="size-10 text-red-500/50" />
            <p className="text-sm font-medium text-red-500">Something went wrong</p>
            <p className="text-xs text-muted-foreground max-w-md">
              {this.state.error ?? "An unexpected error occurred while rendering this section."}
            </p>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => this.setState({ hasError: false, error: null })}>
              <RotateCw className="size-3" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )
    }
    return this.props.children
  }
}
