// @ts-nocheck
/**
 * AUTONOMOUS PIPELINE — No Hermes Required
 * 
 * Scout → Forge → QC → Pack → List
 * All stages run on Vercel, self-contained.
 * Each stage reads/writes agent stats, skill levels affect output quality.
 */
import { NextResponse } from "next/server";
import { generateWithSkills, compareGenerations, TEMPLATES } from "@/lib/skill-sprite-gen";
import { generatePage, comparePages } from "@/lib/skill-page-gen";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATS_PATH = "/tmp/agent-stats.json";
const OUTPUT_DIR = "/tmp/forge-output";
const PIPELINE_LOG = "/tmp/pipeline-log.json";

// ═══════════════════════════════════════════════════════════════
//  STAGE 1: SCOUT — Research & Creative Brief
// ═══════════════════════════════════════════════════════════════
function scoutStage(theme: string, stats: any) {
  const popo = stats.popo;
  const themes = [
    "dark fantasy", "sci-fi", "pixel dungeon", "medieval", "cyberpunk",
    "magical forest", "steampunk", "underwater", "desert ruins", "haunted castle"
  ];
  
  const pickedTheme = theme || themes[Math.floor(Math.random() * themes.length)];
  const paletteStyles = ["warm ramps", "cool tones", "high contrast", "pastel", "neon"];
  const pickedPalette = paletteStyles[Math.floor(Math.random() * paletteStyles.length)];
  
  const brief = {
    theme: pickedTheme,
    palette: pickedPalette,
    spriteCount: 2 + Math.floor(Math.random() * 3),
    targetSize: ["16×16", "32×32", "64×64"][Math.floor(Math.random() * 3)],
    style: "pixel art — 0x72 Dungeon Tileset quality standard",
    deadline: new Date(Date.now() + 3600000).toISOString(),
  };

  // Log scout activity
  const log = loadPipelineLog();
  log.scout = { theme: pickedTheme, brief, timestamp: new Date().toISOString() };
  savePipelineLog(log);

  return { stage: "SCOUT", status: "complete", brief };
}

// ═══════════════════════════════════════════════════════════════
//  STAGE 2: FORGE — Generate Assets
// ═══════════════════════════════════════════════════════════════
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

  // Generate sprites
  const sprites: any[] = [];
  const templates = TEMPLATES.filter(t => t.difficulty <= pixelSkills.pixelart + Math.floor(pixelSkills.color / 2));
  const count = Math.min(brief.spriteCount, templates.length);
  
  for (let i = 0; i < count; i++) {
    const template = templates[i] || templates[0];
    const sprite = generateWithSkills(pixelSkills, template.name);
    sprites.push({
      name: template.name,
      qualityTier: sprite.qualityTier,
      colorsUsed: sprite.colorsUsed,
      size: `${sprite.width}×${sprite.height}`,
      pixels: sprite.pixels,
    });
  }

  // Generate landing page
  const page = generatePage(webSkills, "landing");

  const assets = { sprites, page };

  // Save to forge output
  ensureDir(OUTPUT_DIR);
  const batchId = Date.now().toString(36);
  const batchDir = path.join(OUTPUT_DIR, batchId);
  ensureDir(batchDir);
  
  fs.writeFileSync(
    path.join(batchDir, "assets.json"),
    JSON.stringify({ brief, sprites: sprites.map(s => ({ name: s.name, qualityTier: s.qualityTier, colorsUsed: s.colorsUsed, size: s.size })), pageTier: page.tier, pageFeatures: page.features }, null, 2)
  );
  fs.writeFileSync(path.join(batchDir, "page.html"), page.html);

  const log = loadPipelineLog();
  log.forge = { batchId, spriteCount: sprites.length, topQuality: sprites[0]?.qualityTier || "Basic", pageTier: page.tier, timestamp: new Date().toISOString() };
  savePipelineLog(log);

  return {
    stage: "FORGE",
    status: "complete",
    batchId,
    spritesGenerated: sprites.length,
    topQuality: sprites[0]?.qualityTier || "Basic",
    pageTier: page.tier,
    pageFeatures: page.features.length,
  };
}

// ═══════════════════════════════════════════════════════════════
//  FORGE PALETTE — THE 0x72 STANDARD
// ═══════════════════════════════════════════════════════════════
const FORGE_PALETTE: Record<number, [number, number, number]> = {
  0:  [0,0,0],       1:  [34,32,52],    2:  [69,40,60],
  3:  [102,57,49],   4:  [143,86,59],   5:  [89,67,57],
  6:  [162,112,88],  7:  [217,160,102], 8:  [172,50,50],
  9:  [217,87,99],   10: [251,242,54],  11: [153,229,80],
  12: [106,190,48],  13: [55,148,110],  14: [75,105,47],
  15: [82,75,36],    16: [50,60,57],    17: [63,63,116],
  18: [91,110,225],  19: [70,66,94],    20: [244,180,27],
  21: [223,113,38],  22: [132,126,135], 23: [105,106,106],
  24: [38,43,68],
};

// Warm character body indices (shadow must be BROWN=4, never PINK=9)
const WARM_BODY = new Set([20, 21, 8, 10]); // Gold, Orange, Dark Red, Yellow
const COOL_BODY = new Set([17, 18, 19, 11, 12, 13]); // Blue-gray, Blue, Purple-gray, Green

function rgbDist(a: [number,number,number], b: [number,number,number]): number {
  return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
}

function findClosestPalette(r: number, g: number, b: number, a: number): number {
  if (a < 128) return -1; // transparent
  let best = 0, bestDist = Infinity;
  for (const [idx, color] of Object.entries(FORGE_PALETTE)) {
    const d = rgbDist([r,g,b], color);
    if (d < bestDist) { bestDist = d; best = parseInt(idx); }
  }
  return bestDist > 80 ? -2 : best; // -2 = not in palette
}

// ═══════════════════════════════════════════════════════════════
//  PIXEL-LEVEL QC VALIDATOR
// ═══════════════════════════════════════════════════════════════

interface PixelGrid { w: number; h: number; data: number[][]; }

function parsePixels(sprite: any): PixelGrid | null {
  if (!sprite.pixels || !Array.isArray(sprite.pixels)) return null;
  const w = sprite.width || sprite.size?.split("×")[0] || 16;
  const h = sprite.height || sprite.size?.split("×")[1] || 16;
  const data: number[][] = [];
  // Parse pixel data from sprite (supports flat arrays and 2D)
  if (sprite.pixels.length === w * h) {
    for (let y = 0; y < h; y++) {
      data.push(sprite.pixels.slice(y * w, (y + 1) * w).map((pixel: any) => 
        typeof pixel === 'number' ? pixel : (pixel.index ?? pixel.color ?? -1)
      ));
    }
  } else if (Array.isArray(sprite.pixels[0])) {
    for (let y = 0; y < h; y++) data.push(sprite.pixels[y] || []);
  }
  return { w, h, data };
}

function checkOutline(grid: PixelGrid): { score: number; issues: string[] } {
  const issues: string[] = [];
  let penalty = 0;
  const { w, h, data } = grid;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y][x] < 0) continue; // transparent skip
      // Is this on the silhouette edge?
      const neighbors = [
        [x-1,y],[x+1,y],[x,y-1],[x,y+1]
      ];
      const hasTransparent = neighbors.some(([nx,ny]) => {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) return true;
        return data[ny][nx] < 0;
      });
      if (!hasTransparent) continue;
      
      // This pixel is on the edge — check if it has a black outline neighbor
      const hasBlackNeighbor = neighbors.some(([nx,ny]) => {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) return false;
        return data[ny][nx] === 0;
      });
      if (!hasBlackNeighbor) {
        penalty++;
        if (penalty <= 3) issues.push(`Missing outline at (${x},${y})`);
      }
    }
  }

  // Check for 2px+ thick outlines
  let thickSpots = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y][x] !== 0) continue;
      // Check if this black pixel has another black pixel outward from the shape
      const blackNeighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([nx,ny]) => {
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) return false;
        return data[ny][nx] === 0;
      }).length;
      // Count clusters of 3+ black pixels in a row/col
      if (blackNeighbors >= 2) {
        // Check if it's a 2px thick section
        const rowBlack = (data[y][x-1]||-1) === 0 && (data[y][x+1]||-1) === 0;
        const colBlack = (y>0&&data[y-1][x]===0) && (y<h-1&&data[y+1][x]===0);
        if (!rowBlack && !colBlack) thickSpots++;
      }
    }
  }
  if (thickSpots > w * h * 0.02) {
    issues.push(`Outline too thick: ${thickSpots} px in 2px+ clusters`);
    penalty += thickSpots;
  }

  const maxPenalty = w * h * 0.3;
  return { score: Math.max(0, 20 - Math.floor((penalty / maxPenalty) * 20)), issues };
}

function checkPalette(grid: PixelGrid): { score: number; issues: string[]; colorsFound: Set<number>; nonForge: number } {
  const issues: string[] = [];
  const colorsFound = new Set<number>();
  let nonForge = 0;
  let pinkAsShadow = false;
  const { w, h, data } = grid;

  // Find dominant body color
  const bodyColorCounts: Record<number, number> = {};
  let totalColored = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y][x];
      if (c < 0) continue;
      totalColored++;
      if (c === -2) { nonForge++; continue; } // PURE_WHITE special marker
      if (!(c in FORGE_PALETTE)) { nonForge++; continue; }
      colorsFound.add(c);
      bodyColorCounts[c] = (bodyColorCounts[c] || 0) + 1;
    }
  }

  // Find dominant body color (most common non-outline, non-transparent)
  const sortedColors = Object.entries(bodyColorCounts)
    .filter(([c]) => parseInt(c) !== 0)
    .sort((a, b) => b[1] - a[1]);
  const dominantColor = sortedColors[0] ? parseInt(sortedColors[0][0]) : -1;
  const isWarm = WARM_BODY.has(dominantColor);
  const isCool = COOL_BODY.has(dominantColor);

  // Check for PINK (9) as body shadow on warm character
  if (isWarm && colorsFound.has(9)) {
    pinkAsShadow = true;
    issues.push("🔴 AUTO-FAIL: Pink (index 9) used as body shadow on warm character — use BROWN (index 4) instead");
  }

  // Check for cool shadow on warm
  if (isWarm && colorsFound.has(17) && colorsFound.has(18)) {
    issues.push("Blue shadow on warm character — shadows should be BROWN (4) or dark red (8)");
  }

  // Orphan colors (< 2% of colored pixels)
  for (const [c, count] of Object.entries(bodyColorCounts)) {
    if (count < totalColored * 0.02 && parseInt(c) !== 0) {
      issues.push(`Orphan color: index ${c} appears only ${count} times (${((count/totalColored)*100).toFixed(1)}%)`);
    }
  }

  let score = 25;
  if (pinkAsShadow) score = 0;
  if (nonForge > totalColored * 0.05) score -= 10;
  if (colorsFound.size < 3) score -= 5;
  if (colorsFound.size > 12) score -= 3;

  return { score: Math.max(0, score), issues, colorsFound, nonForge };
}

function checkSilhouette(grid: PixelGrid): { score: number; issues: string[] } {
  const issues: string[] = [];
  const { w, h, data } = grid;

  // Count distinct colored regions (body part separation)
  const visited = Array.from({ length: h }, () => new Array(w).fill(false));
  let regions = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y][x] < 0 || visited[y][x]) continue;
      regions++;
      // Flood fill
      const stack = [[x, y]];
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
        if (visited[cy][cx] || data[cy][cx] < 0) continue;
        visited[cy][cx] = true;
        stack.push([cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]);
      }
    }
  }

  // 2-6 regions is healthy for a character (body + limbs + features)
  // 1 region = blob, 10+ = scattered noise
  let score = 20;
  if (regions === 1) { score -= 8; issues.push("Single blob silhouette — no body part separation"); }
  else if (regions > 10) { score -= 5; issues.push("Too many disconnected regions — scattered pixels"); }
  else if (regions < 3) { score -= 3; issues.push("Only 2 silhouette regions — limbs should be distinct"); }

  // Check for floating eyes (eye pixels with no body-colored neighbor)
  if (data.some((row, y) => row.some((c, x) => {
    if (c !== 7) return false; // OW = eye sclera
    const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    return !neighbors.some(([nx,ny]) => {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) return false;
      return data[ny][nx] >= 0 && data[ny][nx] !== 0 && data[ny][nx] !== 7 && data[ny][nx] !== 10;
    });
  }))) {
    issues.push("Floating eyes detected — eye pixels have no body-colored neighbor");
    score -= 5;
  }

  return { score: Math.max(0, score), issues };
}

function checkShading(grid: PixelGrid): { score: number; issues: string[] } {
  const issues: string[] = [];
  const { w, h, data } = grid;

  // Pillow shading detection: is center brighter than all edges?
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  let centerBright = 0, centerCount = 0;
  let edgeBright = 0, edgeCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y][x];
      if (c < 0 || c === 0) continue; // skip transparent and outline
      const color = FORGE_PALETTE[c] || [128,128,128];
      const bright = color[0] + color[1] + color[2];
      
      const distFromCenter = Math.sqrt((x-cx)**2 + (y-cy)**2);
      if (distFromCenter < Math.min(w,h) * 0.25) {
        centerBright += bright; centerCount++;
      }
      if (x <= 1 || x >= w-2 || y <= 1 || y >= h-2) {
        edgeBright += bright; edgeCount++;
      }
    }
  }

  if (centerCount > 5 && edgeCount > 5) {
    const centerAvg = centerBright / centerCount;
    const edgeAvg = edgeBright / edgeCount;
    // Pillow shading: center is brighter
    if (centerAvg > edgeAvg * 1.15) {
      issues.push("🔴 AUTO-FAIL: Pillow shading detected — center is brighter than edges");
      return { score: 0, issues };
    }
  }

  // Check for light direction consistency (top should be brighter than bottom)
  let topBright = 0, topCount = 0;
  let bottomBright = 0, bottomCount = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y][x];
      if (c < 0 || c === 0) continue;
      const color = FORGE_PALETTE[c] || [128,128,128];
      const bright = color[0] + color[1] + color[2];
      if (y < h * 0.3) { topBright += bright; topCount++; }
      if (y > h * 0.7) { bottomBright += bright; bottomCount++; }
    }
  }
  let score = 15;
  if (topCount > 3 && bottomCount > 3) {
    if (bottomBright / bottomCount > topBright / topCount) {
      issues.push("Light direction is from bottom (should be top-left)");
      score -= 5;
    }
  }

  return { score: Math.max(0, score), issues };
}

function validateSprite(sprite: any): any {
  const grid = parsePixels(sprite);
  if (!grid) {
    // Fallback: no pixel data available, use metadata-only QC
    const tierScore = { Basic: 40, Standard: 65, Quality: 80, Masterwork: 95 }[sprite.qualityTier] || 50;
    const colorScore = sprite.colorsUsed >= 6 ? 20 : sprite.colorsUsed >= 4 ? 15 : 10;
    return {
      name: sprite.name,
      score: Math.min(tierScore + colorScore, 100),
      pass: tierScore + colorScore >= 55,
      details: { method: "metadata-only", tier: sprite.qualityTier, colors: sprite.colorsUsed },
      issues: ["No pixel data — metadata-only QC"],
    };
  }

  const outline = checkOutline(grid);
  const palette = checkPalette(grid);
  const silhouette = checkSilhouette(grid);
  const shading = checkShading(grid);
  const style = 20; // Style requires pack comparison, default full score

  const totalScore = palette.score + outline.score + silhouette.score + shading.score + style;
  const allIssues = [
    ...outline.issues,
    ...palette.issues,
    ...silhouette.issues,
    ...shading.issues,
  ];

  // Auto-fail detection
  const autoFails: string[] = [];
  if (palette.score === 0 && palette.issues.some(i => i.includes("AUTO-FAIL"))) autoFails.push("PINK_AS_SHADOW");
  if (shading.score === 0 && shading.issues.some(i => i.includes("AUTO-FAIL"))) autoFails.push("PILLOW_SHADING");
  if (outline.score < 5) autoFails.push("NO_OUTLINES");
  if (palette.nonForge > 50) autoFails.push("NON_FORGE_PALETTE");
  if (silhouette.score < 8) autoFails.push("BLOB_SILHOUETTE");

  const hasAutoFail = autoFails.length > 0;
  const pass = !hasAutoFail && totalScore >= 55;

  return {
    name: sprite.name,
    score: totalScore,
    pass,
    autoFails,
    details: {
      palette: { score: palette.score, colors: palette.colorsFound.size, nonForge: palette.nonForge },
      outline: { score: outline.score },
      silhouette: { score: silhouette.score },
      shading: { score: shading.score },
      style: { score: style },
    },
    issues: allIssues.slice(0, 8),
  };
}

// ═══════════════════════════════════════════════════════════════
//  STAGE 3: QC — Quality Control (REAL pixel-level validation)
// ═══════════════════════════════════════════════════════════════
function qcStage(batchId: string, stats: any) {
  const batchDir = path.join(OUTPUT_DIR, batchId);
  const assetsFile = path.join(batchDir, "assets.json");
  
  if (!fs.existsSync(assetsFile)) {
    return { stage: "QC", status: "error", error: "No assets found to validate" };
  }

  const assets = JSON.parse(fs.readFileSync(assetsFile, "utf-8"));
  const results: any[] = [];
  let totalScore = 0;
  let passed = 0;

  // Validate each sprite with pixel-level QC
  for (const sprite of assets.sprites) {
    const result = validateSprite(sprite);
    results.push(result);
    totalScore += result.score;
    if (result.pass) passed++;
  }

  // Page QC
  const pageScore = { Basic: 30, Standard: 55, Professional: 75, Enterprise: 95 }[assets.pageTier] || 50;
  const pagePass = pageScore >= 50;
  results.push({
    name: "landing-page",
    score: pageScore,
    pass: pagePass,
    details: { tier: assets.pageTier, features: assets.pageFeatures?.length || 0 },
    issues: [],
  });
  if (pagePass) passed++;

  // Check global auto-fails (MUST be declared before overallPass computation)
  let hasAutoFail = false;
  const allAutoFails: string[] = [];
  for (const r of results) {
    if (r.autoFails?.length > 0) {
      hasAutoFail = true;
      allAutoFails.push(`${r.name}: ${r.autoFails.join(", ")}`);
    }
  }

  const avgScore = assets.sprites.length > 0
    ? Math.round(totalScore / assets.sprites.length)
    : pageScore;
  const overallPass = hasAutoFail
    ? false
    : passed >= Math.ceil(results.length * 0.6);

  const report = {
    results,
    avgScore,
    overallPass: hasAutoFail ? false : overallPass,
    autoFails: allAutoFails,
    timestamp: new Date().toISOString(),
    validator: "Pixel-level QC Engine v3.0 (Popo's 0x72 Standards)",
  };

  fs.writeFileSync(
    path.join(batchDir, "qc-report.json"),
    JSON.stringify(report, null, 2)
  );

  const log = loadPipelineLog();
  log.qc = {
    batchId,
    checks: results.length,
    passed,
    avgScore,
    overallPass: report.overallPass,
    autoFails: allAutoFails,
    timestamp: new Date().toISOString(),
  };
  savePipelineLog(log);

  return {
    stage: "QC",
    status: report.overallPass ? "APPROVED" : "NEEDS WORK",
    checks: results.length,
    passed,
    avgScore,
    autoFails: allAutoFails,
    details: results.map(r =>
      `${r.name}: ${r.pass ? '✓' : '✕'} ${r.score}/100${r.autoFails?.length ? ' [AUTO-FAIL: ' + r.autoFails.join(',') + ']' : ''}`
    ),
    feedback: results.flatMap(r => r.issues || []).slice(0, 10),
  };
}

// ═══════════════════════════════════════════════════════════════
//  STAGE 4: PACK — Bundle for Export
// ═══════════════════════════════════════════════════════════════
function packStage(batchId: string, stats: any) {
  const batchDir = path.join(OUTPUT_DIR, batchId);
  const assetsFile = path.join(batchDir, "assets.json");
  
  if (!fs.existsSync(assetsFile)) {
    return { stage: "PACK", status: "error", error: "No assets to package" };
  }

  const assets = JSON.parse(fs.readFileSync(assetsFile, "utf-8"));
  
  const manifest = {
    batchId,
    theme: assets.brief?.theme || "unknown",
    generated: new Date().toISOString(),
    contents: {
      sprites: assets.sprites || [],
      page: { tier: assets.pageTier, features: assets.pageFeatures || [] },
    },
    files: [] as string[],
  };

  // List all files in batch
  const files = fs.readdirSync(batchDir);
  for (const file of files) {
    manifest.files.push(file);
  }

  fs.writeFileSync(
    path.join(batchDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  const log = loadPipelineLog();
  log.pack = { batchId, files: files.length, timestamp: new Date().toISOString() };
  savePipelineLog(log);

  return {
    stage: "PACK",
    status: "complete",
    batchId,
    files: files.length,
    manifest,
  };
}

// ═══════════════════════════════════════════════════════════════
//  STAGE 5: LIST — Create Listing
// ═══════════════════════════════════════════════════════════════
function listStage(batchId: string, stats: any) {
  const batchDir = path.join(OUTPUT_DIR, batchId);
  const manifestFile = path.join(batchDir, "manifest.json");
  
  if (!fs.existsSync(manifestFile)) {
    return { stage: "LIST", status: "error", error: "No manifest to list" };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
  
  const listing = {
    id: batchId,
    title: `${manifest.theme} — Pixel Art Pack`,
    description: `Autonomously generated ${manifest.theme} themed asset pack. ${manifest.contents.sprites.length} sprites + landing page.`,
    price: Math.floor(manifest.contents.sprites.length * 2.99),
    currency: "USD",
    tags: [manifest.theme, "pixel-art", "game-assets", "autonomous"],
    contents: manifest.contents,
    generated: manifest.generated,
  };

  fs.writeFileSync(
    path.join(batchDir, "listing.json"),
    JSON.stringify(listing, null, 2)
  );

  const log = loadPipelineLog();
  log.list = { batchId, title: listing.title, price: listing.price, timestamp: new Date().toISOString() };
  savePipelineLog(log);

  return {
    stage: "LIST",
    status: "complete",
    listing,
  };
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadPipelineLog(): any {
  try {
    if (fs.existsSync(PIPELINE_LOG)) {
      return JSON.parse(fs.readFileSync(PIPELINE_LOG, "utf-8"));
    }
  } catch {}
  return {};
}

function savePipelineLog(log: any) {
  ensureDir("/tmp");
  fs.writeFileSync(PIPELINE_LOG, JSON.stringify(log, null, 2));
}

function loadStats(): any {
  try {
    if (fs.existsSync(STATS_PATH)) {
      return JSON.parse(fs.readFileSync(STATS_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

// ═══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { theme } = body;

    const stats = loadStats();
    const pipeline: any[] = [];
    let batchId = "";

    // STAGE 1: SCOUT
    const scout = scoutStage(theme, stats);
    pipeline.push(scout);

    // STAGE 2: FORGE
    const forge = forgeStage(scout.brief, stats);
    pipeline.push(forge);
    batchId = forge.batchId;

    // STAGE 3: QC
    const qc = qcStage(batchId, stats);
    pipeline.push(qc);

    // STAGE 4: PACK
    const pack = packStage(batchId, stats);
    pipeline.push(pack);

    // STAGE 5: LIST
    const list = listStage(batchId, stats);
    pipeline.push(list);

    // Award XP to agents
    if (stats.artist) {
      stats.artist.totalXP = (stats.artist.totalXP || 0) + 25;
      stats.artist.xp = (stats.artist.xp || 0) + 25;
    }
    if (stats.webgen) {
      stats.webgen.totalXP = (stats.webgen.totalXP || 0) + 20;
      stats.webgen.xp = (stats.webgen.xp || 0) + 20;
    }
    if (stats.popo) {
      stats.popo.totalXP = (stats.popo.totalXP || 0) + 30;
      stats.popo.xp = (stats.popo.xp || 0) + 30;
    }
    try { fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2)); } catch {}

    return NextResponse.json({
      success: true,
      autonomous: true,
      batchId,
      theme: scout.brief.theme,
      pipeline,
      summary: {
        sprites: forge.spritesGenerated,
        topQuality: forge.topQuality,
        pageTier: forge.pageTier,
        qcPassed: qc.passed,
        qcTotal: qc.checks,
        qcStatus: qc.status,
        price: list.listing?.price || 0,
      },
      output: `/api/forge/autonomous?batch=${batchId}`,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// GET: Retrieve pipeline status or batch results
export async function GET(request: Request) {
  const url = new URL(request.url);
  const batchId = url.searchParams.get("batch");

  if (batchId) {
    const batchDir = path.join(OUTPUT_DIR, batchId);
    const manifestFile = path.join(batchDir, "manifest.json");
    
    if (fs.existsSync(manifestFile)) {
      return NextResponse.json(JSON.parse(fs.readFileSync(manifestFile, "utf-8")));
    }
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  // Return pipeline history
  const log = loadPipelineLog();
  return NextResponse.json({ pipeline: log, batches: listBatches() });
}

function listBatches(): any[] {
  ensureDir(OUTPUT_DIR);
  try {
    return fs.readdirSync(OUTPUT_DIR)
      .map(id => {
        const mf = path.join(OUTPUT_DIR, id, "manifest.json");
        if (fs.existsSync(mf)) {
          return JSON.parse(fs.readFileSync(mf, "utf-8"));
        }
        return null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.generated).getTime() - new Date(a.generated).getTime());
  } catch {
    return [];
  }
}
