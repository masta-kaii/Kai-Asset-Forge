"""Klawf 64x64 Pixel Grid Generator → Feeds into Aseprite Forge"""
import sys, os
sys.path.insert(0, r"C:\Users\khair\Kai-Asset-Forge")
import numpy as np

S = 64

# Color indices matching the forge PALETTE
# 0=outline,1=dk blue,2=dk purple,3=dk green,4=brown,5=dk earthy,6=lt brown,
# 7=off-white,8=dark red,9=orange,10=yellow,11=green,12=blue,13=purple,
# 14=pink,15=peach,16=dk stone,17=stone,18=lt stone,19=vdk brown,20=gold,
# 21=grass,22=dk wood,23=wood,24=shadow
OI, WH, OR, OL, OD = 0, 7, 9, 10, 8    # outline, white, orange, yellow(light), dark red
BG, BD, PU, GR, GD = 15, 6, 14, 11, 3   # peach/belly, lt brown, pink, green, dk green
MO, LG, SH = 19, 4, 24                    # vdk brown(mouth), brown(leg), shadow
CI, CO = 9, 8                             # claw inner(orange), claw outer(dk red)

def circle_mask(cx, cy, r):
    y, x = np.ogrid[:S, :S]
    return (x - cx)**2 + (y - cy)**2 <= r**2

def ellipse_mask(cx, cy, rx, ry):
    y, x = np.ogrid[:S, :S]
    return ((x - cx)**2) / rx**2 + ((y - cy)**2) / ry**2 <= 1

def rect_mask(x1, y1, x2, y2):
    m = np.zeros((S, S), dtype=bool)
    m[y1:y2, x1:x2] = True
    return m

def rrect_mask(x1, y1, x2, y2, r):
    m = np.zeros((S, S), dtype=bool)
    m[y1+r:y2-r, x1:x2] = True
    m[y1:y2, x1+r:x2-r] = True
    for cx, cy in [(x1+r, y1+r), (x2-r, y1+r), (x1+r, y2-r), (x2-r, y2-r)]:
        m |= circle_mask(cx, cy, r)
    return m

def front(frame):
    grid = np.full((S, S), -1, dtype=int)
    bob = frame * 2

    # Shadow
    grid |= np.where(ellipse_mask(S//2, S//2+4, 20, 4), SH, -1).astype(int)

    # Body shell (layered for 3D)
    grid = np.where(rrect_mask(10, 12-bob, S-10, S-18, 10) & (grid < 0), OL, grid)
    grid = np.where(circle_mask(S//2, 22-bob, 22) & (grid < 0), OR, grid)
    grid = np.where(ellipse_mask(S//2, 26-bob, 18, 16) & (grid < 0), BG, grid)
    grid = np.where(ellipse_mask(S//2, 28-bob, 14, 12) & (grid < 0), BD, grid)

    # Shell lines (segmentation)
    for sy in [20, 30, 40]:
        y = sy - bob
        grid[y, 16:S-16] = np.where(grid[y, 16:S-16] > 0, OD, -1)

    # Mouth
    mouth_y = 34 - bob
    grid[mouth_y:mouth_y+5, 20:S-20] = MO
    grid[mouth_y+2:mouth_y+3, 24:S-24] = OI

    # Eye stalks
    for ex in [18, 42]:
        grid[2:12, ex:ex+4] = OD
        eye_mask = circle_mask(ex+2, 8-bob//2, 6)
        grid = np.where(eye_mask & (grid < 0), WH, grid)
        grid = np.where(circle_mask(ex+4+(frame%2), 8-bob//2, 3) & (grid > -2), OI, grid)

    # Pink cheeks
    grid = np.where(circle_mask(12, 32-bob, 4) & (grid < 0), PU, grid)
    grid = np.where(circle_mask(S-12, 32-bob, 4) & (grid < 0), PU, grid)

    # Claws
    for cx, dr in [(6, -1), (S-6, 1)]:
        claw_mask = ellipse_mask(cx+dr*8, 20-bob, 10, 7)
        grid = np.where(claw_mask & (grid < 0), CO, grid)
        inner_mask = ellipse_mask(cx+dr*6, 20-bob, 6, 4)
        grid = np.where(inner_mask, CI, grid)
        # Pincer gap
        grid = np.where(rect_mask(cx+dr*3-1, 17-bob, cx+dr*4+1, 23-bob) & (grid > 0), OI, grid)

    # Legs (6 legs, 3 per side) — simple loop for reliability
    for side in [(16, 1), (S-24, -1)]:
        sx, dr = side
        for i in range(3):
            ly = 38 + i*7
            for lx in range(sx + i*2*dr, sx + i*2*dr + 10*dr, dr):
                if 0 <= lx < S and 0 <= ly < S and 0 <= ly+3 < S:
                    for dy in range(4):
                        if grid[ly+dy, lx] < 0:
                            grid[ly+dy, lx] = LG

    # Green leaf bits
    for gx in [8, 20, S-28, S-16]:
        grid = np.where(circle_mask(gx, S-10, 6) & (grid < 0), GD, grid)
        grid = np.where(circle_mask(gx+2, S-8, 4) & (grid < 0), GR, grid)

    # Outline pass: edge between colored and transparent
    outline = np.zeros((S, S), dtype=bool)
    for y in range(1, S-1):
        for x in range(1, S-1):
            if grid[y, x] >= 0:
                if np.any(grid[y-1:y+2, x-1:x+2] < 0):
                    outline[y, x] = True
    grid = np.where(outline & (grid < 0), OI, grid)

    return grid.tolist()

def side(frame, right=True):
    grid = np.full((S, S), -1, dtype=int)
    dr = 1 if right else -1

    # Shadow
    grid = np.where(ellipse_mask(S//2, S-5, 22, 3), SH, -1)

    # Shell
    grid = np.where(rrect_mask(12, 8, S-12, S-22, 12) & (grid < 0), OR, grid)
    grid = np.where(ellipse_mask(S//2, 28, 20, 22) & (grid < 0), OL, grid)

    # Shell lines
    for sy in [18, 28, 38]:
        grid[sy, 14:S-14] = np.where(grid[sy, 14:S-14] > 0, OD, -1)

    # Eye stalk
    esx = S-16 if right else 16
    grid[2:12, esx:esx+4] = OD
    grid = np.where(circle_mask(esx+2, 8-frame, 6) & (grid < 0), WH, grid)
    grid = np.where(circle_mask(esx+4+(frame%2), 8-frame, 3), OI, grid)

    # Mouth
    mx = S-20 if right else 20
    grid[30:34, mx:S-20 if right else mx+8:S-20] = MO

    # Legs (4 visible)
    for i in range(4):
        lx = 14 + i*2 if right else S-20 - i*2
        ly = 30 + i*8
        for lj in range(6):
            px = lx + dr*lj
            if 0 <= px < S and 0 <= ly+lj//2 < S:
                grid[ly+lj//2, px] = LG

    # Claw
    cx = S-12 if right else 12
    grid = np.where(ellipse_mask(cx-dr*4, 16, 10, 8) & (grid < 0), CO, grid)

    # Green bits
    for gx in [28, S-16]:
        grid = np.where(circle_mask(gx, S-8, 5) & (grid < 0), GR, grid)

    return grid.tolist()

def back(frame):
    grid = np.full((S, S), -1, dtype=int)
    grid = np.where(rrect_mask(8, 12, S-8, S-20, 14) & (grid < 0), OR, grid)
    grid = np.where(rrect_mask(14, 16, S-14, 24, 8) & (grid < 0), OL, grid)
    
    # Shell pattern
    for i in range(4):
        sy = 18 + i*12
        grid[sy, 12:S-12] = OD
    grid = np.where(ellipse_mask(S//2, S-5, 20, 3), SH, -1)

    # Legs from back
    for i in range(6):
        lx = 10 + i*7
        grid[S-20:S-14, lx:lx+4] = LG

    # Green bits
    for gx in [8, S-24]:
        grid = np.where(circle_mask(gx, S-8, 6) & (grid < 0), GR, grid)

    return grid.tolist()

# Generate all and save as forge-compatible K_CUSTOM
out_path = r"C:\Users\khair\Kai-Asset-Forge\forge-output\aseprite\k_custom_grids"
os.makedirs(out_path, exist_ok=True)

directions = [("front", front), ("left", lambda f: side(f, False)),
              ("right", lambda f: side(f, True)), ("back", back)]
frames = [0, 1, 2]

import json
all_grids = {}

for dn, dfn in directions:
    for f in frames:
        name = f"klawf_{dn}_{f}"
        grid = dfn(f)
        all_grids[name] = (S, S, grid)

# Save as a Python-compatible dict that can be copied into forge
with open(f"{out_path}/klawf_grids.py", "w") as f:
    f.write("# Auto-generated 64x64 Klawf pixel grids\n")
    f.write("KLAWF_64 = {\n")
    for name, (w, h, grid) in all_grids.items():
        f.write(f'    "{name}": ({w}, {h}, [\n')
        for row in grid:
            f.write(f"        {row},\n")
        f.write("    ]),\n")
    f.write("}\n")

print(f"Generated {len(all_grids)} grids at 64x64")
print(f"Saved to {out_path}/klawf_grids.py")
print(f"\nNow feeding into Aseprite forge...")

# Feed into the forge pipeline
from aseprite_forge import generate_pixel_art, SCRIPTS_DIR, ASEPRITE, PALETTE
import subprocess

gen_dir = r"C:\Users\khair\Kai-Asset-Forge\forge-output\aseprite\k_custom"
os.makedirs(gen_dir, exist_ok=True)

success = 0
for name, (w, h, grid) in all_grids.items():
    script = generate_pixel_art(name, w, h, grid, gen_dir)
    sp = SCRIPTS_DIR / f"_gen_{name}.lua"
    sp.write_text(script)
    result = subprocess.run(
        [str(ASEPRITE), "--batch", "--script", str(sp)],
        capture_output=True, text=True, timeout=15
    )
    sp.unlink(missing_ok=True)
    if (Path(gen_dir) / f"{name}.png").exists():
        success += 1
        print(f"  ✓ {name}")
    else:
        print(f"  ✗ {name}: {result.stderr.strip()[:80]}")

print(f"\n{success}/{len(all_grids)} sprites generated via Aseprite!")

from pathlib import Path

# Build sprite sheet
from PIL import Image
sheet = Image.new("RGBA", (S*3, S*4), (0,0,0,0))
for ri, dn in enumerate(["front", "left", "right", "back"]):
    for fi, f in enumerate(frames):
        sp = Image.open(f"{gen_dir}/klawf_{dn}_{f}.png")
        sheet.paste(sp, (fi*S, ri*S))

sheet_path = r"C:\Users\khair\AppData\Local\hermes\image_cache\klawf_spritesheet.png"
sheet.save(sheet_path)
print(f"Sprite sheet: {sheet_path}")
