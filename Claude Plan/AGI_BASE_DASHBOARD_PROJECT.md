# AGI Base Dashboard — Project Brief

A small-scale build of the "AI-business-as-a-sci-fi-base" concept from @androoagi's TikTok.

---

## 1. What the reference video actually shows

Filmed footage of a desk monitor cycling between three layers of the same system:

1. **The Map View** — a top-down, isometric, AI-generated render of a sci-fi factory/base. Rooms = departments of the operator's business. A central hangar holds a giant mech (the "core agent"). Conveyor belts, glowing nodes, and laser-lines connect rooms. Top bar shows zoom level + "Center" recenter button. A side panel lists live status pills. Bottom toolbar is a horizontal row of tab icons. Top-right ticker shows live revenue: **$11,728.96**, secondary counters like `$5,083.x / xx`.

2. **The Detail View** — drilling into a "room" opens a screen-filling green-on-black terminal panel. Seen in frames: a vendor/product entry with `$6,928.29` price, item rows with status bars, side rail of filters. Another frame shows a Kanban-style task board with columns "VIRAL CONTENT FACTORY / VIRAL GAME ASSETS / AFFILIATE FACTORY", task counts ("61 tracks, 374 packs, 16 drafts"), ticket IDs (`FV-1000`, `PV-1004`, `ATLAS-...`), and a column of YouTube-style thumbnails ("NEXT 100X?", "30 DAY...", "JOB HUSTLE MAP").

3. **The Real Thing** — the camera pans to a normal-looking Shopify product page for **MINDMAX FOCUS** (1000mg lion's mane mushroom supplement, 60 capsules). This is the punchline: the sci-fi base is a *visualization layer* over an actual e-commerce business the agent is running.

A pink "wand" pointer (physical desk toy, held in frame) gestures at things on the screen. The TikTok overlay reads **@androoagi**.

### The core idea (one sentence)

> Render the agent's business as a video-game base so a human can read its state at a glance, then drill into any room for the actual underlying data.

This is a **diegetic dashboard** — an interface that looks like a game but is wired to a real backend. The aesthetic isn't decoration; it's the information hierarchy.

---

## 2. Why this works as a design pattern

- **Spatial memory > list memory.** Humans remember "the red room in the top-right was the one with errors" faster than scrolling a list of services.
- **Density without overwhelm.** A 2D map can show 30+ subsystems at once. A vertical dashboard can't.
- **Status is ambient.** Color, lighting, animation state of each room = health. No need to read labels.
- **Narrative pull.** Watching your business "run" as a base is more engaging than refreshing Stripe. Useful for solo operators who lose motivation.

The trade-off: it's expensive to build well, and the metaphor stops scaling around ~20 rooms. Small scale is actually the right scale.

---

## 3. Your small-scale version — proposed scope

A single-page web dashboard, vertical-phone or desktop, that:

- Renders **one map** with **4–6 rooms** (not 20+).
- Pulls **real data** from 2–3 services you actually use (Stripe, Shopify, Gmail, GitHub, a database — pick what you have).
- Has **one drill-down view** per room, not three.
- Skips the giant mech. Replace with a simple central "core" tile showing the headline metric.
- Ships in a weekend, not a month.

Cut ruthlessly. The TikTok version has dozens of rooms because the creator has been iterating for months. Yours starts with four.

---

## 4. Concrete room set (pick one stack)

### Option A — Solo e-commerce operator

| Room | What it shows | Data source |
|------|---------------|-------------|
| Storefront | Live visitors, today's revenue, conversion rate | Shopify / Stripe API |
| Inventory | Stock per SKU, low-stock alerts | Shopify Admin API |
| Fulfillment | Open orders, shipped today, delayed | Shopify Orders |
| Inbox | Unread customer emails, avg response time | Gmail API |
| Core (center) | MRR + today's revenue, big number | Aggregated |

### Option B — Indie developer

| Room | What it shows | Data source |
|------|---------------|-------------|
| Repo | Open PRs, CI status, last commit | GitHub API |
| Production | Uptime, error rate, P95 latency | Sentry / your APM |
| Users | DAU, signups today | Your DB or PostHog |
| Inbox | Unread support tickets | Linear / your tool |
| Core | MRR or DAU, big number | Stripe |

### Option C — Content creator

| Room | What it shows | Data source |
|------|---------------|-------------|
| Pipeline | Drafts, scheduled, published | Notion / Airtable |
| Channels | Views/likes/follows per platform | YouTube / TikTok API |
| Inbox | Brand deal emails flagged | Gmail with label filter |
| Audience | Subs today, top-performing post | Platform APIs |
| Core | Total views this week | Aggregated |

Pick one. Don't mix.

---

## 5. Visual language — keep these, drop those

### Keep

- **Top-down 2D map.** Pixel-art or low-poly isometric. No 3D.
- **Green-on-black CRT terminal palette** for detail views (`#0a0a0a` bg, `#39ff14` or `#7cffb5` for foreground, sharp 1px borders).
- **Color-coded room state.** Idle = teal, active = yellow, error = red, success = green pulse.
- **Pill-shaped status badges** in a right-side rail.
- **Live revenue/metric ticker** in the top bar.
- **One subtle animation per room** to signal "this is alive" — flashing light, slow conveyor, blinking cursor. Not all at once.

### Drop

- The giant mech. (Too much work, no information value at small scale.)
- The blue laser-lines between rooms. (Cool but they obscure the rooms underneath.)
- The schematic-wireframe overlay. (Nice flourish; v2.)
- The physical wand pointer. (That's a TikTok prop, not a UI element.)
- AI-generated room art. (Tempting; expensive to make consistent. Use a fixed pixel-art tileset instead.)

---

## 6. Tech stack — opinionated

```
Frontend:    Next.js 15 + React + TypeScript
Rendering:   HTML <canvas> (PixiJS) OR plain CSS Grid with absolutely-positioned divs
Styling:     Tailwind + a few hand-rolled CSS vars for the CRT colors
Backend:     Next.js API routes (or a single Hono server) that proxy each data source
Data fetch:  SWR or TanStack Query, 10–30s polling per source
Persistence: SQLite (better-sqlite3) for caching API responses + storing layout
Deploy:      Vercel or a small VPS
```

**Why canvas vs CSS:** With 4–6 rooms, CSS is fine and lets you put real DOM (numbers, badges) inside each room. Canvas is only worth it if you want sprites, animated tiles, or 20+ rooms.

Start with **CSS Grid + positioned divs**. Migrate to PixiJS only if you outgrow it.

### Art

- **Don't generate room backgrounds with Midjourney/SDXL per build.** They'll drift in style. Either:
  - Pay an artist $200–500 for 6 consistent isometric room tiles, OR
  - Use a single asset pack from itch.io (search "sci-fi factory tileset top-down"), OR
  - Use pure CSS — colored rectangles, gradient borders, the CRT scanline trick. Honestly looks great and ships today.

---

## 7. Milestones (weekend-buildable order)

### Day 1 — Static skeleton (4–6h)
- [ ] Next.js scaffold, Tailwind, dark theme, CRT colors as CSS vars
- [ ] Top bar: revenue ticker (hardcoded), zoom level, "Center" button (no-op for now)
- [ ] Center stage: 5-room grid as colored divs with labels and fake numbers
- [ ] Right rail: 6 hardcoded status pills
- [ ] Bottom toolbar: 6 icon tabs (just visual)

### Day 2 — Wire one real data source (4–6h)
- [ ] Pick ONE room (Storefront if e-comm, Repo if dev). Stand up the API route.
- [ ] Cache responses in SQLite, refresh every 30s
- [ ] Replace that room's fake numbers with real ones
- [ ] Add the "click room → modal opens with detail" interaction
- [ ] Detail modal = green-on-black terminal table

### Week 2 — Fill out the rest
- [ ] Add remaining rooms one per day
- [ ] Add one animation per room (CSS keyframes — pulsing border, blinking dot)
- [ ] Add error states (room border turns red when API fails)
- [ ] Real revenue ticker pulling from the core source

### Week 3+ — Polish
- [ ] Schematic wireframe overlay (toggle button)
- [ ] Mobile vertical layout (single column, rooms stack)
- [ ] Sound effects on hover (optional; annoying for daily use)
- [ ] Record your own TikTok 😉

---

## 8. The honest hard parts

- **Auth for data sources.** Each API has its own OAuth dance. Budget half a day per source.
- **Keeping the aesthetic consistent.** Easy to slip into generic SaaS-dashboard styling. Re-look at the reference video before every styling session.
- **Rate limits.** Polling every 10s will blow through most free tiers. Use webhooks where the API supports them; cache aggressively.
- **What does "the room is busy" actually mean?** Pick a concrete metric per room *before* you start drawing it. Otherwise you'll have pretty rooms with nothing to say.

---

## 9. Stretch goals (only after v1 ships)

- **Agent integration.** Wire a Claude/GPT agent that can *act* (place orders, reply to emails) and have its activity animate the rooms.
- **Replay mode.** Scrub a time slider; the map rewinds to show your business 6 hours ago.
- **Multi-base view.** Zoom out — your e-com business, your content business, your day-job, each as a separate base on a "galaxy" map.
- **Live-stream the dashboard** as ambient content while you work. (This was probably @androoagi's actual goal.)

---

## 10. Anti-goals — what this is NOT

- A general-purpose BI tool. (Use Metabase.)
- A game. (No win condition. Don't add one.)
- A replacement for your existing tool dashboards. It's a *meta-layer* on top.
- A product to sell. Build it for yourself first. If others want it, that's v2.

---

## Reference checklist before you start

- [ ] Decided on Option A/B/C in §4
- [ ] Listed the 4–6 rooms with their exact metric + data source
- [ ] API keys for each source obtained and stored in `.env.local`
- [ ] Sketched the map layout on paper (rooms + center core + bottom toolbar)
- [ ] Picked: pixel-art tileset path, or pure-CSS path
- [ ] Set a hard deadline for v1 (recommend 1 weekend)

Go build.
