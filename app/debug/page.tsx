"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getDashboardData } from "@/app/actions/dashboard"
import { startForgePipeline, getPipelineRun } from "@/app/actions/forge-pipeline"
import { scoutTrends } from "@/app/actions/scout"
import { curatorScore } from "@/app/actions/curator"
import { generateAssets } from "@/app/actions/generate"
import { generateListing } from "@/app/actions/listings"
import {
  Activity, CheckCircle2, AlertTriangle, Loader2, Play, Terminal,
} from "lucide-react"

interface TestResult {
  name: string
  status: "pending" | "testing" | "ok" | "fail"
  message: string
  duration: number
}

const TESTS = [
  { name: "Dashboard Data", fn: () => getDashboardData() },
  { name: "Scout Agent", fn: () => scoutTrends({}) },
  { name: "Curator Agent", fn: () => curatorScore({ assetName: "test", assetType: "creature", assetStyle: "pixel-art", prompt: "test" }) },
  { name: "Generate Listing", fn: () => generateListing({ platform: "itchio", keywords: "test", pricingTier: "standard" }) },
  { name: "Generate Asset", fn: () => generateAssets({ prompt: "test pixel cat", assetType: "creature", style: "pixel-art", batchCount: 1 }) },
]

export default function DebugPage() {
  const [results, setResults] = useState<TestResult[]>(
    TESTS.map((t) => ({ name: t.name, status: "pending", message: "—", duration: 0 }))
  )
  const [running, setRunning] = useState(false)

  const runTests = async () => {
    setRunning(true)
    const newResults = [...results]

    for (let i = 0; i < TESTS.length; i++) {
      const test = TESTS[i]
      newResults[i] = { ...newResults[i], status: "testing", message: "Running...", duration: 0 }
      setResults([...newResults])

      const start = Date.now()
      try {
        const data = await test.fn()
        const duration = Date.now() - start
        newResults[i] = {
          name: test.name,
          status: "ok",
          message: typeof data === "object" ? JSON.stringify(data).slice(0, 120) + (JSON.stringify(data).length > 120 ? "..." : "") : String(data),
          duration,
        }
      } catch (err) {
        const duration = Date.now() - start
        const msg = err instanceof Error ? err.message : String(err)
        newResults[i] = { name: test.name, status: "fail", message: msg, duration }
      }
      setResults([...newResults])
    }

    setRunning(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight font-mono">DEBUG CONSOLE</h1>
          <p className="text-muted-foreground mt-1 text-xs font-mono">
            Test each server action individually to find the failing one
          </p>
        </div>
        <Button className="gap-2" onClick={runTests} disabled={running}>
          {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {running ? "Testing..." : "Run All Tests"}
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        {results.map((r, i) => (
          <Card key={i} className={r.status === "fail" ? "border-red-500/30 bg-red-500/5" : r.status === "ok" ? "border-green-500/20" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  {r.status === "testing" ? <Loader2 className="size-3.5 animate-spin" /> :
                   r.status === "ok" ? <CheckCircle2 className="size-3.5 text-green-500" /> :
                   r.status === "fail" ? <AlertTriangle className="size-3.5 text-red-500" /> :
                   <Activity className="size-3.5 text-muted-foreground" />}
                  {r.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {r.duration > 0 && <span className="text-[10px] text-muted-foreground font-mono">{r.duration}ms</span>}
                  <Badge variant={
                    r.status === "ok" ? "default" :
                    r.status === "fail" ? "destructive" :
                    "secondary"
                  } className="text-[10px]">{r.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-mono text-muted-foreground break-all">{r.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.15)" }}>
        <CardContent className="py-3 flex items-center gap-3">
          <Terminal className="size-4" style={{ color: "#39ff14" }} />
          <p className="text-[10px] font-mono" style={{ color: "#39ff14", opacity: 0.6 }}>
            Run these tests to identify which server action (and API key) is broken.
            Each test calls one server function and shows the exact error.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
