# QC PIXEL ART STANDARDS — Kai Asset Forge
## Reference Benchmarks & Quality Gates

---

## 📚 REFERENCE SOURCES

### Primary References (QC Master Benchmarks)
1. **Modern Tiles Free** — `Agent Sprite & Workstation Tileset/Modern tiles_Free/`
   - Characters: Bob, Amelia, Alex (16x16, animated)
   - Tilesets: 16x16, 32x32, 48x48 (interiors + room builder)
   - RPG Maker MV character sheets

2. **Pixel Art Top Down - Basic v1.2.3** — `Agent Sprite & Workstation Tileset/Pixel Art Top Down - Basic v1.2.3/`
   - Ground tiles: Grass, Stone, Wall
   - Props: Plants, Structures, Shadows
   - Player sprites with animation frames

### Knowledge Reference
- Popo's pixel art pipeline (Popo Pixel Artist)
- 4-phase workflow: BLOCK → SHADE → COLOR → DETAIL
- Warm ramp: gold→orange→BROWN→dark red (never pink)
- Master-derived consistency principle

---

## ✅ QUALITY GATES (100-point scale)

### GATE 1: PALETTE CONSISTENCY (25 pts)
**Reference Standard:** Both tilesets use 4-6 colors per element, no orphan colors

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Color ramp count | 8 pts | 3-6 shades per element (no banding, no single shade) |
| Palette harmony | 7 pts | All colors share temperature (warm OR cool, not mixed) |
| No orphan pixels | 5 pts | Every color appears in ≥2 locations (not one-off) |
| Background contrast | 5 pts | Element clearly visible against intended background |

### GATE 2: OUTLINE QUALITY (20 pts)
**Reference Standard:** Characters use 1px dark outline; tiles use subtle/no outline

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Outline consistency | 8 pts | Same outline color across entire sprite (no mixed outline colors) |
| Outline thickness | 6 pts | 1px outline for sprites; 0-1px for tiles (never 2px+ unless armor) |
| Internal outlines | 6 pts | Selective — only where needed for readability (not on every edge) |

### GATE 3: SILHOUETTE READABILITY (20 pts)
**Reference Standard:** Bob/Amelia recognizable even as solid black silhouette

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Distinct shape | 10 pts | Identifiable at 16x16 without zooming |
| No ambiguous blobs | 5 pts | Arms/legs/head distinguishable as separate elements |
| Icon readability | 5 pts | Readable when scaled to 32x32 or 48x48 (icon size) |

### GATE 4: SHADING TECHNIQUE (15 pts)
**Reference Standard:** Simple, clean shading with directional light source

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Light direction | 5 pts | Consistent single light source (top-left or top-right) |
| Shading gradient | 5 pts | Smooth 3-4 step gradient (no jarring jumps between shades) |
| No pillow shading | 5 pts | Light follows light source, NOT centered on object |

### GATE 5: STYLE COHERENCE (20 pts)
**Reference Standard:** All assets feel like one author; no mixed styles

| Check | Weight | Pass Criteria |
|-------|--------|---------------|
| Tile consistency | 5 pts | All tiles match grid size (16/32/48) |
| Seamless tiling | 5 pts | Edge tiles connect without visible seams |
| Perspective match | 5 pts | Consistent perspective (top-down vs side-view, NOT mixed) |
| Animation fluidity | 5 pts | ≥4 frames for idle, ≥6 for walk; frames transition smoothly |

---

## 🔴 AUTO-FAIL CONDITIONS (immediate QC rejection)

1. **Mixed perspectives** — top-down character on side-view tiles (or vice versa)
2. **Wrong grid size** — sprite doesn't match tile grid (e.g., 24x24 in 16x16 world)
3. **Anti-aliased edges** — blurry edges from AI downscaling (hard pixels only!)
4. **Color banding** — visible color stripes from poor palette quantization
5. **Pillow shading** — light radiates from center instead of directional source
6. **No outlines on character** — character blends into background (must pop)

---

## 📐 TILESET-SPECIFIC STANDARDS

### Modern Tiles Free QC Benchmarks
- **Character sheets**: 12 columns × 8 rows RPG Maker format
- **Animation frames**: 3-frame idle minimum; 4-frame walk
- **Grid alignment**: Characters centered in 16×16 / 32×32 / 48×48 cells
- **Color palette**: Earth tones + character accent colors, no neon

### 64×64 Premium Sprite Standards (NEW)
- **Detail threshold**: 64×64 sprites must show 4× the detail of 16×16
- **Color ramp**: 6-12 colors expected (not 3-6 like small sprites)
- **Outline**: 1-2px outline acceptable at 64×64 (vs 1px only for 16×16)
- **Shading**: 5-6 step gradient expected (vs 3-4 for small sprites)
- **Silhouette**: Must be readable at 75% and 50% downscale
- **Anti-aliasing**: ALLOWED on internal edges at 64×64 (but NOT on outer silhouette)
- **Animation frames**: 6+ frames for idle, 8+ for walk (smoother at larger size)
- **Reference benchmark**: Compare against RPG Maker MV 48×48 sheets (closest match)

### Pixel Art Top Down Basic QC Benchmarks
- **Ground tiles**: Seamless tiling verified by 2×2 tile test grid
- **Props**: Dark outline around objects, 1px shadow offset (bottom-right)
- **Player sprites**: 3-directional minimum (up/down/left/right frames)
- **Shadow layer**: Semi-transparent dark overlay, consistent angle

---

## 🔄 QC PIPELINE INTEGRATION

### Phase 1: Automated Checks
1. Grid size validation (must match target: 16×16, 32×32, or 48×48)
2. Color count scan (flag if <3 or >12 unique colors per element)
3. Outline detection (must have at least 1 dark edge pixel on characters)
4. Perspective detection (flag if depth cues are inconsistent)

### Phase 2: Reference Comparison
1. Extract color palette → compare against reference palette library
2. Compare silhouette against reference silhouettes (template matching)
3. Run seamless-tiling test (2×2 repeat and edge-difference scan)

### Phase 3: Manual QC (Popo vision model)
1. Side-by-side comparison with closest reference asset
2. Style coherence judgment (does it look like same author?)
3. Artistic quality rating (1-10)

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
╔══════════════════════════════════════╗
║        QC REPORT — [Asset Name]     ║
╠══════════════════════════════════════╣
║ PALETTE:   [XX/25]  [PASS/FLAG/FAIL]
║ OUTLINE:   [XX/20]  [PASS/FLAG/FAIL]
║ SILHOUETTE:[XX/20]  [PASS/FLAG/FAIL]
║ SHADING:   [XX/15]  [PASS/FLAG/FAIL]
║ STYLE:     [XX/20]  [PASS/FLAG/FAIL]
╠══════════════════════════════════════╣
║ TOTAL:     [XX/100] [PASS/FLAG/FAIL]
╠══════════════════════════════════════╣
║ Reference: [closest match from benchmarks]
║ Auto-fails: [list or "NONE"]
║ Feedback: [specific improvement notes]
╚══════════════════════════════════════╝
```
