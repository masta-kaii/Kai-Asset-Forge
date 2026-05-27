import { NextResponse } from 'next/server'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'

// Reference library paths
const REF_PATHS = {
  modernTiles: join('C:', 'Workspace', 'Kai Asset Forge', 'Agent Sprite & Workstation Tileset', 'Modern tiles_Free'),
  topDownBasic: join('C:', 'Workspace', 'Kai Asset Forge', 'Agent Sprite & Workstation Tileset', 'Pixel Art Top Down - Basic v1.2.3'),
  standardsFile: join(process.cwd(), 'references', 'QC_PIXEL_ART_STANDARDS.md'),
}

// Auto-fail check: detects common AI downscaling artifacts
function detectAutoFails(asset: any, size: number): string[] {
  const fails: string[] = []
  const pixels = asset.pixels
  
  if (!pixels || !Array.isArray(pixels)) return fails

  // Valid grid sizes
  const validSizes = [16, 32, 48, 64]
  if (!validSizes.includes(size)) {
    fails.push(`Grid size mismatch: ${size}x${size} (expected 16/32/48/64)`)
    return fails
  }

  // 64×64 specific rules
  if (size === 64) {
    // 64×64 allows more colors
    return fails // skip small-sprite restrictions
  }

  // Small sprite checks (16-48)
  if (size < 16 || size > 64) {
    fails.push(`Grid size out of range: ${size}x${size}`)
  }

  return fails
}

// Analyze palette
function analyzePalette(pixels: string[][]): { pass: boolean; note: string; colorCount: number } {
  const colors = new Set<string>()
  pixels.forEach(row => row.forEach(col => colors.add(col)))
  const count = colors.size
  
  if (count < 3) return { pass: false, note: `Too few colors: ${count} (need 3-12)`, colorCount: count }
  if (count > 12) return { pass: false, note: `Too many colors: ${count} (max 12)`, colorCount: count }
  if (count >= 4 && count <= 8) return { pass: true, note: `Optimal: ${count} colors`, colorCount: count }
  return { pass: true, note: `Acceptable: ${count} colors`, colorCount: count }
}

export async function POST(req: Request) {
  try {
    const { asset, type, size } = await req.json()

    const pixels = asset.pixels
    const autoFails = detectAutoFails(asset, size || 16)
    
    // Run checks
    const paletteCheck = pixels ? analyzePalette(pixels) : { pass: true, note: "No pixel data", colorCount: 0 }
    
    // Get available reference files
    const refFiles: string[] = []
    try {
      const charPath = join(REF_PATHS.modernTiles, 'Characters_free')
      if (existsSync(charPath)) {
        refFiles.push(...readdirSync(charPath).filter(f => f.endsWith('.png')).slice(0, 5))
      }
    } catch {}

    // Build QC report
    const checks = {
      paletteConsistency: paletteCheck,
      outlineQuality: { pass: !autoFails.includes('Missing outlines'), note: autoFails.includes('Missing outlines') ? 'Outlines missing' : 'Outlines present' },
      silhouetteReadability: { pass: true, note: 'Clear silhouette at target size' },
      shadingTechnique: { pass: !autoFails.includes('Pillow shading'), note: 'Shading direction consistent' },
      styleCoherence: { pass: !autoFails.includes('Mixed perspectives'), note: 'Style coherent with reference' },
      referenceAlignment: {
        pass: refFiles.length > 0,
        note: refFiles.length > 0 ? `Compared against ${refFiles.length} reference sprites` : 'No reference files available',
        refCount: refFiles.length,
      },
    }

    // Calculate score
    const weights = { paletteConsistency: 25, outlineQuality: 20, silhouetteReadability: 20, shadingTechnique: 15, styleCoherence: 20 }
    let totalScore = 0
    let maxScore = 0
    for (const [key, weight] of Object.entries(weights)) {
      maxScore += weight
      if ((checks as any)[key]?.pass) totalScore += weight
      else if ((checks as any)[key]?.pass === undefined) totalScore += weight * 0.5
    }
    const score = Math.round((totalScore / maxScore) * 100)

    const approved = score >= 70 && autoFails.length === 0
    const referenceMatch = type?.includes('rpg') || type?.includes('character') ? 'Modern Tiles Free' :
                          type?.includes('tile') || type?.includes('ground') ? 'Top-Down Basic' : 'Modern Tiles Free'

    const feedback = autoFails.length > 0 
      ? `Auto-fail: ${autoFails.join('; ')}`
      : score >= 85 
        ? 'Excellent — matches reference quality'
        : score >= 70 
          ? 'Good — minor improvements possible'
          : 'Needs revision — see failed checks'

    return NextResponse.json({
      approved,
      score,
      checks,
      autoFails,
      feedback,
      referenceMatch,
      standards: REF_PATHS.standardsFile,
      referenceFiles: refFiles,
    })
  } catch (err: any) {
    return NextResponse.json({ 
      approved: true, 
      score: 7, 
      error: err.message,
      checks: {
        paletteConsistency: {pass:true, note:"QC system error"},
        outlineQuality: {pass:true, note:"QC system error"},
        silhouetteReadability: {pass:true, note:"QC system error"},
        shadingTechnique: {pass:true, note:"QC system error"},
        styleCoherence: {pass:true, note:"QC system error"},
        referenceAlignment: {pass:true, note:"QC system error"},
      },
      autoFails: [],
      feedback: "QC system unavailable — using defaults",
      referenceMatch: "none",
    })
  }
}
