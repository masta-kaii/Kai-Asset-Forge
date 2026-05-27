// @ts-nocheck
/**
 * AUTONOMOUS PIPELINE — Minimal working version
 * Scout → Forge → QC → Pack → List
 */
import { NextResponse } from "next/server";
import { generateWithSkills, TEMPLATES } from "@/lib/skill-sprite-gen";
import { generatePage } from "@/lib/skill-page-gen";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATS_PATH = "/tmp/agent-stats.json";
const OUTPUT_DIR = "/tmp/forge-output";
const PIPELINE_LOG = "/tmp/pipeline-log.json";

function scoutStage(theme: string, stats: any) {
  const themes = ["dark fantasy","sci-fi","pixel dungeon","medieval","cyberpunk","magical forest","steampunk","underwater","desert ruins","haunted castle"];
  const pickedTheme = theme || themes[Math.floor(Math.random() * themes.length)];
  const paletteStyles = ["warm ramps","cool tones","high contrast","pastel","neon"];
  const pickedPalette = paletteStyles[Math.floor(Math.random() * paletteStyles.length)];
  const brief = {
    theme: pickedTheme, palette: pickedPalette,
    spriteCount: 2 + Math.floor(Math.random() * 3),
    targetSize: ["16×16","32×32","64×64"][Math.floor(Math.random() * 3)],
    style: "pixel art — 0x72 Dungeon Tileset quality standard",
    deadline: new Date(Date.now() + 3600000).toISOString(),
  };
  const log = loadPipelineLog();
  log.scout = { theme: pickedTheme, brief, timestamp: new Date().toISOString() };
  savePipelineLog(log);
  return { stage: "SCOUT", status: "complete", brief };
}

function forgeStage(brief: any, stats: any) {
  const artist = stats.artist || stats.artist_default;
  const webgen = stats.webgen || stats.webgen_default;
  const pixelSkills = {
    pixelart: artist?.skills?.pixelart?.level || 1,
    color: artist?.skills?.color?.level || 1,
    composition: artist?.skills?.composition?.level || 1,
    speed: artist?.skills?.speed?.level || 1,
  };
  const webSkills = {
    frontend: webgen?.skills?.frontend?.level || 1,
    design: webgen?.skills?.design?.level || 1,
    responsive: webgen?.skills?.responsive?.level || 1,
    perf: webgen?.skills?.perf?.level || 1,
  };
  const sprites: any[] = [];
  const templates = TEMPLATES.filter((t: any) => t.difficulty <= pixelSkills.pixelart + Math.floor(pixelSkills.color / 2));
  const count = Math.min(brief.spriteCount, templates.length);
  for (let i = 0; i < count; i++) {
    const template = templates[i] || templates[0];
    const sprite = generateWithSkills(pixelSkills, template.name);
    sprites.push({
      name: template.name,
      qualityTier: sprite.qualityTier,
      colorsUsed: sprite.colorsUsed,
      size: `${sprite.width}×${sprite.height}`,
    });
  }
  const page = generatePage(webSkills, "landing");
  ensureDir(OUTPUT_DIR);
  const batchId = Date.now().toString(36);
  const batchDir = path.join(OUTPUT_DIR, batchId);
  ensureDir(batchDir);
  fs.writeFileSync(path.join(batchDir, "assets.json"), JSON.stringify({
    brief, sprites: sprites.map((s: any) => ({ name: s.name, qualityTier: s.qualityTier, colorsUsed: s.colorsUsed, size: s.size })),
    pageTier: page.tier, pageFeatures: page.features
  }, null, 2));
  fs.writeFileSync(path.join(batchDir, "page.html"), page.html);
  const log = loadPipelineLog();
  log.forge = { batchId, spriteCount: sprites.length, topQuality: sprites[0]?.qualityTier || "Basic", pageTier: page.tier, timestamp: new Date().toISOString() };
  savePipelineLog(log);
  return { stage: "FORGE", status: "complete", batchId, spritesGenerated: sprites.length, topQuality: sprites[0]?.qualityTier || "Basic", pageTier: page.tier, pageFeatures: page.features.length };
}

function qcStage(batchId: string, stats: any) {
  const batchDir = path.join(OUTPUT_DIR, batchId);
  const assetsFile = path.join(batchDir, "assets.json");
  if (!fs.existsSync(assetsFile)) return { stage: "QC", status: "error", error: "No assets found to validate" };
  const assets = JSON.parse(fs.readFileSync(assetsFile, "utf-8"));
  const checks: any[] = [];
  let totalScore = 0;
  let passed = 0;
  for (const sprite of assets.sprites) {
    const tierScore: Record<string,number> = { Basic: 40, Standard: 65, Quality: 80, Masterwork: 95 };
    const tScore = tierScore[sprite.qualityTier] || 50;
    const cScore = sprite.colorsUsed >= 6 ? 20 : sprite.colorsUsed >= 4 ? 15 : 10;
    const score = Math.min(tScore + cScore, 100);
    totalScore += score;
    checks.push({ name: sprite.name, score, pass: score >= 55 });
    if (score >= 55) passed++;
  }
  const pageScore: Record<string,number> = { Basic: 30, Standard: 55, Professional: 75, Enterprise: 95 };
  const pScore = pageScore[assets.pageTier] || 50;
  checks.push({ name: "landing-page", score: pScore, pass: pScore >= 50 });
  if (pScore >= 50) passed++;
  const avgScore = assets.sprites.length > 0 ? Math.round(totalScore / assets.sprites.length) : pScore;
  const overallPass = passed >= Math.ceil(checks.length * 0.6);
  fs.writeFileSync(path.join(batchDir, "qc-report.json"), JSON.stringify({ checks, avgScore, overallPass }, null, 2));
  return {
    stage: "QC", status: overallPass ? "APPROVED" : "NEEDS WORK",
    checks: checks.length, passed, avgScore,
    details: checks.map((c: any) => `${c.name}: ${c.pass ? '✓' : '✕'} ${c.score}/100`),
  };
}

function packStage(batchId: string, stats: any) {
  const batchDir = path.join(OUTPUT_DIR, batchId);
  const assetsFile = path.join(batchDir, "assets.json");
  if (!fs.existsSync(assetsFile)) return { stage: "PACK", status: "error", error: "No assets to package" };
  const assets = JSON.parse(fs.readFileSync(assetsFile, "utf-8"));
  const manifest = { batchId, theme: assets.brief?.theme || "unknown", generated: new Date().toISOString(), contents: { sprites: assets.sprites || [], page: { tier: assets.pageTier, features: assets.pageFeatures || [] } }, files: [] as string[] };
  const files = fs.readdirSync(batchDir);
  for (const file of files) manifest.files.push(file);
  fs.writeFileSync(path.join(batchDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return { stage: "PACK", status: "complete", batchId, files: files.length, manifest };
}

function listStage(batchId: string, stats: any) {
  const batchDir = path.join(OUTPUT_DIR, batchId);
  const manifestFile = path.join(batchDir, "manifest.json");
  if (!fs.existsSync(manifestFile)) return { stage: "LIST", status: "error", error: "No manifest to list" };
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
  const listing = { id: batchId, title: `${manifest.theme} — Pixel Art Pack`, description: `Autonomously generated ${manifest.theme} themed asset pack. ${manifest.contents.sprites.length} sprites + landing page.`, price: Math.floor(manifest.contents.sprites.length * 2.99), currency: "USD", tags: [manifest.theme, "pixel-art", "game-assets", "autonomous"], contents: manifest.contents, generated: manifest.generated };
  fs.writeFileSync(path.join(batchDir, "listing.json"), JSON.stringify(listing, null, 2));
  return { stage: "LIST", status: "complete", listing };
}

function ensureDir(dir: string) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function loadPipelineLog(): any { try { if (fs.existsSync(PIPELINE_LOG)) return JSON.parse(fs.readFileSync(PIPELINE_LOG, "utf-8")); } catch {} return {}; }
function savePipelineLog(log: any) { ensureDir("/tmp"); fs.writeFileSync(PIPELINE_LOG, JSON.stringify(log, null, 2)); }
function loadStats(): any { try { if (fs.existsSync(STATS_PATH)) return JSON.parse(fs.readFileSync(STATS_PATH, "utf-8")); } catch {} return {}; }

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { theme } = body;
    const stats = loadStats();
    const pipeline: any[] = [];
    const scout = scoutStage(theme, stats);
    pipeline.push(scout);
    const forge = forgeStage(scout.brief, stats);
    pipeline.push(forge);
    const qc = qcStage(forge.batchId, stats);
    pipeline.push(qc);
    const pack = packStage(forge.batchId, stats);
    pipeline.push(pack);
    const list = listStage(forge.batchId, stats);
    pipeline.push(list);
    return NextResponse.json({
      success: true, autonomous: true, batchId: forge.batchId, theme: scout.brief.theme, pipeline,
      summary: { sprites: forge.spritesGenerated, topQuality: forge.topQuality, pageTier: forge.pageTier, qcPassed: qc.passed, qcTotal: qc.checks, qcStatus: qc.status, price: list.listing?.price || 0 },
      output: `/api/forge/autonomous?batch=${forge.batchId}`,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const batchId = url.searchParams.get("batch");
  if (batchId) {
    const mf = path.join(OUTPUT_DIR, batchId, "manifest.json");
    if (fs.existsSync(mf)) return NextResponse.json(JSON.parse(fs.readFileSync(mf, "utf-8")));
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  return NextResponse.json({ pipeline: loadPipelineLog() });
}
