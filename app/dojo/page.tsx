"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Skill = { name: string; level: number; icon: string; desc: string };
type HistoryEntry = { action: string; xp: number; ts: string };
type Agent = {
  id: string;
  name: string;
  role: string;
  level: number;
  xp: number;
  xpToNext: number;
  totalXP: number;
  color: string;
  bgA: string;
  motto: string;
  skills: Record<string, Skill>;
  trainingHistory: HistoryEntry[];
};

const SKILL_COLORS: Record<number, string> = {
  1: "#475569",
  2: "#64748b",
  3: "#94a3b8",
  4: "#60a5fa",
  5: "#c084fc",
  6: "#f5a623",
  7: "#f87171",
  8: "#4ade80",
  9: "#f5a623",
  10: "#ffd700",
};

export default function DojoPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [training, setTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState("");
  const [trainFlash, setTrainFlash] = useState<string | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem("kaf_auth");
    if (!auth) {
      try {
        const d = JSON.parse(auth || "{}");
        if (d.user && d.ts && Date.now() - d.ts < 7 * 24 * 60 * 60 * 1000) {
          // ok
        } else {
          router.replace("/login");
          return;
        }
      } catch {
        router.replace("/login");
        return;
      }
    }
    fetchAgents();
    const iv = setInterval(fetchAgents, 10000);
    return () => clearInterval(iv);
  }, [router]);

  const fetchAgents = useCallback(() => {
    fetch("/api/dojo/agents")
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleTrain = useCallback(
    async (agentId: string) => {
      setTraining(true);
      setTrainMsg("");
      setTrainFlash(agentId);

      const xp = Math.floor(15 + Math.random() * 35);
      const actions = [
        "Pipeline training drill",
        "Skill refinement session",
        "Cross-agent collaboration",
        "Production simulation",
        "Quality review exercise",
        "Speed optimization run",
        "Creative workshop",
        "Technical deep-dive",
      ];
      const action = actions[Math.floor(Math.random() * actions.length)];

      try {
        const res = await fetch("/api/dojo/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId, xp, action }),
        });
        const data = await res.json();

        setAgents((prev) => ({
          ...prev,
          [agentId]: data.agent,
        }));

        if (data.leveledUp) {
          setTrainMsg(
            `⚡ LEVEL UP! ${data.agent.name} reached Level ${data.agent.level}! +${xp}XP`
          );
        } else if (data.improvedSkills?.length) {
          setTrainMsg(
            `📈 ${data.agent.name}: +${xp}XP · ${data.improvedSkills.join(", ")} improved!`
          );
        } else {
          setTrainMsg(`✓ ${data.agent.name}: +${xp}XP`);
        }

        setTimeout(() => {
          setTrainFlash(null);
          setTrainMsg("");
        }, 2500);
      } catch {
        setTrainMsg("> ERR: Training failed");
      }
      setTraining(false);
    },
    []
  );

  const handleLoginPage = () => {
    localStorage.removeItem("kaf_auth");
    router.push("/login");
  };

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("kaf_auth") || "{}").user || "OPERATOR";
    } catch {
      return "OPERATOR";
    }
  })();

  const agentList = Object.values(agents);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0d0f14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'VT323', var(--font-vt323), monospace",
          color: "#f5a623",
          fontSize: 22,
          letterSpacing: 2,
        }}
      >
        LOADING DOJO...
        <span style={{ animation: "blink 1s step-end infinite", marginLeft: 2 }}>▌</span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d0f14",
        fontFamily: "'VT323', var(--font-vt323), monospace",
        color: "#e2e8f0",
      }}
    >
      {/* Scanlines */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          pointerEvents: "none",
          zIndex: 100,
        }}
      />

      {/* Header */}
      <header
        style={{
          background: "rgba(13,15,20,0.98)",
          borderBottom: "2px solid #f5a62333",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            onClick={() => router.push("/factory")}
            style={{
              fontSize: 26,
              color: "#f5a623",
              letterSpacing: 3,
              cursor: "pointer",
              textShadow: "0 0 15px rgba(245,166,35,0.4)",
            }}
          >
            🏯 AGENT DOJO
          </span>
          <span style={{ color: "#64748b", fontSize: 14, letterSpacing: 2 }}>
            ── TRAINING GROUND ──
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ color: "#4ade80", fontSize: 14, letterSpacing: 1 }}>
            ▸ {user}
          </span>
          <span
            onClick={() => router.push("/factory")}
            style={{ fontSize: 15, color: "#475569", cursor: "pointer", letterSpacing: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a623")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            ⚙ FACTORY
          </span>
          <span
            onClick={handleLoginPage}
            style={{ fontSize: 14, color: "#475569", cursor: "pointer", letterSpacing: 1 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            LOGOUT
          </span>
        </div>
      </header>

      {/* Dojo stats banner */}
      <div
        style={{
          padding: "16px 24px",
          background: "rgba(245,166,35,0.04)",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          fontSize: 15,
          letterSpacing: 1,
        }}
      >
        <span style={{ color: "#64748b" }}>
          TOTAL AGENTS: <span style={{ color: "#f5a623" }}>{agentList.length}</span>
        </span>
        <span style={{ color: "#64748b" }}>
          COMBINED LEVEL:{" "}
          <span style={{ color: "#c084fc" }}>
            {agentList.reduce((s, a) => s + a.level, 0)}
          </span>
        </span>
        <span style={{ color: "#64748b" }}>
          TOTAL XP:{" "}
          <span style={{ color: "#4ade80" }}>
            {agentList.reduce((s, a) => s + a.totalXP, 0).toLocaleString()}
          </span>
        </span>
      </div>

      {/* Training notification */}
      {trainMsg && (
        <div
          style={{
            padding: "12px 24px",
            background: "#12161e",
            borderBottom: "1px solid #4ade80",
            color: "#4ade80",
            fontSize: 16,
            letterSpacing: 1,
            animation: "slideDown 0.3s ease-out",
          }}
        >
          {trainMsg}
        </div>
      )}

      {/* Agent cards */}
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
            gap: 20,
          }}
        >
          {agentList.map((agent) => {
            const xpPct = Math.min(100, (agent.xp / agent.xpToNext) * 100);
            const isSelected = selected === agent.id;
            const isFlashing = trainFlash === agent.id;

            return (
              <div
                key={agent.id}
                style={{
                  background: agent.bgA,
                  border:
                    isSelected
                      ? `2px solid ${agent.color}`
                      : `1px solid ${agent.color}22`,
                  transition: "all 0.2s",
                  overflow: "hidden",
                  ...(isFlashing
                    ? {
                        animation: "xpFlash 0.5s ease-out",
                        boxShadow: `0 0 30px ${agent.color}44`,
                      }
                    : {}),
                }}
              >
                {/* Agent header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid ${agent.color}22`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelected(isSelected ? null : agent.id)}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 22,
                        color: agent.color,
                        letterSpacing: 2,
                        textShadow: `0 0 10px ${agent.color}33`,
                      }}
                    >
                      {agent.name}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#64748b",
                        letterSpacing: 1,
                        marginTop: 2,
                      }}
                    >
                      {agent.role}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: 32,
                        color: agent.color,
                        fontWeight: 400,
                        lineHeight: 1,
                        textShadow: `0 0 15px ${agent.color}55`,
                      }}
                    >
                      Lv.{agent.level}
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1 }}>
                      {agent.totalXP.toLocaleString()} XP
                    </div>
                  </div>
                </div>

                {/* XP Bar */}
                <div style={{ padding: "12px 20px", borderBottom: `1px solid ${agent.color}11` }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                      fontSize: 12,
                      color: "#64748b",
                      letterSpacing: 1,
                    }}
                  >
                    <span>XP</span>
                    <span>
                      {agent.xp} / {agent.xpToNext}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "#0a0d12",
                      border: `1px solid ${agent.color}22`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${xpPct}%`,
                        background: `linear-gradient(90deg, ${agent.color}88, ${agent.color})`,
                        transition: "width 0.5s ease-out",
                        boxShadow: `0 0 8px ${agent.color}55`,
                      }}
                    />
                  </div>
                </div>

                {/* Motto */}
                <div
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    color: "#475569",
                    fontStyle: "italic",
                    letterSpacing: 0.5,
                    borderBottom: `1px solid ${agent.color}11`,
                  }}
                >
                  &ldquo;{agent.motto}&rdquo;
                </div>

                {/* Skills (always visible, compact) */}
                <div style={{ padding: "12px 20px" }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}
                  >
                    Skills
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {Object.values(agent.skills).map((skill) => (
                      <div
                        key={skill.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{skill.icon}</span>
                        <span
                          style={{
                            fontSize: 14,
                            color: "#cbd5e1",
                            letterSpacing: 0.5,
                            flex: 1,
                          }}
                        >
                          {skill.name}
                        </span>
                        <div style={{ display: "flex", gap: 2 }}>
                          {Array.from({ length: Math.min(skill.level, 10) }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                width: 8,
                                height: 8,
                                background:
                                  SKILL_COLORS[Math.min(i + 1, 10)] || "#475569",
                                boxShadow:
                                  i >= skill.level - 1
                                    ? `0 0 4px ${SKILL_COLORS[Math.min(i + 1, 10)]}`
                                    : "none",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Train button */}
                <div style={{ padding: "12px 20px" }}>
                  <button
                    onClick={() => handleTrain(agent.id)}
                    disabled={training}
                    style={{
                      width: "100%",
                      background: training
                        ? "#1e293b"
                        : `${agent.color}15`,
                      color: training ? "#475569" : agent.color,
                      border: `1px solid ${agent.color}33`,
                      padding: "10px",
                      fontFamily: "inherit",
                      fontSize: 16,
                      letterSpacing: 2,
                      cursor: training ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      textTransform: "uppercase",
                    }}
                    onMouseEnter={(e) => {
                      if (!training) {
                        e.currentTarget.style.background = `${agent.color}25`;
                        e.currentTarget.style.borderColor = agent.color;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `${agent.color}15`;
                      e.currentTarget.style.borderColor = `${agent.color}33`;
                    }}
                  >
                    {training && trainFlash === agent.id
                      ? "TRAINING..."
                      : `▸ TRAIN ${agent.name.split(" ")[0]}`}
                  </button>
                </div>

                {/* Training history (expanded) */}
                {isSelected && agent.trainingHistory?.length > 0 && (
                  <div
                    style={{
                      borderTop: `1px solid ${agent.color}22`,
                      padding: "12px 20px",
                      maxHeight: 200,
                      overflow: "auto",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#475569",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        marginBottom: 8,
                      }}
                    >
                      Training Log
                    </div>
                    {agent.trainingHistory.slice(0, 10).map((entry, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          padding: "3px 0",
                          borderBottom: "1px solid #1e293b",
                          letterSpacing: 0.5,
                        }}
                      >
                        <span style={{ color: "#94a3b8" }}>{entry.action}</span>
                        <span style={{ color: "#4ade80", whiteSpace: "nowrap" }}>
                          +{entry.xp}XP
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes xpFlash {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
