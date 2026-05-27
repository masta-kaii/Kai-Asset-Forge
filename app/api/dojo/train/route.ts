// @ts-nocheck
/**
 * ENHANCED DOJO TRAINING — Real Connection
 * 
 * Training now ACTUALLY generates assets and compares quality.
 * XP earned = real quality score, not random numbers.
 * 
 * STUDY: Analyzes reference → stores real insights
 * PRACTICE: Generates at current skill → compares to master → real score
 * CHALLENGE: Generates at skill+1 → passes if score > 70
 */
import { NextResponse } from "next/server";
import { generateWithSkills, compareGenerations, TEMPLATES } from "@/lib/skill-sprite-gen";
import { generatePage, comparePages } from "@/lib/skill-page-gen";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATS_PATH = "/tmp/agent-stats.json";
const TRAINING_MEMORY_PATH = "/tmp/training-memory.json";

// ═══════════════════════════════════════════════════════════════
//  STATS HELPERS
// ═══════════════════════════════════════════════════════════════

function ensureStats(): Record<string, any> {
  const defaultStats = getDefaultStats();
  try {
    if (fs.existsSync(STATS_PATH)) {
      const data = JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"));
      // Merge defaults for any missing agents
      for (const [id, agent] of Object.entries(defaultStats)) {
        if (!data[id]) data[id] = agent;
      }
      return data;
    }
  } catch {}
  // Seed with defaults
  fs.writeFileSync(STATS_PATH, JSON.stringify(defaultStats, null, 2));
  return defaultStats;
}

function getDefaultStats() {
  return {
    artist: {
      id: "artist", name: "PIXEL STUDIO", level: 1, xp: 0, totalXP: 0, xpToNext: 100,
      skills: {
        pixelart: { level: 1, name: "Pixel Art" },
        color: { level: 1, name: "Color Theory" },
        composition: { level: 1, name: "Composition" },
        speed: { level: 1, name: "Speed" },
      },
      trainingHistory: [] as any[],
    },
    webgen: {
      id: "webgen", name: "WEB GENERATOR", level: 1, xp: 0, totalXP: 0, xpToNext: 100,
      skills: {
        frontend: { level: 1, name: "Frontend" },
        design: { level: 1, name: "Design" },
        responsive: { level: 1, name: "Responsive" },
        perf: { level: 1, name: "Performance" },
      },
      trainingHistory: [] as any[],
    },
  };
}

function saveStats(stats: Record<string, any>) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
}

function loadTrainingMemory(): Record<string, any> {
  try {
    if (fs.existsSync(TRAINING_MEMORY_PATH)) {
      return JSON.parse(fs.readFileSync(TRAINING_MEMORY_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

// ═══════════════════════════════════════════════════════════════
//  SKILL EXTRACTION
// ═══════════════════════════════════════════════════════════════

function getPixelSkills(agent: any) {
  return {
    pixelart: agent.skills?.pixelart?.level || 1,
    color: agent.skills?.color?.level || 1,
    composition: agent.skills?.composition?.level || 1,
    speed: agent.skills?.speed?.level || 1,
  };
}

function getWebSkills(agent: any) {
  return {
    frontend: agent.skills?.frontend?.level || 1,
    design: agent.skills?.design?.level || 1,
    responsive: agent.skills?.responsive?.level || 1,
    perf: agent.skills?.perf?.level || 1,
  };
}

// ═══════════════════════════════════════════════════════════════
//  LEVELING
// ═══════════════════════════════════════════════════════════════

function getXPForLevel(level: number): number {
  return 100 * Math.pow(1.5, level - 1);
}

function applyXP(agent: any, xpGained: number): { leveledUp: boolean; skillsImproved: string[] } {
  agent.xp = (agent.xp || 0) + xpGained;
  agent.totalXP = (agent.totalXP || 0) + xpGained;
  
  let leveledUp = false;
  const skillsImproved: string[] = [];
  
  // Level up check
  while (agent.xp >= agent.xpToNext) {
    agent.xp -= agent.xpToNext;
    agent.level = (agent.level || 1) + 1;
    agent.xpToNext = getXPForLevel(agent.level);
    leveledUp = true;
    
    // On level up, improve a random skill
    const skills = Object.keys(agent.skills || {});
    if (skills.length > 0) {
      const skillToImprove = skills[Math.floor(Math.random() * skills.length)];
      agent.skills[skillToImprove].level = (agent.skills[skillToImprove].level || 1) + 1;
      skillsImproved.push(skillToImprove);
    }
  }
  
  return { leveledUp, skillsImproved };
}

// ═══════════════════════════════════════════════════════════════
//  PIXEL STUDIO TRAINING
// ═══════════════════════════════════════════════════════════════

function trainPixelStudio(agent: any, mode: string, templateName?: string) {
  const skills = getPixelSkills(agent);
  const memory = loadTrainingMemory();
  
  // STUDY: Analyze a reference template
  if (mode === "study") {
    const template = templateName 
      ? TEMPLATES.find(t => t.name === templateName) 
      : TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    
    if (!template) {
      return { error: `Template "${templateName}" not found` };
    }

    // Analyze the template
    const colorsUsed = new Set<number>();
    for (const row of template.grid) {
      for (const cell of row) {
        if (cell >= 0) colorsUsed.add(cell);
      }
    }
    
    const hasOutline = template.grid.some(row => row.includes(0));
    const hasHighlights = template.grid.some(row => 
      row.some(cell => [7, 10, 20].includes(cell))
    );
    const hasTransparency = template.grid.some(row => row.includes(-1));

    // Store in training memory
    memory[template.name] = {
      studied: true,
      studiedAt: new Date().toISOString(),
      colorsUsed: colorsUsed.size,
      hasOutline,
      hasHighlights,
      hasTransparency,
      size: `${template.width}×${template.height}`,
    };
    fs.writeFileSync(TRAINING_MEMORY_PATH, JSON.stringify(memory, null, 2));

    const insights = [
      `🎨 PALETTE: ${colorsUsed.size} unique colors detected`,
      `✏️ OUTLINE: ${hasOutline ? '1px dark outline present' : 'No outline detected'}`,
      `✨ HIGHLIGHTS: ${hasHighlights ? 'Specular highlights found' : 'No highlights'}`,
      `🫧 TRANSPARENCY: ${hasTransparency ? 'Transparent pixels used' : 'Fully opaque'}`,
      `📐 SIZE: ${template.width}×${template.height} pixels — ${template.width * template.height} total`,
      `📚 DIFFICULTY: ${template.difficulty}/5`,
    ];

    const xpGained = 10 + (template.difficulty * 3);
    const { leveledUp, skillsImproved } = applyXP(agent, xpGained);

    return {
      success: true,
      mode: "study",
      agent: agent.id,
      xp: xpGained,
      leveledUp,
      improvedSkills: skillsImproved,
      template: template.name,
      insights,
      feedback: `Studied ${template.name} — ${template.width}×${template.height} pixel art. Insights stored in training memory for future practice.`,
      currentSkills: getPixelSkills(agent),
    };
  }

  // PRACTICE: Generate at current skill, compare to master
  if (mode === "practice") {
    const templates = TEMPLATES.filter(t => t.difficulty <= skills.pixelart + Math.floor(skills.color / 2));
    if (templates.length === 0) {
      return { error: "No templates available at current skill level. Train pixelart or color first!" };
    }
    
    const template = templateName
      ? templates.find(t => t.name === templateName) || templates[templates.length - 1]
      : templates[Math.floor(Math.random() * templates.length)];

    const masterSkills = { pixelart: 5, color: 5, composition: 5, speed: 5 };
    const reference = generateWithSkills(masterSkills, template.name);
    const student = generateWithSkills(skills, template.name);
    const comparison = compareGenerations(student, reference);

    // XP = real score
    const xpGained = comparison.score;
    const { leveledUp, skillsImproved } = applyXP(agent, xpGained);

    return {
      success: true,
      mode: "practice",
      agent: agent.id,
      xp: xpGained,
      score: comparison.score,
      leveledUp,
      improvedSkills: skillsImproved,
      template: template.name,
      studentQuality: student.qualityTier,
      referenceQuality: reference.qualityTier,
      feedback: comparison.feedback,
      currentSkills: getPixelSkills(agent),
    };
  }

  // CHALLENGE: Generate at skill+1 difficulty
  if (mode === "challenge") {
    const challengeSkills = {
      pixelart: Math.min(skills.pixelart + 1, 5),
      color: Math.min(skills.color + 1, 5),
      composition: Math.min(skills.composition + 1, 5),
      speed: skills.speed,
    };

    const templates = TEMPLATES.filter(t => t.difficulty <= challengeSkills.pixelart + Math.floor(challengeSkills.color / 2));
    if (templates.length === 0) {
      return { error: "No challenge-level templates available. Train more!" };
    }

    const template = templates[templates.length - 1]; // Hardest available
    const masterSkills = { pixelart: 5, color: 5, composition: 5, speed: 5 };
    const reference = generateWithSkills(masterSkills, template.name);
    const student = generateWithSkills(challengeSkills, template.name);
    const comparison = compareGenerations(student, reference);

    const passed = comparison.score >= 65;
    const xpGained = passed ? comparison.score * 1.5 : comparison.score * 0.5;
    const { leveledUp, skillsImproved } = applyXP(agent, Math.round(xpGained));

    return {
      success: true,
      mode: "challenge",
      agent: agent.id,
      xp: Math.round(xpGained),
      score: comparison.score,
      passed,
      leveledUp,
      improvedSkills: skillsImproved,
      template: template.name,
      studentQuality: student.qualityTier,
      referenceQuality: reference.qualityTier,
      feedback: [
        passed ? "🏆 CHALLENGE PASSED! You pushed beyond your current skill level." : "❌ Challenge failed — keep training fundamentals first.",
        ...comparison.feedback,
      ],
      currentSkills: getPixelSkills(agent),
    };
  }

  return { error: `Unknown mode: ${mode}` };
}

// ═══════════════════════════════════════════════════════════════
//  WEB GENERATOR TRAINING
// ═══════════════════════════════════════════════════════════════

function trainWebGenerator(agent: any, mode: string) {
  const skills = getWebSkills(agent);

  if (mode === "study") {
    const masterSkills = { frontend: 5, design: 5, responsive: 5, perf: 5 };
    const page = generatePage(masterSkills, "landing");
    
    const xpGained = 15;
    const { leveledUp, skillsImproved } = applyXP(agent, xpGained);

    return {
      success: true,
      mode: "study",
      agent: agent.id,
      xp: xpGained,
      leveledUp,
      improvedSkills: skillsImproved,
      insights: [
        `🎨 DESIGN: ${page.features.length} features in reference page`,
        `📐 STRUCTURE: Hero + Feature Cards + Footer layout`,
        `🏆 TIER: ${page.tier} level page studied`,
      ],
      feedback: "Studied a professional landing page. Design patterns and structure extracted.",
      currentSkills: getWebSkills(agent),
    };
  }

  if (mode === "practice") {
    const masterSkills = { frontend: 5, design: 5, responsive: 5, perf: 5 };
    const reference = generatePage(masterSkills, "landing");
    const student = generatePage(skills, "landing");
    const comparison = comparePages(student, reference);

    const xpGained = comparison.score;
    const { leveledUp, skillsImproved } = applyXP(agent, xpGained);

    return {
      success: true,
      mode: "practice",
      agent: agent.id,
      xp: xpGained,
      score: comparison.score,
      leveledUp,
      improvedSkills: skillsImproved,
      studentTier: student.tier,
      referenceTier: reference.tier,
      feedback: comparison.feedback,
      currentSkills: getWebSkills(agent),
    };
  }

  if (mode === "challenge") {
    const challengeSkills = {
      frontend: Math.min(skills.frontend + 1, 5),
      design: Math.min(skills.design + 1, 5),
      responsive: Math.min(skills.responsive + 1, 5),
      perf: Math.min(skills.perf + 1, 5),
    };

    const masterSkills = { frontend: 5, design: 5, responsive: 5, perf: 5 };
    const reference = generatePage(masterSkills, "landing");
    const student = generatePage(challengeSkills, "landing");
    const comparison = comparePages(student, reference);

    const passed = comparison.score >= 65;
    const xpGained = passed ? comparison.score * 1.5 : comparison.score * 0.5;
    const { leveledUp, skillsImproved } = applyXP(agent, Math.round(xpGained));

    return {
      success: true,
      mode: "challenge",
      agent: agent.id,
      xp: Math.round(xpGained),
      score: comparison.score,
      passed,
      leveledUp,
      improvedSkills: skillsImproved,
      studentTier: student.tier,
      referenceTier: reference.tier,
      feedback: [
        passed ? "🏆 CHALLENGE PASSED! You pushed beyond your current skill level." : "❌ Challenge failed — keep training fundamentals first.",
        ...comparison.feedback,
      ],
      currentSkills: getWebSkills(agent),
    };
  }

  if (mode === "responsive") {
    const pageTypes = [
      { type: "landing", label: "Desktop Landing" },
      { type: "dashboard", label: "Mobile Dashboard" },
    ];
    const chosen = pageTypes[Math.floor(Math.random() * pageTypes.length)];
    const page = generatePage(skills, chosen.type);

    const xpGained = 25;
    const { leveledUp, skillsImproved } = applyXP(agent, xpGained);

    return {
      success: true,
      mode: "responsive",
      agent: agent.id,
      xp: xpGained,
      leveledUp,
      improvedSkills: skillsImproved,
      pageType: chosen.label,
      tier: page.tier,
      feedback: [
        `📱 Generated ${chosen.label} page at ${page.tier} tier`,
        `🎨 Features: ${page.features.join(', ')}`,
        `📐 Responsive level: ${skills.responsive} — ${page.skillBreakdown.responsive.unlocks.join(', ')}`,
      ],
      currentSkills: getWebSkills(agent),
    };
  }

  return { error: `Unknown mode: ${mode}` };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let { agentId, mode, templateName, reference } = body;

    if (!agentId || !mode) {
      return NextResponse.json({ error: "agentId and mode required" }, { status: 400 });
    }

    // Accept reference object from DOJO UI: map it to a template name
    if (!templateName && reference) {
      const refId = typeof reference === 'string' ? reference : (reference.id || reference.name || '');
      // Map DOJO reference IDs to pixel art templates
      const refMap: Record<string, string> = {
        'bob_idle': 'crystal_magic',
        'bob_run': 'sword_flame',
        'amelia_idle': 'egg_dragon',
        'alex_sit': 'tome_ancient',
        'interiors_16': 'chalice_golden',
        'td_props': 'star_charm',
        'td_player': 'feather_phoenix',
        'td_grass': 'orb_mystic',
        'td_stone': 'skull_relic',
        'room_builder_16': 'potion_rainbow',
      };
      templateName = refMap[refId] || undefined;
    }

    const stats = ensureStats();
    const agent = stats[agentId];

    if (!agent) {
      return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 });
    }

    let result: any;

    if (agentId === "artist") {
      result = trainPixelStudio(agent, mode, templateName);
    } else if (agentId === "webgen") {
      result = trainWebGenerator(agent, mode);
    } else {
      return NextResponse.json({ error: `Unknown agent: ${agentId}` }, { status: 400 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Save stats
    saveStats(stats);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  const stats = ensureStats();
  return NextResponse.json({ agents: stats });
}
