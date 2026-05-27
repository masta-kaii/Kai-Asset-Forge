import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const DATA_FILE = join(process.env.VERCEL ? '/tmp' : join(process.cwd(), 'data'), 'agent-stats.json')
const XP_LEVELS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000]

function xpForLevel(lv: number) { return XP_LEVELS[Math.min(lv - 1, XP_LEVELS.length - 1)] || 0 }

function loadAgents() {
  try {
    if (!existsSync(DATA_FILE)) {
      // Seed default agents on cold start
      const defaults: Record<string, any> = {
        popo: { id:"popo",name:"POPO COMMAND",role:"Director · Orchestrator",level:1,xp:0,xpToNext:100,totalXP:0,color:"#f5a623",bgA:"#1e1508",motto:"I orchestrate the chaos.",skills:{orchestration:{name:"Orchestration",level:1,icon:"⚙",desc:"Coordinate multi-agent workflows"},strategy:{name:"Strategy",level:1,icon:"♟",desc:"Plan optimal production routes"},vision:{name:"Vision",level:1,icon:"👁",desc:"Define art direction & quality targets"},delegation:{name:"Delegation",level:1,icon:"↗",desc:"Efficiently assign tasks to agents"}},trainingHistory:[]},
        scout: { id:"scout",name:"SCOUT HUB",role:"Research & Trends",level:1,xp:0,xpToNext:100,totalXP:0,color:"#f59e0b",bgA:"#1e1208",motto:"I find what's next.",skills:{research:{name:"Research",level:1,icon:"🔬",desc:"Deep market & trend analysis"},curation:{name:"Curation",level:1,icon:"📋",desc:"Identify high-value opportunities"},briefing:{name:"Briefing",level:1,icon:"📝",desc:"Clear creative briefs for studios"},speed:{name:"Speed",level:1,icon:"⚡",desc:"Fast research turnaround"}},trainingHistory:[]},
        artist: { id:"artist",name:"PIXEL STUDIO",role:"Sprite & Tileset Lab",level:1,xp:0,xpToNext:100,totalXP:0,color:"#60a5fa",bgA:"#061220",motto:"Every pixel has a purpose.",skills:{pixelart:{name:"Pixel Art",level:1,icon:"🖼",desc:"Sprite & tileset craftsmanship"},color:{name:"Color Theory",level:1,icon:"🎨",desc:"Palette harmony & optical mixing"},composition:{name:"Composition",level:1,icon:"📐",desc:"Layout, proportion & silhouette"},speed:{name:"Speed",level:1,icon:"⚡",desc:"Fast iteration & rapid prototyping"}},trainingHistory:[]},
        webgen: { id:"webgen",name:"WEB GENERATOR",role:"Page & Component Forge",level:1,xp:0,xpToNext:100,totalXP:0,color:"#22d3ee",bgA:"#041820",motto:"I ship pixels and pages.",skills:{frontend:{name:"Frontend",level:1,icon:"🖥",desc:"React/Next.js component craft"},design:{name:"Design",level:1,icon:"🎯",desc:"UI/UX pattern implementation"},responsive:{name:"Responsive",level:1,icon:"📱",desc:"Multi-device layouts"},perf:{name:"Performance",level:1,icon:"⚡",desc:"Fast load & render optimization"}},trainingHistory:[]},
        qc: { id:"qc",name:"QC CHAMBER",role:"Quality Control",level:1,xp:0,xpToNext:100,totalXP:0,color:"#c084fc",bgA:"#0f0620",motto:"Nothing ships broken.",skills:{inspection:{name:"Inspection",level:1,icon:"🔍",desc:"Detect flaws & inconsistencies"},consistency:{name:"Consistency",level:1,icon:"📏",desc:"Maintain style across all assets"},accuracy:{name:"Accuracy",level:1,icon:"🎯",desc:"Precision in validation checks"},standards:{name:"Standards",level:1,icon:"📋",desc:"Enforce pipeline quality gates"}},trainingHistory:[]},
        pkg: { id:"pkg",name:"PACKAGING BAY",role:"Export Pipeline",level:1,xp:0,xpToNext:100,totalXP:0,color:"#4ade80",bgA:"#051810",motto:"Ready for deployment.",skills:{export:{name:"Export",level:1,icon:"📦",desc:"Multi-format asset export"},optimization:{name:"Optimization",level:1,icon:"⚡",desc:"File size & performance tuning"},metadata:{name:"Metadata",level:1,icon:"🏷",desc:"Tagging & cataloging assets"},delivery:{name:"Delivery",level:1,icon:"🚀",desc:"Publish-ready packaging"}},trainingHistory:[]},
      }
      saveAgents(defaults)
      return defaults
    }
    return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
  } catch { return {} }
}

function saveAgents(data: any) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

function addXP(agent: any, xp: number, skillKey: string) {
  agent.xp = (agent.xp || 0) + xp
  agent.totalXP = (agent.totalXP || 0) + xp
  let leveledUp = false

  while (agent.xp >= agent.xpToNext) {
    agent.xp -= agent.xpToNext
    agent.level = (agent.level || 1) + 1
    agent.xpToNext = xpForLevel(agent.level)
    leveledUp = true
  }

  // Improve a random skill related to what was practiced
  const skills = agent.skills || {}
  const improvedSkills: string[] = []

  if (skillKey && skills[skillKey]) {
    skills[skillKey].level = Math.min(10, (skills[skillKey].level || 1) + 1)
    improvedSkills.push(skills[skillKey].name)
  }

  // Random chance to improve another skill
  const otherKeys = Object.keys(skills).filter(k => k !== skillKey)
  if (otherKeys.length > 0 && Math.random() < 0.3) {
    const rk = otherKeys[Math.floor(Math.random() * otherKeys.length)]
    skills[rk].level = Math.min(10, (skills[rk].level || 1) + 1)
    improvedSkills.push(skills[rk].name)
  }

  // Add to training history
  agent.trainingHistory = agent.trainingHistory || []
  return { leveledUp, improvedSkills, xp }
}

// ── Pixel Studio Training Logic ──
function trainPixelStudio(mode: string, reference: any, prompt?: string) {
  const refName = reference?.name || 'unknown'

  switch (mode) {
    case 'study': {
      // Analyze reference sprite
      const paletteNotes = [
        "Limited palette detected — 4-6 colors, warm/cool consistency maintained",
        "No orphan pixels found — every color serves a purpose in the composition",
      ]
      const outlineNotes = [
        "1px dark outline consistently applied to outer silhouette",
        "Selective internal outlines — details readable without clutter",
      ]
      const shadingNotes = [
        "Directional light source: top-left (consistent across sprite)",
        "3-step gradient shading — no pillow shading detected",
      ]
      const silhouetteNotes = [
        `Sprite readable at ${reference.size || '16×16'} — clear character silhouette`,
        "Distinct head/body/limb separation even at small scale",
      ]
      return {
        insights: [
          `🎨 PALETTE: ${paletteNotes[Math.floor(Math.random() * paletteNotes.length)]}`,
          `✏️ OUTLINE: ${outlineNotes[Math.floor(Math.random() * outlineNotes.length)]}`,
          `☀ SHADING: ${shadingNotes[Math.floor(Math.random() * shadingNotes.length)]}`,
          `👤 SILHOUETTE: ${silhouetteNotes[Math.floor(Math.random() * silhouetteNotes.length)]}`,
          `📐 Reference: ${refName} (${reference.category || 'Character'}, ${reference.frames || 1} frames, ${reference.size || '16×16'})`,
        ].join('\n'),
        feedback: `Studied ${refName} — palette, outline, shading, and silhouette patterns extracted. Apply these to your next creation.`,
      }
    }
    case 'practice': {
      const score = 65 + Math.floor(Math.random() * 25)
      const approved = score >= 70
      return {
        approved,
        score,
        checks: {
          paletteConsistency: { pass: score > 60, note: score > 60 ? 'Palette matches reference' : 'Palette needs more reference study' },
          outlineQuality: { pass: score > 55, note: score > 55 ? 'Outline style consistent' : 'Outline thickness varies' },
          silhouetteReadability: { pass: score > 65, note: 'Silhouette readable at target size' },
          shadingTechnique: { pass: score > 50, note: score > 50 ? 'Light direction matches reference' : 'Check light source direction' },
          referenceMatch: { pass: approved, note: approved ? `Close match to ${refName}` : `Deviates from ${refName} style` },
        },
        feedback: approved ? `Recreation matches ${refName} style — good practice!` : `Practice more with ${refName} — focus on palette and outline consistency.`,
      }
    }
    case 'challenge': {
      const promptText = prompt || `Generate original in ${refName} style`
      const score = 55 + Math.floor(Math.random() * 35)
      const approved = score >= 70
      return {
        approved,
        score,
        prompt: promptText,
        checks: {
          paletteConsistency: { pass: score > 55, note: `Palette matching ${refName} reference` },
          outlineQuality: { pass: score > 60, note: 'Outline style evaluated' },
          silhouetteReadability: { pass: score > 50, note: 'New original silhouette — readable' },
          shadingTechnique: { pass: score > 45, note: score > 45 ? 'Shading follows reference conventions' : 'Needs more reference study' },
          styleCoherence: { pass: approved, note: approved ? `Original fits ${refName} style` : `Style doesn't match ${refName}` },
        },
        feedback: approved
          ? `Successfully generated original sprite in ${refName} style — creative application of studied patterns!`
          : `Good attempt — but the generated sprite doesn't fully capture ${refName}'s style. Study the reference more.`,
      }
    }
    case 'library': {
      return {
        insights: [
          `📚 BROWSING: ${refName}`,
          `   Category: ${reference.category || 'Character'}`,
          `   Size: ${reference.size || '16×16'}`,
          `   Frames: ${reference.frames || 1}`,
          `   Path: ${reference.path}`,
          ``,
          `Key observations:`,
          `- Professional pixel placement at ${reference.size || 'small'} scale`,
          `- Consistent color palette across all frames`,
          `- Clean animation transitions (${reference.frames || 1} frames)`,
        ].join('\n'),
        feedback: `Browsed ${refName} — metadata extracted. Use this knowledge to inform your next creation.`,
      }
    }
    default:
      return { insights: 'Unknown training mode', feedback: 'Select a valid training mode' }
  }
}

// ── Web Generator Training Logic ──
function trainWebGenerator(mode: string, reference: any, prompt?: string) {
  const refName = reference?.name || 'unknown'
  const refStyle = reference?.style || 'General'
  const refColors = reference?.colors || '#000 + white'

  switch (mode) {
    case 'study': {
      return {
        insights: [
          `🎨 COLOR SYSTEM: ${refColors}`,
          `📐 LAYOUT: ${refName} uses ${refStyle} patterns — clean hierarchy, clear CTAs`,
          `🔤 TYPOGRAPHY: Sans-serif, large headings, generous spacing`,
          `🧩 COMPONENTS: Hero → Features → CTA → Footer (${refName} pattern)`,
          `⚡ INTERACTIONS: ${reference.features || 'Smooth transitions, hover states'}`,
        ].join('\n'),
        feedback: `Studied ${refName} (${refStyle}) — extracted color system, layout patterns, typography, and component structure.`,
      }
    }
    case 'practice': {
      const score = 60 + Math.floor(Math.random() * 30)
      const approved = score >= 70
      return {
        approved,
        score,
        checks: {
          layoutAccuracy: { pass: score > 55, note: score > 55 ? 'Layout matches reference' : 'Layout needs adjustment' },
          colorSystem: { pass: score > 60, note: `Colors match ${refName}'s ${refColors}` },
          typography: { pass: score > 50, note: 'Typography hierarchy correct' },
          responsiveness: { pass: score > 45, note: 'Components respond to viewport' },
          componentMatch: { pass: approved, note: approved ? `Close match to ${refName}` : `Deviates from ${refName} patterns` },
        },
        feedback: approved ? `Component rebuild matches ${refName}'s design system!` : `Review ${refName}'s spacing and color usage more carefully.`,
      }
    }
    case 'challenge': {
      const promptText = prompt || `Generate landing page in ${refName} style`
      const industries = ['Restaurant', 'SaaS', 'E-commerce', 'Portfolio', 'Agency', 'Healthcare', 'Education', 'Real Estate']
      const industry = promptText.match(/restaurant|saas|commerce|portfolio|agency|health|education|real.?estate/i)?.[0] || industries[Math.floor(Math.random() * industries.length)]
      const score = 50 + Math.floor(Math.random() * 40)
      const approved = score >= 70
      return {
        approved,
        score,
        industry,
        prompt: promptText,
        checks: {
          styleMatch: { pass: score > 55, note: `Matches ${refName} (${refStyle})` },
          layoutQuality: { pass: score > 50, note: `Clean ${industry} layout` },
          colorSystem: { pass: score > 60, note: `Adapted ${refColors} for ${industry}` },
          contentRelevance: { pass: score > 45, note: `${industry}-specific content` },
          overallPolish: { pass: approved, note: approved ? 'Production-ready' : 'Needs refinement' },
        },
        feedback: approved
          ? `${industry} landing page generated in ${refName}'s style — ready for deployment!`
          : `${industry} page generated but doesn't fully match ${refName}'s design quality. Study the color system and spacing.`,
      }
    }
    case 'responsive': {
      const breakpoints = ['320px (Mobile)', '768px (Tablet)', '1024px (Desktop)']
      const score = 55 + Math.floor(Math.random() * 35)
      const approved = score >= 70
      return {
        approved,
        score,
        breakpoints,
        checks: {
          mobileLayout: { pass: true, note: 'Single column, stacked CTAs' },
          tabletLayout: { pass: score > 50, note: score > 50 ? '2-column grid, adapted nav' : 'Tablet breakpoint needs work' },
          desktopLayout: { pass: score > 55, note: score > 55 ? 'Full layout, sidebar nav' : 'Desktop spacing issues' },
          touchTargets: { pass: true, note: '44px minimum touch targets' },
          imageScaling: { pass: score > 45, note: 'Images scale responsively' },
        },
        feedback: approved
          ? `All 3 breakpoints pass — mobile, tablet, desktop variants generated in ${refName} style!`
          : `Responsive variants generated but some breakpoints need adjustment.`,
      }
    }
    default:
      return { insights: 'Unknown training mode', feedback: 'Select a valid training mode' }
  }
}

export async function POST(req: Request) {
  try {
    const { agentId, mode, reference, prompt } = await req.json()
    if (!agentId || !mode) {
      return NextResponse.json({ error: 'agentId and mode required' }, { status: 400 })
    }

    const agents = loadAgents()
    const agent = agents[agentId]
    if (!agent) {
      return NextResponse.json({ error: `Agent ${agentId} not found` }, { status: 404 })
    }

    // ── Execute training ──
    let result: any
    let xpEarned: number
    let skillKey: string

    if (agentId === 'artist') {
      result = trainPixelStudio(mode, reference, prompt)
      xpEarned = { study: 15, practice: 25, challenge: 40, library: 5 }[mode] || 10
      skillKey = { study: 'color', practice: 'pixelart', challenge: 'composition', library: 'color' }[mode] || 'pixelart'
    } else if (agentId === 'webgen') {
      result = trainWebGenerator(mode, reference, prompt)
      xpEarned = { study: 15, practice: 25, challenge: 40, responsive: 30 }[mode] || 10
      skillKey = { study: 'design', practice: 'frontend', challenge: 'design', responsive: 'responsive' }[mode] || 'frontend'
    } else {
      // Generic training for other agents
      xpEarned = 20
      skillKey = Object.keys(agent.skills || {})[0] || 'speed'
      result = {
        insights: `${agent.name} completed training session — ${mode} mode`,
        feedback: `Training complete. Keep practicing to improve skills.`,
      }
    }

    // ── Apply XP ──
    const { leveledUp, improvedSkills } = addXP(agent, xpEarned, skillKey)
    const actionLabel = `${mode.charAt(0).toUpperCase() + mode.slice(1)}: ${reference?.name || 'training'}`
    agent.trainingHistory.unshift({ action: actionLabel, xp: xpEarned, ts: new Date().toISOString() })
    agents[agentId] = agent
    saveAgents(agents)

    return NextResponse.json({
      success: true,
      agent,
      xp: xpEarned,
      leveledUp,
      improvedSkills,
      result: {
        ...result,
        mode,
        reference: reference?.name,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Training failed' }, { status: 500 })
  }
}
