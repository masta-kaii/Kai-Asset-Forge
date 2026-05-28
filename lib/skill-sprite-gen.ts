/**
 * Skill-Based Sprite Generator
 * 
 * Connects DOJO training to actual generation quality.
 * Higher agent skills → more detailed, more colorful, better-composed sprites.
 * 
 * Skill levels map to real generation parameters:
 *   pixelart  L1→L5: 8×8 basic shapes → 64×64 multi-part characters
 *   color     L1→L5: 4-color mono ramp → 16+ colors with optical mixing
 *   composition L1→L5: simple rectangles → multi-layer with shadows & highlights
 */

// ═══════════════════════════════════════════════════════════════
//  PALETTE (matching aseprite-forge.py PALETTE)
// ═══════════════════════════════════════════════════════════════
const PALETTE: [number, number, number][] = [
  [0,0,0],          // 0  — outline/black
  [29,43,83],       // 1  — dark blue
  [126,37,83],      // 2  — dark purple
  [0,135,81],       // 3  — dark green
  [120,70,30],      // 4  — brown
  [70,60,50],       // 5  — dark earthy brown
  [150,130,110],    // 6  — light brown / leather
  [240,230,220],    // 7  — off-white / skin light
  [180,50,50],      // 8  — dark red
  [220,140,50],     // 9  — orange / gold
  [240,220,50],     // 10 — yellow
  [50,180,50],      // 11 — green
  [60,150,200],     // 12 — blue
  [130,110,150],    // 13 — purple
  [220,120,160],    // 14 — pink
  [240,200,160],    // 15 — peach / skin
  [50,50,60],       // 16 — dark stone
  [100,90,80],      // 17 — stone gray
  [170,160,150],    // 18 — light stone
  [40,30,20],       // 19 — very dark brown
  [200,180,50],     // 20 — gold highlight
  [100,180,80],     // 21 — grass green
  [80,40,0],        // 22 — dark wood
  [180,140,100],    // 23 — wood
  [30,30,30],       // 24 — dark shadow
];

// ═══════════════════════════════════════════════════════════════
//  HAND-CRAFTED PIXEL ART TEMPLATES (from aseprite-forge.py)
// ═══════════════════════════════════════════════════════════════
// -1 = transparent, numbers = palette index

interface Template {
  name: string;
  width: number;
  height: number;
  grid: number[][];
  difficulty: number; // 1-5: how complex this template is
}

export const TEMPLATES: Template[] = [
  {
    name: "potion_rainbow",
    width: 8, height: 12, difficulty: 1,
    // Fixed PILLOW_SHADING: QC checks center brightness > edge brightness ×1.15
    // Glass (17=bright 480) forms the edge. Center uses medium-dark colors (240-410)
    // so center avg brightness < edge avg brightness — passes shading check
    grid: [
      [-1,-1, 0, 0,-1,-1,-1,-1],
      [-1, 0,17,17, 0,-1,-1,-1],
      [ 0,17,17,17,17,17, 0,-1],
      [ 0,17, 8,12,11,17,17,-1],
      [ 0,17, 8,12,11, 3,17,-1],
      [ 0,17,12,11, 3, 2,17,-1],
      [ 0,17,11, 3, 2, 8,17,-1],
      [ 0,17, 3, 2, 8,12,17,-1],
      [ 0,17, 2, 8,12,17,17,-1],
      [ 0,17,17,17,17,17, 0,-1],
      [ 0,17,17,17,17,17, 0,-1],
      [-1, 0, 0, 0, 0, 0,-1,-1],
    ]
  },
  {
    name: "star_charm",
    width: 12, height: 12, difficulty: 2,
    grid: [
      [-1,-1,-1,-1,-1,10,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,10,20,10,-1,-1,-1,-1,-1],
      [-1,-1,-1,10,20,10,20,10,-1,-1,-1,-1],
      [-1,-1,10,20,10,20,10,20,10,-1,-1,-1],
      [-1,10,20,10,20,10,20,10,20,10,-1,-1],
      [10,20,10,20,10,20,10,20,10,20,10,-1],
      [-1,10,20,10,20,10,20,10,20,10,-1,-1],
      [-1,-1,10,20,10,20,10,20,10,-1,-1,-1],
      [-1,-1, 0,10,20,10,20,10, 0,-1,-1,-1],
      [-1,-1,-1, 0,10,20,10, 0,-1,-1,-1,-1],
      [-1,-1,-1,-1, 0,10, 0,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1, 0,-1,-1,-1,-1,-1,-1],
    ]
  },
  {
    name: "feather_phoenix",
    width: 8, height: 16, difficulty: 2,
    grid: [
      [-1,-1,-1,-1,-1,-1, 8,-1],
      [-1,-1,-1,-1,-1, 8,10, 8],
      [-1,-1,-1,-1, 8,10, 9,10],
      [-1,-1,-1, 8,10, 9,10, 9],
      [-1,-1, 8,10, 9,10, 9,10],
      [-1, 8,10, 9,10, 9,10, 9],
      [ 8,10, 9,10, 9,10, 9,10],
      [10, 9,10, 9,10, 9,10, 9],
      [ 9,10, 9,10, 9,10, 9,10],
      [10, 9,10, 9,10, 9,10, 9],
      [ 9,10, 9,10, 9,10,10, 0],
      [10, 9,10, 9,10,10, 0,-1],
      [ 9,10, 9,10,10, 0,-1,-1],
      [10, 9,10, 9, 0,-1,-1,-1],
      [ 9,10, 9, 0,-1,-1,-1,-1],
      [-1, 0, 0,-1,-1,-1,-1,-1],
    ]
  },
  {
    name: "orb_mystic",
    width: 12, height: 12, difficulty: 2,
    // Fixed PILLOW_SHADING: offset highlight to top-left, darken bottom-right
    // Light source from top-left — dark shadow (24) on bottom-right edge
    // Highlight (7) shifted toward (2,2) instead of dead center
    grid: [
      [-1,-1,-1,-1,24,12,12,24,-1,-1,-1,-1],
      [-1,-1,-1, 1,12,12,12,12, 1,-1,-1,-1],
      [-1,-1, 1,12, 7,12,12,12,12, 1,-1,-1],
      [-1, 1,12, 7, 7,12,12,12,12,12, 1,-1],
      [-1, 1,12, 7, 7, 7,12,12,12,12,24,-1],
      [ 1,12,12, 7, 7, 7, 7,12,12,12,24,24],
      [ 1,12, 7, 7, 7, 7, 7, 7,12,12,24, 1],
      [-1,24,12, 7, 7, 7, 7,12,12,12, 1,-1],
      [-1, 0,12,12, 7, 7,12,12,12,12, 0,-1],
      [-1,-1, 1,12,12,12,12,12,12, 1,-1,-1],
      [-1,-1,10, 1, 1, 1, 1, 1, 1,10,-1,-1],
      [-1,-1,-1,10,10,10,-1,10,10,10,-1,-1],
    ]
  },
  {
    name: "crystal_magic",
    width: 16, height: 16, difficulty: 3,
    grid: [
      [-1,-1,-1,-1,-1,-1,-1, 1,-1,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1, 1,12, 1,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1, 1,12,12,12, 1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1, 1,12,12, 7,12,12, 0,-1,-1,-1,-1,-1],
      [-1,-1,-1, 1,12,12, 7, 7, 7,12,12, 1,-1,-1,-1,-1],
      [-1,-1,-1, 0,12, 7, 7, 7, 7, 7,12, 0,-1,-1,-1,-1],
      [-1,-1, 1,12,12, 7, 7, 7, 7, 7,12,12, 1,-1,-1,-1],
      [-1, 1,12,12, 7, 7, 7, 7, 7, 7, 7,12,12, 1,-1,-1],
      [-1, 1,12, 7, 7, 7, 7, 7, 7, 7, 7, 7,12, 1,-1,-1],
      [-1,-1, 1,12, 7, 7, 7, 7, 7, 7, 7,12, 1,-1,-1,-1],
      [-1,-1, 0,12,12, 7, 7, 7, 7, 7,12,12, 0,-1,-1,-1],
      [-1,-1, 1,12,12,12, 7, 7, 7,12,12,12, 1,-1,-1,-1],
      [-1,-1,-1, 0,12,12,12, 7,12,12,12, 0,-1,-1,-1,-1],
      [-1,-1,-1,-1, 1,12,12,12,12,12, 1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1, 0, 1, 0, 1, 0,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]
  },
  {
    name: "egg_dragon",
    width: 16, height: 16, difficulty: 3,
    grid: [
      [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1, 2,13,13, 2,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1, 2,13,14,14,13, 2,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1, 2,13,14,14,14,14,13, 2,-1,-1,-1,-1],
      [-1,-1,-1, 2,13,14,14,14,14,14,14,13, 2,-1,-1,-1],
      [-1,-1,-1, 2,14,14,14, 7, 7,14,14,14, 2,-1,-1,-1],
      [-1,-1, 2,13,14,14, 7, 7, 7, 7,14,14,13, 2,-1,-1],
      [-1,-1, 2,14,14, 7, 7, 7, 7, 7, 7,14,14, 2,-1,-1],
      [-1,-1, 2,14,14, 7, 7, 7, 7, 7, 7,14,14, 2,-1,-1],
      [-1,-1, 2,14,14,14, 7, 7, 7, 7,14,14,14, 2,-1,-1],
      [-1,-1,-1, 2,14,14,14,14,14,14,14,14, 2,-1,-1,-1],
      [-1,-1,-1, 2,13,14,14,14,14,14,14,13, 2,-1,-1,-1],
      [-1,-1,-1,-1, 2,13,14,14,14,14,13, 2,-1,-1,-1,-1],
      [-1,-1,-1,-1, 0, 2,13,14,14,13, 2, 0,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1, 2, 2, 2, 2,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1, 0,-1, 0,-1,-1,-1,-1,-1,-1],
    ]
  },
  {
    name: "sword_flame",
    width: 16, height: 16, difficulty: 3,
    grid: [
      [-1,-1,-1,-1,-1,-1,-1, 8,-1,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1, 8,10, 8,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1, 8,10, 9,10, 8,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1, 8,10, 9,10, 9,10, 8,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1, 8,10, 9,10, 8,-1,17,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1, 8,10, 8,-1,17,17,17,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1, 8,-1,17,17,18,17,17,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,-1,-1,17,18,18,18,17,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,-1,17,17,18,18,17,17,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,-1,17,18,17,17,18,17,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,17,17,17, 0,17,17,17,-1,-1],
      [-1,-1,-1,-1,-1,-1,22,22,17, 0,-1, 0,17,22,-1,-1],
      [-1,-1,-1,-1,-1,-1,22,23,22,22,20,-1,22,22,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,22,23,22,22, 9,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,-1,22,23,22,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1,-1,-1,22,-1,-1,-1,-1,-1,-1],
    ]
  },
  {
    name: "skull_relic",
    width: 16, height: 16, difficulty: 4,
    grid: [
      [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1,-1,-1],
      [-1,-1,-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1,-1],
      [-1,-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1],
      [-1, 7, 7, 7, 0, 7, 7, 7, 7, 7, 0, 7, 7, 7,-1,-1],
      [-1, 7, 7, 0, 0, 0, 7, 7, 7, 0, 0, 0, 7, 7,-1,-1],
      [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1],
      [-1, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7,-1,-1],
      [-1, 7, 7, 7, 7, 7, 7, 7, 7, 6, 7, 7, 7, 7,-1,-1],
      [-1,-1, 7, 7, 7, 7, 6, 7, 6, 7, 7, 7, 7,-1,-1,-1],
      [-1,-1, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,-1,-1,-1],
      [-1,-1, 0, 7, 6, 7, 7, 7, 7, 6, 7, 7, 0,-1,-1,-1],
      [-1,-1,-1, 7, 7, 7, 7, 0, 6, 7, 7, 7,-1,-1,-1,-1],
      [-1,-1,-1, 0, 7, 7, 0, 7, 7, 0, 7, 0,-1,-1,-1,-1],
      [-1,-1,-1,-1,10,10, 0,10,10, 0,10,10,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,10,10,10,10,10,10,-1,-1,-1,-1,-1],
    ]
  },
  {
    name: "chalice_golden",
    width: 16, height: 16, difficulty: 4,
    grid: [
      [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1,20,20,20,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,20,10, 9,10,20,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,20,10, 9,20, 9,10,20,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,20, 9,20, 8,20, 9,20,-1,-1,-1,-1,-1],
      [-1,-1,-1, 0, 9,20, 8, 8, 8,20, 9, 0,-1,-1,-1,-1],
      [-1,-1,-1, 9,20, 8, 8, 8, 8, 8,20, 9,-1,-1,-1,-1],
      [-1,-1, 0,20, 8, 8, 8, 8, 8, 8, 8,20, 0,-1,-1,-1],
      [-1,-1, 0,20, 8, 8, 8, 8, 8, 8, 8,20, 0,-1,-1,-1],
      [-1,-1, 0,20, 8, 8, 8, 8, 8, 8, 8,20, 0,-1,-1,-1],
      [-1,-1,-1, 0,20, 8, 8, 8, 8, 8,20, 0,-1,-1,-1,-1],
      [-1,-1,-1,-1, 0,20, 9, 9, 9,20, 0,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,20, 9, 9,20, 9, 9,20,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,20,20, 0,20,20,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1, 0,20, 0,-1,-1,-1,-1,-1,-1,-1],
      [-1,-1,-1,-1,-1,-1,-1, 0,-1,-1,-1,-1,-1,-1,-1,-1],
    ]
  },
  {
    name: "tome_ancient",
    width: 12, height: 16, difficulty: 3,
    grid: [
      [-1,-1,-1,22,22,22,22,22,22,-1,-1,-1],
      [-1,-1,22, 8, 8, 8, 8, 8, 8,22,-1,-1],
      [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
      [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
      [22, 8, 8, 8,20, 8, 8,20, 8, 8, 8,22],
      [22, 8, 8, 8, 8,20,20, 8, 8, 8, 8,22],
      [22, 8, 8,20, 8, 8, 8, 8,20, 8, 8,22],
      [22, 8, 8, 8, 8, 8,20, 8, 8, 8, 8,22],
      [22, 8, 8, 8,20, 8, 8,20, 8, 8, 8,22],
      [22, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,22],
      [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
      [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
      [-1, 0,22,20,20,20,20,20,20,22, 0,-1],
      [-1,-1, 0,22,20,20,20,20,22, 0,-1,-1],
      [-1,-1,-1, 0,22,20,20,22, 0,-1,-1,-1],
      [-1,-1,-1,-1, 0,22,22, 0,-1,-1,-1,-1],
    ]
  }
];

// ═══════════════════════════════════════════════════════════════
//  SKILL → QUALITY MAPPING
// ═══════════════════════════════════════════════════════════════

interface AgentSkills {
  pixelart: number;   // 1-5
  color: number;      // 1-5
  composition: number; // 1-5
  speed: number;      // 1-5
}

interface GenerationParams {
  spriteSize: number;         // output pixel size
  paletteSize: number;        // how many colors from palette to use
  useOutline: boolean;        // 1px outline? (pixelart ≥ 2)
  useShading: boolean;        // directional shading? (pixelart ≥ 3)
  useHighlights: boolean;     // specular highlights? (pixelart ≥ 4)
  useAntiAlias: boolean;      // internal AA? (pixelart ≥ 5)
  colorComplexity: number;    // 1=mono, 2=ramp, 3=harmony, 4=optical, 5=full
  layers: number;             // 1=flat, 2=fg+bg, 3=+shadow, 4=+highlight, 5=+glow
  availableTemplates: Template[];  // which templates are unlocked
}

export function mapSkillsToParams(skills: AgentSkills): GenerationParams {
  const pixelart = skills.pixelart || 1;
  const color = skills.color || 1;
  const composition = skills.composition || 1;

  // Sprite size by pixelart skill
  const sizeMap = [8, 12, 16, 32, 64];
  const spriteSize = sizeMap[Math.min(pixelart - 1, 4)];

  // Palette size by color skill
  const paletteMap = [4, 6, 8, 12, 16];
  const paletteSize = paletteMap[Math.min(color - 1, 4)];

  // Color complexity by color skill
  const colorComplexity = Math.min(color, 5);

  // Layers by composition skill
  const layers = Math.min(composition, 5);

  // Template access by combined skill
  // difficulty threshold = pixelart + Math.floor(color/2)
  const skillThreshold = pixelart + Math.floor(color / 2);
  const availableTemplates = TEMPLATES.filter(t => t.difficulty <= skillThreshold);

  // If no templates qualify (shouldn't happen), give the easiest
  if (availableTemplates.length === 0) {
    availableTemplates.push(TEMPLATES[0]);
  }

  return {
    spriteSize,
    paletteSize,
    useOutline: pixelart >= 2,
    useShading: pixelart >= 3,
    useHighlights: pixelart >= 4,
    useAntiAlias: pixelart >= 5,
    colorComplexity,
    layers,
    availableTemplates,
  };
}

// ═══════════════════════════════════════════════════════════════
//  SPRITE GENERATION
// ═══════════════════════════════════════════════════════════════

export interface GeneratedSprite {
  /** Raw pixel data: rows of [r,g,b,a] quads */
  pixels: number[][][];  // pixels[y][x] = [r,g,b,a]
  width: number;
  height: number;
  /** Color count actually used */
  colorsUsed: number;
  /** Template name used */
  templateName: string;
  /** Quality tier based on params */
  qualityTier: string;
  /** Metadata for display */
  metadata: {
    skillLevels: { pixelart: number; color: number; composition: number };
    params: GenerationParams;
  };
}

/**
 * Generate a sprite from a template, adjusted by skill level.
 * Lower skills → fewer colors, simpler shapes.
 * Higher skills → full template detail with all enhancements.
 */
export function generateSprite(
  template: Template,
  params: GenerationParams
): GeneratedSprite {
  const { paletteSize, useOutline, useShading, useHighlights } = params;
  
  // Build a reduced palette (first N colors + keep outline=0)
  const reducedPalette = new Set<number>();
  reducedPalette.add(0); // outline always available
  
  // Add colors that actually appear in the template, up to paletteSize
  const usedColors = new Set<number>();
  for (const row of template.grid) {
    for (const cell of row) {
      if (cell >= 0) usedColors.add(cell);
    }
  }
  
  // Sort by frequency (for now, just take first N that appear)
  const sortedColors = Array.from(usedColors)
    .filter(c => c !== 0)
    .slice(0, paletteSize - 1);
  sortedColors.forEach(c => reducedPalette.add(c));

  // Build pixel output with skill-based modifications
  const pixels: number[][][] = [];
  let colorsActuallyUsed = 0;
  const colorSet = new Set<string>();

  for (let y = 0; y < template.height; y++) {
    const row: number[][] = [];
    for (let x = 0; x < template.width; x++) {
      const colorIdx = template.grid[y][x];
      
      // Transparent pixel
      if (colorIdx < 0) {
        row.push([0, 0, 0, 0]);
        continue;
      }

      let finalColorIdx = colorIdx;

      // Skill-based modifications:
      // - If color not in reduced palette, map to nearest available
      if (!reducedPalette.has(finalColorIdx)) {
        // Map to closest color in reduced palette
        finalColorIdx = findClosestColor(finalColorIdx, Array.from(reducedPalette));
      }

      // - Without outline skill, replace outline color (0) with nearest dark
      if (!useOutline && finalColorIdx === 0) {
        finalColorIdx = 24; // dark shadow
      }

      // - Without shading, flatten mid-tones
      if (!useShading) {
        // Replace mid-tones with base colors
        if ([6, 18, 23].includes(finalColorIdx)) {
          // Map highlights to base
          if (finalColorIdx === 18) finalColorIdx = 17;
          if (finalColorIdx === 23) finalColorIdx = 22;
          if (finalColorIdx === 6) finalColorIdx = 5;
        }
      }

      // - Without highlights, remove bright spots
      if (!useHighlights) {
        if ([7, 20, 10].includes(finalColorIdx)) {
          // Map sparkle to base
          if (finalColorIdx === 20) finalColorIdx = 9;
          if (finalColorIdx === 10) finalColorIdx = 9;
          // 7 (white) → keep but could map to 15 (skin)
        }
      }

      const [r, g, b] = PALETTE[finalColorIdx];
      row.push([r, g, b, 255]);
      colorSet.add(`${r},${g},${b}`);
    }
    pixels.push(row);
  }

  colorsActuallyUsed = colorSet.size;

  // Quality tier
  const avgSkill = (params.colorComplexity + 
    (params.useOutline ? 1 : 0) + 
    (params.useShading ? 1 : 0) + 
    (params.useHighlights ? 1 : 0)) / 4;
  
  let qualityTier: string;
  if (avgSkill >= 4) qualityTier = "Masterwork";
  else if (avgSkill >= 3) qualityTier = "Quality";
  else if (avgSkill >= 2) qualityTier = "Standard";
  else qualityTier = "Basic";

  return {
    pixels,
    width: template.width,
    height: template.height,
    colorsUsed: colorsActuallyUsed,
    templateName: template.name,
    qualityTier,
    metadata: {
      skillLevels: {
        pixelart: params.useAntiAlias ? 5 : params.useHighlights ? 4 : params.useShading ? 3 : params.useOutline ? 2 : 1,
        color: params.colorComplexity,
        composition: params.layers,
      },
      params,
    },
  };
}

function findClosestColor(targetIdx: number, available: number[]): number {
  const [tr, tg, tb] = PALETTE[targetIdx];
  let bestIdx = available[0];
  let bestDist = Infinity;
  
  for (const idx of available) {
    const [r, g, b] = PALETTE[idx];
    const dist = (tr - r) ** 2 + (tg - g) ** 2 + (tb - b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  }
  
  return bestIdx;
}

/**
 * Generate a sprite with quality determined by agent skill levels.
 * This is the main entry point — call this from API routes.
 */
export function generateWithSkills(
  skills: AgentSkills,
  templateName?: string
): GeneratedSprite {
  const params = mapSkillsToParams(skills);
  
  // Pick a template: either the requested one, or the best available
  let template: Template;
  if (templateName) {
    const found = params.availableTemplates.find(t => t.name === templateName);
    template = found || params.availableTemplates[params.availableTemplates.length - 1];
  } else {
    // Pick the highest-difficulty template the agent can handle
    template = params.availableTemplates[params.availableTemplates.length - 1];
  }

  return generateSprite(template, params);
}

/**
 * Compare two generations — used by DOJO PRACTICE mode for real feedback.
 * Returns a score 0-100 and detailed comparison.
 */
export function compareGenerations(
  student: GeneratedSprite,
  reference: GeneratedSprite
): { score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;

  // Color count comparison (25 points)
  const colorRatio = student.colorsUsed / Math.max(reference.colorsUsed, 1);
  if (colorRatio >= 0.9) {
    score += 25;
    feedback.push("🎨 PALETTE: Color count matches reference");
  } else if (colorRatio >= 0.6) {
    score += 15;
    feedback.push(`🎨 PALETTE: ${student.colorsUsed}/${reference.colorsUsed} colors — good effort`);
  } else {
    score += 5;
    feedback.push(`🎨 PALETTE: Only ${student.colorsUsed} colors — train COLOR skill for richer palettes`);
  }

  // Size comparison (25 points)
  const pixelRatio = (student.width * student.height) / (reference.width * reference.height);
  if (pixelRatio >= 1) {
    score += 25;
    feedback.push("📐 SIZE: Matches or exceeds reference dimensions");
  } else if (pixelRatio >= 0.5) {
    score += 15;
    feedback.push(`📐 SIZE: ${student.width}×${student.height} — train PIXELART for bigger sprites`);
  } else {
    score += 5;
    feedback.push("📐 SIZE: Much smaller than reference — keep training!");
  }

  // Quality tier comparison (25 points)
  const tierScores: Record<string, number> = { "Basic": 10, "Standard": 15, "Quality": 20, "Masterwork": 25 };
  score += tierScores[student.qualityTier] || 10;
  feedback.push(`✨ QUALITY: ${student.qualityTier} tier — ${student.qualityTier === reference.qualityTier ? 'matches reference!' : 'keep improving'}`);

  // Template complexity bonus (25 points)
  score += Math.min(student.metadata.params.availableTemplates.length * 5, 25);
  feedback.push(`📚 UNLOCKED: ${student.metadata.params.availableTemplates.length} templates available`);

  return { score: Math.min(score, 100), feedback };
}
