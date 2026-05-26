"use client"

import { useEffect } from "react"

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <html>
      <body style={{ margin: 0, padding: 0, background: "#0d0f14", color: "#f5a623", fontFamily: "monospace" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 48 }}>⚠</div>
          <div style={{ fontSize: 24 }}>Factory Error</div>
          <div style={{ color: "#475569", fontSize: 14 }}>{error.message || "Something went wrong"}</div>
          <button onClick={() => window.location.reload()} style={{
            background: "rgba(245,166,35,0.1)", border: "1px solid #f5a623", color: "#f5a623",
            padding: "8px 16px", cursor: "pointer", fontFamily: "monospace"
          }}>
            RELOAD
          </button>
        </div>
      </body>
    </html>
  )
}
