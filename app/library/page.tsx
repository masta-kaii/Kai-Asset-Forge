"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

type Asset = {
  id: string;
  name: string;
  filename: string;
  category: string;
  size: number;
  path: string;
  relPath: string;
};

export default function LibraryPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [error, setError] = useState("");

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

  // Load assets
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);

    fetch(`/api/library/assets?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setError("");
        setAssets(data.assets || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [category]);

  // Search is debounced
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (search) params.set("search", search);
      fetch(`/api/library/assets?${params}`)
        .then((r) => r.json())
        .then((data) => setAssets(data.assets || []))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Categories from data
  const categories = useMemo(() => {
    const cats = new Set(assets.map((a) => a.category));
    return ["all", ...Array.from(cats).sort()];
  }, [assets]);

  const grouped = useMemo(() => {
    const g: Record<string, Asset[]> = {};
    for (const a of assets) {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [assets]);

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
      <div style={{ minHeight: "100vh", background: "#0d0f14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'VT323', var(--font-vt323), monospace", color: "#f5a623", fontSize: 22, letterSpacing: 2 }}>
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
      <header style={{ background: "rgba(13,15,20,0.98)", borderBottom: "2px solid #60a5fa33", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
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

      {/* Search + stats bar */}
      <div style={{ padding: "12px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", background: "#12161e", border: "1px solid #1e293b", padding: "0 10px", flex: "0 1 300px" }}>
          <span style={{ color: "#475569", fontSize: 16, marginRight: 6 }}>⌕</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search by name or category..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontFamily: "inherit", fontSize: 18, padding: "8px 0", letterSpacing: 1 }} />
          {search && <span onClick={() => setSearch("")} style={{ color: "#f87171", cursor: "pointer", fontSize: 16 }}>✕</span>}
        </div>
        <span style={{ color: "#475569", fontSize: 14, letterSpacing: 1 }}>
          {assets.length} ASSETS
        </span>
      </div>

      {/* Category tabs */}
      <div style={{ display: "flex", gap: 6, padding: "12px 24px", overflowX: "auto", flexWrap: "nowrap", borderBottom: "1px solid #0f1218" }}>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)} style={{
            background: category === cat ? "#60a5fa" : "#12161e",
            color: category === cat ? "#0d0f14" : "#94a3b8",
            border: category === cat ? "1px solid #60a5fa" : "1px solid #1e293b",
            padding: "6px 14px", fontFamily: "inherit", fontSize: 13, letterSpacing: 1,
            cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s", textTransform: "uppercase",
          }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "16px 24px", color: "#f87171", fontSize: 15, letterSpacing: 1 }}>⚠ {error}</div>
      )}

      {/* Asset grid */}
      <div style={{ padding: 24 }}>
        {grouped.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#475569", fontSize: 18, letterSpacing: 2 }}>
            NO ASSETS FOUND
            <div style={{ marginTop: 8, fontSize: 14, color: "#334155" }}>Run the factory pipeline to generate assets</div>
          </div>
        )}

        {category === "all"
          ? grouped.map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 14, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#60a5fa" }}>▸</span> {cat} <span style={{ color: "#334155", fontSize: 12 }}>({items.length})</span>
                </div>
                <AssetGrid items={items} onSelect={setSelected} formatSize={formatSize} />
              </div>
            ))
          : <AssetGrid items={assets} onSelect={setSelected} formatSize={formatSize} />
        }
      </div>

      {/* Preview modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
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
              </div>
              <div><span style={{ color: "#64748b", fontSize: 12 }}>FILE</span><div style={{ fontSize: 13, color: "#475569", fontFamily: "var(--font-geist-mono), monospace", wordBreak: "break-all" }}>{selected.relPath}</div></div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
}

function AssetGrid({ items, onSelect, formatSize }: { items: Asset[]; onSelect: (a: Asset) => void; formatSize: (b: number) => string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
      {items.map((a) => (
        <div key={a.id} onClick={() => onSelect(a)} style={{ background: "#12161e", border: "1px solid #1e293b", cursor: "pointer", transition: "all 0.15s", overflow: "hidden", display: "flex", flexDirection: "column" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor="#60a5fa"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 4px 20px rgba(96,165,250,0.15)" }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor="#1e293b"; e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="none" }}>
          <div style={{ aspectRatio: "1/1", background: "#0a0d12", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, overflow: "hidden" }}>
            <img src={a.path} alt={a.name} style={{ maxWidth: "100%", maxHeight: "100%", imageRendering: "pixelated", objectFit: "contain" }} />
          </div>
          <div style={{ padding: "8px 10px", borderTop: "1px solid #1e293b" }}>
            <div style={{ fontSize: 12, color: "#e2e8f0", letterSpacing: 0.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.name}>{a.name}</div>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 2, letterSpacing: 1 }}>{a.category} · {formatSize(a.size)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
