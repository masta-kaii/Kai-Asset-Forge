"use client"

import { useState } from "react"
import { FileText, Plus, Trash2, Edit3, Save } from "lucide-react"

interface ListingDraft {
  id: string
  title: string
  description: string
  tags: string[]
  price: string
  status: "draft" | "ready" | "published"
  createdAt: string
}

const ASSET_TYPES = ["creature", "accessory", "item", "weapon", "food", "material", "animation", "ui-icon"]
const STYLES = ["pixel-art", "cute-retro", "pastel-cyber-fantasy", "tamagotchi"]

export function ListerPanel() {
  const [drafts, setDrafts] = useState<ListingDraft[]>([
    {
      id: "1",
      title: "Fantasy Creature Pack Vol.1",
      description: "A collection of 8 adorable pixel-art fantasy creatures perfect for RPG Maker, Godot, or any indie game project. Each sprite is 32x32 with a transparent background.",
      tags: ["fantasy", "creatures", "rpg", "pixel-art", "rpg-maker"],
      price: "4.99",
      status: "draft",
      createdAt: new Date().toISOString(),
    },
  ])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ title: "", description: "", tags: "", price: "" })

  const startEdit = (d: ListingDraft) => {
    setEditingId(d.id)
    setEditForm({
      title: d.title,
      description: d.description,
      tags: d.tags.join(", "),
      price: d.price,
    })
  }

  const saveEdit = () => {
    if (!editingId) return
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === editingId
          ? {
              ...d,
              title: editForm.title,
              description: editForm.description,
              tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
              price: editForm.price,
            }
          : d
      )
    )
    setEditingId(null)
  }

  const addDraft = () => {
    const newDraft: ListingDraft = {
      id: Date.now().toString(),
      title: "New Asset Pack",
      description: "Describe your asset pack here...",
      tags: ["pixel-art"],
      price: "4.99",
      status: "draft",
      createdAt: new Date().toISOString(),
    }
    setDrafts((prev) => [newDraft, ...prev])
    startEdit(newDraft)
  }

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const toggleStatus = (id: string) => {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: d.status === "draft" ? "ready" as const : d.status === "ready" ? "published" as const : "draft" as const }
          : d
      )
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] text-stone-500">{drafts.length} draft{drafts.length !== 1 ? "s" : ""}</p>
        <button onClick={addDraft}
          className="flex items-center gap-1 px-2 py-1 rounded border border-yellow-600/30 bg-yellow-950/20 text-yellow-400 hover:bg-yellow-950/40 transition-colors text-[10px] font-mono">
          <Plus className="h-3 w-3" />
          NEW DRAFT
        </button>
      </div>

      {/* Drafts */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {drafts.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 mx-auto mb-2 text-stone-600" />
            <p className="font-mono text-xs text-stone-500">No listing drafts</p>
            <p className="font-mono text-[10px] text-stone-600 mt-1">Create a draft to start marketing your assets!</p>
          </div>
        ) : (
          drafts.map((d) => (
            <div key={d.id}
              className={`rounded-md border transition-colors ${
                d.status === "published" ? "border-emerald-700/20 bg-emerald-950/5" :
                d.status === "ready" ? "border-blue-700/30 bg-blue-950/15" :
                "border-stone-700/30 bg-stone-800/30"
              }`}
            >
              {editingId === d.id ? (
                /* Edit mode */
                <div className="p-3 space-y-2">
                  <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-2 py-1 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono" placeholder="Title" />
                  <textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-2 py-1 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono resize-none h-16" placeholder="Description" />
                  <input value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                    className="w-full px-2 py-1 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono" placeholder="Tags (comma-separated)" />
                  <div className="flex gap-2">
                    <input value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                      className="w-24 px-2 py-1 rounded bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono" placeholder="$0.00" />
                    <button onClick={saveEdit}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-mono transition-colors">
                      <Save className="h-3 w-3" /> SAVE
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-[10px] font-mono transition-colors">CANCEL</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="px-2.5 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-mono truncate ${d.status === "published" ? "text-stone-500" : "text-stone-200"}`}>
                        {d.title}
                      </p>
                      <p className="text-[10px] font-mono text-stone-500 mt-0.5 line-clamp-1">{d.description}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {d.tags.slice(0, 3).map((t) => (
                          <span key={t} className="px-1 py-0.5 rounded bg-stone-700/30 text-[8px] font-mono text-stone-500">{t}</span>
                        ))}
                        {d.tags.length > 3 && <span className="text-[8px] font-mono text-stone-600">+{d.tags.length - 3}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono text-xs text-yellow-400">${d.price}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <button onClick={() => toggleStatus(d.id)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase transition-colors ${
                        d.status === "published" ? "bg-emerald-950/30 text-emerald-500" :
                        d.status === "ready" ? "bg-blue-950/30 text-blue-400" :
                        "bg-stone-800 text-stone-500"
                      }`}
                    >
                      {d.status}
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(d)}
                        className="p-1 rounded hover:bg-stone-700/50 text-stone-500 hover:text-stone-300 transition-colors">
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeDraft(d.id)}
                        className="p-1 rounded hover:bg-red-900/30 text-stone-500 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
