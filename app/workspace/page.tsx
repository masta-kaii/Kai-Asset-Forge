"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getDashboardData } from "@/app/actions/dashboard"
import type { BudgetStatus } from "@/lib/budget/types"
import {
  Cpu, Shield, Warehouse, Store, Wrench, Terminal, Zap, AlertTriangle,
} from "lucide-react"

interface RoomDef {
  id: string
  label: string
  icon: string
  row: number
  col: number
  span: number
  color: string
  metric: string
  subtext: string
  pulse: boolean
  error: boolean
}

const ROOM_TEMPLATES = [
  { id: "forge", label: "FORGE", icon: "⚡", col: 1, span: 2, color: "rgba(250, 204, 21, 0.12)" },
  { id: "armory", label: "ARMORY", icon: "🔮", col: 1, span: 2, color: "rgba(124, 58, 237, 0.12)" },
  { id: "storefront", label: "STORE", icon: "🏪", col: 2, span: 2, color: "rgba(34, 197, 94, 0.12)" },
  { id: "command", label: "COMMAND", icon: "📡", col: 2, span: 2, color: "rgba(59, 130, 246, 0.12)" },
]

interface TerminalData {
  title: string
  headers: string[]
  rows: string[][]
  status: string
}

export default function MapPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null)
  const [totalAssets, setTotalAssets] = useState(0)
  const [approvedCount, setApprovedCount] = useState(0)
  const [genCount, setGenCount] = useState(0)
  const [readyPacks, setReadyPacks] = useState(0)
  const [activeWorkflows, setActiveWorkflows] = useState(0)
  const [recentAssets, setRecentAssets] = useState<{ type: string; status: string }[]>([])
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null)
  const [terminalData, setTerminalData] = useState<TerminalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardData().then((data) => {
      setBudget(data.budget)
      setTotalAssets(data.totalAssets)
      setApprovedCount(data.recentAssets.filter((a) => a.status === "approved").length)
      setGenCount(data.recentGenerations.length)
      setReadyPacks(data.readyPacks)
      setActiveWorkflows(data.activeWorkflows)
      setRecentAssets(data.recentAssets.map((a) => ({ type: a.type, status: a.status })))
    }).catch((e) => {
      console.error("Map load error:", e)
      setError("Systems offline — check Vercel logs")
    }).finally(() => setLoading(false))
  }, [])

  const rooms: RoomDef[] = [
    {
      ...ROOM_TEMPLATES[0],
      row: 1,
      metric: `${genCount}`,
      subtext: "generations today",
      pulse: genCount > 0,
      error: false,
    },
    {
      ...ROOM_TEMPLATES[1],
      row: 2,
      metric: `${totalAssets}`,
      subtext: `${approvedCount} approved`,
      pulse: totalAssets > 0,
      error: false,
    },
    {
      ...ROOM_TEMPLATES[2],
      row: 1,
      metric: `${readyPacks}`,
      subtext: "packs ready",
      pulse: readyPacks > 0,
      error: false,
    },
    {
      ...ROOM_TEMPLATES[3],
      row: 2,
      metric: budget ? `$${budget.monthlyUsed.toFixed(2)}` : "--",
      subtext: budget ? `$${budget.monthlyRemaining.toFixed(2)} remaining` : "--",
      pulse: false,
      error: budget ? budget.dailyPercent > 80 : false,
    },
  ]

  const handleRoomClick = (room: RoomDef) => {
    setActiveTerminal(room.id)
    switch (room.id) {
      case "forge":
        setTerminalData({
          title: "FORGE — ASSET GENERATION LOG",
          headers: ["ID", "TYPE", "STATUS", "TIME"],
          rows: [
            ["F-1001", "creature", "GENERATED", "07:32:14"],
            ["F-1002", "item", "GENERATED", "07:31:58"],
            ["F-1003", "creature", "QUEUED", "--:--:--"],
            ["F-1004", "accessory", "QUEUED", "--:--:--"],
          ],
          status: `▶ ${genCount} GENERATED TODAY`,
        })
        break
      case "armory":
        {
          const typeCounts: Record<string, { total: number; approved: number }> = {}
          for (const a of recentAssets) {
            if (!typeCounts[a.type]) typeCounts[a.type] = { total: 0, approved: 0 }
            typeCounts[a.type].total++
            if (a.status === "approved") typeCounts[a.type].approved++
          }
          const rows = Object.entries(typeCounts).slice(0, 6).map(([type, counts]) => [
            type, String(counts.total), String(counts.approved), counts.total > 0 ? ((counts.approved / counts.total) * 100).toFixed(0) + "%" : "—"
          ])
          if (rows.length === 0) rows.push(["—", "0", "0", "—"])
          setTerminalData({
            title: "ARMORY — ASSET INVENTORY",
            headers: ["TYPE", "TOTAL", "APPROVED", "READY %"],
            rows,
            status: `▶ ${totalAssets} ASSETS IN VAULT`,
          })
        }
        break
      case "storefront":
        setTerminalData({
          title: "STORE — LISTING MANAGEMENT",
          headers: ["PLATFORM", "LISTED", "SALES", "REVENUE"],
          rows: [
            ["itch.io", readyPacks > 0 ? String(readyPacks) : "0", "0", "$0.00"],
            ["Gumroad", "0", "0", "$0.00"],
          ],
          status: readyPacks > 0 ? `▶ ${readyPacks} PACKS READY TO PUBLISH` : "⚠ STORE OFFLINE — CREATE A PACK FIRST",
        })
        break
      case "command":
        setTerminalData({
          title: "COMMAND — BUDGET & PIPELINE",
          headers: ["METRIC", "VALUE", "CAP", "STATUS"],
          rows: [
            ["Daily Spend", `$${budget?.dailyUsed.toFixed(4) ?? "0.00"}`, `$${budget?.dailyCap.toFixed(2) ?? "0.33"}`, budget && budget.dailyPercent > 80 ? "⚠ HIGH" : "OK"],
            ["Monthly Spend", `$${budget?.monthlyUsed.toFixed(2) ?? "0.00"}`, `$${budget?.monthlyCap.toFixed(2) ?? "10"}`, budget && budget.monthlyPercent > 80 ? "⚠ HIGH" : "OK"],
            ["Active Workflows", String(activeWorkflows), "—", activeWorkflows > 0 ? "RUNNING" : "IDLE"],
            ["Pipeline", activeWorkflows > 0 ? "ACTIVE" : "STOPPED", "—", activeWorkflows > 0 ? "▶" : "READY"],
          ],
          status: budget?.isExceeded ? "⛔ BUDGET EXCEEDED" : activeWorkflows > 0 ? "▶ PIPELINE ACTIVE" : "▶ SYSTEMS NOMINAL",
        })
        break
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight font-mono">BASE MAP</h1>
          <p className="text-muted-foreground mt-1 text-xs font-mono">
            FORGE STATION — KAI ASSET FORGE v2.0
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-black/80 border border-green-500/30 rounded-md px-3 py-1.5 font-mono text-xs text-green-400 flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-green-500" />
            </span>
            SYS.OK
          </div>
          <Badge variant="outline" className="font-mono text-[10px] gap-1 border-green-500/30 text-green-400">
            <Terminal className="size-3" />
            CRT-1
          </Badge>
        </div>
      </div>

      <Separator />

      {error && (
        <div className="flex items-center gap-2 text-sm text-amber-500 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 font-mono">
          <AlertTriangle className="size-4" />
          {error} — showing static layout
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden" style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.15)" }}>
          <CardContent className="p-0">
            <div
              className="relative w-full p-4"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gridTemplateRows: "1fr 1fr",
                gap: "12px",
                minHeight: "420px",
              }}
            >
              {/* Core / Vault in the center */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none"
                style={{ width: "100px", height: "100px" }}
              >
                <div
                  className="w-full h-full rounded-full flex flex-col items-center justify-center gap-0.5 border-2"
                  style={{
                    borderColor: budget?.isExceeded ? "rgba(239,68,68,0.6)" : "rgba(57,255,20,0.4)",
                    background: "radial-gradient(circle, rgba(0,0,0,0.9), rgba(0,0,0,0.95))",
                    boxShadow: budget?.isExceeded
                      ? "0 0 20px rgba(239,68,68,0.2), inset 0 0 20px rgba(239,68,68,0.05)"
                      : "0 0 20px rgba(57,255,20,0.15), inset 0 0 20px rgba(57,255,20,0.05)",
                  }}
                >
                  <Cpu className="size-5" style={{ color: budget?.isExceeded ? "#ef4444" : "#39ff14" }} />
                  <span className="font-mono text-[10px] font-bold tracking-widest" style={{ color: budget?.isExceeded ? "#ef4444" : "#39ff14" }}>
                    VAULT
                  </span>
                  <span className="font-mono text-[13px] font-bold tabular-nums" style={{ color: budget?.isExceeded ? "#ef4444" : "#39ff14" }}>
                    ${budget?.monthlyRemaining.toFixed(2) ?? "10"}
                  </span>
                </div>
              </div>

              {/* Rooms */}
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleRoomClick(room)}
                  className="relative rounded-lg border-2 transition-all hover:scale-[1.02] text-left p-4 flex flex-col justify-between group overflow-hidden"
                  style={{
                    borderColor: room.error
                      ? "rgba(239,68,68,0.4)"
                      : room.pulse
                      ? "rgba(250,204,21,0.3)"
                      : "rgba(57,255,20,0.15)",
                    background: room.color,
                    gridRow: room.row,
                    gridColumn: room.col,
                  }}
                >
                  {/* Room glow */}
                  {room.pulse && (
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        background: `radial-gradient(ellipse at 30% 20%, ${room.error ? "rgba(239,68,68,0.3)" : "rgba(250,204,21,0.3)"}, transparent 70%)`,
                        animation: "pulse 2s ease-in-out infinite",
                      }}
                    />
                  )}

                  {/* Status dot */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <div
                      className="size-1.5 rounded-full"
                      style={{
                        background: room.error ? "#ef4444" : room.pulse ? "#facc15" : "#39ff14",
                        boxShadow: `0 0 4px ${room.error ? "#ef4444" : room.pulse ? "#facc15" : "#39ff14"}`,
                      }}
                    />
                  </div>

                  <div className="z-10">
                    <span className="text-2xl">{room.icon}</span>
                    <p className="font-mono text-[10px] font-bold tracking-[0.2em] mt-1 opacity-60">
                      {room.label}
                    </p>
                  </div>
                  <div className="z-10">
                    <p className="font-mono text-2xl font-bold tabular-nums tracking-tight">
                      {room.metric}
                    </p>
                    <p className="font-mono text-[9px] opacity-50 mt-0.5 uppercase tracking-widest">
                      {room.subtext}
                    </p>
                  </div>
                </button>
              ))}

              {/* Floor labels */}
              <div className="absolute bottom-2 left-4 font-mono text-[8px] opacity-20" style={{ color: "#39ff14" }}>
                32×32 TILE GRID · BASE MAP v2.0
              </div>
              <div className="absolute bottom-2 right-4 font-mono text-[8px] opacity-20" style={{ color: "#39ff14" }}>
                {new Date().toISOString().slice(0, 10)} · {new Date().toLocaleTimeString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Terminal Panel */}
        <Card
          className="flex flex-col overflow-hidden"
          style={{
            background: "#0a0a0a",
            borderColor: "rgba(57,255,20,0.15)",
          }}
        >
          <CardHeader className="pb-2" style={{ borderBottom: "1px solid rgba(57,255,20,0.1)" }}>
            <CardTitle className="text-sm font-mono flex items-center gap-2" style={{ color: "#39ff14" }}>
              <Terminal className="size-4" />
              {activeTerminal ? `${activeTerminal.toUpperCase()} TERMINAL` : "SELECT A ROOM"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-4 font-mono text-[11px] overflow-y-auto max-h-[380px]">
            {!activeTerminal ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                <Shield className="size-10" style={{ color: "#39ff14" }} />
                <p style={{ color: "#39ff14" }}>CLICK ANY ROOM TO INSPECT</p>
                <p className="text-[9px] opacity-50" style={{ color: "#39ff14" }}>TERMINAL STANDBY MODE</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Scanline overlay */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{
                    background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,255,20,0.5) 2px, rgba(57,255,20,0.5) 3px)",
                  }}
                />

                <p className="font-bold tracking-wider" style={{ color: "#39ff14" }}>
                  █ {terminalData?.title}
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(57,255,20,0.2)" }}>
                        {terminalData?.headers.map((h) => (
                          <th key={h} className="text-left py-1.5 pr-3 text-[10px] font-bold tracking-wider opacity-60" style={{ color: "#39ff14" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {terminalData?.rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(57,255,20,0.05)" }}>
                          {row.map((cell, j) => (
                            <td key={j} className="py-1.5 pr-3 tabular-nums" style={{ color: j === 0 ? "#39ff14" : "rgba(57,255,20,0.7)" }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div
                  className="pt-2 font-bold text-[10px] tracking-wider flex items-center gap-2"
                  style={{
                    color: terminalData?.status.startsWith("⚠") ? "#facc15" : "#39ff14",
                    borderTop: "1px solid rgba(57,255,20,0.1)",
                  }}
                >
                  <span className="animate-pulse">█</span>
                  {terminalData?.status}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Maintenance access */}
      <Card
        style={{ background: "#0a0a0a", borderColor: "rgba(57,255,20,0.1)" }}
      >
        <CardContent className="py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="size-4 opacity-50" style={{ color: "#39ff14" }} />
            <span className="font-mono text-[10px] opacity-50" style={{ color: "#39ff14" }}>
              MAINTENANCE ACCESS · FULL DIAGNOSTICS AVAILABLE IN TERMINAL
            </span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[10px]" style={{ color: "#39ff14", opacity: 0.4 }}>
            <span>UPTIME: ∞</span>
            <span>NODES: 7</span>
            <span>POWER: {budget ? `${100 - budget.monthlyPercent}%` : "100%"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
