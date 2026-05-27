// @ts-nocheck
import { NextResponse } from "next/server";
import { generateWithSkills, compareGenerations } from "@/lib/skill-sprite-gen";
import * as fs from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATS_PATH = "/tmp/agent-stats.json";

function readAgentStats(): Record<string, { skills: Record<string, { level: number }> }> {
  try {
    if (fs.existsSync(STATS_PATH)) {
      return JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { agentId = "artist", templateName, mode = "generate" } = body;

    // Read agent stats
    const stats = readAgentStats();
    const agent = stats[agentId];

    if (!agent) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found. Train in the DOJO first!` },
        { status: 404 }
      );
    }

    // Extract skill levels
    const skills: AgentSkills = {
      pixelart: agent.skills?.pixelart?.level || 1,
      color: agent.skills?.color?.level || 1,
      composition: agent.skills?.composition?.level || 1,
      speed: agent.skills?.speed?.level || 1,
    };

    const actualAgentId = agentId === "artist" ? "pixel-studio" : agentId;

    if (mode === "compare") {
      // PRACTICE mode: generate at current skill, compare to reference (master-level)
      const masterSkills: AgentSkills = { pixelart: 5, color: 5, composition: 5, speed: 5 };
      const reference = generateWithSkills(masterSkills, templateName);
      const student = generateWithSkills(skills, templateName);
      const comparison = compareGenerations(student, reference);

      return NextResponse.json({
        success: true,
        mode: "compare",
        agent: actualAgentId,
        skills,
        student: {
          template: student.templateName,
          qualityTier: student.qualityTier,
          colorsUsed: student.colorsUsed,
          size: `${student.width}×${student.height}`,
          width: student.width,
          height: student.height,
          pixels: student.pixels,
        },
        reference: {
          template: reference.templateName,
          qualityTier: reference.qualityTier,
          colorsUsed: reference.colorsUsed,
          size: `${reference.width}×${reference.height}`,
        },
        score: comparison.score,
        feedback: comparison.feedback,
      });
    }

    // Standard GENERATE mode
    const sprite = generateWithSkills(skills, templateName);

    return NextResponse.json({
      success: true,
      mode: "generate",
      agent: actualAgentId,
      skills,
      sprite: {
        template: sprite.templateName,
        qualityTier: sprite.qualityTier,
        colorsUsed: sprite.colorsUsed,
        size: `${sprite.width}×${sprite.height}`,
        width: sprite.width,
        height: sprite.height,
        pixels: sprite.pixels,
      },
      unlockedTemplates: skills.pixelart >= 5 ? "All 10 templates" :
        skills.pixelart >= 3 ? "6 templates" : "3 templates",
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
