"""
aseprite_practice.py — Round 1: 6 diverse game assets, hand-crafted pixel grids.
Each round runs through Aseprite CLI for indexed palette + auto-outline.
Vision review between rounds drives improvements.
"""
import sys, os, subprocess, importlib.util
from pathlib import Path
import numpy as np

FORGE_PATH = Path(__file__).resolve().parent.parent / 'aseprite-forge.py'
spec = importlib.util.spec_from_file_location('forge', str(FORGE_PATH))
forge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forge)

ASEPRITE = forge.ASEPRITE
SCRIPTS_DIR = forge.SCRIPTS_DIR
OUT_DIR = Path(__file__).resolve().parent.parent / 'forge-output' / 'aseprite' / 'practice'
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Color shortcuts (forge palette)
_  = -1   # transparent
BK=0; D1=1; D2=2; DG=3; BR=4; EB=5; LB=6; OW=7
DR=8; OG=9; YL=10; GN=11; BL=12; PL=13; PK=14; PE=15
ST=16; MT=17; HL=18; VD=19; GH=20; MG=21; DW=22; WD=23; SH=24

def bake(name, grid):
    """Render a pixel grid through Aseprite and return the result path."""
    h, w = len(grid), len(grid[0])
    script = forge.generate_pixel_art(name, w, h, grid, OUT_DIR)
    sp = SCRIPTS_DIR / f'_gen_prac_{name}.lua'
    sp.write_text(script)
    result = subprocess.run(
        [str(ASEPRITE), '--batch', '--script', str(sp)],
        capture_output=True, text=True, timeout=15
    )
    sp.unlink(missing_ok=True)
    out = OUT_DIR / f'{name}.png'
    if out.exists():
        print(f'  ✓ {name} ({w}×{h}, {out.stat().st_size}B)')
        return out
    else:
        print(f'  ✗ {name}: {result.stderr.strip()[:100]}')
        return None

# ═══════════════════════════════════════════════════════
# ROUND 1 ASSETS — hand-crafted pixel grids
# ═══════════════════════════════════════════════════════

# 1. KNIGHT (16×16) — tiny hero character
KNIGHT = [
    [_, _, _, _, _, _, _,MT,MT, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,MT,MT,MT,MT, _, _, _, _, _, _],
    [_, _, _, _, _,MT,MT,MT,MT,MT,MT, _, _, _, _, _],
    [_, _, _, _,MT,MT,OW,OW,OW,OW,MT,MT, _, _, _, _],
    [_, _, _,MT,MT,OW,OW,OW,OW,OW,OW,MT,MT, _, _, _],
    [_, _, _,MT,OW,BK,BK,OW,OW,BK,BK,OW,MT, _, _, _],
    [_, _, _,MT,OW,OW,OW,OW,OW,OW,OW,OW,MT, _, _, _],
    [_, _, _,MT,OW,PK,OW,OW,OW,OW,PK,OW,MT, _, _, _],
    [_, _, _, _,MT,OW,OW,OW,OW,OW,OW,MT, _, _, _, _],
    [_, _, _, _, _,MT,MT,MT,MT,MT,MT, _, _, _, _, _],
    [_, _, _, _, _,MT,BL,BL,BL,BL,MT, _, _, _, _, _],
    [_, _, _, _,MT,MT,BL,BL,BL,BL,MT,MT, _, _, _, _],
    [_, _, _, _,MT,MT,ST,ST,ST,ST,MT,MT, _, _, _, _],
    [_, _, _, _,MT,ST,ST,ST,ST,ST,ST,MT, _, _, _, _],
    [_, _, _, _,MT,ST,ST,ST,ST,ST,ST,MT, _, _, _, _],
    [_, _, _, _, _,MT,ST, _, _,ST,MT, _, _, _, _, _],
]

# 2. TREASURE CHEST (16×16) — classic RPG prop
CHEST = [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _, _,WD,WD,WD,WD,WD,WD,WD, _, _, _, _],
    [_, _, _, _,WD,WD,GH,GH,GH,GH,GH,WD,WD, _, _, _],
    [_, _, _,WD,WD,GH,GH,GH,GH,GH,GH,GH,WD,WD, _, _],
    [_, _,WD,WD,GH,GH,GH,GH,GH,GH,GH,GH,GH,WD,WD, _],
    [_, _,WD,DW,DW,DW,DW,DW,GH,GH,GH,GH,GH,GH,WD, _],
    [_, _,WD,DW,GH,GH,GH,GH,GH,GH,GH,GH,GH,GH,WD, _],
    [_, _,WD,DW,GH,GH,GH,GH,GH,GH,GH,GH,GH,GH,WD, _],
    [_, _,WD,DW,GH,GH,GH,GH,GH,GH,GH,GH,GH,GH,WD, _],
    [_,WD,WD,DW,GH,GH,GH,GH,GH,GH,GH,GH,GH,GH,WD,WD],
    [_,WD,WD,WD,DW,DW,DW,DW,GH,GH,GH,GH,GH,WD,WD,WD],
    [WD,WD,DW,DW,WD,WD,WD,WD,WD,WD,WD,WD,WD,DW,DW,WD],
    [WD,WD,DW,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,DW,WD],
    [WD,DW,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,DW],
    [DW,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD],
    [DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW],
]

# 3. GRASS TILE (16×16) — platformer ground tile
GRASS_TILE = [
    [GN,MG,GN,MG,GN,MG,GN,MG,GN,MG,GN,MG,GN,MG,GN,MG],
    [MG,GN,MG,GN,MG,GN,MG,GN,MG,GN,MG,GN,MG,GN,MG,GN],
    [GN,MG,GN,GN,MG,GN,MG,GN,MG,GN,GN,MG,GN,MG,GN,MG],
    [MG,GN,GN,GN,MG,GN,MG,GN,MG,GN,GN,GN,MG,GN,MG,GN],
    [GN,GN,GN,GN,MG,MG,GN,GN,GN,MG,MG,GN,GN,GN,GN,MG],
    [BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR],
    [BR,EB,BR,EB,BR,EB,BR,EB,BR,EB,BR,EB,BR,EB,BR,EB],
    [EB,BR,EB,BR,EB,BR,EB,BR,EB,BR,EB,BR,EB,BR,EB,BR],
    [BR,EB,BR,BR,EB,BR,EB,BR,EB,BR,BR,EB,BR,EB,BR,EB],
    [EB,BR,BR,BR,EB,BR,EB,BR,EB,BR,BR,BR,EB,BR,EB,BR],
    [BR,BR,BR,BR,EB,EB,BR,BR,BR,EB,EB,BR,BR,BR,BR,EB],
    [EB,BR,EB,BR,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
    [BR,EB,BR,EB,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
    [EB,BR,EB,BR,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
    [BR,EB,BR,EB,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
    [ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
]

# 4. POTION BOTTLE (14×16) — RPG item
POTION = [
    [_, _, _, _, _,BL,BL,BL, _, _, _, _, _, _],
    [_, _, _, _,BL,BL,BL,BL,BL, _, _, _, _, _],
    [_, _, _, _,BL,HL,HL,HL,BL, _, _, _, _, _],
    [_, _, _, _,BL,BL,BL,BL,BL, _, _, _, _, _],
    [_, _, _, _, _,BL,BL,BL, _, _, _, _, _, _],
    [_, _, _, _,BL,BL,DR,BL,BL, _, _, _, _, _],
    [_, _, _,BL,BL,DR,DR,DR,BL,BL, _, _, _, _],
    [_, _,BL,BL,DR,DR,DR,DR,DR,BL,BL, _, _, _],
    [_, _,BL,DR,DR,DR,DR,DR,DR,DR,BL, _, _, _],
    [_, _,BL,DR,DR,DR,DR,DR,DR,DR,BL, _, _, _],
    [_, _,BL,DR,DR,PK,PK,PK,DR,DR,BL, _, _, _],
    [_, _,BL,DR,DR,PK,PK,PK,DR,DR,BL, _, _, _],
    [_, _,BL,DR,DR,DR,DR,DR,DR,DR,BL, _, _, _],
    [_, _, _,BL,DR,DR,DR,DR,DR,BL, _, _, _, _],
    [_, _, _, _,BL,BL,BL,BL,BL, _, _, _, _, _],
    [_, _, _, _, _,SH,SH,SH, _, _, _, _, _, _],
]

# 5. SLIME ENEMY (16×16) — bouncy blob
SLIME = [
    [_, _, _, _, _,GN,GN,GN,GN, _, _, _, _, _, _, _],
    [_, _, _, _,GN,GN,GN,GN,GN,GN, _, _, _, _, _, _],
    [_, _, _,GN,GN,MG,MG,MG,MG,GN,GN, _, _, _, _, _],
    [_, _,GN,GN,MG,MG,MG,MG,MG,MG,GN,GN, _, _, _, _],
    [_,GN,GN,MG,MG,MG,MG,MG,MG,MG,MG,GN,GN, _, _, _],
    [_,GN,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,GN, _, _, _],
    [GN,GN,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,GN,GN, _, _],
    [GN,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,GN, _, _],
    [_,GN,MG,MG,MG,OW,OW,OW,OW,MG,MG,MG,GN, _, _, _],
    [_,GN,MG,MG,OW,BK,BK,OW,OW,BK,BK,OW,GN, _, _, _],
    [_,_,GN,GN,OW,OW,OW,OW,OW,OW,OW,OW,GN, _, _, _],
    [_,_,_,GN,GN,MG,MG,MG,MG,MG,MG,GN,GN, _, _, _],
    [_,_,_,_,GN,GN,MG,MG,MG,MG,GN,GN, _, _, _, _],
    [_,_,_,_,_,GN,GN,GN,GN,GN,GN, _, _, _, _, _],
    [_,_,_,_,_,_,SH,SH,SH,SH, _, _, _, _, _, _],
    [_,_,_,_,_,_,SH,SH,SH,SH, _, _, _, _, _, _],
]

# 6. HEALTH BAR UI (32×12) — game HUD element
HP_BAR = [
    [BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK],
    [BK, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR, _, _, _, _, _,BK],
    [BK, _, _,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR, _, _, _, _, _,BK],
    [BK, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,BK],
    [BK, _, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _, _, _, _,BK],
    [BK, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _,BK,BK,BK,GN, _,BK, _, _, _,BK],
    [BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK],
]

ROUND1 = [
    ("knight", KNIGHT),
    ("treasure_chest", CHEST),
    ("grass_tile", GRASS_TILE),
    ("potion", POTION),
    ("slime_enemy", SLIME),
    ("hp_bar", HP_BAR),
]

print("🎮 ROUND 1 — 6 Game Assets\n")
results = []
for name, grid in ROUND1:
    r = bake(name, grid)
    if r:
        results.append(r)

# Build preview montage
if results:
    from PIL import Image
    # Scale 4x for visibility
    rows = []
    for i in range(0, len(results), 3):
        row_imgs = []
        for j in range(3):
            idx = i + j
            if idx < len(results):
                img = Image.open(results[idx]).resize(
                    (results[idx].stat().st_size and 64, 64),
                    Image.NEAREST
                )
                # Actually use the real dimensions scaled 4x
                img = Image.open(results[idx])
                w, h = img.size
                img = img.resize((w*4, h*4), Image.NEAREST)
                row_imgs.append(img)
        if row_imgs:
            row_w = sum(im.width for im in row_imgs) + (len(row_imgs)-1)*4
            row_h = max(im.height for im in row_imgs)
            row_img = Image.new('RGBA', (row_w, row_h), (0,0,0,0))
            x = 0
            for im in row_imgs:
                row_img.paste(im, (x, 0))
                x += im.width + 4
            rows.append(row_img)
    
    total_h = sum(r.height for r in rows) + (len(rows)-1)*4
    total_w = max(r.width for r in rows)
    montage = Image.new('RGBA', (total_w, total_h), (40,40,50,255))
    y = 0
    for row_img in rows:
        montage.paste(row_img, (0, y))
        y += row_img.height + 4
    
    preview_path = OUT_DIR / 'round1_preview.png'
    montage.save(preview_path, 'PNG')
    
    # Copy to cache
    import shutil
    cache = Path.home() / 'AppData' / 'Local' / 'hermes' / 'image_cache' / 'round1_preview.png'
    shutil.copy(preview_path, cache)
    print(f'\n📊 Preview: {preview_path}')
    print(f'📋 Cached: {cache}')

print(f'\n✅ Round 1 done! {len(results)}/6 assets generated.')
