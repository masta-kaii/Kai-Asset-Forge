"use client"

import { useState } from "react"
import { Plus, Trash2, Sparkles, CheckCircle2, Clock } from "lucide-react"

interface WishItem {
  id: string
  agent: string
  request: string
  reason: string
  status: "pending" | "built" | "in-progress"
  createdAt: string
}

const AGENTS = [
  { id: "scout", label: "🔍 Scout", color: "#34d399" },
  { id: "forge", label: "⚒️ Forge", color: "#f87171" },
  { id: "curator", label: "🔬 Curator", color: "#fbbf24" },
  { id: "lister", label: "📋 Lister", color: "#60a5fa" },
  { id: "packager", label: "📦 Packager", color: "#fb923c" },
  { id: "monitor", label: "📡 Monitor", color: "#94a3b8" },
  { id: "deploy", label: "🚀 Deploy", color: "#a78bfa" },
  { id: "orch", label: "🧙 Orch", color: "#c084fc" },
]

export function ScoutPanel() {
  const [wishlist, setWishlist] = useState<WishItem[]>([
    {
      id: "1",
      agent: "scout",
      request: "Bookshelf sprite for my research corner",
      reason: "Need somewhere to store all my trend reports!",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      agent: "curator",
      request: "Magnifying glass prop for inspection desk",
      reason: "Would help with QC inspections — thematic!",
      status: "in-progress",
      createdAt: new Date().toISOString(),
    },
  ])

  const [showForm, setShowForm] = useState(false)
  const [newRequest, setNewRequest] = useState("")
  const [newReason, setNewReason] = useState("")
  const [newAgent, setNewAgent] = useState("scout")

  const addWish = () => {
    if (!newRequest.trim()) return
    const item: WishItem = {
      id: Date.now().toString(),
      agent: newAgent,
      request: newRequest.trim(),
      reason: newReason.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    }
    setWishlist((prev) => [item, ...prev])
    setNewRequest("")
    setNewReason("")
    setShowForm(false)
  }

  const toggleStatus = (id: string) => {
    setWishlist((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, status: w.status === "pending" ? "in-progress" as const : w.status === "in-progress" ? "built" as const : "pending" as const }
          : w
      )
    )
  }

  const removeWish = (id: string) => {
    setWishlist((prev) => prev.filter((w) => w.id !== id))
  }

  const pendingCount = wishlist.filter((w) => w.status !== "built").length

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] text-stone-500">
          {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 px-2 py-1 rounded border border-yellow-600/30 bg-yellow-950/20 text-yellow-400 hover:bg-yellow-950/40 transition-colors text-[10px] font-mono"
        >
          <Plus className="h-3 w-3" />
          REQUEST
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="p-3 rounded-lg border border-yellow-600/30 bg-stone-800/60 space-y-2">
          <select
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono"
          >
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <input
            value={newRequest}
            onChange={(e) => setNewRequest(e.target.value)}
            placeholder="What asset do you want?"
            className="w-full px-2 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono placeholder:text-stone-600"
          />
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Why would it improve your workspace?"
            className="w-full px-2 py-1.5 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono placeholder:text-stone-600"
          />
          <div className="flex gap-2">
            <button onClick={addWish}
              className="flex-1 px-2 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-mono transition-colors"
            >
              POST REQUEST
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-[10px] font-mono transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Wishlist */}
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {wishlist.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-stone-600" />
            <p className="font-mono text-xs text-stone-500">No requests yet</p>
            <p className="font-mono text-[10px] text-stone-600 mt-1">Agents haven't requested anything!</p>
          </div>
        ) : (
          wishlist.map((w) => {
            const agent = AGENTS.find((a) => a.id === w.agent)
            return (
              <div key={w.id}
                className={`flex items-start gap-2 px-2.5 py-2 rounded-md border transition-colors ${
                  w.status === "built" ? "border-emerald-700/20 bg-emerald-950/10 opacity-60" :
                  w.status === "in-progress" ? "border-amber-700/30 bg-amber-950/20" :
                  "border-stone-700/30 bg-stone-800/30 hover:bg-stone-800/50"
                }`}
              >
                {/* Status toggle */}
                <button onClick={() => toggleStatus(w.id)}
                  className="shrink-0 mt-0.5"
                  title={`Mark as ${w.status === "pending" ? "in progress" : w.status === "in-progress" ? "built" : "pending"}`}
                >
                  {w.status === "built" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : w.status === "in-progress" ? (
                    <Clock className="h-4 w-4 text-amber-400" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-stone-600 hover:border-amber-500" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-mono ${w.status === "built" ? "text-stone-600 line-through" : "text-stone-200"}`}>
                    {w.request}
                  </p>
                  <p className="text-[10px] font-mono text-stone-500 mt-0.5">{w.reason}</p>
                  <span className="text-[9px] font-mono" style={{ color: agent?.color ?? "#94a3b8" }}>
                    Requested by {agent?.label ?? w.agent}
                  </span>
                </div>

                {/* Delete */}
                <button onClick={() => removeWish(w.id)}
                  className="shrink-0 p-1 rounded hover:bg-red-900/30 text-stone-600 hover:text-red-400 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
