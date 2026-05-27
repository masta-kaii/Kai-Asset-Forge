import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const WEB_DIR = join(process.cwd(), 'forge-output', 'web')

// Malaysian-market web themes with relevant palettes
const WEB_THEMES: Record<string, { name: string; palette: string[]; industry: string; desc: string }> = {
  'food-delivery': { name: 'QuickBite MY', palette: ['#FF6B35', '#FF8C42', '#1A1A2E', '#16213E', '#FFFFFF'], industry: 'F&B', desc: 'Modern food delivery landing page for Malaysian market' },
  'ecommerce-fashion': { name: 'GayaKita', palette: ['#E94560', '#0F3460', '#533483', '#1A1A2E', '#FFFFFF'], industry: 'Fashion', desc: 'Trendy fashion e-commerce for young Malaysians' },
  'travel-explorer': { name: 'Jelajah MY', palette: ['#4ADE80', '#166534', '#3B82F6', '#1E3A5F', '#FFFFFF'], industry: 'Travel', desc: 'Malaysian travel & tour landing page' },
  'crypto-exchange': { name: 'RinggitX', palette: ['#F7931A', '#1A1A2E', '#2D1B69', '#7C3AED', '#FFFFFF'], industry: 'Fintech', desc: 'Crypto exchange with Malaysian Ringgit pairs' },
  'property-listing': { name: 'RumahKu', palette: ['#3B82F6', '#1E40AF', '#F59E0B', '#1A1A2E', '#FFFFFF'], industry: 'Property', desc: 'Modern property listing platform for Malaysian market' },
  'edu-platform': { name: 'IlmuHub', palette: ['#8B5CF6', '#6D28D9', '#EC4899', '#1A1A2E', '#FFFFFF'], industry: 'Education', desc: 'Interactive online learning platform' },
  'health-wellness': { name: 'SihatPlus', palette: ['#10B981', '#059669', '#3B82F6', '#1A1A2E', '#FFFFFF'], industry: 'Healthcare', desc: 'Health & wellness booking platform for clinics' },
  'event-booking': { name: 'AcaraMY', palette: ['#F59E0B', '#D97706', '#DC2626', '#1A1A2E', '#FFFFFF'], industry: 'Events', desc: 'Event discovery & ticket booking platform' },
}

function generateLandingPage(theme: typeof WEB_THEMES[string]): string {
  const { name, palette, industry, desc } = theme
  const [primary, secondary, dark1, dark2, white] = palette

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — ${industry} Platform</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --dark1: ${dark1};
      --dark2: ${dark2};
      --white: ${white};
      --radius: 16px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--dark1);
      color: var(--white);
      overflow-x: hidden;
    }

    /* ── NAV ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
      padding: 16px 40px;
      display: flex; justify-content: space-between; align-items: center;
      background: rgba(26,26,46,0.85); backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .nav-logo { font-size: 24px; font-weight: 800; color: var(--primary); letter-spacing: -0.5px; }
    .nav-links { display: flex; gap: 32px; list-style: none; }
    .nav-links a { color: rgba(255,255,255,0.7); text-decoration: none; font-weight: 500; font-size: 14px; transition: all 0.2s; }
    .nav-links a:hover { color: var(--white); }
    .nav-cta {
      background: var(--primary); color: var(--white); border: none;
      padding: 10px 24px; border-radius: 50px; font-weight: 600;
      font-size: 14px; cursor: pointer; transition: all 0.3s;
      box-shadow: 0 4px 20px ${primary}44;
    }
    .nav-cta:hover { transform: translateY(-2px); box-shadow: 0 8px 30px ${primary}66; }

    /* ── HERO ── */
    .hero {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      text-align: center; padding: 120px 40px 80px;
      background: radial-gradient(ellipse at 50% 0%, ${primary}15, transparent 60%),
                  linear-gradient(180deg, var(--dark1), var(--dark2));
    }
    .hero-content { max-width: 700px; }
    .hero-badge {
      display: inline-block; background: ${primary}22; color: var(--primary);
      padding: 6px 16px; border-radius: 50px; font-size: 13px; font-weight: 600;
      letter-spacing: 0.5px; margin-bottom: 24px;
      border: 1px solid ${primary}33;
    }
    .hero h1 { font-size: 64px; font-weight: 800; line-height: 1.1; margin-bottom: 20px; letter-spacing: -1px; }
    .hero h1 span { color: var(--primary); }
    .hero p { font-size: 18px; color: rgba(255,255,255,0.6); line-height: 1.7; margin-bottom: 36px; max-width: 500px; margin-left: auto; margin-right: auto; }
    .hero-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      background: var(--primary); color: var(--white); border: none;
      padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px;
      cursor: pointer; transition: all 0.3s; box-shadow: 0 8px 30px ${primary}44;
      text-decoration: none; display: inline-block;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px ${primary}66; }
    .btn-outline {
      background: transparent; color: var(--white); border: 2px solid rgba(255,255,255,0.15);
      padding: 14px 32px; border-radius: 50px; font-weight: 600; font-size: 16px;
      cursor: pointer; transition: all 0.3s; text-decoration: none; display: inline-block;
    }
    .btn-outline:hover { border-color: var(--white); }

    /* ── FEATURES ── */
    .section { padding: 100px 40px; max-width: 1200px; margin: 0 auto; }
    .section-label {
      text-align: center; color: var(--primary); font-size: 13px; font-weight: 700;
      letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;
    }
    .section h2 { text-align: center; font-size: 42px; font-weight: 800; margin-bottom: 16px; letter-spacing: -0.5px; }
    .section-sub { text-align: center; color: rgba(255,255,255,0.5); font-size: 16px; max-width: 500px; margin: 0 auto 60px; }
    .features-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;
    }
    .feature-card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      border-radius: var(--radius); padding: 32px; transition: all 0.3s;
      cursor: pointer;
    }
    .feature-card:hover {
      background: rgba(255,255,255,0.06); transform: translateY(-4px);
      border-color: ${primary}33; box-shadow: 0 20px 40px ${primary}11;
    }
    .feature-icon { font-size: 36px; margin-bottom: 16px; display: block; }
    .feature-card h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .feature-card p { color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.7; }

    /* ── STATS ── */
    .stats { background: var(--dark2); padding: 80px 40px; }
    .stats-grid { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 40px; text-align: center; }
    .stat-number { font-size: 48px; font-weight: 800; color: var(--primary); margin-bottom: 4px; }
    .stat-label { color: rgba(255,255,255,0.5); font-size: 14px; font-weight: 500; }

    /* ── CTA ── */
    .cta-section { padding: 100px 40px; text-align: center; }
    .cta-card {
      max-width: 700px; margin: 0 auto;
      background: linear-gradient(135deg, ${primary}22, ${secondary}22);
      border: 1px solid ${primary}33; border-radius: 24px; padding: 60px;
    }
    .cta-card h2 { font-size: 36px; font-weight: 800; margin-bottom: 12px; }
    .cta-card p { color: rgba(255,255,255,0.6); margin-bottom: 32px; font-size: 16px; }

    /* ── FOOTER ── */
    footer {
      border-top: 1px solid rgba(255,255,255,0.06); padding: 40px;
      text-align: center; color: rgba(255,255,255,0.3); font-size: 13px;
    }
    footer span { color: var(--primary); }

    /* ── RESPONSIVE ── */
    @media (max-width: 768px) {
      nav { padding: 16px 20px; }
      .nav-links { display: none; }
      .hero h1 { font-size: 36px; }
      .hero p { font-size: 15px; }
      .section { padding: 60px 20px; }
      .section h2 { font-size: 28px; }
    }

    /* ── ANIMATIONS ── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate { animation: fadeUp 0.6s ease forwards; }
    .delay-1 { animation-delay: 0.1s; }
    .delay-2 { animation-delay: 0.2s; }
    .delay-3 { animation-delay: 0.3s; }
  </style>
</head>
<body>
  <nav>
    <div class="nav-logo">✦ ${name}</div>
    <ul class="nav-links">
      <li><a href="#features">Features</a></li>
      <li><a href="#stats">Stats</a></li>
      <li><a href="#cta">Get Started</a></li>
    </ul>
    <button class="nav-cta">Launch App</button>
  </nav>

  <section class="hero">
    <div class="hero-content">
      <div class="hero-badge">✦ ${industry} · Malaysia</div>
      <h1>The Future of <span>${industry}</span> Starts Here</h1>
      <p>${desc}. Built for the Malaysian market with cutting-edge design and seamless user experience.</p>
      <div class="hero-buttons">
        <a href="#cta" class="btn-primary">Get Early Access</a>
        <a href="#features" class="btn-outline">Explore Features</a>
      </div>
    </div>
  </section>

  <section class="section" id="features">
    <div class="section-label">Why ${name}</div>
    <h2>Built for the Modern Malaysian</h2>
    <p class="section-sub">Everything you need, designed with local context in mind.</p>
    <div class="features-grid">
      <div class="feature-card animate">
        <span class="feature-icon">⚡</span>
        <h3>Lightning Fast</h3>
        <p>Optimized for Malaysian internet speeds. Loads in under 2 seconds on 4G.</p>
      </div>
      <div class="feature-card animate delay-1">
        <span class="feature-icon">🌏</span>
        <h3>Local-First</h3>
        <p>Bahasa Malaysia support, local payment gateways, and Malaysian market insights built in.</p>
      </div>
      <div class="feature-card animate delay-2">
        <span class="feature-icon">🔒</span>
        <h3>Bank-Grade Security</h3>
        <p>End-to-end encryption with PDPA compliance for Malaysian user data protection.</p>
      </div>
      <div class="feature-card animate delay-1">
        <span class="feature-icon">📱</span>
        <h3>Mobile-First Design</h3>
        <p>92% of Malaysians browse on mobile. Our responsive design delivers the best experience.</p>
      </div>
      <div class="feature-card animate delay-2">
        <span class="feature-icon">💳</span>
        <h3>Local Payments</h3>
        <p>FPX, Touch 'n Go eWallet, GrabPay, and major credit cards — all supported.</p>
      </div>
      <div class="feature-card animate delay-3">
        <span class="feature-icon">📊</span>
        <h3>Smart Analytics</h3>
        <p>Real-time dashboard with Malaysian market trends and user behavior insights.</p>
      </div>
    </div>
  </section>

  <section class="stats" id="stats">
    <div class="stats-grid">
      <div><div class="stat-number">97%</div><div class="stat-label">Customer Satisfaction</div></div>
      <div><div class="stat-number">50K+</div><div class="stat-label">Active Users</div></div>
      <div><div class="stat-number">< 2s</div><div class="stat-label">Average Load Time</div></div>
      <div><div class="stat-number">24/7</div><div class="stat-label">Local Support</div></div>
    </div>
  </section>

  <section class="cta-section" id="cta">
    <div class="cta-card animate">
      <h2>Ready to Transform Your ${industry} Experience?</h2>
      <p>Join thousands of Malaysians already using ${name}. Early access available now.</p>
      <a href="#" class="btn-primary">Get Started Free</a>
    </div>
  </section>

  <footer>
    <p>✦ ${name} — Built for Malaysia · <span>KAI ASSET FORGE</span> · HERMES OS v5</p>
  </footer>
</body>
</html>`
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const themeKey = body.theme || Object.keys(WEB_THEMES)[Math.floor(Math.random() * Object.keys(WEB_THEMES).length)]
    const theme = WEB_THEMES[themeKey] || Object.values(WEB_THEMES)[0]

    if (!existsSync(WEB_DIR)) {
      await mkdir(WEB_DIR, { recursive: true })
    }

    const ts = Date.now()
    const filename = `${theme.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${ts}.html`
    const filepath = join(WEB_DIR, filename)
    const html = generateLandingPage(theme)
    await writeFile(filepath, html, 'utf-8')

    return NextResponse.json({
      success: true,
      asset: {
        name: theme.name,
        filename,
        path: `/api/library/image?file=${encodeURIComponent(`web/${filename}`)}`,
        category: 'web',
        type: 'landing-page',
        industry: theme.industry,
        size: Buffer.byteLength(html, 'utf-8'),
        palette: theme.palette,
        description: theme.desc,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
