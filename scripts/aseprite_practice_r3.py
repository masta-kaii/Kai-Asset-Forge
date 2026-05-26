"""
Round 3 — 32×32 animated game assets.
Knight idle (breathing), Slime bounce (squish-stretch), Torch flicker, Coin spin.
Each asset = 3-4 frames, compiled to sprite strip + animated GIF.
"""
import sys, os, subprocess, importlib.util
from pathlib import Path
import numpy as np

FORGE_PATH = Path(__file__).resolve().parent.parent / 'aseprite-forge.py'
spec = importlib.util.spec_from_file_location('forge', str(FORGE_PATH))
forge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forge)

ASEPRITE = forge.ASEPRITE; SCRIPTS_DIR = forge.SCRIPTS_DIR
OUT_DIR = Path(__file__).resolve().parent.parent / 'forge-output' / 'aseprite' / 'practice'
OUT_DIR.mkdir(parents=True, exist_ok=True)

_=-1; BK=0; DG=3; BR=4; EB=5; OW=7; DR=8; OG=9; YL=10; GN=11; BL=12
PK=14; PE=15; ST=16; MT=17; HL=18; VD=19; GH=20; MG=21; DW=22; WD=23; SH=24

S = 32  # canvas size

def bake(name, grid, w=None, h=None):
    """Render grid through Aseprite, return output path."""
    if w is None: w = len(grid[0])
    if h is None: h = len(grid)
    script = forge.generate_pixel_art(name, w, h, grid, OUT_DIR)
    sp = SCRIPTS_DIR / f'_gen_prac_{name}.lua'
    sp.write_text(script)
    subprocess.run([str(ASEPRITE), '--batch', '--script', str(sp)],
                   capture_output=True, text=True, timeout=15)
    sp.unlink(missing_ok=True)
    out = OUT_DIR / f'{name}.png'
    return out if out.exists() else None

def empty():
    return [[-1]*S for _ in range(S)]

# ═══════════════════════════════════════════════
# 1. KNIGHT IDLE — 3 frames: breathing bob + cape sway
# ═══════════════════════════════════════════════
def knight_idle(frame):
    g = empty()
    bob = [0, -1, 0][frame]  # subtle vertical bob
    cape_wave = [0, 1, 0][frame]  # cape sways slightly
    
    # Shadow
    for x in range(10, 23):
        g[30+bob][x] = SH if (x%3!=0) else _
    
    # Legs (grounded, slight stance)
    for lx in [12, 19]:
        for y in range(26+bob, 30+bob):
            for dx in range(-2, 3):
                px = lx + dx
                if 0 <= px < S and g[y][px] == -1:
                    g[y][px] = ST if (px+y)%2==0 else MT
    
    # Body / torso (armor)
    for y in range(14+bob, 26+bob):
        body_w = 6 if y < 19+bob else 5
        for x in range(16-body_w, 16+body_w+1):
            if 0 <= x < S and g[y][x] == -1:
                if y < 17+bob: g[y][x] = MT
                else: g[y][x] = BL if x%3==0 else MT
    
    # Belt
    for x in range(13, 20):
        if g[21+bob][x] == MT:
            g[21+bob][x] = GH
    for x in range(14, 19):
        g[20+bob][x] = GH
    
    # Shoulder pauldrons
    for sx in [12, 19]:
        for dy in range(-2, 1):
            for dx in range(-3, 4):
                px, py = sx+dx, 14+bob+dy
                if 0<=px<S and 0<=py<S and g[py][px]==-1:
                    g[py][px] = HL
    
    # Head / helmet
    for y in range(8+bob, 15+bob):
        hw = 4 if y < 11+bob else 5
        for x in range(16-hw, 16+hw+1):
            if g[y][x] == -1:
                g[y][x] = MT
    
    # Visor slit
    for x in range(14, 19):
        g[11+bob][x] = BK
    for x in range(13, 20):
        g[12+bob][x] = BK
    
    # Eyes (glow through visor)
    for x in [14, 17]:
        g[11+bob][x] = OW
        g[12+bob][x] = OW
    
    # Helmet crest
    for y in range(5+bob, 9+bob):
        for x in range(15, 18):
            if g[y][x] == -1:
                g[y][x] = GH if y==5+bob else MT
    g[4+bob][16] = GH
    
    # Cape (behind, sways)
    for y in range(15+bob, 27+bob):
        cw = [2, 3, 2][frame]  # cape width varies
        cx = 16 + cape_wave
        for x in range(cx-cw, cx+cw+1):
            if 0<=x<S and g[y][x]==-1:
                g[y][x] = DR if (x+y+cape_wave)%3==0 else DR
    # Cape bottom points
    for dx in [-2, 2]:
        g[27+bob][16+cape_wave+dx] = DR
    
    return g

# ═══════════════════════════════════════════════
# 2. SLIME BOUNCE — 3 frames: squish → stretch
# ═══════════════════════════════════════════════
def slime_bounce(frame):
    g = empty()
    # frame 0: squished (wide, flat)
    # frame 1: normal (round)
    # frame 2: stretched (tall, narrow)
    
    squish = [(0.85, 1.2, 0), (1.0, 1.0, -2), (1.15, 0.8, -4)][frame]
    sx, sy_scale, y_off = squish
    
    cx, cy = 16, 18 + y_off
    
    # Body — oval scaled by frame
    for y in range(S):
        for x in range(S):
            dx = (x - cx) / sx
            dy = (y - cy) * sy_scale
            if dx*dx + dy*dy < 72:  # radius²
                if g[y][x] == -1:
                    # Shading: top lighter, bottom darker
                    if dy < -5:     g[y][x] = MG
                    elif dy < -2:   g[y][x] = GN if (x+y)%3==0 else MG
                    elif dy < 3:    g[y][x] = GN
                    elif dy < 6:    g[y][x] = DG
                    else:           g[y][x] = DG
    
    # Eyes (big, white)
    eye_y = cy - 2
    for ex, side in [(-5, -1), (5, 1)]:
        for dy in range(-4, 5):
            for dx in range(-3, 4):
                if dx*dx + dy*dy <= 14:
                    px, py = int(cx + ex*(1/sx) + dx), eye_y + dy
                    if 0<=px<S and 0<=py<S:
                        g[py][px] = OW
        # Pupils
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                if dx*dx + dy*dy <= 3:
                    px, py = int(cx + ex*(1/sx) + dx), eye_y + dy
                    if 0<=px<S and 0<=py<S:
                        g[py][px] = BK
        # Catchlight
        g[eye_y-2][int(cx + ex*(1/sx) - 2)] = OW
    
    # Mouth (cute curve)
    mouth_y = cy + 3
    for dx in range(-3, 4):
        dy = 0 if abs(dx) < 2 else 1
        px = cx + dx
        if 0<=px<S and 0<=mouth_y+dy<S:
            g[mouth_y+dy][px] = BK
    
    # Bounce shadow
    shadow_y = 30
    shadow_w = [7, 5, 3][frame]
    for x in range(cx-shadow_w, cx+shadow_w+1):
        if 0<=x<S and 0<=shadow_y<S:
            g[shadow_y][x] = SH
    for x in range(cx-shadow_w+1, cx+shadow_w):
        if 0<=x<S:
            g[shadow_y-1][x] = SH
    
    return g

# ═══════════════════════════════════════════════
# 3. TORCH FLICKER — 3 frames: flame dance
# ═══════════════════════════════════════════════
def torch_flicker(frame):
    g = empty()
    
    # Torch handle (static)
    for y in range(20, 32):
        g[y][15] = DW
        g[y][16] = WD
        g[y][17] = DW
    
    # Base
    for x in range(13, 20):
        g[30][x] = DW
        g[31][x] = DW
    
    # Bracket
    for x in range(14, 19):
        g[19][x] = MT
        g[20][x] = MT
    
    # Flame — varies by frame
    flame_heights = [10, 12, 8]  # frame 1 = tallest
    flame_widths  = [4, 3, 5]    # frame 2 = widest
    
    fh = flame_heights[frame]
    fw = flame_widths[frame]
    
    for y in range(19-fh, 20):
        row_w = max(1, int(fw * (1 - (19-y)/fh)))  # narrower at top
        cx = 16
        for x in range(cx-row_w, cx+row_w+1):
            if 0<=x<S and 0<=y<S and g[y][x]==-1:
                if y > 19 - fh//3:
                    g[y][x] = YL  # base of flame yellow
                elif y > 19 - 2*fh//3:
                    g[y][x] = OG  # mid orange
                else:
                    g[y][x] = DR if (x+y+frame)%3==0 else OG  # tip red-orange with flicker
    
    # Flame tip spark
    tip_y = 19 - fh
    g[tip_y][16] = YL
    if frame == 1:
        g[tip_y-1][16] = YL
        g[tip_y-1][15] = OG
    
    # Glow on bracket
    for x in range(14, 19):
        if g[18][x] == MT:
            g[18][x] = OG if (x+frame)%2==0 else MT
    
    return g

# ═══════════════════════════════════════════════
# 4. COIN SPIN — 4 frames: width shrinks → flips
# ═══════════════════════════════════════════════
COIN_S = 24
def coin_spin(frame):
    g = [[-1]*COIN_S for _ in range(COIN_S)]
    cx, cy = 12, 12
    
    # Width shrinks for rotation illusion
    widths = [10, 6, 10, 6]  # full → edge → full (flipped) → edge
    rim_w = widths[frame]
    
    # Coin body (gold circle squished horizontally)
    for y in range(COIN_S):
        for x in range(COIN_S):
            dx = (x - cx) * (10 / max(1, rim_w))  # unstretch x
            dy = y - cy
            if dx*dx + dy*dy < 81:  # radius 9
                if g[y][x] == -1:
                    # Edge highlight
                    dist = dx*dx + dy*dy
                    if dist > 64:
                        g[y][x] = GH  # outer rim
                    elif dist > 49:
                        g[y][x] = YL  # inner band
                    else:
                        g[y][x] = GH if (x+y)%3==0 else YL  # face
    
    # Dollar sign on face (only visible on wide frames)
    if frame in [0, 2]:
        # $
        s_cx = 12
        for dy in [-2, 0, 2]:
            for dx in [-2, -1, 0, 1, 2]:
                px, py = s_cx+dx, cy+dy
                if 0<=px<COIN_S and 0<=py<COIN_S and g[py][px] != -1:
                    g[py][px] = OG if (dx+dy)%2==0 else GH
        # Vertical line
        for dy in [-4, -3, -1, 1, 3, 4]:
            px = s_cx
            if 0<=cy+dy<COIN_S and g[cy+dy][px] != -1:
                g[cy+dy][px] = OG
    
    return g

# ═══════════════════════════════════════════════
# Generate all
# ═══════════════════════════════════════════════
print("🎬 ROUND 3 — 32×32 Animated Assets\n")

from PIL import Image

# Generate all frames
all_frames = {}

# Knight idle
for f in range(3):
    name = f'knight_idle_{f}'
    g = knight_idle(f)
    r = bake(name, g)
    if r:
        all_frames.setdefault('knight', []).append(r)
        print(f'  ✓ knight_idle_{f}')

# Slime bounce
for f in range(3):
    name = f'slime_bounce_{f}'
    g = slime_bounce(f)
    r = bake(name, g)
    if r:
        all_frames.setdefault('slime', []).append(r)
        print(f'  ✓ slime_bounce_{f}')

# Torch flicker
for f in range(3):
    name = f'torch_flicker_{f}'
    g = torch_flicker(f)
    r = bake(name, g)
    if r:
        all_frames.setdefault('torch', []).append(r)
        print(f'  ✓ torch_flicker_{f}')

# Coin spin (4 frames)
for f in range(4):
    name = f'coin_spin_{f}'
    g = coin_spin(f)
    r = bake(name, g, w=COIN_S, h=COIN_S)
    if r:
        all_frames.setdefault('coin', []).append(r)
        print(f'  ✓ coin_spin_{f}')

# Build animated GIFs
print("\n🎞 Building animated GIFs...")
import shutil
cache = Path.home() / 'AppData' / 'Local' / 'hermes' / 'image_cache'

for asset_name, paths in all_frames.items():
    frames = [Image.open(p) for p in paths]
    gif_path = OUT_DIR / f'{asset_name}_anim.gif'
    # Scale 4x for visibility
    frames_4x = [f.resize((f.width*3, f.height*3), Image.NEAREST) for f in frames]
    frames_4x[0].save(
        gif_path, save_all=True, append_images=frames_4x[1:],
        duration=200, loop=0, disposal=2
    )
    cache_path = cache / f'{asset_name}_anim.gif'
    shutil.copy(gif_path, cache_path)
    print(f'  🎞 {asset_name}_anim.gif ({len(frames)} frames)')

# Build preview strip (all frames side by side)
for asset_name, paths in all_frames.items():
    frames = [Image.open(p) for p in paths]
    w, h = frames[0].size
    strip = Image.new('RGBA', (w*len(frames)+len(frames)*2, h), (40,40,50,255))
    x = 0
    for f in frames:
        strip.paste(f, (x, 0))
        x += w + 2
    strip_path = OUT_DIR / f'{asset_name}_strip.png'
    strip.save(strip_path, 'PNG')
    # Scale preview
    strip_big = strip.resize((strip.width*3, strip.height*3), Image.NEAREST)
    cache_path = cache / f'{asset_name}_strip.png'
    strip_big.save(cache_path, 'PNG')
    print(f'  📊 {asset_name}_strip.png')

print(f'\n✅ Round 3 done! {sum(len(v) for v in all_frames.values())} frames generated.')
