# Self-Improving Asset-Forge Agent — Project Plan

A pipeline of AI agents that generates game assets, sells them online, learns from what sells, and reinvests. You sit on top of the dashboard from the previous doc and harvest the profit.

---

## 0. Read this first — the honest framing

This works, but only if you treat it as a business with an AI workforce, not a magic money button. Three rules:

1. **The agent doesn't "self-improve" in the AGI sense.** It improves by running experiments, recording outcomes, and updating its own prompts/parameters based on what sold. That's a feedback loop, not consciousness. Don't pitch it to yourself as more than that or you'll over-engineer.

2. **Marketplaces hate fully-automated AI-asset spam.** itch.io tolerates it, Unity Asset Store and Unreal Marketplace will reject low-quality AI dumps and may ban accounts. The winning strategy is **AI generates → you (or a curation agent) gates → only the top 10% gets listed**. Quality > volume.

3. **Your edge is the loop, not the generator.** Anyone can generate 1000 sprites with SDXL. Your moat is the *feedback loop* — which assets sold, at what price, to whom, what tags worked, what didn't. That data compounds. Guard it.

---

## 1. System architecture (the high level)

Six agents in a closed loop. Think of them as departments in the base map.

```
┌─────────────────────────────────────────────────────────────┐
│                    YOU (overseer, dashboard)                │
└──────────────────┬──────────────────────────────────────────┘
                   │ approvals, kill switch, budget cap
                   ▼
   ┌──────────────────────────────────────────────────┐
   │              ORCHESTRATOR (Claude/GPT)           │
   │  decides which agent runs next, tracks budget    │
   └─┬──────┬──────┬──────┬──────┬──────┬─────────────┘
     ▼      ▼      ▼      ▼      ▼      ▼
   ┌────┐┌────┐┌────┐┌────┐┌────┐┌─────┐
   │SCOUT││FORGE││CURATOR││LISTER││PROMOTER││LEDGER│
   └────┘└────┘└────┘└────┘└────┘└─────┘
     │      │      │      │      │      │
     ▼      ▼      ▼      ▼      ▼      ▼
  trends  assets  rejects listings posts  sales DB
  data    files                   replies (the moat)
```

### Agent roles

| Agent | Job | Tools it calls | Output |
|-------|-----|----------------|--------|
| **Scout** | Find what's trending and what gaps exist | Web search, itch.io scraping, Reddit/r/gamedev, Steam tag trends | A ranked list of "asset opportunities" with target tags, style refs, price range |
| **Forge** | Generate the actual assets | SDXL/Flux for 2D, Tripo/Meshy for 3D, ElevenLabs/Suno for audio, photo-editing libs for cleanup | Raw asset files in a staging folder |
| **Curator** | Reject 80–90% of what Forge made | Vision model (Claude Sonnet, GPT-4o vision) scoring against quality rubric | Pass/fail per asset + reasoning |
| **Lister** | Package, write copy, upload | Marketplace APIs (itch.io API, Gumroad API, Shopify Admin) | Live product listings |
| **Promoter** | Drive traffic | Reddit/Twitter posting via API, screenshot generation, marketing copy | Posts, replies, schedules |
| **Ledger** | Track every cost, sale, and outcome | Stripe/marketplace webhooks, SQLite | The feedback dataset |

The orchestrator is just a loop with a budget cap. It reads ledger → picks the next highest-EV action → calls the relevant agent.

---

## 2. The self-improvement loop (the actual important part)

This is what makes it interesting versus a dumb generator. Every cycle:

```
1. Scout proposes a batch (e.g., "10 cyberpunk pixel-art enemy sprites,
   price target $4.99, target itch.io tag 'cyberpunk'").

2. Forge generates 30 candidates with varied prompts/seeds.

3. Curator scores each on: technical quality, style consistency,
   commercial appeal, originality. Top 5 advance.

4. Lister publishes them. Each listing is tagged in the ledger with
   its full lineage: which prompt, which model, which Scout proposal.

5. Promoter pushes traffic.

6. Ledger records: views, wishlists, sales, refunds, reviews.

7. After N days (or M sales), Orchestrator runs a *reflection* step:
   asks Claude to read the ledger and produce a "lessons learned"
   document. Updates the prompt library for Scout and Forge.

8. Loop.
```

The reflection step is where "self-improvement" actually lives. Concrete form:

```
Input to reflection: last 30 days of ledger entries
Output: structured JSON like
{
  "winning_patterns": [
    "Pixel sprites tagged 'cyberpunk' + 'hostile' sold 3x more",
    "Bundles of 10+ outsold singles at every price point",
    "Posting on Tuesday 7pm UTC got 2x engagement"
  ],
  "losing_patterns": [
    "3D low-poly weapons: 47 listed, 2 sold. Stop.",
    "Prompts containing 'realistic' produced sterile output"
  ],
  "prompt_updates": {
    "Scout": "Bias toward 2D + bundles. Avoid 3D weapons.",
    "Forge.pixel": "Add 'gritty, high contrast' to base prompt."
  },
  "budget_reallocation": "Move 80% of Forge spend to 2D pipeline."
}
```

That JSON gets merged into the system prompts for the next cycle. **This is the entire trick.** No fancy RL, no fine-tuning. Just a feedback file that the agents read on every run.

---

## 3. Asset-type decisions — pick your pipeline

You didn't lock in a type, so here are honest assessments per option. Pick one to start. **Do not start with all of them.**

### 2D sprites / pixel art
- **Pros:** Cheapest to generate ($0.01–0.10/image), easy to curate visually, fast iteration, biggest indie-dev market.
- **Cons:** Saturated. Quality bar is real — generic AI pixel art looks generic immediately.
- **Tools:** SDXL with a pixel-art LoRA, or Retro Diffusion (purpose-built), or Flux Schnell + downscale + palette quantize.
- **Best marketplace:** itch.io, Gumroad.
- **Realistic revenue:** $0–500/mo solo, $500–3K/mo with strong curation and promotion.

### 3D models
- **Pros:** Higher price points ($5–50 per asset), less saturated on the AI side.
- **Cons:** Generation tools (Tripo, Meshy, TRELLIS, Rodin) still produce models that need cleanup before they're usable. Topology, UVs, and rigging are not solved. Curator workload is heavy.
- **Tools:** Meshy API, Tripo API, Rodin Gen-1. Blender headless for cleanup/export.
- **Best marketplace:** CGTrader, Sketchfab Store, Unity (slow review).
- **Realistic revenue:** Higher ceiling but slower ramp. Probably negative for first 2–3 months.

### UI kits & GUI packs
- **Pros:** Image-gen handles this well, devs always need them, can charge $10–30 per pack.
- **Cons:** Smaller buyer pool than sprites.
- **Tools:** Same as 2D + Figma API for packaging.
- **Best marketplace:** itch.io, Gumroad, Creative Market.

### Audio (SFX/music)
- **Pros:** Audio AI (Suno, ElevenLabs Sound Effects, Stable Audio) is genuinely good and the market is hungry.
- **Cons:** Licensing is a minefield — most AI audio tools forbid commercial use in their TOS. **Check ToS before you build anything here.**
- **Realistic revenue:** Promising but legally risky in 2026. Wait for a tool with clean commercial-use rights.

**My recommendation for v1:** Start with **2D sprites/pixel art on itch.io and Gumroad**. Lowest cost per experiment, fastest feedback loop, most forgiving market. Move into other types only after the loop is profitable.

---

## 4. Marketplace strategy

| Marketplace | Friction | AI tolerance | Revenue | Verdict |
|-------------|----------|--------------|---------|---------|
| itch.io | Very low (API, instant publish) | High | Low–medium | **Start here** |
| Gumroad | Low (API, instant) | High | Medium | **Add second** |
| Your own Shopify | Medium (you own it) | Total control | Depends on traffic | Add at month 3 |
| Unity Asset Store | High (manual review, weeks) | Low — be very careful | High | Month 6+ if quality is real |
| Unreal Marketplace | Very high | Low | High | Skip until you have hits |
| Creative Market | Medium | Medium | Medium | Optional |
| Etsy | Low | Medium | Medium for printable game assets | Niche |

**Cardinal rule:** if a marketplace's ToS prohibits AI-generated content or fully-automated listings, don't lie about it. The bans are permanent and they share lists. Some marketplaces require disclosure — disclose.

---

## 5. Quality gate — the unsexy thing that decides if you make money

This is where most "AI agents that sell on Etsy" projects die. They generate 1000 things and list 1000 things. Buyers see the slop, leave, and the account dies.

Your Curator agent enforces:

1. **Technical checks (automated, cheap)**
   - Image: resolution, palette count (for pixel art), transparency, file size
   - 3D: poly count, watertight mesh, UV coverage, texture resolution
   - All: filename hygiene, no NSFW (CLIP-based check)

2. **Aesthetic checks (vision model, $0.01–0.05 per asset)**
   - "Score this asset 1–10 on style consistency with [reference]"
   - "Does this look like generic AI output? yes/no"
   - "Would an indie dev pay $5 for this? yes/no with reasoning"

3. **Duplicate check** — embed every generated asset, compare to past assets and known marketplace listings. Reject near-duplicates.

4. **Human gate (you)** — the dashboard shows you everything that passed automated curation. **You click approve/reject before anything goes live.** This is non-negotiable for the first 2 months. Once you trust the Curator, you can auto-approve top-decile scores.

Expected funnel:
```
Forge generates 100 → Curator passes 15 → You approve 8 → Lister publishes 8
```

Anyone telling you to skip the human gate is selling you something.

---

## 6. Tech stack

```
Orchestrator:    Python (LangGraph or vanilla) or TypeScript (Mastra)
LLM brain:       Claude Sonnet 4.6 for reasoning, Haiku 4.5 for cheap routing
Image gen:       Replicate or Fal.ai (SDXL, Flux, Retro Diffusion)
3D gen:          Meshy / Tripo API (only if you go 3D)
Vision/curate:   Claude Sonnet 4.6 with vision, or GPT-4o
Storage:         SQLite for ledger + Postgres if it grows, S3/R2 for assets
Marketplace:     itch.io butler CLI, Gumroad API, Shopify Admin API
Promotion:       Twitter API v2, Reddit PRAW, scheduled via cron
Dashboard:       The map UI from the previous doc
Monitoring:      Sentry for errors, your own budget tracker
```

Why Claude as the brain: reflection step needs to read long ledgers and produce structured updates. Claude is good at this and the API is clean. Fine to use whatever you prefer though — the architecture is model-agnostic.

---

## 7. Budget reality check

Per cycle (one batch of 10 listed assets), rough costs:

| Step | Cost |
|------|------|
| Scout (LLM calls + web search) | $0.20 |
| Forge (100 generated → 8 listed, ~$0.05 each for 2D) | $5.00 |
| Curator (vision scoring 100 assets) | $2.00 |
| Lister (LLM for copy, free uploads) | $0.30 |
| Promoter (LLM for posts) | $0.20 |
| **Per-cycle total** | **~$8** |

At 3 cycles/week = ~$100/month just in API costs. Plus marketplace fees (itch.io takes 10%, Gumroad takes ~10%).

**Break-even math:** you need to sell ~$120/month gross to cover API + fees. That's 24 sales at $5 each. Doable but not guaranteed.

**Budget envelope by ambition:**
- Bootstrap ($50/mo): 1 cycle/week, sprites only, manual everything except generation
- Hobby ($200/mo): 2–3 cycles/week, sprites + UI kits, automated curation + Lister
- Small biz ($500–1000/mo): daily cycles, multiple asset types, automated promotion
- Going for it ($1000+/mo): everything above + paid ads experiments + 3D pipeline

**Hard rule:** the orchestrator has a budget cap per day. If it hits the cap, it stops. Never let an agent burn money unattended.

---

## 8. Milestone plan (8-week ramp)

### Week 1–2: Manual everything, prove the unit economics
- [ ] Generate 30 sprites by hand with the tool you'll use
- [ ] Manually curate to 10
- [ ] Manually list on itch.io with butler CLI
- [ ] Manually post to r/IndieDev and r/PixelArt
- [ ] Track sales for 2 weeks
- **Decision gate:** did *any* of them sell? If zero sales, fix the product before automating. If 1+ sale, proceed.

### Week 3: Build Forge + Curator + Ledger
- [ ] Forge: a script that takes a prompt batch and produces N assets
- [ ] Curator: vision-model scoring with a rubric you tuned in week 1–2
- [ ] Ledger: SQLite schema for prompts, assets, listings, sales
- [ ] Manual Scout, Lister, Promoter still

### Week 4: Build Lister + Orchestrator
- [ ] Lister: itch.io and Gumroad upload via API
- [ ] Orchestrator loop with budget cap and human-approval queue
- [ ] First fully-automated batch (with your approval step)

### Week 5: Build Promoter
- [ ] Twitter posting with generated screenshots
- [ ] Reddit posting with rate limits and account aging respected
- [ ] Track CTR from each channel in the ledger

### Week 6: Build Scout + first reflection
- [ ] Scout: trend scraping + opportunity ranking
- [ ] Reflection step: read 30 days of ledger, output prompt updates
- [ ] Apply updates, run another cycle, compare

### Week 7: Dashboard
- [ ] Wire the base-map dashboard from the previous doc to this backend
- [ ] One room per agent, real metrics, click-to-drill-down to ledger

### Week 8: Profitability review
- [ ] Honest P&L: revenue minus API costs minus marketplace fees
- [ ] If profitable: scale (more cycles, more asset types)
- [ ] If not: which step is broken? Usually it's product quality or distribution, never the agents themselves.

---

## 9. Legal / ToS landmines

- **Training data of image models.** SDXL/Flux base models trained on scraped data with known copyright disputes. Use models with clean training data if you can (Stable Diffusion 3.5, Adobe Firefly for commercial certainty). Disclose AI involvement where required.
- **Marketplace AI disclosure.** itch.io requires AI disclosure. Etsy requires AI disclosure. Comply.
- **Trademark.** Your agents will try to generate "Mario-style" or "Zelda-style" assets because those tags get traffic. Block this in the Forge system prompt with an explicit denylist.
- **Tax.** Sales income is taxable. Set up a separate bank account / business entity early. Ledger should output a year-end CSV for your accountant.
- **Promoter behavior.** Don't let it spam. Reddit bans on sight. Throttle to 1–2 posts/day per account, and have it engage with replies (or you do).

---

## 10. Kill switches (you will need these)

- **Budget cap** — daily and monthly, enforced in the orchestrator. Hard stop, no override.
- **Listing cap** — max N new listings per marketplace per day, regardless of how many pass curation. Marketplaces flag accounts that suddenly publish 50 items/day.
- **Negative-feedback trigger** — if review rating drops below X or refund rate above Y%, auto-pause Lister.
- **Manual pause** — one button on the dashboard that stops everything.
- **Dead-man switch** — if you don't check the dashboard for 3 days, agents pause and email you.

---

## 11. What "monitoring and farming" actually looks like for you

The fantasy is: you check the dashboard, see money go up, smile.

The reality is, daily for the first 2 months:
- 10 min reviewing the approval queue (approve/reject what Curator passed)
- 5 min spot-checking Promoter posts before they go out
- 5 min reading reflection outputs and sanity-checking the prompt updates

Per month:
- 1 hour reviewing the P&L
- 1 hour adjusting strategy based on what's selling
- Tax/admin as needed

After month 3 if things work, you can probably get this down to 30 min/day passive review + occasional intervention. Below that, quality degrades and sales drop. The agents need a human in the loop.

---

## 12. Failure modes I expect you to hit

1. **Generic-looking output.** Fix: stronger style anchors, LoRAs, reference-image conditioning.
2. **Curator passes too much.** Fix: tighten the rubric, add comparative scoring against past hits.
3. **Promoter gets shadow-banned.** Fix: slow down, vary content, engage genuinely.
4. **Reflection step says nonsense.** Fix: smaller, more concrete ledger schema; explicit examples in the reflection prompt.
5. **API costs spike.** Fix: cache vision scores; only re-curate if asset changed.
6. **You stop checking the dashboard.** Fix: budget cap and dead-man switch (above) so the damage is bounded.
7. **One asset goes viral, you can't replicate it.** This is the *good* failure. Capture everything about it in the ledger so reflection can learn from it.

---

## Decisions to make before you start coding

- [ ] Asset type for v1 (recommend: 2D sprites/pixel art)
- [ ] Primary marketplace for v1 (recommend: itch.io)
- [ ] Monthly budget cap and daily budget cap
- [ ] Which LLM you'll use for the brain
- [ ] Which image gen API you'll use
- [ ] Where the human-approval queue lives (dashboard, email, Telegram, Slack)
- [ ] Business entity / bank account / tax setup (boring but matters)

---

## What to build first, concretely

If you only do one thing this week: **Forge + Ledger + manual approval, generating 2D pixel-art sprites you list yourself on itch.io.** Skip everything else. Prove the unit economics. The full multi-agent system is only worth building once you know the product sells.

If it doesn't sell at the manual stage, the agents won't fix it.
