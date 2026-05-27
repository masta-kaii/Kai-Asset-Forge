# QC PIXEL ART STANDARDS — Kai Asset Forge
## Popo's Complete Pixel Art Quality Gates

> **QC Agent Training Data.** Every rule below is gospel. Violating one gate = docked points. Violating an auto-fail = immediate rejection.

---

## 📚 REFERENCE SOURCES

### Primary References (QC Master Benchmarks)
1. **Modern Tiles Free** — `Agent Sprite & Workstation Tileset/Modern tiles_Free/`
   - Characters: Bob, Amelia, Alex (16×16, animated — idle, run, sit, phone)
   - Tilesets: RPG Maker MV format (12 col × 8 row) at 16×16, 32×32, 48×48
   - Interiors: Room builder + furniture layouts
   - **Key standards:** 1px consistent outlines, limited palette (4-6 colors/element), clean silhouettes, directional lighting

2. **Pixel Art Top Down - Basic v1.2.3** — `Agent Sprite & Workstation Tileset/Pixel Art Top Down - Basic v1.2.3/`
   - Ground tiles: Grass, Stone, Wall — seamless tiling verified
   - Props: Crates, barrels, signs, statues, architectural elements
   - Player sprites: 3-frame directional (up/down/left/right)
   - Shadow layer: Semi-transparent dark overlay, bottom-right offset
   - **Key standards:** Seamless edge matching, single light source, no visible tile seams, props with dark outlines that pop from background

### Knowledge Reference
- Popo's pixel art pipeline (Popo Pixel Artist) — the 10/10 workflow
- MortMort 4-phase workflow: BLOCK → SHADE → COLOR → DETAIL
- 0x72 hue-shifting technique (highlights shift toward YELLOW, shadows toward BLUE/PURPLE)
- Master-derived consistency principle
- Component positioning rules (eyes inside body, layer ordering, mirror symmetry)

---

## 🎨 THE 0x72 FORGE PALETTE (25 indexed colors)

Every sprite must draw from this palette. No random RGB values. No exceptions.

```
 0: #000000  Outline/Black (BK)
 1: #222034  Dark navy (DN)
 2: #45283c  Dark purple (DP)
 3: #663931  Dark brown (DB)
 4: #8f563b  Brown (BR)
 5: #594339  Dark earthy (DE)
 6: #a27058  Light leather (LL)
 7: #d9a066  Skin/off-white (OW)
 8: #ac3232  Dark red (DR)
 9: #d95763  Red/pink (PK)
10: #fbf236  Yellow (YL)
11: #99e550  Green (GN)
12: #6abe30  Dark green (DG)
13: #37946e  Teal (TL)
14: #4b692f  Olive (OL)
15: #524b24  Dark olive (DO)
16: #323c39  Dark stone (DS)
17: #3f3f74  Blue-gray (BG)
18: #5b6ee1  Blue (BL)
19: #46425e  Purple-gray (PG)
20: #f4b41b  Gold (GD)
21: #df7126  Orange (OG)
22: #847e87  Gray (GR)
23: #696a6a  Dark gray (DG2)
24: #262b44  Deep shadow (DS2)
```

**Special marker:** `PURE_WHITE = -2` → RGB (255,255,255). Allowed ONLY for eye sclera at 48-64px where OW (#d9a066) reads as brown/green against dark bodies. Max 2-8px per sprite. Everything else must use forge palette.

---

## ✅ QUALITY GATES (100-point scale)

### GATE 1: PALETTE CONSISTENCY (25 pts)
**Reference Standard:** The forge palette. Every color must be intentional.

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Palette fidelity | 10 pts | All colors from forge palette (or documented PURE_WHITE exception). Zero random RGB values. |
| Color ramp count | 5 pts | 16×16: 3-6 colors/element. 32×32: 4-8. 64×64: 6-12. |
| Hue-shifting | 5 pts | Highlights shift toward YELLOW (warmer), shadows shift toward BLUE/PURPLE (cooler). Not just darker same-hue. |
| Warm/cool harmony | 3 pts | Warm body = BROWN shadow (index 4), never PINK (index 9). Cool body = blue/purple shadows, never warm. |
| No orphan pixels | 2 pts | Every color appears in ≥2 distinct pixel clusters. No single stray pixels of a color. |

**🔴 Color ramp anti-patterns:**
- ❌ gold → orange → PINK → dark red (Pink clashes with warm body — rated 8/10)
- ✅ gold → orange → BROWN → dark red (Brown harmonizes with warm body — rated 9/10)
- ❌ green → light green → BLUE → dark (Blue is cool, green wants warm shadow)
- ✅ green → light green → OLIVE → dark green

---

### GATE 2: OUTLINE QUALITY (20 pts)
**Reference Standard:** 1px black outline (index 0) around entire silhouette. Never 2px. Never missing.

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Outline thickness | 10 pts | EXACTLY 1px everywhere (16×16 and 32×32). 1-2px OK at 64×64. ZERO spots with 0px or 3px+. |
| Outline color | 5 pts | Pure black (index 0) for outer silhouette. Dark variant of body color for internal segment lines. |
| Outline completeness | 3 pts | No gaps in the black ring. Every colored pixel on the silhouette edge must have a black neighbor. |
| No mixed outlines | 2 pts | Same outline color across entire sprite. No switching between black, dark brown, dark gray mid-sprite. |

**🔴 Outline detection:**
- Scan every pixel: if colored AND adjacent to transparent → that pixel needs black outline
- Scan every black pixel: if it has NO colored neighbor → it's a stray black pixel (remove it)
- Internal outlines: ONLY where needed for readability (shell seams, limb joints). Not on every internal edge.

---

### GATE 3: SILHOUETTE READABILITY (20 pts)
**Reference Standard:** Bob/Amelia recognizable even as solid black silhouette at 16×16.

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Distinct shape | 10 pts | Character type identifiable at native size as black silhouette. Crab ≠ frog ≠ slime. |
| Body part separation | 5 pts | Head, body, arms, legs distinguishable as separate silhouette regions. No "one blob" characters. |
| Downscale readability | 5 pts | 64×64 sprites: readable at 75% and 50% downscale. 16×16 sprites: readable at native. |

**🔴 Silhouette test:** Render sprite as pure black fill. Can you tell what it is without seeing colors? Can you distinguish left/right limbs from body? If no → auto-fail.

---

### GATE 4: SHADING TECHNIQUE (15 pts)
**Reference Standard:** MortMort top-lighting with 4-step gradient. Light from top-left.

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Light direction | 5 pts | Consistent single light source (top-left preferred). Highlights on top/left edges, shadows on bottom/right. |
| Shading gradient | 5 pts | 3-4 step gradient at 16×16, 5-6 step at 64×64. Smooth transition — no jarring jumps between adjacent shades. |
| NO pillow shading | 5 pts | Light follows light source, NOT centered on object. Shadows at edges, highlights at top. |
| Deep shadow zone | +bonus | Bottom 20% of body uses deep shadow (DR or DS2). Ground shadow band at very bottom. |

**🔴 Pillow shading detection:** If the lightest pixels are in the geometric CENTER and darkest at ALL edges (not just bottom/right) → reject immediately.

---

### GATE 5: STYLE COHERENCE (20 pts)
**Reference Standard:** All assets feel like one author; no mixed styles.

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Outline consistency | 5 pts | Same outline thickness on all sprites in a pack. Same outline color. Same internal outline style. |
| Perspective match | 5 pts | Consistent perspective (top-down vs side-view). Never mix perspectives in one pack. |
| Grid alignment | 3 pts | All tiles match grid size (16/32/48). Sprites centered in their cell. |
| Animation consistency | 4 pts | Same body proportions, limb thickness, outline width across ALL animation frames. |
| Detail uniformity | 3 pts | Don't over-detail one sprite and under-detail another in the same pack. |

---

## 🔴 AUTO-FAIL CONDITIONS (immediate QC rejection)

These are instant REJECT — no score, no second chance:

| # | Condition | Detection Method |
|---|-----------|------------------|
| 1 | **Mixed perspectives** | Side-view character on top-down tiles (or vice versa) |
| 2 | **Wrong grid size** | Sprite doesn't match tile grid (e.g., 24×24 in 16×16 world) |
| 3 | **Anti-aliased edges** | Any pixel with alpha between 0 and 255 on silhouette edge → AI artifact |
| 4 | **Color banding** | >3 consecutive pixels of same color in a gradient zone → poor quantization |
| 5 | **Pillow shading** | Lightest pixels in geometric center, darkest at ALL edges (not just shadow side) |
| 6 | **No outlines on character** | <5 black edge pixels per 16px of sprite perimeter → character blends into background |
| 7 | **Body shadow = PINK** | Index 9 (#d95763) used as body shadow on warm-colored character |
| 8 | **Outline >2px** | Any section where black outline ring is 3+ pixels thick |
| 9 | **Transparent gap in silhouette** | Any fully transparent pixel SURROUNDED by colored pixels → broken silhouette |
| 10 | **Eyes outside body** | Eye pixels with no body-colored neighbor → "floating eyes" syndrome |

---

## 📐 SIZE-SPECIFIC STANDARDS

### 16×16 Sprites
| Rule | Standard |
|------|----------|
| Palette | 3-6 colors per element |
| Outline | 1px only, black (BK) |
| Shading | 2-3 shades (limited space) |
| Anti-aliasing | NEVER |
| Silhouette | Readable at native 16×16 |
| Detail | 1px features only — no 2×2 blocks |
| Animation | 4+ frames for idle |

### 32×32 Sprites
| Rule | Standard |
|------|----------|
| Palette | 4-8 colors per element |
| Outline | 1px only, black (BK) |
| Shading | 3-4 step gradient |
| Anti-aliasing | NEVER |
| Silhouette | Readable at native |
| Detail | Up to 2×2 feature blocks |
| Animation | 4+ idle, 6+ walk |

### 64×64 Premium Sprites
| Rule | Standard |
|------|----------|
| Palette | 6-12 colors per element |
| Outline | 1-2px OK (but 1px preferred) |
| Shading | 5-6 step gradient with hue-shifting |
| Anti-aliasing | ALLOWED on internal edges only (NOT on outer silhouette) |
| Silhouette | Readable at 75% and 50% downscale |
| Detail | Up to 16×16 feature regions |
| Animation | 6+ idle, 8+ walk, 12f for premium |
| Eye sclera | PURE_WHITE (-2) allowed for 2-8px |
| Catchlights | 3×3 with glow (not just 2×2 white) |

---

## 🎯 THE 10 PROFESSIONAL TECHNIQUES (QC Checklist)

Every hand-crafted sprite must demonstrate these. Points docked for each missing technique:

| # | Technique | QC Check |
|---|-----------|----------|
| 1 | **1px consistent outlines everywhere** | Scan full perimeter — no 2px spots, no gaps |
| 2 | **Top-lighting gradient** | Highlight top 20%, base middle 50%, shadow bottom 20%, deep shadow bottom 10% |
| 3 | **Shell/body segment lines at 1px** | Internal lines use darker body variant, not pure black |
| 4 | **Dithering at shade transitions** | Checkerboard every 3-5px at shade boundaries: `(x+y) % N == 0` |
| 5 | **Intentional pixel clusters** | No isolated pixels (<2 same-color neighbors) |
| 6 | **Back-to-front layering** | Draw order: shadow → back → body → belly → face → front limbs |
| 7 | **Multi-tone limbs with visible joints** | Upper segment thicker, knee/elbow dark pixel cluster, lower segment thinner |
| 8 | **Catchlights on eyes** | 2×2 or 3×1 white/yellow at top-left of eye |
| 9 | **Ground shadow** | Dark 3-6px band at very bottom, anchors to ground |
| 10 | **Master-frame derivation** | All animation frames derive from ONE master — same proportions, colors, outlines |

---

## 🔬 DESIGN vs EXECUTION — Two Quality Dimensions

QC must evaluate BOTH dimensions separately. They are independent:

| | Execution | Design |
|---|---|---|
| **What** | Clean outlines, consistent shading, no stray pixels | Shapes, proportions, pose, vibe |
| **Rating** | 10/10 achievable through technique | Requires matching the reference's intent |
| **How to fix** | 4-phase workflow, master derivation | Study reference with FRESH eyes |
| **QC check** | Automated: outline scan, palette check, silhouette test | Manual: compare against reference, check body shape rules |

**When the user says "design really out":** The execution is clean but the shapes/proportions are wrong. Go back to the reference and extract the DESIGN specs. Don't just tweak — rebuild.

---

## 🧬 CHARACTER DESIGN SPECS (for reference comparison)

### Klawf (fierce crab)
- Shell: **Egg-shaped** (narrower at top, wider at bottom) — NOT round
- Seams: **Slightly curved** — NOT perfectly straight horizontal lines
- Claws: **BIG and dramatic**, extending OUT from body — NOT proportional
- Legs: **Wide spider stance**, angling out — NOT hanging straight down
- Eyes: **Protruding bumps** on shell surface — NOT flat dots
- Vibe: **Fierce** — NOT cute
- Color: Orange/Brown/Gold. Shadow = BROWN (4), NOT pink (9)

### Fwog (simple meme frog)
- Eyes: **PERFECT circles** — NOT ovals (rx=ry, not rx≠ry)
- Mouth: **STRAIGHT horizontal line** — NOT tilted, NOT curved
- Legs: **Straight down** — NOT angled out
- Arms: **Angle slightly out** from body — NOT straight down
- Body: **Slightly wider than tall**, pear-shaped (wider at TOP where eyes embed)
- Vibe: **Simple, derpy, flat** — no shading ever
- Color: Green. Pure black circle eyes. Small pink mouth.

### Design rule — trust the reference, never your instincts:
```
❌ "I think the eyes should be oval" → They're circles. You're wrong.
❌ "A tilted mouth looks better" → It's straight. You're wrong.  
❌ "Egg shape adds character" → Reference is round. You're wrong.
✅ "What does the reference actually show?" → Match it exactly.
```

---

## 🔄 QC PIPELINE INTEGRATION

### Phase 1: Automated Checks (run on every asset)
1. **Grid size validation** — must match target: 16×16, 32×32, 48×48, or 64×64
2. **Palette scan** — check every pixel against forge palette; flag non-forge colors
3. **Outline detection** — scan silhouette edge; measure outline thickness per pixel
4. **Silhouette test** — render as pure black; check body part separation
5. **Pillow shading detection** — compare center brightness vs edge brightness
6. **Anti-alias detection** — check for alpha values between 0 and 255
7. **Color ramp check** — verify warm=Brown shadow, cool=blue shadow
8. **Orphan pixel scan** — find pixels with <2 same-color neighbors
9. **Eye position check** — verify eye pixels touch body pixels

### Phase 2: Reference Comparison (character sprites)
1. Extract color palette → compare against reference palette library
2. Compare silhouette against reference silhouettes (template matching)
3. Run seamless-tiling test (2×2 repeat and edge-difference scan)
4. Check body proportions against character design specs

### Phase 3: Vision Model Review (Popo's eyes)
1. Side-by-side comparison with closest reference asset
2. Style coherence judgment (does it look like same author?)
3. Design intent verification (fierce vs cute, round vs egg)
4. Artistic quality rating (1-10)

### Scoring Formula
```
TOTAL = Palette(25%) + Outline(20%) + Silhouette(20%) + Shading(15%) + Style(20%)

PASS  = ≥70% AND no auto-fail triggers
FLAG  = 50-69% OR 1 minor issue  
FAIL  = <50% OR any auto-fail trigger
```

---

## 📝 QC REPORT TEMPLATE

```
╔════════════════════════════════════════════════════════════╗
║              QC REPORT — [Asset Name]                      ║
╠════════════════════════════════════════════════════════════╣
║ SIZE:       [16×16 | 32×32 | 64×64]                        ║
║ TYPE:       [character | tile | prop | ui | effect]        ║
╠════════════════════════════════════════════════════════════╣
║ PALETTE:    [XX/25]  [PASS/FLAG/FAIL]                      ║
║   → Forge fidelity: [X/10]  → Ramp quality: [X/5]          ║
║   → Hue-shifting:   [X/5]   → Harmony:     [X/3]           ║
║   → No orphans:     [X/2]                                  ║
╠════════════════════════════════════════════════════════════╣
║ OUTLINE:    [XX/20]  [PASS/FLAG/FAIL]                      ║
║   → Thickness:  [X/10]  → Color:      [X/5]                ║
║   → Completeness:[X/3]  → No mixing:  [X/2]                ║
╠════════════════════════════════════════════════════════════╣
║ SILHOUETTE: [XX/20]  [PASS/FLAG/FAIL]                      ║
║   → Shape: [X/10]  → Parts: [X/5]  → Downscale: [X/5]     ║
╠════════════════════════════════════════════════════════════╣
║ SHADING:    [XX/15]  [PASS/FLAG/FAIL]                      ║
║   → Direction: [X/5]  → Gradient: [X/5]  → No pillow: [X/5]║
╠════════════════════════════════════════════════════════════╣
║ STYLE:      [XX/20]  [PASS/FLAG/FAIL]                      ║
║   → Outlines:   [X/5]  → Perspective: [X/5]                ║
║   → Grid:       [X/3]  → Animation:   [X/4]                ║
║   → Uniformity: [X/3]                                      ║
╠════════════════════════════════════════════════════════════╣
║ TOTAL:      [XX/100] [✅ PASS / ⚠ FLAG / ❌ FAIL]          ║
╠════════════════════════════════════════════════════════════╣
║ AUTO-FAILS: [list or "NONE"]                               ║
║ MISSING TECHNIQUES: [#/10 professional techniques]         ║
║ DESIGN SCORE: [Execution: X/10 | Design: X/10]             ║
║ REFERENCE: [closest match from benchmarks]                 ║
║ FEEDBACK: [specific fix instructions with pixel counts]    ║
╚════════════════════════════════════════════════════════════╝
```

---

## 🔴 VISION MODEL CAVEAT (for QC agents)

**Vision models describe images in natural language, not pixel data.** They will say "bright orange crab with round eyes" when what you need is `#D2764F` at `(128, 136)` with `aspect 1.07`.

**Vision model ratings are UNRELIABLE for design accuracy:** Vision gave 10/10 to procedural frog sprites that the user said were "not even the same popo." The vision model scores CLEAN EXECUTION (sharp outlines, consistent palette) but cannot judge whether the DESIGN matches the user's intent or reference.

**Vision model common failure modes:**
- Says "on stalks" but doesn't specify stalk HEIGHT → you make them too tall
- Says "large eyes" but doesn't distinguish white-sclera vs black-with-highlights
- Says "round body" when the reference is actually tall/oval
- Says "short limbs" when they're thin and elongated
- Hallucinates details (moss/seaweed) that AREN'T in the reference

**The fix: read raw pixels FIRST, then use vision for intent.** Every image analyzed by QC must extract:
- Exact dominant colors (hex values with pixel counts)
- Character bounding box and aspect ratio (w/h)
- Color distribution percentages
- Outline thickness measurements

---

## 🚫 GENERATION APPROACH QUALITY CEILINGS

QC must account for the inherent limits of each generation method:

| Approach | Quality Ceiling | Cost | Verdict |
|----------|:---:|:----:|---------|
| Pure code (circles/ovals) | 3-5/10 | $0 | Reject for characters |
| Numpy hybrid (silhouette → Aseprite) | 5-7/10 | $0 | Flag for characters |
| AI gen + post-processor | 8-9/10 | $$ | Acceptable but audit for artifacts |
| Reference extraction | 9/10 | $0 | Acceptable if specs match |
| **Hand-crafted grid → Aseprite** | **9-10/10** | **$0** | **Gold standard** |
| **Procedural pixel engine** | **8-9/10** | **$0** | **Preferred for batch** |

**QC adjustment:** If the generation approach is known, adjust pass threshold:
- Hand-crafted: threshold 80/100
- Procedural engine: threshold 70/100
- AI gen + post: threshold 60/100 + mandatory anti-alias scan
- Pure code: REJECT characters at any score (fine for tiles/props)

---

## 🎓 THE MORTMORT 4-PHASE MANDATORY WORKFLOW

QC must verify each phase was completed:

```
🖤 PHASE 1: BLOCK      →  🔆 PHASE 2: SHADE     →  🎨 PHASE 3: COLOR      →  🔍 PHASE 4: DETAIL
   (silhouette only)       (4-shade ramp)            (optical mixing)          (pixel-precise polish)
```

| Phase | QC Verification |
|-------|-----------------|
| BLOCK | Does the black silhouette read correctly? Are body parts distinct? |
| SHADE | Are there 3-6 distinct shade levels? Does light come from one direction? |
| COLOR | Is there dithering at transitions? Are colors hue-shifted? |
| DETAIL | Are outlines exactly 1px? Are catchlights present? Any stray pixels? |

**NEVER skip phases. NEVER do them out of order. This is the #1 quality driver.**

---

> **Last Updated:** 2026-05-27 — Full Popo knowledge injection (v3.0)
> **Previous versions:** v1.0 (basic 5-gate), v2.0 (added 64×64 standards)
