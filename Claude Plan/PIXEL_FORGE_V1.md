# Pixel Forge v1 — The Bootstrap Plan

You picked: **2D pixel art, multi-marketplace, $50/mo cap.** This document is the locked-in v1.

---

## TL;DR — what changed from the generic plan

1. **Tool stack pinned.** Flux Schnell on Replicate ($0.003/image), Claude Haiku for routing, Claude Sonnet only for weekly reflection.
2. **Marketplaces phased, not parallel.** itch.io week 1. Gumroad week 3. Unity / Shopify ignored until v2 (you'd burn the entire $50 budget on auth flows and review-queue headaches).
3. **Disclosure baked in.** itch.io requires AI disclosure for assets — undisclosed AI work loses indexing. We design around this rather than fight it.
4. **No automated Promoter, no automated Curator at launch.** You do both manually weeks 1–3. The agents only generate and prepare. We add the eyes once we know what "good" looks like for your taste.

---

## 1. The brutal market reality (read this first)

itch.io's policy requires AI disclosure on all asset packs, and buyers can filter to "No AI" when shopping. The realistic buyer for AI-tagged pixel-art assets is:

- A solo gamedev prototyping who needs placeholder art and is fine with AI
- A jam developer working in a 48-hour window
- A hobbyist who doesn't care about the AI debate
- A buyer specifically looking for AI-as-aesthetic novelty

Buyers who **won't** buy:
- Anyone shipping a commercial game where AI-trained-on-scraped-data is a legal/PR risk
- Anyone who's part of the loud anti-AI gamedev community (sizable on itch and r/gamedev)

This narrows your TAM but doesn't kill it. The wedge is **"affordable, fast, transparent-about-AI pixel art for prototyping."** Lean into "AI-assisted, hand-finished" — don't hide it. Price below human-made equivalents ($2–8 per pack, not $15–30).

---

## 2. Budget breakdown — what $50/mo actually buys

| Line item | Cost | Notes |
|-----------|------|-------|
| Flux Schnell on Replicate | $0.003/image | Primary generator |
| Claude Haiku 4.5 | ~$1/M input tokens, $5/M output | Routing, copy generation |
| Claude Sonnet 4.6 | ~$3/M input, $15/M output | Weekly reflection only |
| itch.io fees | 10% of sales | Default split |
| Gumroad fees | ~10% of sales | Pay-as-you-go is free, takes 10% |
| Hosting | $0 | SQLite + cron on your own machine |

**Monthly envelope:**
- ~10,000 Flux Schnell images = $30
- ~$15 of Claude API for routing/copy/reflection
- $5 buffer

That's 10K image *attempts* per month. If your hit rate (Curator pass + you approve) is 5%, you list 500 finished assets — way more than itch.io can absorb anyway. Realistic plan: 2K images/month, list 50–100, save the budget for iteration.

**Hard rules:**
- Daily Replicate cap: $1.50 (~500 images)
- Monthly Claude API cap: $15
- Both enforced in code, not just willpower

---

## 3. The product catalog (week-by-week)

Don't try to be a generalist. Pick a vertical, dominate it, then expand.

### Tier 1 — start here (week 1–4)
- **8×8 / 16×16 / 32×32 enemy sprites** — top-down or side-view
- **Tilesets** — single-theme, 16×16 (e.g., "Cyberpunk Alley Tileset", "Mushroom Forest Tiles")
- **Icon packs** — RPG inventory icons, UI buttons, ability icons (16×16, 32×32, 64×64)

### Tier 2 — add if Tier 1 works (week 5+)
- Character animation strips (idle, walk, attack)
- Themed item packs (potions, weapons, gems)
- Backgrounds / parallax layers

### Tier 3 — only after profitability (month 3+)
- Cohesive "game starter kits" — sprites + tiles + UI in one matching theme
- Custom commissions via Gumroad

**v1 focus:** 2 enemy sprite packs + 1 tileset + 1 icon pack. Four products total.

---

## 4. The pipeline — concrete v1

```
┌─────────────┐
│  YOU (10 min/day)                                       │
│  - Approve queue                                         │
│  - Post to Reddit/Twitter (drafted by agent)             │
└──────┬───────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│  CRON (runs 3×/week, Mon/Wed/Fri 9am)                   │
│  ┌─────────┐  ┌───────┐  ┌────────────┐  ┌─────────┐    │
│  │ Scout   │→ │ Forge │→ │ Approval Q │→ │ Lister  │    │
│  └─────────┘  └───────┘  └────────────┘  └─────────┘    │
│                            ↑ YOU                         │
└─────────────────────────────────────────────────────────┘

WEEKLY (Sunday)
┌─────────────────────────────────────────────────────────┐
│  Reflection (Sonnet) reads Ledger → updates prompts     │
└─────────────────────────────────────────────────────────┘
```

### What each component does in v1

**Scout (Haiku, 1 call/run)**
- Reads ledger: last 14 days of "themes that sold"
- Reads a simple curated list of "trending pixel-art tags" (you maintain a file)
- Outputs: `{theme, style, asset_type, count}` for the next batch

**Forge (Replicate Flux Schnell)**
- Receives the Scout spec
- Generates N variants per spec (typically 20–40 images per batch)
- Post-processes locally: downscale to true pixel grid, palette quantize to 16/32 colors, alpha background, save as PNG
- No vision-model curation in v1 — every generated image goes to your approval queue

**Approval Queue (you, in the dashboard)**
- Grid view of all generated images, click to thumbs-up/thumbs-down
- Approved images get grouped into packs (e.g., 10 enemies = one pack)
- You write the pack title and tags; Lister drafts the description

**Lister (Haiku for copy, then itch.io upload)**
- Uses itch.io's "butler" CLI to push the pack
- Sets the AI disclosure flag honestly (graphics: AI-generated)
- Tags: relevant pixel-art tags + "ai-generated"
- Price: starts at $3 for a 10-pack, adjusts based on reflection

**Ledger (SQLite)**
- Every generated image: prompt, model, seed, timestamp, approved/rejected
- Every listing: SKU, price, marketplace, AI disclosure
- Every sale: amount, source, refund status
- This is the moat. Back it up weekly.

**Reflection (Sonnet, 1 call/week)**
- Reads last 7 days of ledger
- Outputs JSON: winning patterns, losing patterns, prompt deltas
- You eyeball the deltas, accept or reject, they merge into Scout/Forge prompts

---

## 5. The directory layout

```
pixel-forge/
├── .env.local                  # REPLICATE_API_TOKEN, CLAUDE_API_KEY, ITCHIO_API_KEY
├── pyproject.toml              # Python 3.11+, uv or poetry
├── ledger.db                   # SQLite
├── prompts/
│   ├── scout.md                # Updated by reflection
│   ├── forge_pixel.md          # Updated by reflection
│   ├── lister_copy.md
│   └── reflection.md
├── trending_tags.yaml          # You curate weekly
├── data/
│   ├── pending/                # Forge writes here
│   ├── approved/               # Approval queue moves here
│   ├── listed/                 # Lister moves here
│   └── rejected/                # For reflection learning
├── src/
│   ├── orchestrator.py         # Entry point, called by cron
│   ├── budget.py               # Hard caps, no override
│   ├── agents/
│   │   ├── scout.py
│   │   ├── forge.py
│   │   ├── lister.py
│   │   └── reflection.py
│   ├── tools/
│   │   ├── replicate_client.py
│   │   ├── claude_client.py
│   │   ├── itchio_butler.py
│   │   └── image_postprocess.py  # palette quantize, pixel-grid snap
│   └── ledger.py
├── dashboard/                   # Reuses the base-map UI from previous doc
│   └── (Next.js app)
└── scripts/
    ├── seed_db.sql
    ├── backup_ledger.sh
    └── reset_weekly.py
```

---

## 6. Image post-processing — the unsung hero

This is what separates "obvious AI slop" from "actually usable pixel art." Flux Schnell does NOT output true pixel art — it outputs smooth raster images that *look* pixelated. Required post-processing:

1. **Downscale** to target resolution (e.g., generate at 1024×1024, downscale to 32×32) using nearest-neighbor
2. **Palette quantize** to N colors (PIL `quantize(colors=16)`) — choose a fixed palette per pack for consistency
3. **Outline pass** (optional) — add a 1px dark outline using edge detection, makes sprites readable
4. **Background removal** — many pixel-art LoRAs paint colored backgrounds. Use a threshold-based alpha mask.
5. **Pixel-grid snap** — re-upscale by 4× nearest-neighbor for preview, but ship the small version

Without these, your output is "Midjourney-flavored fake pixel art" and buyers will roast you in reviews. Build this BEFORE you build the agents.

Python libs needed: Pillow, numpy. Optional: `pyxelate` for advanced quantization.

---

## 7. The week-by-week build order

### Week 1: Forge alone, manually wired
**Goal:** Generate and post-process 30 sprites you'd actually pay for.

- [ ] Set up Replicate account, get API token
- [ ] Write `forge.py` that takes a prompt and produces N images
- [ ] Write `image_postprocess.py` with downscale + quantize + alpha
- [ ] Generate 100 enemy sprites with 5 different prompt templates
- [ ] **Eyeball them all.** Are any good? If none, fix prompts before continuing.
- [ ] Manually package 10 best into an itch.io pack
- [ ] Manually upload to itch.io with butler CLI (`butler push`)
- [ ] Post in r/gamedev "Show off your work" thread

**Decision gate end of week 1:** did you generate at least 10 sprites you're proud of? If no, the problem is the product, not the agents. Iterate prompts/post-processing until yes.

### Week 2: Ledger + Lister + first sale data
- [ ] SQLite schema, basic insert/query
- [ ] Lister that writes copy via Haiku + uploads via butler
- [ ] Track every view/wishlist/download on itch.io (use their analytics API or scrape your own page)
- [ ] List 3 more packs (variations on what got attention in week 1)
- [ ] **Set a price experiment:** one pack at $0 (free with optional tip), one at $3, one at $7

**Decision gate end of week 2:** are any of the packs getting views? If zero views, the problem is distribution, not product. Fix that before automating.

### Week 3: Scout + Orchestrator + Gumroad
- [ ] Scout reads ledger and proposes the next batch
- [ ] Orchestrator with hard budget cap (`budget.py`)
- [ ] Cron job 3×/week
- [ ] Add Gumroad as second marketplace (its API is simpler than itch.io)
- [ ] You're still manually approving everything from the approval queue

### Week 4: Approval queue UI + Reflection
- [ ] Build the approval-queue page (just a grid with approve/reject buttons)
- [ ] Reflection script: Sonnet reads 7 days of ledger, outputs prompt deltas
- [ ] You eyeball the deltas, hit "accept" → they merge into prompts
- [ ] Second batch generated with updated prompts

### Week 5–6: Polish + first real reflection cycle
- [ ] Hook up the base-map dashboard from the previous doc
- [ ] One room per agent, real metrics
- [ ] Two full reflection cycles, compare hit rate vs. baseline
- [ ] If hit rate improved: ship more product, raise prices on winners
- [ ] If not: the reflection prompt needs work

### Week 7–8: Profitability review and v2 decisions
- [ ] Honest P&L
- [ ] Decision: scale current pipeline, or pivot product?
- [ ] If profitable: time to consider Unity Asset Store (requires real human polish first)
- [ ] If not: probably a product/quality issue, not an agent issue

---

## 8. Specific prompts to start with

### Scout system prompt (initial)
```
You are Scout, a market analyst for a one-person pixel-art store on itch.io.

Inputs:
- LEDGER: a JSON of recent listings with views, sales, refunds
- TRENDING: a YAML list of recently-popular pixel-art tags
- BUDGET_REMAINING: dollars left this month

Job: Propose the next batch of pixel art to generate. Output ONE batch spec
as JSON:
{
  "theme": "<concrete visual theme, e.g. 'haunted-forest enemies'>",
  "asset_type": "enemy_sprite" | "tileset" | "icon_pack",
  "count": <int, 10-40>,
  "style_anchor": "<keyword string for Forge: e.g. 'gritty, 32px, limited palette, dark outline'>",
  "target_price_usd": <number>,
  "rationale": "<1-2 sentences why this proposal>"
}

Bias toward themes that have sold in the LEDGER. If nothing has sold yet,
bias toward the top 3 items in TRENDING.
Never propose a theme that has been listed in the last 14 days.
```

### Forge prompt template (initial)
```
{count} pixel art sprites, {theme}, 32×32 resolution, transparent background,
strictly limited 16-color palette, sharp pixel edges, no anti-aliasing,
dark 1px outline, top-down view, individual sprites suitable for a 2D game,
{style_anchor}, no text, no watermarks
```

Tune this in week 1. The "strictly limited palette" and "no anti-aliasing" matter — Flux ignores them constantly, which is why post-processing is non-negotiable.

### Reflection prompt
```
You are Reflection. You read a sales ledger and update prompts.

Input: LEDGER_7D (last 7 days of listings + sales + Promoter results)

Output JSON:
{
  "summary": "<2-3 sentence overview of the week>",
  "winning_patterns": [<concrete observations with evidence>],
  "losing_patterns": [<concrete observations with evidence>],
  "prompt_deltas": {
    "scout": "<text to append to Scout's system prompt, or null>",
    "forge": "<text to append to Forge's prompt template, or null>"
  },
  "trending_tags_to_add": [<strings>],
  "trending_tags_to_remove": [<strings>],
  "recommended_pause": <bool — true if data suggests stopping and reassessing>
}

Be specific. "Cyberpunk sprites sold 3x more than fantasy" is useful;
"some themes did better" is not.
```

---

## 9. Failure modes specific to this stack

1. **Flux output doesn't look like pixel art even after post-processing.**
   - Fix: better prompts ("blocky 32×32, no smooth shading"), and a stronger quantize pass. Worst case, train a small LoRA on real pixel art (~$10 on Replicate).

2. **Every batch looks like the same enemy.**
   - Fix: pass `seed` explicitly, varied seeds per image. Add subtype variation in the prompt template.

3. **itch.io flags the account for spam.**
   - Fix: hard cap at 1 listing per day per marketplace. Quality > volume.

4. **Reddit shadowbans your promo account.**
   - Fix: don't automate Reddit posting in v1. You do it yourself once a week, in genuine "show off" threads, not spam.

5. **Zero sales after 4 weeks despite views.**
   - Fix: the issue is almost certainly *quality* not pricing. Drop prices and ask in r/gamedev for honest feedback. Iterate the style.

6. **You stop checking the approval queue.**
   - Fix: the orchestrator pauses if the queue exceeds 200 unreviewed items.

---

## 10. Honest revenue expectations

I've seen similar bootstrap operations land at:
- Month 1: $0–20 (1–5 sales)
- Month 2: $20–80
- Month 3: $50–200 if quality is real, $0 if not
- Month 6: $100–500 if you've found a niche, plateau or decline if you haven't

This is not "farm money" territory at $50/mo budget. It's "side project that might cover its own costs and teach you a lot." If you want bigger numbers, plan for a $300+/mo budget at month 3 (assuming month 2 covers it) and add Unity Asset Store with actual hand-polished work.

The *real* reason to do this is the engineering and the dashboard, not the money. The money is the scoreboard.

---

## 11. What I'd build first, today

If you have 4 hours this week:

1. Make a Replicate account
2. `pip install replicate pillow`
3. Generate 30 sprites with Flux Schnell, hand-tune one prompt for 30 min
4. Write the post-processing script (downscale + quantize + alpha)
5. Look at the output side by side with paid pixel-art packs on itch.io
6. Decide honestly: is this competitive?

If yes, proceed with the plan. If no, you've spent $0.10 and learned a real thing.

---

## Decisions made for v1 (lock these in)

- ✅ Asset type: 2D pixel-art sprites + tilesets + icon packs
- ✅ Marketplaces: itch.io week 1, Gumroad week 3, others deferred
- ✅ Budget: $50/mo hard cap, $1.50/day Replicate cap
- ✅ Generator: Flux Schnell on Replicate
- ✅ Brain: Claude Haiku (routine), Sonnet (weekly reflection)
- ✅ AI disclosure: always honest, tagged on every listing
- ✅ Human-in-loop: you approve every asset before listing, weeks 1–8 minimum
- ✅ Promoter: manual for v1 (you post, agent drafts copy)

Ready to start when you are.
