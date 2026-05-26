"""
Round 5 — Fix weak points from composite scene.
- TORCH v2: metal bands, ember sparks, stronger glow
- GRASS variants: 3 tiles (plain, flower patch, tall grass edge)
- KNIGHT WALK: 4-frame walk cycle
Then rebuild scene with everything.
"""
import sys, os, subprocess, importlib.util
from pathlib import Path

FORGE_PATH = Path(__file__).resolve().parent.parent / 'aseprite-forge.py'
spec = importlib.util.spec_from_file_location('forge', str(FORGE_PATH))
forge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forge)

ASEPRITE = forge.ASEPRITE; SCRIPTS_DIR = forge.SCRIPTS_DIR
OUT_DIR = Path(__file__).resolve().parent.parent / 'forge-output' / 'aseprite' / 'practice'
OUT_DIR.mkdir(parents=True, exist_ok=True)

_=-1; BK=0; DG=3; BR=4; EB=5; OW=7; DR=8; OG=9; YL=10; GN=11; BL=12
PK=14; PE=15; ST=16; MT=17; HL=18; VD=19; GH=20; MG=21; DW=22; WD=23; SH=24

S = 32

def bake(name, grid, w=None, h=None):
    if w is None: w = len(grid[0])
    if h is None: h = len(grid)
    script = forge.generate_pixel_art(name, w, h, grid, OUT_DIR)
    sp = SCRIPTS_DIR / f'_gen_r5_{name}.lua'
    sp.write_text(script)
    subprocess.run([str(ASEPRITE), '--batch', '--script', str(sp)],
                   capture_output=True, text=True, timeout=15)
    sp.unlink(missing_ok=True)
    out = OUT_DIR / f'{name}.png'
    return out if out.exists() else None

def empty(w=S, h=S):
    return [[-1]*w for _ in range(h)]

# ═══════════════════════════════════════════════
# 1. TORCH v2 — metal bands, ember sparks
# ═══════════════════════════════════════════════
def torch_v2(frame):
    g = empty()
    
    # Handle — wood with metal bands
    for y in range(20, 32):
        g[y][15] = DW
        g[y][16] = WD
        g[y][17] = DW
    # Metal bands
    for band_y in [22, 27]:
        for x in range(14, 19):
            g[band_y][x] = MT
        g[band_y][14] = HL; g[band_y][18] = HL  # rivets
    
    # Base plate
    for x in range(13, 20):
        g[30][x] = MT
        g[31][x] = MT
    g[30][13] = HL; g[30][19] = HL
    
    # Bracket — detailed metal
    for x in range(14, 19):
        g[19][x] = MT if (x%2==0) else HL
        g[20][x] = MT
    
    # Flame — dynamic flicker
    fh = [12, 14, 10, 16][frame]  # varied heights
    fw = [4, 3, 5, 4][frame]
    
    for y in range(19-fh, 20):
        prog = (19-y)/fh  # 0 at base, 1 at tip
        row_w = max(1, int(fw * (1 - prog*0.8)))
        cx = 16
        # Flame sway
        sway = [0, -1, 1, -1][frame]
        for x in range(cx+sway-row_w, cx+sway+row_w+1):
            if 0<=x<S and 0<=y<S and g[y][x]==-1:
                if prog < 0.3:   g[y][x] = YL  # base yellow
                elif prog < 0.55: g[y][x] = OG if (x+y+frame)%3!=0 else YL  # mid orange
                elif prog < 0.8:  g[y][x] = OG  # upper orange
                else:             g[y][x] = DR if (x+y+frame)%2==0 else OG  # tip red
    
    # Flame tip — bright white hotspot
    tip_y = 19 - fh
    g[tip_y][16+sway] = YL
    g[tip_y-1][16+sway] = OW
    
    # Ember sparks (2-3 per frame)
    sparks = [
        [(15, tip_y-3), (18, tip_y-2)],
        [(14, tip_y-4), (17, tip_y-2), (16, tip_y-5)],
        [(16, tip_y-3), (19, tip_y-3)],
        [(15, tip_y-4), (18, tip_y-5), (17, tip_y-3)],
    ][frame]
    for sx, sy in sparks:
        if 0<=sx<S and 0<=sy<S and g[sy][sx]==-1:
            g[sy][sx] = OG if (sx+sy)%2==0 else YL
    
    # Bracket glow
    for x in range(14, 19):
        if g[18][x] == -1: g[18][x] = OG if (x+frame)%3!=0 else MT
        if g[17][x] == -1: g[17][x] = OG if (x+frame)%3==0 else _
    
    return g

# ═══════════════════════════════════════════════
# 2. GRASS VARIANTS — 3 different 16×16 tiles
# ═══════════════════════════════════════════════
GRASS_PLAIN = [
    [GN,MG,GN,MG,GN,MG,GN,GN,MG,GN,MG,GN,GN,MG,GN,MG],
    [MG,GN,GN,MG,GN,MG,GN,GN,MG,GN,MG,GN,GN,MG,GN,GN],
    [GN,GN,GN,MG,MG,GN,GN,MG,GN,GN,MG,GN,GN,MG,GN,MG],
    [GN,MG,GN,GN,GN,MG,GN,MG,GN,MG,GN,GN,MG,GN,MG,GN],
    [MG,GN,GN,MG,GN,GN,MG,GN,GN,GN,MG,GN,GN,MG,GN,GN],
    [BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR],
    [BR,EB,BR,EB,BR,EB,BR,BR,EB,BR,EB,BR,BR,EB,BR,EB],
    [EB,BR,BR,EB,BR,EB,BR,BR,EB,BR,EB,BR,BR,EB,BR,BR],
    [BR,BR,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,EB],
    [BR,EB,BR,BR,BR,EB,BR,EB,BR,EB,BR,BR,EB,BR,EB,BR],
    [EB,BR,BR,EB,BR,BR,EB,BR,BR,BR,EB,BR,BR,EB,BR,BR],
    [ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
    [ST,MT,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,MT,ST],
    [ST,ST,ST,MT,ST,ST,ST,MT,ST,ST,ST,MT,ST,ST,ST,ST],
    [ST,MT,ST,ST,ST,MT,ST,ST,ST,MT,ST,ST,ST,MT,ST,ST],
    [ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
]

GRASS_FLOWER = [
    [GN,MG,GN,MG,GN,GN,MG,GN,MG,GN,GN,PK,GN,MG,GN,MG],
    [MG,GN,GN,MG,GN,GN,MG,GN,GN,MG,PK,PK,PK,MG,GN,GN],
    [GN,GN,GN,MG,GN,MG,GN,MG,GN,PK,PK,PK,MG,GN,GN,MG],
    [GN,MG,GN,GN,MG,GN,MG,GN,GN,MG,PK,PK,PK,MG,GN,GN],
    [MG,GN,MG,GN,GN,MG,GN,GN,MG,GN,MG,PK,GN,GN,MG,GN],
    [BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR],
    [BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR],
    [EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB],
    [BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR],
    [BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR],
    [EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB],
    [ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
    [ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST],
    [ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST],
    [ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST],
    [ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
]

GRASS_TALL = [
    [GN,MG,GN,MG,GN,MG,DG,GN,MG,GN,MG,DG,GN,MG,GN,MG],
    [MG,DG,GN,MG,DG,GN,MG,GN,DG,MG,GN,MG,GN,DG,MG,GN],
    [DG,GN,DG,MG,GN,MG,DG,GN,MG,DG,GN,MG,GN,MG,DG,GN],
    [GN,DG,GN,MG,DG,GN,MG,DG,GN,MG,DG,GN,MG,GN,MG,DG],
    [MG,GN,MG,DG,GN,MG,GN,MG,DG,GN,MG,DG,GN,MG,GN,MG],
    [BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR,BR],
    [BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR],
    [EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB],
    [BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR],
    [BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR],
    [EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB,BR,BR,EB],
    [ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
    [ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST],
    [ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST],
    [ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST,MT,ST,ST,ST,ST],
    [ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST,ST],
]

# ═══════════════════════════════════════════════
# 3. KNIGHT WALK — 4-frame cycle
# ═══════════════════════════════════════════════
def knight_walk(frame):
    """4-frame walk cycle: 0=right leg forward, 1=passing, 2=left leg forward, 3=passing"""
    g = empty()
    
    # Leg positions per frame (knee x, knee y, foot x, foot y)
    # Left leg
    ll = [
        (13, 26, 11, 30),  # back
        (14, 25, 16, 30),  # passing
        (15, 24, 19, 30),  # forward
        (14, 25, 16, 30),  # passing
    ][frame]
    # Right leg
    rl = [
        (19, 24, 21, 30),  # forward
        (18, 25, 16, 30),  # passing
        (17, 26, 13, 30),  # back
        (18, 25, 16, 30),  # passing
    ][frame]
    
    bob = [0, 1, 0, 1][frame]  # body rises at passing
    
    # Shadow
    shadow_w = [8, 6, 8, 6][frame]
    for x in range(16-shadow_w, 16+shadow_w+1):
        if 0<=x<S: g[30][x] = SH if x%3!=0 else _
    
    # Draw left leg
    # Upper
    for y in range(24+bob, ll[1]+1):
        for x in range(13, 16):
            if g[y][x]==-1: g[y][x] = MT
    # Lower
    dx_step = 1 if ll[0] < ll[2] else -1
    cx = ll[0]
    for y in range(ll[1], ll[3]+1):
        cx = cx + (1 if ll[0] < ll[2] else -1) // 3
        for x in range(cx-1, cx+2):
            if 0<=x<S and g[y][x]==-1: g[y][x] = ST
    # Foot
    for x in range(ll[2]-2, ll[2]+3):
        if 0<=x<S and g[ll[3]][x]==-1: g[ll[3]][x] = ST
    
    # Draw right leg
    for y in range(24+bob, rl[1]+1):
        for x in range(18, 21):
            if g[y][x]==-1: g[y][x] = MT
    cx = rl[0]
    for y in range(rl[1], rl[3]+1):
        cx = cx + (1 if rl[0] < rl[2] else -1) // 3
        for x in range(cx-1, cx+2):
            if 0<=x<S and g[y][x]==-1: g[y][x] = ST
    for x in range(rl[2]-2, rl[2]+3):
        if 0<=x<S and g[rl[3]][x]==-1: g[rl[3]][x] = ST
    
    # Body
    for y in range(12+bob, 24+bob):
        bw = 5 if y < 16+bob else 6
        for x in range(16-bw, 16+bw+1):
            if g[y][x]==-1:
                g[y][x] = BL if (x+y)%4==0 else MT
    
    # Belt stays
    for x in range(13, 20):
        if g[20+bob][x] != -1: g[20+bob][x] = GH
    
    # Shoulders
    for sx in [12, 20]:
        for dy in range(-2, 1):
            for dx in range(-2, 3):
                px, py = sx+dx, 12+bob+dy
                if 0<=px<S and 0<=py<S and g[py][px]==-1: g[py][px] = HL
    
    # Head
    for y in range(6+bob, 13+bob):
        hw = 4 if y < 9+bob else 5
        for x in range(16-hw, 16+hw+1):
            if g[y][x]==-1: g[y][x] = MT
    
    # Visor
    for x in range(14, 19): g[9+bob][x] = BK
    for x in range(13, 20): g[10+bob][x] = BK
    g[9+bob][14] = OW; g[9+bob][17] = OW
    g[10+bob][14] = OW; g[10+bob][17] = OW
    
    # Crest
    g[5+bob][16] = GH; g[4+bob][16] = GH
    
    # Cape sway
    cape_sway = [0, 1, 0, -1][frame]
    for y in range(13+bob, 25+bob):
        cw = 2
        cx = 16 + cape_sway
        for x in range(cx-cw, cx+cw+1):
            if 0<=x<S and g[y][x]==-1: g[y][x] = DR
    
    return g

# ═══════════════════════════════════════════════
# Generate
# ═══════════════════════════════════════════════
print("🔥 ROUND 5 — Torch v2 + Grass variants + Knight walk\n")

from PIL import Image
all_frames = {}

# Grass variants (static)
for name, grid in [("grass_plain", GRASS_PLAIN), ("grass_flower", GRASS_FLOWER), ("grass_tall", GRASS_TALL)]:
    r = bake(name, grid, w=16, h=16)
    if r: print(f'  ✓ {name} (16×16)')

# Torch v2 (4 frames)
for f in range(4):
    g = torch_v2(f)
    r = bake(f'torch_v2_{f}', g)
    if r:
        all_frames.setdefault('torch_v2', []).append(r)
        print(f'  ✓ torch_v2_{f}')

# Knight walk (4 frames)
for f in range(4):
    g = knight_walk(f)
    r = bake(f'knight_walk_{f}', g)
    if r:
        all_frames.setdefault('knight_walk', []).append(r)
        print(f'  ✓ knight_walk_{f}')

# Build strips + GIFs
import shutil
cache = Path.home() / 'AppData' / 'Local' / 'hermes' / 'image_cache'

for name, paths in all_frames.items():
    frames = [Image.open(p) for p in paths]
    # GIF
    gif_path = OUT_DIR / f'{name}_anim.gif'
    frames_3x = [f.resize((f.width*3, f.height*3), Image.NEAREST) for f in frames]
    frames_3x[0].save(gif_path, save_all=True, append_images=frames_3x[1:],
                      duration=180, loop=0, disposal=2)
    shutil.copy(gif_path, cache / f'{name}_anim.gif')
    # Strip
    w, h = frames[0].size
    strip = Image.new('RGBA', (w*len(frames)+len(frames)*2, h), (40,40,50,255))
    x=0
    for f in frames:
        strip.paste(f, (x,0))
        x += w+2
    strip_path = OUT_DIR / f'{name}_strip.png'
    strip.save(strip_path, 'PNG')
    strip_big = strip.resize((strip.width*3, strip.height*3), Image.NEAREST)
    strip_big.save(cache / f'{name}_strip.png')
    print(f'  🎞 {name} — GIF + strip')

print(f'\n✅ Round 5 done! {3+sum(len(v) for v in all_frames.values())} assets generated.')
