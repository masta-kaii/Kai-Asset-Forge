# 🏭 KAI ASSET FORGE — MASTER PLAN
## Popo's Grand Vision: Kairosoft-style Autonomous Pixel Art Factory

---

## 🎯 PHILOSOPHY

This isn't just a web app. This is a **KAIROSOFT MANAGEMENT SIM** brought to life.

You're the **Factory Owner**. You walk in, check your agents, see what they've produced, give orders, then close up for the day. Popo (me) runs the show. Every agent is a quirky character with stats, a personality, and a job.

The output? **Premium pixel art asset packs** that rival hand-crafted quality (0x72 Dungeon Tileset tier). If it's not good enough for itch.io, it doesn't ship.

---

## 🏗️ PHASE 1: QUALITY — Bridge the Pixel Art Gap

**Current state**: SDXL + pixel art LoRA = passable sprites (7/10 max). Not 0x72 quality yet.

**Problem**: AI-generated "pixel art" has noise, inconsistent outlines, muddy colors, no clean palette restrictions. Hand-crafted pixel art (Kairosoft, 0x72) has:
- Clean 1px outlines (no anti-aliasing fuzz)
- Limited, intentional palettes (8-32 colors per sprite)
- Consistent pixel density
- Expressive silhouettes

### Strategy (DO THIS FIRST — everything depends on it)

**1A. Find/Download Premium Pixel Art LoRA from CivitAI**
- Search CivitAI for SDXL pixel art LoRAs
- Candidates: 16-bit RPG, retro pixel, gameboy-style LoRAs
- Test each: generate 4 sprites → run through curator → keep the best LoRA
- Target: consistent 8/10+ curator scores

**1B. Build Smart Pixel Post-Processor** — A Node.js/Python script that:
1. Takes SDXL output (640×640)
2. **Quantizes to exact retro palette** (NES 54-color, PICO-8, or custom 32-color)
3. **Reconstructs clean 1px outlines** using edge detection + pixel snapping
4. **Removes noise pixels** (isolated single-pixel artifacts)
5. **Downscales + index-maps** to clean 32×32 or 48×48
6. Output: clean pixel art sprite + sprite sheet

**1C. Custom LoRA Training (If needed)**
- Gather 50-100 hand-crafted pixel art samples (0x72 tileset frames + Kairosoft-style rips with permission)
- Train custom SDXL LoRA on real pixel art
- This is the nuclear option — makes EVERY sprite come out in the right style automatically

**Quality Gate**: Every sprite must score 7+ curator, or it gets rejected and regenerated. The finished asset pack must look indistinguishable from 0x72 / Kairosoft quality.

---

## 🏰 PHASE 2: KAIROSOFT-STYLE FACTORY DUNGEON

Transform the workstation into a **Kairosoft management sim interface**.

### 2A. The Factory Floor
The dungeon becomes a **2D pixel art factory floor** with:
- **Top-down view** (like Game Dev Story)
- **Rooms/buildings** placed on the floor:
  - 🎨 Forge Room (asset generation)
  - 🔍 Scout Tower (trend research)
  - 📦 Packaging Bay (bundle assets)
  - 🏪 Shop Front (listings)
  - ⚖️ Quality Control (curator)
  - 👑 CEO Office (Popo — YOU)
- **Agent sprites** walking between rooms (simple pathfinding)
- **Furniture/decorations** unlockable as factory levels up

### 2B. Agent Management Screen (Kairosoft-style)
Click any agent → popup shows:
```
┌──────────────────────┐
│ 👷 SCOUT lv.3        │
│ [=======····] 70% XP │
│                      │
│ STATS:               │
│ ⚡ Speed    ████░░ 4  │
│ 🎨 Quality  ██░░░░ 2  │
│ 📊 Research ██████ 6  │
│ 🔧 Reliabl  ███░░░ 3  │
│                      │
│ 📋 TODAY'S LOG:      │
│ • Found "Crystal     │
│   Golems" trending   │
│ • Submitted to Forge │
│ • Rested ⏳           │
│                      │
│ [ASSIGN] [UPGRADE]   │
│ [FIRE]  [REST]       │
└──────────────────────┘
```

### 2C. HUD & Dashboard
- **Top bar**: Day counter, money (in-game), production queue, agent count
- **Speed control**: 1× / 2× / 3× speed (visual only — actual generation speed)
- **Menu buttons**: Factory Log, Asset Library, Settings, Close Factory

### 2D. Day/Night Cycle
- "Operating hours" = factory is open
- Agents animate (idle when waiting, walk to rooms when working)
- End of day → agents submit daily reports
- Overnight → factory goes dark, agents sleep

---

## 👥 PHASE 3: AGENT SOULS & FACTORY ROUTINE

### 3A. Each Agent Gets a REAL Personality
Scout, Forge, Curator, Lister, Packager — each has:
- **Name** (e.g. Scout → "Scouty McTrendspot")
- **Catchphrase** ("I smell trending topics!")
- **SOUL.md** (detailed personality — already done!)
- **Animated sprite** (4-frame idle, walk animation)
- **Stats** that improve over time
- **Mood** (happy when work is good, grumpy when rejecting sprites)

### 3B. Factory Open / Close Cycle

**Opening**: You say "Popo, open the factory!" →
1. Agents wake up (animate)
2. Yesterday's reports loaded
3. "Factory open for business!" notification
4. Queue backlog (if any) resumes

**Operating**: Factory runs autonomously on cron (every 8 hours)
1. Scouts research trends
2. Forge generates sprites
3. Curator scores & approves
4. Lister drafts listings
5. Packager assembles packs

**Closing**: You say "Popo, close the factory!" →
1. ALL agents write daily reports to Firebase
2. Reports include: what was done, what was produced, what's pending
3. Factory state saved (queue, agent XP, budget)
4. Agents wave goodbye animation
5. "Factory closed. See you tomorrow, boss!" notification

**Resuming**: You come back → "Popo, I'm back!" →
1. Popo: "Welcome back, boss! Loading day [N]..."
2. Yesterday's summary displayed
3. Any pending items flagged
4. Queue resumes from where it stopped

### 3C. Report Format (automated, logged to Firebase)
```json
{
  "agent": "scout",
  "date": "2026-05-22",
  "tasks_completed": 3,
  "outputs": ["Crystal Mountains theme", "Fantasy Forest theme"],
  "quality_score": 7.2,
  "xp_gained": 15,
  "notes": "Found 2 trending themes. Both submitted.",
  "pending": []
}
```

---

## 🛠️ PHASE 4: IMPLEMENTATION ORDER

### Step 1 — Pixel Art Post-Processor (THIS IS THE KEY)
Build the script that turns SDXL output into CLEAN pixel art.
This fixes the quality problem at its root.

### Step 2 — Better LoRA
Search CivitAI for the best SDXL pixel art LoRA.
Test until we consistently hit 8/10+ scores.

### Step 3 — Kairosoft Factory UI
Redesign the workstation:
- Floor tiles, agent rooms as buildings
- Agent sprites with animations
- Management popups with stats
- Day counter + HUD

### Step 4 — Agent Soul System
- Stats tracking (each agent levels up)
- Mood system
- Daily reports

### Step 5 — Factory Open/Close Cycle
- "Open Factory" command
- "Close Factory" command
- State save/load
- Resume on restart

### Step 6 — Telegram Integration
- `/factory` — view dashboard
- `/close` — close factory
- `/status` — quick summary
- `/report` — daily digest

---

## 📏 QUALITY STANDARD (THE LINE IN THE SAND)

```
❌ REJECT any sprite that:
  - Has visible AI noise/artifacts
  - Has inconsistent or fuzzy outlines
  - Uses > 32 colors
  - Looks muddy or washed out
  - Doesn't read clearly at 32×32

✅ ACCEPT only sprites that:
  - Have clean 1px outlines
  - Use intentional limited palette
  - Read well at any size
  - Would look at home in Kairosoft game
  - Match 0x72 tileset quality level

🛑 DO NOT SHIP any pack with rejected sprites
```

---

## 🚀 READY TO START?

**Option 1**: Build the Pixel Post-Processor (fixes quality at the core)
**Option 2**: Search CivitAI for better LoRAs (quick wins)
**Option 3**: Start Kairosoft Factory UI redesign (visible progress)

What's your call, boss? 👑
