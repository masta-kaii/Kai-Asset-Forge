import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const STATS_PATH = join(process.cwd(), "data", "agent-stats.json");

async function loadStats() {
  try {
    const raw = await readFile(STATS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveStats(stats: any) {
  await writeFile(STATS_PATH, JSON.stringify(stats, null, 2), "utf-8");
}

function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export async function GET() {
  const stats = await loadStats();
  return NextResponse.json({ agents: stats });
}

export async function POST(req: Request) {
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

  // Add XP
  agent.totalXP = (agent.totalXP || 0) + earnedXP;
  
  // Check level up
  const required = xpForLevel(agent.level);
  if (agent.totalXP >= required) {
    agent.level = agent.level + 1;
    agent.xpToNext = xpForLevel(agent.level + 1);
    agent.xp = agent.totalXP - required;
  } else {
    agent.xpToNext = required;
    agent.xp = agent.totalXP;
  }

  // Add to training history
  agent.trainingHistory = agent.trainingHistory || [];
  agent.trainingHistory.unshift({
    action: action || "Training session",
    xp: earnedXP,
    ts: new Date().toISOString(),
  });
  // Keep last 20 entries
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

  await saveStats(stats);

  return NextResponse.json({
    agent: stats[agentId],
    leveledUp: agent.xp < earnedXP,
    improvedSkills,
  });
}
