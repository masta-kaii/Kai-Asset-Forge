"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [bootText, setBootText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [focused, setFocused] = useState<"user" | "pass" | null>(null);

  // Boot sequence
  useEffect(() => {
    const lines = [
      "INITIALIZING KAI ASSET FORGE v5.0...",
      "MOUNTING PIXEL FORGE PIPELINE... [OK]",
      "CONNECTING HERMES OS GATEWAY... [OK]",
      "LOADING AGENT SOULS... [OK]",
      "QC CHAMBER STANDBY... [READY]",
      "PACKAGING BAY ONLINE... [READY]",
      "",
      "SYSTEM READY. AUTHENTICATE TO CONTINUE.",
    ];

    let i = 0;
    const iv = setInterval(() => {
      if (i < lines.length) {
        setBootText((prev) => prev + (prev ? "\n" : "") + lines[i]);
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => setShowForm(true), 400);
      }
    }, 180);

    return () => clearInterval(iv);
  }, []);

  // Check if already logged in
  useEffect(() => {
    const auth = localStorage.getItem("kaf_auth");
    if (auth) {
      try {
        const d = JSON.parse(auth);
        if (d.user && d.ts && Date.now() - d.ts < 7 * 24 * 60 * 60 * 1000) {
          router.replace("/dojo");
        }
      } catch {}
    }
  }, []);

  const handleLogin = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!username.trim() || !password.trim()) {
        setStatus("error");
        setStatusMsg("> ERR: ALL FIELDS REQUIRED");
        return;
      }

      setStatus("loading");
      setStatusMsg("> AUTHENTICATING...");

      // Simple local auth (demo mode)
      setTimeout(() => {
        const valid = username.trim().length >= 3 && password.trim().length >= 3;
        if (valid) {
          localStorage.setItem(
            "kaf_auth",
            JSON.stringify({ user: username.trim(), ts: Date.now() })
          );
          setStatus("success");
          setStatusMsg("> ACCESS GRANTED. REDIRECTING...");
          setTimeout(() => router.push("/dojo"), 600);
        } else {
          setStatus("error");
          setStatusMsg("> ERR: INVALID CREDENTIALS. MIN 3 CHARACTERS.");
        }
      }, 800);
    },
    [username, password, router]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0f14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'VT323', var(--font-vt323), monospace",
        color: "#e2e8f0",
        position: "relative",
        overflow: "hidden",
        padding: 24,
      }}
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Subtle grid */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(245,166,35,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(245,166,35,0.03) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Main container */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: 520, width: "100%" }}>
        {/* ASCII Art Lock */}
        {!showForm && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.1,
              color: "#f5a623",
              textAlign: "center",
              whiteSpace: "pre",
              marginBottom: 24,
              opacity: bootText ? 1 : 0,
              transition: "opacity 0.5s",
            }}
          >
{`     .--------.
    / .------. \\
   / /        \\ \\
   | |  LOCK  | |
  _| |________| |_
.' |_|        |_| '.
'._____ ____ _____.'
|     .'____'.     |
'.__.'.'    '.'.__.'
'.__  | KAI  |  __.'
|   '.'.__.'.'   |
'.____'.__.'____.'
  '.__________.'`}
          </div>
        )}

        {/* Boot sequence */}
        {!showForm && (
          <div
            style={{
              background: "rgba(13,15,20,0.95)",
              border: "1px solid #f5a62333",
              padding: "20px 24px",
              fontSize: 15,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              color: "#4ade80",
              minHeight: 140,
              imageRendering: "pixelated",
            }}
          >
            {bootText}
            <span style={{ animation: "blink 1s step-end infinite" }}>▌</span>
          </div>
        )}

        {/* Login form */}
        {showForm && (
          <form
            onSubmit={handleLogin}
            style={{
              background: "rgba(13,15,20,0.95)",
              border: "1px solid #f5a62344",
              padding: "32px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* Title */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 400,
                  color: "#f5a623",
                  textShadow: "0 0 20px rgba(245,166,35,0.4)",
                  letterSpacing: 4,
                  lineHeight: 1,
                }}
              >
                KAI ASSET FORGE
              </div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 4, letterSpacing: 2 }}>
                ── HERMES OS v5.0 ──
              </div>
            </div>

            <div
              style={{ height: 1, background: "linear-gradient(90deg, transparent, #f5a62344, transparent)" }}
            />

            {/* Username */}
            <div>
              <label
                style={{
                  fontSize: 14,
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: 6,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                ▸ Operator ID
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#12161e",
                  border:
                    focused === "user"
                      ? "1px solid #f5a623"
                      : "1px solid #1e293b",
                  padding: "0 12px",
                  transition: "border-color 0.2s",
                }}
              >
                <span style={{ color: "#475569", fontSize: 18, marginRight: 8 }}>&gt;</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setStatus("idle");
                  }}
                  onFocus={() => setFocused("user")}
                  onBlur={() => setFocused(null)}
                  placeholder="enter operator id..."
                  autoFocus
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "#e2e8f0",
                    fontFamily: "inherit",
                    fontSize: 20,
                    padding: "12px 0",
                    letterSpacing: 1,
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                style={{
                  fontSize: 14,
                  color: "#94a3b8",
                  display: "block",
                  marginBottom: 6,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                ▸ Access Key
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#12161e",
                  border:
                    focused === "pass"
                      ? "1px solid #f5a623"
                      : "1px solid #1e293b",
                  padding: "0 12px",
                  transition: "border-color 0.2s",
                }}
              >
                <span style={{ color: "#475569", fontSize: 18, marginRight: 8 }}>&gt;</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setStatus("idle");
                  }}
                  onFocus={() => setFocused("pass")}
                  onBlur={() => setFocused(null)}
                  placeholder="enter access key..."
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    outline: "none",
                    color: "#e2e8f0",
                    fontFamily: "inherit",
                    fontSize: 20,
                    padding: "12px 0",
                    letterSpacing: 2,
                  }}
                />
              </div>
            </div>

            {/* Status message */}
            {status !== "idle" && (
              <div
                style={{
                  fontSize: 14,
                  color:
                    status === "error"
                      ? "#f87171"
                      : status === "success"
                      ? "#4ade80"
                      : "#f5a623",
                  textAlign: "center",
                  letterSpacing: 1,
                }}
              >
                {statusMsg}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "loading"}
              style={{
                background:
                  status === "loading"
                    ? "#1e293b"
                    : "linear-gradient(135deg, #f5a623, #d4891a)",
                color: status === "loading" ? "#64748b" : "#0d0f14",
                border: status === "loading" ? "1px solid #334155" : "none",
                padding: "14px",
                fontSize: 22,
                fontFamily: "inherit",
                letterSpacing: 3,
                cursor: status === "loading" ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                fontWeight: 400,
                transition: "all 0.2s",
                boxShadow:
                  status === "loading"
                    ? "none"
                    : "0 0 20px rgba(245,166,35,0.3), 0 4px 12px rgba(0,0,0,0.5)",
              }}
              onMouseEnter={(e) => {
                if (status !== "loading") {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 0 30px rgba(245,166,35,0.5), 0 6px 20px rgba(0,0,0,0.6)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow =
                  "0 0 20px rgba(245,166,35,0.3), 0 4px 12px rgba(0,0,0,0.5)";
              }}
            >
              {status === "loading" ? "AUTHENTICATING..." : "LOGIN"}
            </button>

            {/* Footer links */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                color: "#475569",
                letterSpacing: 1,
              }}
            >
                <span
                  onClick={() => router.push("/dojo")}
                  style={{ cursor: "pointer", color: "#c084fc" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a623")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#c084fc")}
                >
                  🏯 DOJO
                </span>
                <span
                onClick={() => router.push("/factory")}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a623")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
              >
                ▸ FACTORY
              </span>
              <span>v5.0.1</span>
            </div>
          </form>
        )}
      </div>

      {/* Blinking cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
