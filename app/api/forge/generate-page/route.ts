// @ts-nocheck
import { NextResponse } from "next/server";
import { generatePage, comparePages } from "@/lib/skill-page-gen";
import * as fs from "fs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATS_PATH = "/tmp/agent-stats.json";

function readAgentStats() {
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
    const { agentId = "webgen", pageType = "landing", mode = "generate" } = body;

    const stats = readAgentStats();
    const agent = stats[agentId];

    if (!agent) {
      return NextResponse.json(
        { error: `Agent ${agentId} not found. Train in the DOJO first!` },
        { status: 404 }
      );
    }

    const skills = {
      frontend: agent.skills?.frontend?.level || 1,
      design: agent.skills?.design?.level || 1,
      responsive: agent.skills?.responsive?.level || 1,
      perf: agent.skills?.perf?.level || 1,
    };

    if (mode === "compare") {
      const masterSkills = { frontend: 5, design: 5, responsive: 5, perf: 5 };
      const reference = generatePage(masterSkills, pageType);
      const student = generatePage(skills, pageType);
      const comparison = comparePages(student, reference);

      return NextResponse.json({
        success: true,
        mode: "compare",
        agent: agentId,
        skills,
        student: { tier: student.tier, features: student.features, html: student.html, skillBreakdown: student.skillBreakdown },
        reference: { tier: reference.tier, features: reference.features },
        score: comparison.score,
        feedback: comparison.feedback,
      });
    }

    const page = generatePage(skills, pageType);

    return NextResponse.json({
      success: true,
      mode: "generate",
      agent: agentId,
      skills,
      page: {
        tier: page.tier,
        features: page.features,
        html: page.html,
        skillBreakdown: page.skillBreakdown,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
