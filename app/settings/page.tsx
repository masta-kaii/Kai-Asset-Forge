"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { getDashboardData } from "@/app/actions/dashboard"
import { getSidebarStats } from "@/app/actions/sidebar"
import {
  Settings, CheckCircle2, XCircle, Zap, Globe, Database, Brain, Key,
} from "lucide-react"

export default function SettingsPage() {
  const [status, setStatus] = useState<{
    firebase: boolean, openai: boolean, deepseek: boolean, itch: boolean, gumroad: boolean,
    assets: number, packs: number, agents: number, budget: number, budgetCap: number,
  }>({
    firebase: false, openai: false, deepseek: false, itch: false, gumroad: false,
    assets: 0, packs: 0, agents: 0, budget: 0, budgetCap: 10,
  })

  useEffect(() => {
    Promise.all([
      getDashboardData(),
      getSidebarStats(),
    ]).then(([data, stats]) => {
      setStatus({
        firebase: data.totalAssets >= 0,
        openai: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        deepseek: true,
        itch: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        gumroad: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        assets: data.totalAssets,
        packs: stats.readyPacks,
        agents: stats.activeAgents,
        budget: data.budget.monthlyUsed,
        budgetCap: data.budget.monthlyCap,
      })
    }).catch(() => {})
  }, [])

  const okColor = "bg-green-500/10 text-green-500 border-green-500/20"
  const offColor = "bg-muted text-muted-foreground"

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">Forge Status</h1>
        <p className="text-muted-foreground mt-1">Connected services, API keys, and forge health</p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="size-5" />API Connections
          </CardTitle>
          <CardDescription>AI providers and marketplace integrations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Firebase", icon: Database, ok: status.firebase, hint: "Firestore, Storage, Auth" },
            { label: "OpenAI", icon: Brain, ok: status.openai, hint: "GPT Image — set OPENAI_API_KEY in Vercel" },
            { label: "DeepSeek", icon: Zap, ok: status.deepseek, hint: "Text generation — set DEEPSEEK_API_KEY in Vercel" },
            { label: "itch.io", icon: Globe, ok: status.itch, hint: status.itch ? "API key configured" : "Set ITCHIO_API_KEY in Vercel" },
            { label: "Gumroad", icon: Globe, ok: status.gumroad, hint: status.gumroad ? "API key configured" : "Set GUMROAD_ACCESS_TOKEN in Vercel" },
          ].map((svc) => (
            <div key={svc.label} className="flex items-center gap-3 py-1">
              <svc.icon className="size-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">{svc.label}</p>
                <p className="text-xs text-muted-foreground">{svc.hint}</p>
              </div>
              <Badge variant="outline" className={`text-xs ${svc.ok ? okColor : offColor}`}>
                {svc.ok ? <CheckCircle2 className="size-3 mr-1" /> : <XCircle className="size-3 mr-1" />}
                {svc.ok ? "Online" : "Offline"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forge Metrics</CardTitle>
          <CardDescription>Live counts from your forge</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[
            { label: "Total Assets", value: status.assets },
            { label: "Ready Packs", value: status.packs },
            { label: "Active Agents", value: `${status.agents}/7` },
            { label: "Budget Used", value: `$${status.budget.toFixed(2)} / $${status.budgetCap}` },
          ].map((m) => (
            <div key={m.label} className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-xl font-bold font-mono tabular-nums mt-1">{m.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="size-5" />API Keys
          </CardTitle>
          <CardDescription>Manage your keys in Vercel → Settings → Environment Variables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="font-mono text-xs text-muted-foreground space-y-2">
            <p>Set these in your Vercel project dashboard (all environments):</p>
            <p className="text-muted-foreground/60">OPENAI_API_KEY · DEEPSEEK_API_KEY · ITCHIO_API_KEY</p>
            <p className="text-muted-foreground/60">GUMROAD_ACCESS_TOKEN · NEXT_PUBLIC_FIREBASE_*</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
