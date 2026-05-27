import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const STATS_PATH = join(process.env.VERCEL ? '/tmp' : join(process.cwd(), 'data'), 'agent-stats.json');
const STATS_DIR = process.env.VERCEL ? '/tmp' : join(process.cwd(), 'data');

async function ensureDir() {
  if (!existsSync(STATS_DIR)) {
    await mkdir(STATS_DIR, { recursive: true });
  }
}

const DEFAULT_AGENTS = {
  artist: { id:"artist", name:"PIXEL STUDIO", role:"Sprite & Tileset Lab", level:1, xp:0, totalXP:0, xpToNext:100, color:"#60a5fa", bgA:"#061220", motto:"Every pixel has a purpose.", skills:{ pixelart:{name:"Pixel Art",level:1,icon:"🖼",desc:"Sprite & tileset craftsmanship"}, color:{name:"Color Theory",level:1,icon:"🎨",desc:"Palette harmony & optical mixing"}, composition:{name:"Composition",level:1,icon:"📐",desc:"Layout, proportion & silhouette"}, speed:{name:"Speed",level:1,icon:"⚡",desc:"Fast iteration & rapid prototyping"} }, trainingHistory:[] },
  webgen: { id:"webgen", name:"WEB GENERATOR", role:"Page & Component Forge", level:1, xp:0, totalXP:0, xpToNext:100, color:"#22d3ee", bgA:"#041820", motto:"I ship pixels and pages.", skills:{ frontend:{name:"Frontend",level:1,icon:"🖥",desc:"React/Next.js component craft"}, design:{name:"Design",level:1,icon:"🎯",desc:"UI/UX pattern implementation"}, responsive:{name:"Responsive",level:1,icon:"📱",desc:"Multi-device layouts"}, perf:{name:"Performance",level:1,icon:"⚡",desc:"Fast load & render optimization"} }, trainingHistory:[] },
  popo: { id:"popo", name:"POPO COMMAND", role:"Director · Orchestrator", level:1, xp:0, totalXP:0, xpToNext:100, color:"#f5a623", bgA:"#1e1508", motto:"I orchestrate the chaos.", skills:{ orchestration:{name:"Orchestration",level:1,icon:"⚙",desc:"Coordinate multi-agent workflows"}, strategy:{name:"Strategy",level:1,icon:"♟",desc:"Plan optimal production routes"}, vision:{name:"Vision",level:1,icon:"👁",desc:"Define art direction & quality targets"}, delegation:{name:"Delegation",level:1,icon:"↗",desc:"Efficiently assign tasks to agents"} }, trainingHistory:[] },
};

async function loadStats() {
  try {
    await ensureDir();
    if (!existsSync(STATS_PATH)) {
      // Seed defaults on cold start
      await writeFile(STATS_PATH, JSON.stringify(DEFAULT_AGENTS, null, 2), "utf-8");
      return { ...DEFAULT_AGENTS };
    }
    const raw = await readFile(STATS_PATH, "utf-8");
    const data = JSON.parse(raw);
    // Merge defaults for any missing agents
    let changed = false;
    for (const [id, agent] of Object.entries(DEFAULT_AGENTS)) {
      if (!data[id]) { data[id] = { ...agent }; changed = true; }
    }
    if (changed) await writeFile(STATS_PATH, JSON.stringify(data, null, 2), "utf-8");
    return data;
  } catch (e: any) {
    console.error("loadStats error:", e.message);
    return { ...DEFAULT_AGENTS };
  }
}

async function saveStats(stats: any): Promise<void> {
  await ensureDir();
  await writeFile(STATS_PATH, JSON.stringify(stats, null, 2), "utf-8");
}

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export async function GET() {
  try {
    const stats = await loadStats();
    return NextResponse.json({ agents: stats });
  } catch (e: any) {
    console.error("GET /api/dojo/agents error:", e.message);
    return NextResponse.json({ agents: {}, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { agentId, xp: earnedXP, action } = body;

    if (!agentId || !earnedXP || earnedXP <= 0) {
      return NextResponse.json(
        { error: "agentId and positive xp required" },
        { status: 400 }
      );
    }

    const stats = await loadStats();
    const agent = stats[agentId];

    if (!agent) {
      return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
    }

    // Capture level before
    const prevLevel = agent.level;

    // Add XP
    agent.totalXP = (agent.totalXP || 0) + earnedXP;

    // Check level up
    let leveledUp = false;
    let cumulative = agent.totalXP;
    let currentLevel = prevLevel;
    let required = xpForLevel(currentLevel);

    while (cumulative >= required) {
      cumulative -= required;
      currentLevel++;
      required = xpForLevel(currentLevel + 1);
      leveledUp = true;
    }

    agent.level = currentLevel;
    agent.xpToNext = required;
    agent.xp = cumulative;

    // Add to training history
    agent.trainingHistory = agent.trainingHistory || [];
    agent.trainingHistory.unshift({
      action: action || "Training session",
      xp: earnedXP,
      ts: new Date().toISOString(),
    });
    if (agent.trainingHistory.length > 20) {
      agent.trainingHistory = agent.trainingHistory.slice(0, 20);
    }

    // Random skill improvement (20% chance per skill)
    const skillKeys = Object.keys(agent.skills || {});
    const improvedSkills: string[] = [];
    for (const key of skillKeys) {
      if (Math.random() < 0.2) {
        agent.skills[key].level = (agent.skills[key].level || 1) + 1;
        improvedSkills.push(agent.skills[key].name);
      }
    }

    // Save — with retry on failure
    let saved = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await saveStats(stats);
        saved = true;
        break;
      } catch (e: any) {
        console.error(`saveStats attempt ${attempt + 1} failed:`, e.message);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (!saved) {
      throw new Error("Failed to save agent stats after 3 attempts");
    }

    return NextResponse.json({
      agent: stats[agentId],
      leveledUp,
      improvedSkills,
    });
  } catch (e: any) {
    console.error("POST /api/dojo/agents error:", e.message);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
