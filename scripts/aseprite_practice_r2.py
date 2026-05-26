"""
Round 2 additions — fixes for weakest assets + new techniques.
Appended to aseprite_practice.py ROUND2 dict.
"""
import sys, os, subprocess, importlib.util
from pathlib import Path

FORGE_PATH = Path(__file__).resolve().parent.parent / 'aseprite-forge.py'
spec = importlib.util.spec_from_file_location('forge', str(FORGE_PATH))
forge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forge)

ASEPRITE = forge.ASEPRITE
SCRIPTS_DIR = forge.SCRIPTS_DIR
OUT_DIR = Path(__file__).resolve().parent.parent / 'forge-output' / 'aseprite' / 'practice'
OUT_DIR.mkdir(parents=True, exist_ok=True)

_  = -1
BK=0; DG=3; BR=4; EB=5; OW=7; DR=8; OG=9; YL=10; GN=11; BL=12
PK=14; PE=15; ST=16; MT=17; HL=18; VD=19; GH=20; MG=21; DW=22; WD=23; SH=24

def bake(name, grid):
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
# ROUND 2 — improved assets + new weapon
# ═══════════════════════════════════════════════════════

# 1. KNIGHT v2 (16×16) — proper armor: visor, pauldrons, shield, sword
KNIGHT_V2 = [
    [_, _, _, _, _, _,MT,MT,MT,MT, _, _, _, _, _, _],
    [_, _, _, _, _,MT,MT,MT,MT,MT,MT, _, _, _, _, _],
    [_, _, _, _,MT,MT,HL,HL,HL,HL,MT,MT, _, _, _, _],
    [_, _, _,MT,MT,HL,BK,BK,HL,HL,BK,BK,MT, _, _, _],
    [_, _, _,MT,HL,HL,OW,OW,OW,OW,HL,HL,MT, _, _, _],
    [_, _,MT,MT,MT,HL,OW,OW,OW,OW,HL,MT,MT,MT, _, _],
    [_, _,MT,GH,GH,MT,HL,OW,OW,HL,MT,MT,MT,MT, _, _],
    [_, _,MT,GH,GH,GH,MT,MT,MT,MT,MT,MT, _, _, _, _],
    [_, _, _,MT,GH,GH,BL,BL,BL,BL,MT, _, _, _, _, _],
    [_, _, _,MT,MT,BL,BL,BL,BL,BL,MT,MT, _, _, _, _],
    [_, _, _, _,MT,BL,ST,ST,ST,BL,MT, _, _, _, _, _],
    [_, _, _,MT,MT,MT,ST,ST,ST,MT,MT,MT, _, _, _, _],
    [_, _, _,MT,GH,YL,MT,MT,MT,MT,YL,MT, _, _, _, _],
    [_, _, _, _,MT,GH,MT,ST,ST,MT,YL,MT, _, _, _, _],
    [_, _, _, _, _,MT,ST,ST,ST,ST,MT, _, _, _, _, _],
    [_, _, _, _, _,MT,ST, _, _,ST,MT, _, _, _, _, _],
]

# 2. TREASURE CHEST v2 (16×16) — bold gold trim, lock, wood grain
CHEST_V2 = [
    [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    [_, _, _, _,WD,WD,WD,WD,WD,WD,WD,WD, _, _, _, _],
    [_, _, _,WD,WD,GH,GH,GH,GH,GH,GH,WD,WD, _, _, _],
    [_, _,WD,WD,GH,GH,GH,GH,GH,GH,GH,GH,WD,WD, _, _],
    [_,WD,WD,GH,GH,GH,GH,GH,GH,GH,GH,GH,GH,WD,WD, _],
    [_,WD,GH,GH,GH,GH,YL,YL,GH,GH,GH,GH,GH,GH,WD, _],
    [_,WD,DW,WD,WD,WD,WD,WD,WD,WD,WD,GH,GH,GH,WD, _],
    [_,WD,DW,GH,YL,GH,GH,GH,GH,GH,GH,GH,GH,GH,WD, _],
    [_,WD,DW,GH,GH,GH,YL,GH,GH,GH,GH,GH,GH,GH,WD, _],
    [WD,WD,DW,GH,GH,GH,GH,GH,GH,YL,GH,GH,GH,GH,WD,WD],
    [WD,WD,WD,DW,DW,DW,DW,DW,DW,DW,DW,GH,GH,WD,WD,WD],
    [WD,WD,GH,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,GH,WD,WD],
    [WD,GH,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,GH,WD],
    [WD,GH,WD,WD,GH,WD,WD,GH,WD,WD,WD,WD,WD,WD,GH,WD],
    [GH,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,WD,GH],
    [DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW,DW],
]

# 3. HP BAR v2 (32×12) — dithered gradient, bigger hearts
HP_BAR_V2 = [
    [BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK],
    [BK, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,BK],
    # Gradient: DR→DR→DR/VD dither→VD — 26 columns of health
    [BK,DR,DR,DR,DR,DR,DR,DR,DR,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,VD, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,DR,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,VD,VD, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,VD,VD,VD, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,VD,VD,VD,VD, _, _, _, _, _,BK],
    [BK,DR,DR,DR,DR,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,DR,VD,VD,VD,VD,VD,VD, _, _, _, _, _,BK],
    [BK, _, _,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR,DR, _, _, _, _, _,BK],
    [BK, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,BK],
    # Bigger hearts (BK outline + PK fill)
    [BK, _,BK,BK, _,BK, _,BK,BK, _,BK, _,BK,BK, _,BK, _,BK,BK, _,BK, _,BK,BK, _,BK,BK, _, _,BK],
    [BK, _,BK,PK,BK,BK,PK,BK,PK,BK,BK,PK,BK,PK,BK,BK,PK,BK,PK,BK,BK,PK,BK,PK,BK,PK,BK, _, _,BK],
    [BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK,BK],
]

# 4. SLIME v2 (16×16) — bounce shadow, highlight spots
SLIME_V2 = [
    [_, _, _, _, _,GN,GN,GN,GN, _, _, _, _, _, _, _],
    [_, _, _, _,GN,GN,MG,MG,GN,GN, _, _, _, _, _, _],
    [_, _, _,GN,GN,MG,MG,MG,MG,GN,GN, _, _, _, _, _],
    [_, _,GN,GN,MG,MG,MG,MG,MG,MG,GN,GN, _, _, _, _],
    [_,GN,GN,MG,MG,MG,MG,MG,MG,MG,MG,GN,GN, _, _, _],
    [_,GN,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,GN, _, _],
    [GN,GN,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,GN,GN, _],
    [GN,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,MG,GN, _],
    [_,GN,MG,MG,MG,OW,OW,OW,OW,MG,MG,MG,MG,GN, _, _],
    [_,GN,MG,MG,OW,BK,BK,OW,OW,BK,BK,OW,MG,GN, _, _],
    [_,_,GN,GN,OW,OW,OW,OW,OW,OW,OW,OW,GN,GN, _, _],
    [_,_,_,GN,GN,MG,MG,MG,MG,MG,MG,GN,GN, _, _, _],
    [_,_,_,_,GN,GN,MG,MG,MG,MG,GN,GN, _, _, _, _],
    [_,_,_,_,_,GN,GN,GN,GN,GN,GN, _, _, _, _, _],
    # Bounce shadow
    [_,_,_,_,_,SH,SH, _, _,SH,SH, _, _, _, _, _],
    [_,_,_,_,_, _,SH,SH,SH,SH, _, _, _, _, _, _],
]

# 5. SWORD (16×16) — new weapon asset
SWORD = [
    [_, _, _, _, _, _, _,HL,HL, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,HL,HL,HL,HL, _, _, _, _, _, _],
    [_, _, _, _, _,HL,HL,HL,HL,HL,HL, _, _, _, _, _],
    [_, _, _, _, _,HL,HL,HL,HL,HL,HL, _, _, _, _, _],
    [_, _, _, _, _,HL,HL,HL,HL,HL,HL, _, _, _, _, _],
    [_, _, _, _, _, _,HL,HL,HL,HL, _, _, _, _, _, _],
    [_, _, _, _, _, _,HL,HL,HL,HL, _, _, _, _, _, _],
    [_, _, _, _, _, _,HL,HL,HL,HL, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,HL,HL, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,MT,MT, _, _, _, _, _, _, _],
    [_, _, _, _, _, _, _,MT,MT, _, _, _, _, _, _, _],
    [_, _, _, _, _, _,MT,MT,MT,MT, _, _, _, _, _, _],
    [_, _, _, _, _, _,MT,MT,MT,MT, _, _, _, _, _, _],
    [_, _, _, _, _,MT,MT,MT,MT,MT,MT, _, _, _, _, _],
    [_, _, _, _, _, _,WD,WD,WD,WD, _, _, _, _, _, _],
    [_, _, _, _, _, _,WD,WD,WD,WD, _, _, _, _, _, _],
]

ROUND2 = [
    ("knight_v2", KNIGHT_V2),
    ("chest_v2", CHEST_V2),
    ("hp_bar_v2", HP_BAR_V2),
    ("slime_v2", SLIME_V2),
    ("sword", SWORD),
]

print("⚔️ ROUND 2 — 5 improved + new assets\n")

from PIL import Image
results = []
for name, grid in ROUND2:
    r = bake(name, grid)
    if r:
        results.append(r)

# Build montage
rows = []
for i in range(0, len(results), 3):
    row_imgs = []
    for j in range(3):
        idx = i + j
        if idx < len(results):
            img = Image.open(results[idx])
            w, h = img.size
            row_imgs.append(img.resize((w*4, h*4), Image.NEAREST))
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

preview = OUT_DIR / 'round2_preview.png'
montage.save(preview, 'PNG')
import shutil
cache = Path.home() / 'AppData' / 'Local' / 'hermes' / 'image_cache' / 'round2_preview.png'
shutil.copy(preview, cache)

print(f'\n📊 R2 Preview: {preview}')
print(f'✅ Round 2 done! {len(results)}/5 assets generated.')
