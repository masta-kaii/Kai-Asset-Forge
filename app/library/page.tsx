"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

type Asset = {
  id: string;
  name: string;
  filename: string;
  category: string;
  size: number;
  mtime: number;
  path: string;
  relPath: string;
};

const SORT_OPTIONS = [
  { key: "newest", label: "✦ NEWEST", icon: "↓" },
  { key: "oldest", label: "OLDEST", icon: "↑" },
  { key: "name_asc", label: "NAME A-Z", icon: "↕" },
  { key: "name_desc", label: "NAME Z-A", icon: "↕" },
  { key: "size", label: "SIZE", icon: "↓" },
] as const;

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isNew(ms: number): boolean {
  return Date.now() - ms < 24 * 60 * 60 * 1000;
}

export default function LibraryPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Auth gate
  useEffect(() => {
    try {
      const raw = localStorage.getItem("kaf_auth");
      if (!raw) { router.replace("/login"); return; }
      const d = JSON.parse(raw);
      if (!d.user || !d.ts || Date.now() - d.ts > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem("kaf_auth");
        router.replace("/login");
      }
    } catch {
      localStorage.removeItem("kaf_auth");
      router.replace("/login");
    }
  }, [router]);

  // Load all assets once (for category counts)
  useEffect(() => {
    fetch("/api/library/assets?sort=newest")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setError("");
        setAllAssets(data.assets || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Fetch with filters
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);
    if (sortBy) params.set("sort", sortBy);

    const t = setTimeout(() => {
      fetch(`/api/library/assets?${params}`)
        .then((r) => r.json())
        .then((data) => setAssets(data.assets || []))
        .catch(() => {});
    }, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [category, search, sortBy]);

  // Category counts from full asset list
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allAssets) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return counts;
  }, [allAssets]);

  const categories = useMemo(() => {
    const cats = Object.keys(catCounts).sort();
    return [{ key: "all", count: allAssets.length }, ...cats.map((c) => ({ key: c, count: catCounts[c] }))];
  }, [catCounts, allAssets.length]);

  // Group for grid when sorted by newest
  const grouped = useMemo(() => {
    if (sortBy !== "newest" && sortBy !== "oldest") return null;
    const g: Record<string, Asset[]> = {};
    for (const a of assets) {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    }
    return Object.entries(g);
  }, [assets, sortBy]);

  const formatSize = (b: number) => (b < 1024 ? `${b}B` : `${(b / 1024).toFixed(1)}KB`);

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("kaf_auth") || "{}").user || "OPERATOR";
    } catch {
      return "OPERATOR";
    }
  })();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'VT323', var(--font-vt323), monospace", color: "#60a5fa", fontSize: 22, letterSpacing: 2 }}>
        SCANNING FORGE OUTPUT...
        <span style={{ animation: "blink 1s step-end infinite", marginLeft: 2 }}>▌</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0d0f14", fontFamily: "'VT323', var(--font-vt323), monospace", color: "#e2e8f0" }}>
      {/* Scanlines */}
      <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)", pointerEvents: "none", zIndex: 100 }} />

      {/* Header */}
      <header style={{ background: "rgba(13,15,20,0.98)", borderBottom: "2px solid #60a5fa33", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span onClick={() => router.push("/factory")} style={{ fontSize: 26, color: "#60a5fa", letterSpacing: 3, cursor: "pointer", textShadow: "0 0 15px rgba(96,165,250,0.4)" }}>
            📦 ASSET LIBRARY
          </span>
          <span style={{ color: "#64748b", fontSize: 14, letterSpacing: 2 }}>── FORGE OUTPUT ──</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span onClick={() => router.push("/dojo")} style={{ fontSize: 15, color: "#c084fc", cursor: "pointer", letterSpacing: 2 }} onMouseEnter={(e) => e.currentTarget.style.color = "#f5a623"} onMouseLeave={(e) => e.currentTarget.style.color = "#c084fc"}>🏯 DOJO</span>
          <span onClick={() => router.push("/factory")} style={{ fontSize: 15, color: "#475569", cursor: "pointer", letterSpacing: 2 }} onMouseEnter={(e) => e.currentTarget.style.color = "#f5a623"} onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}>⚙ FACTORY</span>
          <span style={{ color: "#4ade80", fontSize: 14, letterSpacing: 1 }}>▸ {user}</span>
        </div>
      </header>

      {/* Stats strip */}
      <div style={{ padding: "10px 24px", background: "#12161e", borderBottom: "1px solid #1e293b", display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <Stat label="TOTAL" value={allAssets.length} color="#60a5fa" />
        <Stat label="NEW (24H)" value={allAssets.filter((a) => isNew(a.mtime)).length} color="#4ade80" />
        <Stat label="FOLDERS" value={Object.keys(catCounts).length} color="#c084fc" />
        <Stat label="SIZE" value={formatSize(allAssets.reduce((s, a) => s + a.size, 0))} color="#f5a623" />
      </div>

      {/* Controls bar */}
      <div style={{ padding: "10px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #0f1218" }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", background: "#0a0d12", border: "1px solid #1e293b", padding: "0 10px", flex: "0 1 280px" }}>
          <span style={{ color: "#475569", fontSize: 16, marginRight: 6 }}>⌕</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search by name..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 17, padding: "8px 0", letterSpacing: 1 }} />
          {search && <span onClick={() => setSearch("")} style={{ color: "#f87171", cursor: "pointer", fontSize: 16 }}>✕</span>}
        </div>

        {/* Sort dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#475569", fontSize: 12, letterSpacing: 1 }}>SORT:</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{
            background: "#0a0d12", border: "1px solid #60a5fa44", color: "#60a5fa",
            padding: "7px 10px", fontFamily: "inherit", fontSize: 14, letterSpacing: 1,
            cursor: "pointer", outline: "none"
          }}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", marginLeft: "auto", border: "1px solid #1e293b", overflow: "hidden" }}>
          <button onClick={() => setViewMode("grid")} style={{
            background: viewMode === "grid" ? "#60a5fa22" : "transparent",
            border: "none", color: viewMode === "grid" ? "#60a5fa" : "#475569",
            padding: "5px 10px", fontFamily: "inherit", fontSize: 14, cursor: "pointer", letterSpacing: 1
          }}>▦ GRID</button>
          <button onClick={() => setViewMode("list")} style={{
            background: viewMode === "list" ? "#60a5fa22" : "transparent",
            border: "none", borderLeft: "1px solid #1e293b", color: viewMode === "list" ? "#60a5fa" : "#475569",
            padding: "5px 10px", fontFamily: "inherit", fontSize: 14, cursor: "pointer", letterSpacing: 1
          }}>☰ LIST</button>
        </div>
      </div>

      {/* Category pills */}
      <div style={{ display: "flex", gap: 6, padding: "10px 24px", overflowX: "auto", flexWrap: "nowrap", borderBottom: "1px solid #0f1218" }}>
        {categories.map(({ key, count }) => (
          <button key={key} onClick={() => setCategory(key)} style={{
            background: category === key ? "#60a5fa" : "#12161e",
            color: category === key ? "#0d0f14" : "#94a3b8",
            border: category === key ? "1px solid #60a5fa" : "1px solid #1e293b",
            padding: "5px 12px", fontFamily: "inherit", fontSize: 12, letterSpacing: 1,
            cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s", textTransform: "uppercase",
            display: "flex", gap: 6, alignItems: "center"
          }}>
            <span>{key === "all" ? "✦ ALL" : key}</span>
            <span style={{
              fontSize: 10, color: category === key ? "#0d0f1499" : "#475569",
              background: category === key ? "rgba(0,0,0,0.1)" : "#0a0d12",
              padding: "1px 5px"
            }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "16px 24px", color: "#f87171", fontSize: 15, letterSpacing: 1 }}>⚠ {error}</div>
      )}

      {/* Asset grid/list */}
      <div style={{ padding: 24 }}>
        {assets.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#475569", fontSize: 18, letterSpacing: 2 }}>
            NO ASSETS FOUND
            <div style={{ marginTop: 8, fontSize: 14, color: "#334155" }}>Run the factory pipeline to generate assets</div>
          </div>
        )}

        {viewMode === "grid" ? (
          // Grid view
          category === "all" && grouped
            ? grouped.map(([cat, items]) => (
                <div key={cat} style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "#60a5fa" }}>▸</span> {cat} <span style={{ color: "#334155", fontSize: 11 }}>({items.length})</span>
                  </div>
                  <AssetGrid items={items} onSelect={setSelected} formatSize={formatSize} />
                </div>
              ))
            : <AssetGrid items={assets} onSelect={setSelected} formatSize={formatSize} />
        ) : (
          // List view
          <AssetList items={assets} onSelect={setSelected} formatSize={formatSize} />
        )}
      </div>

      {/* Preview modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#12161e", border: "1px solid #60a5fa44", maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1e293b" }}>
              <span style={{ fontSize: 18, color: "#60a5fa", letterSpacing: 2 }}>ASSET DETAIL</span>
              <span onClick={() => setSelected(null)} style={{ fontSize: 20, color: "#64748b", cursor: "pointer" }}>✕</span>
            </div>
            <div style={{ background: "#0a0d12", padding: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={selected.path} alt={selected.name} style={{ maxWidth: "100%", maxHeight: 360, imageRendering: "pixelated", objectFit: "contain" }} />
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div><span style={{ color: "#64748b", fontSize: 12, letterSpacing: 1 }}>NAME</span><div style={{ fontSize: 20, color: "#e2e8f0", letterSpacing: 1 }}>{selected.name}</div></div>
              <div style={{ display: "flex", gap: 24 }}>
                <div><span style={{ color: "#64748b", fontSize: 12 }}>CATEGORY</span><div style={{ fontSize: 16, color: "#60a5fa", letterSpacing: 1 }}>{selected.category}</div></div>
                <div><span style={{ color: "#64748b", fontSize: 12 }}>SIZE</span><div style={{ fontSize: 16, color: "#94a3b8" }}>{formatSize(selected.size)}</div></div>
                <div><span style={{ color: "#64748b", fontSize: 12 }}>CREATED</span><div style={{ fontSize: 16, color: "#f5a623" }}>{timeAgo(selected.mtime)}</div></div>
              </div>
              <div><span style={{ color: "#64748b", fontSize: 12 }}>FILE</span><div style={{ fontSize: 13, color: "#475569", fontFamily: "var(--font-geist-mono), monospace", wordBreak: "break-all" }}>{selected.relPath}</div></div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @media (max-width: 640px) {
          .library-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .library-header h1 { font-size: 20px !important; }
          .library-controls { flex-direction: column !important; }
        }
      `}</style>
    </div>
  );
}

// ── Stats ──
function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "#475569", fontSize: 11, letterSpacing: 1 }}>{label}</span>
      <span style={{ color, fontSize: 16, letterSpacing: 1, fontWeight: "bold" }}>{value}</span>
    </div>
  );
}

// ── Grid ──
function AssetGrid({ items, onSelect, formatSize }: { items: Asset[]; onSelect: (a: Asset) => void; formatSize: (b: number) => string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
      {items.map((a) => (
        <AssetCard key={a.id} asset={a} onSelect={onSelect} formatSize={formatSize} />
      ))}
    </div>
  );
}

// ── List ──
function AssetList({ items, onSelect, formatSize }: { items: Asset[]; onSelect: (a: Asset) => void; formatSize: (b: number) => string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Header */}
      <div style={{ display: "flex", padding: "8px 12px", fontSize: 11, color: "#475569", letterSpacing: 1, borderBottom: "1px solid #1e293b", background: "#0f1218" }}>
        <span style={{ width: 60, flexShrink: 0 }}></span>
        <span style={{ flex: 1 }}>NAME</span>
        <span style={{ width: 100 }}>CATEGORY</span>
        <span style={{ width: 80, textAlign: "right" }}>SIZE</span>
        <span style={{ width: 100, textAlign: "right" }}>CREATED</span>
      </div>
      {items.map((a) => (
        <div key={a.id} onClick={() => onSelect(a)} style={{
          display: "flex", alignItems: "center", padding: "6px 12px", cursor: "pointer",
          borderBottom: "1px solid #0f1218", transition: "all 0.1s",
          background: "transparent", gap: 0,
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#12161e"; e.currentTarget.style.borderColor = "#60a5fa44"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#0f1218"; }}>
          <div style={{ width: 48, height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0d12", marginRight: 12 }}>
            <img src={a.path} alt={a.name} style={{ maxWidth: 40, maxHeight: 40, imageRendering: "pixelated", objectFit: "contain" }} />
          </div>
          <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0", letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isNew(a.mtime) && <span style={{ color: "#4ade80", marginRight: 4, fontSize: 9, verticalAlign: "middle" }}>●</span>}
            {a.name}
          </span>
          <span style={{ width: 100, fontSize: 11, color: "#60a5fa", letterSpacing: 1, textTransform: "uppercase" }}>{a.category}</span>
          <span style={{ width: 80, textAlign: "right", fontSize: 12, color: "#64748b" }}>{formatSize(a.size)}</span>
          <span style={{ width: 100, textAlign: "right", fontSize: 11, color: isNew(a.mtime) ? "#4ade80" : "#475569" }}>{timeAgo(a.mtime)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Card ──
function AssetCard({ asset: a, onSelect, formatSize }: { asset: Asset; onSelect: (a: Asset) => void; formatSize: (b: number) => string }) {
  return (
    <div onClick={() => onSelect(a)} style={{ background: "#12161e", border: "1px solid #1e293b", cursor: "pointer", transition: "all 0.15s", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#60a5fa"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(96,165,250,0.15)" }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "none" }}>
      {/* NEW badge */}
      {isNew(a.mtime) && (
        <div style={{
          position: "absolute", top: 6, right: 6, zIndex: 5,
          background: "#4ade80", color: "#0d0f14", fontSize: 9,
          padding: "1px 5px", fontFamily: "inherit", letterSpacing: 1
        }}>NEW</div>
      )}
      <div style={{ aspectRatio: "1/1", background: "#0a0d12", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, overflow: "hidden" }}>
        <img src={a.path} alt={a.name} style={{ maxWidth: "100%", maxHeight: "100%", imageRendering: "pixelated", objectFit: "contain" }} />
      </div>
      <div style={{ padding: "8px 10px", borderTop: "1px solid #1e293b" }}>
        <div style={{ fontSize: 12, color: "#e2e8f0", letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.name}>
          {isNew(a.mtime) && <span style={{ color: "#4ade80", marginRight: 3 }}>●</span>}
          {a.name}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 10, color: "#60a5fa", letterSpacing: 1, textTransform: "uppercase" }}>{a.category}</span>
          <span style={{ fontSize: 10, color: isNew(a.mtime) ? "#4ade80" : "#475569" }}>{timeAgo(a.mtime)}</span>
        </div>
        <div style={{ fontSize: 9, color: "#475569", marginTop: 1 }}>{formatSize(a.size)}</div>
      </div>
    </div>
  );
}
