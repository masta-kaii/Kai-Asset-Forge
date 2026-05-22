# Kai-Asset-Forge — UI/UX Design Brief for Claude Design

## Project Overview
A Kairosoft-style pixel art management sim factory dashboard. 6 agents work on an autonomous pipeline (Scout→Forge→Curator→Packager→Lister), displayed as a dungeon floor with clickable agent rooms.

## Current Tech Stack
- **Framework**: Next.js 16 (React + TypeScript)
- **Styling**: Tailwind CSS + custom `kairosoft-theme.css`
- **Sprites**: 32×32 pixel art agent sprites (48 files), tile-based dungeon floor
- **Audio**: Web Audio API retro synth sounds (no audio files)
- **Deployment**: Vercel (kai-asset-forge-hub.vercel.app)

## Target Aesthetic
**Kairosoft Management Sim** (like Game Dev Story, Dungeon Village):
- Warm gold/brown color palette
- Pixel art aesthetic with retro chiptune vibes
- Clickable buildings with popup windows
- Character stats with bar displays
- Game-like HUD (LIVE, CYCLE, SCAN indicators)
- Building roofs with name signs over each department

## Current Design Tokens

### Colors
```
Background: #0d0a04 (near-black warm)
Surface:    #1a1206 (dark brown)
Border:     #d4a03c (gold)
Accent:     #f5d98a (light gold)
Text:       #ffd700 (bright gold)
Muted:      #c8b88a (warm beige)
Dim:        #5c4510 (dark gold)
Button:     #6b8e23 (olive green)
Danger:     #8b2500 (brick red)
```

### Typography
- Font: monospace throughout
- Sizes: 9px (labels), 10px (body), 11px (HUD), 12px (agent names), 14px (day counter), 16px (levels)
- Text transform: uppercase + letter-spacing: 1-2px

### Layout
- 3×3 CSS grid for agent rooms
- 7 rooms: Popo(Center), Scout(0,0), Forge(1,0), Curator(2,0), Packager(1,1), Lister(2,1), TestBench(1,2)
- Full-screen layout: HUD bar (top, 28px) + dungeon floor (flex-1)

## Current UI Components

### 1. HUD Bar (Top Bar)
```
[● LIVE] | [Cycle: SCAN] | [👣 0/6] [⚙ Cycle #0] | [⏱ 00:00:01] | [📋 LOG]
```
- Live status dot (green pulse)
- Current pipeline step badge (SCAN/FORGE/QC/BUNDLE/LIST)
- Working agent count / total
- Cycle counter
- Uptime timer
- LOG button

### 2. Dungeon Floor
- Dark background with radial gradient torchlight effect
- 3×3 CSS grid with agent room cells
- Corridor SVG overlay (gold dashed lines connecting rooms)
- Each room has: floor tile texture, wall decorations, room props (column/crate/banner)
- Building roofs with agent name signs

### 3. Agent Rooms (Clickable)
Each room displays:
- Kairosoft building roof (triangle + sign with agent name)
- Custom pixel art agent sprite (32×32, idle animation 4 frames)
- Nameplate with agent label and role
- Status dot (green=working, blue=walking, violet=meeting, grey=idle)
- Speech bubble with soul lines (random dialogue)
- Room border changes color by status (gold for Popo, violet for meeting, amber for pipeline step)
- Glow/drop-shadow effects for active states

### 4. GameWindow Popups (Click Agent → Opens)
- Kairosoft gold-bordered modal with monospace title bar
- Agent stats card: level, speed, quality, research, reliability bars
- Department-specific panels:
  - **Scout**: Wishlist/bounty board
  - **Forge**: Production panel
  - **Curator**: Asset library + QC tools
  - **Packager**: Assembly panel
  - **Lister**: Listing drafts
  - **Popo**: Command center (pipeline overview, agent fleet grid, quick stats)
  - **Test Bench**: Asset preview grid (last 12 generated assets)

### 5. Top-Left Controls
- Day counter (Building2 icon + "Day N")
- LOG button, SFX/MUTE toggle, CLOSE button

### 6. Bottom
- Keyboard hint: "1-6 Focus | Esc Close"
- Pipeline progress bar at bottom

### 7. Audio
- Pipeline start arpeggio (retro chiptune)
- Step complete chime
- Cycle complete fanfare
- Agent click sound
- Ambient factory drone (subtle)

## What Needs UI/UX Improvement

### Priority 1 — Polish & Refinement
1. **HUD Bar**: Too sparse and text-heavy. Could use more game-like treatment with pixel icon indicators, colored bars, or a more compact layout.
2. **Agent popups**: Content feels cramped. The 440px max-width makes stat bars and department panels feel squeezed. Need better use of vertical space.
3. **Building roofs**: Simple CSS triangles — could be more pixel-perfect with proper sprite-based roofs.
4. **Animations**: Agent animations work but transitions between states (idle→working→done) could be smoother with more intermediate states.

### Priority 2 — Missing Features
5. **Kanban board display**: No visual indicator of the Kanban pipeline status. Would be great to show which agents have tasks queued.
6. **Pipeline timeline**: No way to see upcoming pipeline steps. A visual timeline at the bottom would help.
7. **Asset preview in agent popups**: When clicking Forge or Curator, should be able to see recent generated assets without going to Test Bench.
8. **Agent detail panel**: No way to see more stats about an agent (experience, specializations, mood).

### Priority 3 — Visual Upgrades
9. **More game-like polish**: Kairosoft games have charming pixel art UI elements — scrolls, parchment, wood panels, gem icons. Our UI is monospace-only and lacks texture.
10. **Responsive design**: The 3×3 grid works on desktop but doesn't adapt well to mobile. Agent names overlap on smaller screens.
11. **Better empty states**: Test Bench shows "No assets yet" with no visual charm. Kairosoft games make even empty screens fun.
12. **Color harmony**: Current palette is warm/gold-focused but lacks contrast in some areas (text on dark backgrounds).

## Files to Modify
- `app/workstation/page.tsx` — Main workstation component (~1500 lines)
- `app/workstation/kairosoft-theme.css` — Custom theme CSS (254 lines)
- Component files under `components/workstation/`:
  - `curator-panel.tsx` (Curator/Asset Library panel)
  - `scout-panel.tsx` (Scout/Wishlist panel)
  - `lister-panel.tsx` (Lister/Listing Drafts panel)
- `lib/factory-audio.ts` — Audio system

## Design Direction (Your Choice)
1. **Conservative**: Polish the existing Kairosoft theme — better spacing, consistent pixel sizing, refined gold borders
2. **Bold**: Go deeper into Kairosoft game UI — add scroll/wood textures, parchment backgrounds, gem icons, animated character portraits in popups
3. **Hybrid**: Keep current dungeon floor but upgrade popups to look like actual Kairosoft game windows with proper pixel art UI elements

## Current Screenshot
See `public/screenshots/current-workstation.png` for the current visual state.

## How to Work
1. First, read the actual source files to understand the component structure
2. Create a design prototype as a standalone HTML file in a new branch or as an exploration
3. Show 2-3 layout/polish variants for the agent popup window
4. Show a redesigned HUD bar concept
5. Once approved, implement changes in the actual repo files
