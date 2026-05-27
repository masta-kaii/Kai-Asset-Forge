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

async function loadStats() {
  try {
    await ensureDir();
    if (!existsSync(STATS_PATH)) return {};
    const raw = await readFile(STATS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (e: any) {
    console.error("loadStats error:", e.message);
    return {};
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
