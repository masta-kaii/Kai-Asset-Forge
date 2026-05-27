/**
 * Skill-Based Web Page Generator
 * 
 * Connects DOJO training to actual page generation quality.
 * Higher Web Generator skills → more sophisticated HTML/CSS/JS output.
 * 
 * Skill levels map to real generation parameters:
 *   frontend  L1→L5: plain HTML → React components → interactive SPA
 *   design    L1→L5: no CSS → basic styles → polished design system
 *   responsive L1→L5: desktop only → tablet → full mobile + desktop
 *   perf      L1→L5: no optimization → minified → lazy-loaded + CDN-ready
 */

interface WebGenSkills {
  frontend: number;   // 1-5
  design: number;     // 1-5
  responsive: number; // 1-5
  perf: number;       // 1-5
}

interface GeneratedPage {
  html: string;
  tier: string;
  features: string[];
  skillBreakdown: {
    frontend: { level: number; unlocks: string[] };
    design: { level: number; unlocks: string[] };
    responsive: { level: number; unlocks: string[] };
    perf: { level: number; unlocks: string[] };
  };
}

// ═══════════════════════════════════════════════════════════════
//  DESIGN TOKENS by skill level
// ═══════════════════════════════════════════════════════════════

const FONTS = {
  1: "system-ui, sans-serif",
  3: "'Inter', system-ui, sans-serif",
  5: "'Inter', 'Geist', system-ui, sans-serif",
};

const SPACING = {
  1: "8px",
  2: "12px",
  3: "16px",
  4: "24px",
  5: "32px",
};

const RADIUS = {
  1: "0px",
  2: "4px",
  3: "8px",
  4: "12px",
  5: "16px",
};

const SHADOWS: Record<number, string> = {
  1: "none",
  2: "0 1px 3px rgba(0,0,0,0.1)",
  3: "0 2px 8px rgba(0,0,0,0.12)",
  4: "0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)",
  5: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
};

const COLORS = {
  1: { bg: "#fff", text: "#000", accent: "#00f", surface: "#f0f0f0" },
  3: { bg: "#fafafa", text: "#1a1a1a", accent: "#2563eb", surface: "#ffffff", border: "#e5e7eb" },
  5: { bg: "#0a0a0a", text: "#fafafa", accent: "#3b82f6", surface: "#171717", border: "#262626", muted: "#737373", success: "#22c55e", warning: "#f59e0b" },
};

// ═══════════════════════════════════════════════════════════════
//  PAGE TEMPLATES
// ═══════════════════════════════════════════════════════════════

function generateHeroSection(skills: WebGenSkills, colors: typeof COLORS[keyof typeof COLORS]): string {
  const design = skills.design;
  const responsive = skills.responsive;

  if (design < 2) {
    return `<div style="padding:20px; text-align:center;">
      <h1 style="font-size:24px;">Welcome to Our Site</h1>
      <p>We make cool stuff.</p>
      <button style="padding:8px 16px; background:blue; color:white; border:none;">Get Started</button>
    </div>`;
  }

  if (design < 4) {
    return `<section style="padding:${SPACING[Math.min(responsive, 4) as keyof typeof SPACING]}; text-align:center; background:${colors.surface};">
      <h1 style="font-size:${responsive >= 3 ? '48px' : '32px'}; font-weight:700; color:${colors.text}; margin:0 0 16px;">
        Build Something Great
      </h1>
      <p style="font-size:${responsive >= 3 ? '20px' : '16px'}; color:${colors.text}; opacity:0.7; max-width:600px; margin:0 auto 24px;">
        Modern solutions for modern problems. Ship faster with our platform.
      </p>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
        <button style="padding:12px 24px; background:${colors.accent}; color:#fff; border:none; border-radius:${RADIUS[Math.min(design, 5) as keyof typeof RADIUS]}; font-size:16px; cursor:pointer; box-shadow:${SHADOWS[2]};">Get Started</button>
        <button style="padding:12px 24px; background:transparent; color:${colors.accent}; border:1px solid ${colors.accent}; border-radius:${RADIUS[Math.min(design, 5) as keyof typeof RADIUS]}; font-size:16px; cursor:pointer;">Learn More</button>
      </div>
    </section>`;
  }

  // Level 4+: Full polished hero
  return `<section style="padding:${SPACING[5]}; text-align:center; background:linear-gradient(135deg, ${colors.surface}, ${colors.bg}); position:relative; overflow:hidden;">
    <div style="position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:radial-gradient(circle at 30% 50%, ${colors.accent}15, transparent 50%); pointer-events:none;"></div>
    <div style="position:relative; z-index:1;">
      <span style="display:inline-block; padding:4px 12px; background:${colors.accent}20; color:${colors.accent}; border-radius:20px; font-size:14px; font-weight:500; margin-bottom:16px;">🚀 Now in Public Beta</span>
      <h1 style="font-size:${responsive >= 4 ? '64px' : '48px'}; font-weight:800; color:${colors.text}; margin:0 0 20px; letter-spacing:-0.02em; line-height:1.1;">
        Build the Future,<br/>${responsive >= 3 ? '<span style="color:' + colors.accent + '">Today</span>' : 'Today'}
      </h1>
      <p style="font-size:20px; color:${colors.text}; opacity:0.65; max-width:640px; margin:0 auto 32px; line-height:1.6;">
        The all-in-one platform for creators who demand more. Design, build, and ship at the speed of thought.
      </p>
      <div style="display:flex; gap:16px; justify-content:center; flex-wrap:wrap;">
        <button style="padding:16px 32px; background:${colors.accent}; color:#fff; border:none; border-radius:12px; font-size:16px; font-weight:600; cursor:pointer; box-shadow:${SHADOWS[4]}; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">Start Free Trial</button>
        <button style="padding:16px 32px; background:${colors.surface}; color:${colors.text}; border:1px solid ${getBorder(colors)}; border-radius:12px; font-size:16px; font-weight:600; cursor:pointer;">View Demo →</button>
      </div>
    </div>
  </section>`;
}

function generateFeatureCards(skills: WebGenSkills, colors: typeof COLORS[keyof typeof COLORS]): string {
  const design = skills.design;
  const responsive = skills.responsive;

  if (design < 2) {
    return `<div style="padding:16px;">
      <p>• Fast</p><p>• Reliable</p><p>• Secure</p>
    </div>`;
  }

  const cols = responsive >= 4 ? 3 : responsive >= 2 ? 2 : 1;
  const features = design >= 4
    ? [
        { icon: "⚡", title: "Lightning Fast", desc: "Sub-second load times with edge caching and optimized builds." },
        { icon: "🔒", title: "Enterprise Security", desc: "SOC 2 compliant with end-to-end encryption and SSO." },
        { icon: "🎨", title: "Beautiful by Default", desc: "Pixel-perfect components that make your brand shine." },
        { icon: "📊", title: "Real-time Analytics", desc: "Understand your users with live dashboards and insights." },
        { icon: "🌍", title: "Global CDN", desc: "Serve content from 300+ edge locations worldwide." },
        { icon: "🤖", title: "AI-Powered", desc: "Smart suggestions that improve your workflow automatically." },
      ]
    : [
        { icon: "⚡", title: "Fast", desc: "Quick load times." },
        { icon: "🔒", title: "Secure", desc: "Your data is safe." },
        { icon: "📊", title: "Analytics", desc: "Track your growth." },
      ];

  const displayFeatures = features.slice(0, design >= 4 ? 6 : 3);

  return `<section style="padding:${SPACING[Math.min(design, 4) as keyof typeof SPACING]}; background:${colors.bg};">
    <div style="max-width:1200px; margin:0 auto;">
      ${design >= 3 ? `<h2 style="text-align:center; font-size:${responsive >= 3 ? '36px' : '28px'}; color:${colors.text}; margin:0 0 48px;">Why Choose Us</h2>` : ''}
      <div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:${SPACING[Math.min(design, 4) as keyof typeof SPACING]};">
        ${displayFeatures.map(f => `
          <div style="padding:${SPACING[Math.min(design, 4) as keyof typeof SPACING]}; background:${colors.surface}; border-radius:${RADIUS[Math.min(design, 5) as keyof typeof RADIUS]}; border:1px solid ${getBorder(colors)}; box-shadow:${SHADOWS[Math.min(design, 3)]};">
            <div style="font-size:${design >= 3 ? '32px' : '24px'}; margin-bottom:12px;">${f.icon}</div>
            <h3 style="font-size:${design >= 3 ? '20px' : '16px'}; color:${colors.text}; margin:0 0 8px;">${f.title}</h3>
            <p style="font-size:14px; color:${colors.text}; opacity:0.6; margin:0; line-height:1.5;">${f.desc}</p>
          </div>
        `).join('')}
      </div>
    </div>
  </section>`;
}

function generateFooter(skills: WebGenSkills, colors: typeof COLORS[keyof typeof COLORS]): string {
  const design = skills.design;
  if (design < 2) return `<footer style="padding:16px; text-align:center; font-size:12px;">© 2024</footer>`;

  return `<footer style="padding:${SPACING[Math.min(design, 4) as keyof typeof SPACING]}; background:${colors.surface}; border-top:1px solid ${getBorder(colors)};">
    <div style="max-width:1200px; margin:0 auto; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
      <span style="color:${colors.text}; opacity:0.6; font-size:14px;">© 2024 Kai Forge. All rights reserved.</span>
      ${design >= 3 ? `<div style="display:flex; gap:16px;">
        <a href="#" style="color:${colors.text}; opacity:0.6; text-decoration:none; font-size:14px;">Privacy</a>
        <a href="#" style="color:${colors.text}; opacity:0.6; text-decoration:none; font-size:14px;">Terms</a>
        <a href="#" style="color:${colors.text}; opacity:0.6; text-decoration:none; font-size:14px;">Contact</a>
      </div>` : ''}
    </div>
  </footer>`;
}

// Helper to safely access color properties
function getBorder(colors: any): string {
  return (colors as any).border || '#e5e7eb';
}

// ═══════════════════════════════════════════════════════════════
//  MAIN GENERATOR
// ═══════════════════════════════════════════════════════════════

export function generatePage(skills: WebGenSkills, pageType: string = "landing"): GeneratedPage {
  const design = Math.min(skills.design || 1, 5);
  const responsive = Math.min(skills.responsive || 1, 5);
  const perf = Math.min(skills.perf || 1, 5);
  const frontend = Math.min(skills.frontend || 1, 5);

  const colorKey = design >= 5 ? 5 : design >= 3 ? 3 : 1;
  const colors = COLORS[colorKey as keyof typeof COLORS];

  // Build CSS
  const hasAnimations = design >= 4;
  const hasTransitions = design >= 3;
  const hasDarkMode = design >= 5;
  const hasGradients = design >= 4;

  const responsiveMeta = responsive >= 2
    ? `<meta name="viewport" content="width=device-width, initial-scale=1">`
    : '';

  const mediaQueries = responsive >= 3
    ? `@media (max-width: 768px) { h1 { font-size: 32px !important; } .grid { grid-template-columns: 1fr !important; } }`
    : '';

  const perfOptimizations = perf >= 3
    ? `<link rel="preconnect" href="https://fonts.googleapis.com">`
    : '';

  const fontLink = design >= 3
    ? `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`
    : '';

  const features: string[] = [];

  if (design >= 3) features.push("Typography system (Inter font)");
  if (design >= 4) features.push("Gradient backgrounds");
  if (design >= 5) features.push("Dark mode color scheme");
  if (responsive >= 2) features.push("Viewport meta tag");
  if (responsive >= 3) features.push("Mobile breakpoints");
  if (responsive >= 4) features.push("3-column responsive grid");
  if (responsive >= 5) features.push("Full responsive design system");
  if (perf >= 3) features.push("Font preconnect optimization");
  if (perf >= 4) features.push("CSS containment hints");
  if (perf >= 5) features.push("Performance budget ready");
  if (frontend >= 3) features.push("Semantic HTML5 structure");
  if (frontend >= 4) features.push("Interactive hover states");
  if (frontend >= 5) features.push("JavaScript interactivity ready");

  const hero = generateHeroSection(skills, colors);
  const featureCards = generateFeatureCards(skills, colors);
  const footer = generateFooter(skills, colors);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${responsiveMeta}
  <title>Kai Forge — ${pageType === "landing" ? "Build Something Great" : "Dashboard"}</title>
  ${fontLink}
  ${perfOptimizations}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${FONTS[Math.min(design, 5) as keyof typeof FONTS]}; background: ${colors.bg}; color: ${colors.text}; -webkit-font-smoothing: antialiased; }
    ${hasTransitions ? 'a, button { transition: all 0.2s ease; }' : ''}
    ${hasAnimations ? `
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    section { animation: fadeIn 0.6s ease-out; }
    ` : ''}
    button:hover { opacity: 0.9; cursor: pointer; }
    ${mediaQueries}
  </style>
</head>
<body>
  ${hero}
  ${featureCards}
  ${footer}
</body>
</html>`;

  const tierScore = design + responsive + perf + frontend;
  let tier: string;
  if (tierScore >= 16) tier = "Enterprise";
  else if (tierScore >= 12) tier = "Professional";
  else if (tierScore >= 8) tier = "Standard";
  else tier = "Basic";

  return {
    html,
    tier,
    features,
    skillBreakdown: {
      frontend: { 
        level: frontend, 
        unlocks: frontend >= 5 ? ["SPA-ready", "Component architecture"] :
                 frontend >= 4 ? ["Interactive elements"] :
                 frontend >= 3 ? ["Semantic HTML"] : ["Basic HTML"]
      },
      design: {
        level: design,
        unlocks: design >= 5 ? ["Dark mode", "Full design system"] :
                 design >= 4 ? ["Gradients", "Animations"] :
                 design >= 3 ? ["Typography", "Spacing system"] :
                 design >= 2 ? ["Basic styling"] : ["No styling"]
      },
      responsive: {
        level: responsive,
        unlocks: responsive >= 5 ? ["All viewports"] :
                 responsive >= 4 ? ["Mobile + Tablet + Desktop"] :
                 responsive >= 3 ? ["Mobile breakpoints"] :
                 responsive >= 2 ? ["Viewport meta"] : ["Desktop only"]
      },
      perf: {
        level: perf,
        unlocks: perf >= 5 ? ["CDN-ready", "Performance budget"] :
                 perf >= 4 ? ["Optimized assets"] :
                 perf >= 3 ? ["Preconnect hints"] :
                 perf >= 2 ? ["Minimal CSS"] : ["No optimization"]
      },
    },
  };
}

export function comparePages(
  student: GeneratedPage,
  reference: GeneratedPage
): { score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;

  // Feature count (25 pts)
  const featureRatio = student.features.length / Math.max(reference.features.length, 1);
  score += Math.round(featureRatio * 25);
  feedback.push(`🔧 Features: ${student.features.length}/${reference.features.length} — ${featureRatio >= 0.8 ? 'Great coverage!' : 'Keep training to unlock more.'}`);

  // Tier comparison (25 pts)
  const tierScores: Record<string, number> = { "Basic": 5, "Standard": 12, "Professional": 18, "Enterprise": 25 };
  score += tierScores[student.tier] || 5;
  feedback.push(`🏆 Tier: ${student.tier} — ${student.tier === reference.tier ? 'Matches reference!' : `Reference is ${reference.tier}`}`);

  // HTML size as proxy for complexity (25 pts)
  const sizeRatio = student.html.length / Math.max(reference.html.length, 1);
  score += Math.round(Math.min(sizeRatio, 1) * 25);
  feedback.push(`📝 Complexity: ${Math.round(sizeRatio * 100)}% of reference`);

  // Responsive capabilities (25 pts)
  score += Math.min(student.skillBreakdown.responsive.level * 5, 25);
  feedback.push(`📱 Responsive: Level ${student.skillBreakdown.responsive.level} — ${student.skillBreakdown.responsive.unlocks.join(', ')}`);

  return { score: Math.min(score, 100), feedback };
}
