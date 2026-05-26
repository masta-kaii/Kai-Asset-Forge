"""
klawf_transform.py — Derive multi-direction animated Klawf sprites
from the hand-crafted 64×64 front-view grid.

Produces: 4 directions × 3 frames = 12 Aseprite-rendered PNGs + sprite sheet.
"""
import sys, os, subprocess, copy, importlib.util
from pathlib import Path
import numpy as np

# ── Load forge module ──────────────────────────────────────
FORGE_PATH = Path(__file__).resolve().parent.parent / 'aseprite-forge.py'
spec = importlib.util.spec_from_file_location('forge', str(FORGE_PATH))
forge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(forge)

ASEPRITE = forge.ASEPRITE
SCRIPTS_DIR = forge.SCRIPTS_DIR
OUTPUT_DIR = Path(__file__).resolve().parent.parent / 'forge-output' / 'aseprite' / 'k_custom'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Color constants (forge palette indices) ─────────────────
BK=0   # black / outline
DG=3   # dark green
BR=4   # brown
EB=5   # dark earthy  
OW=7   # off-white (eyes)
DR=8   # dark red
OG=9   # orange (body)
YL=10  # yellow (highlight)
GN=11  # green (foliage)
PK=14  # pink (cheeks)
PE=15  # peach/beige (belly)
SG=17  # stone gray
VD=19  # very dark brown (shadow)
GH=20  # gold highlight
DW=22  # dark wood
SH=24  # shadow

# ── Load the base grid ──────────────────────────────────────
base_grid_raw = forge.K_CUSTOM.get('klawf_crab_64')
if base_grid_raw is None:
    print("ERROR: klawf_crab_64 not found in K_CUSTOM")
    sys.exit(1)

_, _, grid_list = base_grid_raw
BASE = np.array(grid_list, dtype=int)  # 64x64, -1 = transparent


def render_through_aseprite(name, grid, out_dir):
    """Run a numpy grid through Aseprite's indexed palette + auto-outline."""
    script = forge.generate_pixel_art(name, 64, 64, grid.tolist(), out_dir)
    sp = SCRIPTS_DIR / f'_gen_{name}.lua'
    sp.write_text(script)
    result = subprocess.run(
        [str(ASEPRITE), '--batch', '--script', str(sp)],
        capture_output=True, text=True, timeout=20
    )
    sp.unlink(missing_ok=True)
    out = out_dir / f'{name}.png'
    if out.exists():
        print(f'  ✓ {name}.png ({out.stat().st_size} bytes)')
        return out
    else:
        print(f'  ✗ {name}: {result.stderr.strip()[:120]}')
        return None


def front_view(frame=0):
    """Front view with subtle bob animation."""
    g = BASE.copy()
    bob = frame  # 0, 1, 2 px vertical shift
    
    if bob > 0:
        # Shift everything up by `bob` pixels
        shifted = np.full((64, 64), -1, dtype=int)
        for y in range(64 - bob):
            shifted[y, :] = g[y + bob, :]
        # Add slight leg spread on frame 1
        if frame == 1:
            # Widen stance slightly
            pass
        g = shifted
    
    return g


def side_view(frame=0, right=True):
    """Side view — squish body, show legs in profile, claws to one side."""
    g = np.full((64, 64), -1, dtype=int)
    
    # ── Body (squished for profile, with shell segments) ──
    body_cx = 30 if right else 34
    body_top, body_bot = 10, 50
    
    # Shell segments — hand-crafted pattern
    # Top carapace arch
    shell_arch = [
        (body_cx, 10, 8),  # (center_x, y, half_width)
        (body_cx, 11, 10),
        (body_cx, 12, 12),
        (body_cx, 13, 13),
        (body_cx, 14, 14),
        (body_cx, 15, 14),
        (body_cx, 16, 15),
        (body_cx, 17, 15),
        (body_cx, 18, 15),
        (body_cx, 19, 14),
        (body_cx, 20, 14),
        (body_cx, 21, 13),
        (body_cx, 22, 13),
        (body_cx, 23, 12),
        (body_cx, 24, 12),
        (body_cx, 25, 11),
        (body_cx, 26, 11),
        (body_cx, 27, 10),
        (body_cx, 28, 10),
        (body_cx, 29, 9),
        (body_cx, 30, 9),
        (body_cx, 31, 9),
        (body_cx, 32, 8),
        (body_cx, 33, 8),
        (body_cx, 34, 7),
        (body_cx, 35, 7),
        (body_cx, 36, 6),
        (body_cx, 37, 6),
        (body_cx, 38, 5),
        (body_cx, 39, 5),
        (body_cx, 40, 4),
        (body_cx, 41, 4),
        (body_cx, 42, 3),
        (body_cx, 43, 3),
        (body_cx, 44, 2),
        (body_cx, 45, 2),
        (body_cx, 46, 1),
    ]
    
    # Draw shell with segment lines
    for cx, sy, hw in shell_arch:
        seg_num = (sy - 10) // 4  # which segment
        is_seam = ((sy - 10) % 4 == 0) and sy > 14
        
        for x in range(cx - hw, cx + hw + 1):
            if 0 <= x < 64 and g[sy, x] == -1:
                if is_seam and (abs(x - cx) < hw - 2):
                    g[sy, x] = DR  # dark seam line between segments
                elif sy < 16:
                    g[sy, x] = GH  # top highlight
                elif sy < 20:
                    g[sy, x] = YL  # upper body
                elif sy < 30:
                    g[sy, x] = OG  # mid body
                elif sy < 40:
                    g[sy, x] = OG
                else:
                    g[sy, x] = DR  # lower shadow
    
    # ── Underbelly stripe ──
    belly_x = body_cx - 2
    for y in range(25, 45):
        for bx in range(belly_x - 4, belly_x + 4):
            if 0 <= bx < 64 and g[y, bx] == OG:
                g[y, bx] = PE if (bx - (belly_x-3)) % 3 != 0 else OG
    
    # ── Mouth (dark line on side) ──
    mouth_x = body_cx - 2
    mouth_y = 22
    mouth_pattern = [
        (0, 0, BK), (1, 0, BK), (2, 0, BK),
        (-1, 1, BK), (0, 1, DR), (1, 1, DR), (2, 1, DR), (3, 1, BK),
        (-1, 2, BK), (0, 2, DR), (1, 2, DR), (2, 2, BK),
        (0, 3, BK), (1, 3, BK),
    ]
    for dx, dy, c in mouth_pattern:
        px, py = mouth_x + dx, mouth_y + dy
        if 0 <= px < 64 and 0 <= py < 64:
            g[py, px] = c
    
    # ── Eye stalk (thin, deliberate pixel) ──
    eye_x = body_cx + (9 if right else -9)
    eye_y = 5
    
    # Stalk — thin 2px line
    for y in range(2, 10):
        stalk_w = 1
        for x in range(eye_x - stalk_w, eye_x + stalk_w + 1):
            if 0 <= x < 64 and g[y, x] == -1:
                g[y, x] = OG
    # Stalk base wider
    for y in range(10, 14):
        stalk_w = 2
        for x in range(eye_x - stalk_w, eye_x + stalk_w + 1):
            if 0 <= x < 64 and g[y, x] == -1:
                g[y, x] = OG
    
    # Eye ball — white with black pupil + white catchlight
    eyeball_pattern = [
        # White sclera outline
        (-4, -2, OW), (-3, -2, OW), (-2, -2, OW), (-1, -2, OW), (0, -2, OW), (1, -2, OW), (2, -2, OW), (3, -2, OW), (4, -2, OW),
        (-5, -1, OW), (-4, -1, OW), (5, -1, OW), (4, -1, OW),
        (-5, 0, OW), (-4, 0, OW), (5, 0, OW), (4, 0, OW),
        (-5, 1, OW), (-4, 1, OW), (5, 1, OW), (4, 1, OW),
        (-4, 2, OW), (-3, 2, OW), (-2, 2, OW), (-1, 2, OW), (0, 2, OW), (1, 2, OW), (2, 2, OW), (3, 2, OW), (4, 2, OW),
        # Inner fill
        (-3, -1, OW), (-2, -1, OW), (-1, -1, OW), (0, -1, OW), (1, -1, OW), (2, -1, OW), (3, -1, OW),
        (-3, 0, OW), (-2, 0, OW), (-1, 0, OW), (0, 0, OW), (1, 0, OW), (2, 0, OW), (3, 0, OW),
        (-3, 1, OW), (-2, 1, OW), (-1, 1, OW), (0, 1, OW), (1, 1, OW), (2, 1, OW), (3, 1, OW),
        # Pupil (dark red center)
        (-1, -1, DR), (0, -1, DR), (1, -1, DR),
        (-2, 0, DR), (-1, 0, BK), (0, 0, BK), (1, 0, BK), (2, 0, DR),
        (-1, 1, DR), (0, 1, DR), (1, 1, DR),
        # Catchlight (white dot)
        (-1, -1, OW), (0, -1, OW),
    ]
    for dx, dy, c in eyeball_pattern:
        px, py = eye_x + dx, eye_y + dy
        if 0 <= px < 64 and 0 <= py < 64:
            g[py, px] = c
    
    # ── Pink cheek ──
    cheek_x = body_cx + (5 if right else -5)
    cheek_y = 20
    for dy in range(-2, 3):
        for dx in range(-3, 4):
            if dx*dx + dy*dy <= 8:
                px, py = cheek_x + dx, cheek_y + dy
                if 0 <= px < 64 and 0 <= py < 64 and g[py, px] != -1:
                    g[py, px] = PK
    
    # ── Claw (V-shaped pincer, hand-crafted pixel pattern) ──
    claw_x = body_cx + (13 if right else -13)
    claw_y = 28
    sign = 1 if right else -1
    
    # Arm — tapered, wider at body
    arm_start = body_cx + (8 * sign)
    for y in range(24, 34):
        arm_w = max(2, 7 - abs(y - 29))  # 7px wide at center, 2px at ends
        arm_cx = arm_start + (claw_x - arm_start) * (y - 24) // 10
        for x in range(arm_cx - arm_w, arm_cx + arm_w + 1):
            if 0 <= x < 64 and g[y, x] == -1:
                g[y, x] = OG
    
    # Claw base (palm) — hand-crafted V-shape
    claw_pattern = [
        #      x offset, y offset, color
        # Palm outline
        (-4, -5, DR), (-3, -5, DR), (-2, -5, DR), (0, -5, DR), (1, -5, DR), (2, -5, DR), (3, -5, DR),
        (-5, -4, DR), (-5, -3, DR), (-5, -2, DR), (-5, -1, DR), (-5, 0, DR),
        (5, -4, DR), (5, -3, DR), (5, -2, DR), (5, -1, DR), (5, 0, DR),
        (-4, 5, DR), (-3, 5, DR), (-2, 5, DR), (0, 5, DR), (1, 5, DR), (2, 5, DR), (3, 5, DR),
        (-5, 4, DR), (-5, 3, DR), (-5, 2, DR), (-5, 1, DR),
        (5, 4, DR), (5, 3, DR), (5, 2, DR), (5, 1, DR),
        # Palm fill
        (-3, -3, OG), (-2, -3, OG), (-1, -3, OG), (0, -3, OG), (1, -3, OG), (2, -3, OG),
        (-4, -2, DR), (-3, -2, OG), (-2, -2, OG), (-1, -2, OG), (0, -2, OG), (1, -2, OG), (2, -2, OG), (3, -2, OG), (4, -2, DR),
        (-4, -1, DR), (-3, -1, OG), (-2, -1, OG), (-1, -1, OG), (0, -1, OG), (1, -1, OG), (2, -1, OG), (3, -1, OG), (4, -1, DR),
        (-4, 0, DR), (-3, 0, OG), (-2, 0, OG), (-1, 0, OG), (0, 0, OG), (1, 0, OG), (2, 0, OG), (3, 0, OG), (4, 0, DR),
        (-4, 1, DR), (-3, 1, OG), (-2, 1, OG), (-1, 1, OG), (0, 1, OG), (1, 1, OG), (2, 1, OG), (3, 1, OG), (4, 1, DR),
        (-4, 2, DR), (-3, 2, OG), (-2, 2, OG), (-1, 2, OG), (0, 2, OG), (1, 2, OG), (2, 2, OG), (3, 2, OG), (4, 2, DR),
        (-3, 3, OG), (-2, 3, OG), (-1, 3, OG), (0, 3, OG), (1, 3, OG), (2, 3, OG),
        # Highlight
        (-2, -2, GH), (-1, -2, GH), (0, -2, GH), (1, -2, GH),
        (-2, -1, GH), (-1, -1, GH),
        # Top pincer (curved arc outward)
        (-4, -7, DR), (-3, -7, DR), (-2, -7, DR), (-1, -7, DR), (0, -7, DR),
        (-5, -6, DR), (-6, -6, DR), (-6, -5, DR), (-6, -4, DR),
        (-4, -6, DR), (-2, -6, DR), (0, -6, DR),
        (-5, -5, OG), (-3, -6, OG), (-1, -6, OG),
        # Bottom pincer (curved arc outward)
        (-4, 7, DR), (-3, 7, DR), (-2, 7, DR), (-1, 7, DR), (0, 7, DR),
        (-5, 6, DR), (-6, 6, DR), (-6, 5, DR), (-6, 4, DR),
        (-4, 6, DR), (-2, 6, DR), (0, 6, DR),
        (-5, 5, OG), (-3, 6, OG), (-1, 6, OG),
        # Pincer gap (open mouth of claw)
        (1, -6, SH), (2, -6, SH),
        (1, 6, SH), (2, 6, SH),
    ]
    for dx, dy, c in claw_pattern:
        # Flip only the outer pincer arcs; keep palm symmetric
        px = claw_x + (dx * sign if abs(dy) >= 4 else dx)
        py = claw_y + dy
        if 0 <= px < 64 and 0 <= py < 64 and g[py, px] == -1:
            g[py, px] = c
    
    # ── Legs (4 visible from side, jointed with claw tips — reference-accurate) ──
    leg_bases = [
        (body_cx - 8, 38, 5),   # (x, y, lower_length) — back leg
        (body_cx - 3, 40, 6),   # mid-back
        (body_cx + 3, 41, 6),   # mid-front
        (body_cx + 8, 39, 5),   # front leg
    ]
    leg_shift = frame * 2
    for i, (lx, ly, lower_len) in enumerate(leg_bases):
        sy = ly + leg_shift
        # Upper segment (short, thick — crab joint)
        for dy in range(0, 3):
            y = sy + dy
            mid_x = lx + dy
            for x in range(mid_x - 2, mid_x + 3):
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == -1:
                    g[y, x] = DW if dy < 2 else BR
        # Elbow/knee joint (dark articulation)
        knee_x = lx + 3
        knee_y = sy + 3
        for dy in range(0, 2):
            for dx in range(-2, 3):
                px, py = knee_x + dx, knee_y + dy
                if 0 <= px < 64 and 0 <= py < 64 and g[py, px] == -1:
                    g[py, px] = DR if abs(dx) > 1 else VD
        # Lower segment (longer, thinner, angled down)
        for dy in range(0, lower_len):
            y = knee_y + 2 + dy
            mid_x = knee_x + dy // 3
            for x in range(mid_x - 1, mid_x + 2):
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == -1:
                    g[y, x] = DW if dy % 2 == 0 else BR
        # Pointed claw tip (reference shows tapered leg ends)
        tip_y = knee_y + 2 + lower_len
        tip_x = knee_x + lower_len // 3
        g[tip_y, tip_x] = VD
        g[tip_y, tip_x-1] = BR
        g[tip_y, tip_x+1] = BR
    
    # ── Green foliage base ──
    for y in range(53, 62):
        for x in range(body_cx - 8, body_cx + 9):
            if 0 <= x < 64 and g[y, x] == -1:
                g[y, x] = GN if (x + y) % 3 != 0 else DG
    
    # ── Shadow ──
    for y in range(58, 64):
        for x in range(body_cx - 10, body_cx + 11):
            if 0 <= x < 64 and g[y, x] == -1:
                g[y, x] = SH
    
    return g


def back_view(frame=0):
    """Back view — prominent shell segments, textured, jointed legs from behind."""
    g = np.full((64, 64), -1, dtype=int)
    bob = frame
    cx, cy = 32, 28
    
    # ── Shell (big round, 1px segment lines — reference-accurate) ──
    for y in range(6, 52):
        for x in range(8, 56):
            dx = x - cx
            dy = (y - cy) * 0.85
            dist = np.sqrt(dx*dx + dy*dy)
            if dist < 17.5 and g[y, x] == -1:
                seg = (y + bob) % 10
                # 1px dark seam lines every 10 rows
                if seg == 0 or seg == 1:
                    g[y, x] = DR if dist < 15 else VD
                # Top highlight
                elif y < 14:
                    g[y, x] = GH
                elif y < 18:
                    g[y, x] = YL
                # Upper shell
                elif y < 24:
                    g[y, x] = OG
                # Mid shell with subtle texture
                elif y < 36:
                    g[y, x] = OG if (x + y) % 6 != 0 else DR
                # Lower shell
                elif y < 44:
                    g[y, x] = DR if (x + y) % 4 == 0 else OG
                else:
                    g[y, x] = VD if dist > 12 else DR
    
    # ── Shell texture spots (larger, more visible) ──
    import random
    random.seed(42)
    for _ in range(20):
        sx = cx + int((random.random() * 18) - 9)
        sy = 15 + int(random.random() * 28)
        spot_size = 2 if _ < 8 else 1
        for dy in range(-spot_size, spot_size+1):
            for dx in range(-spot_size, spot_size+1):
                if dx*dx + dy*dy <= spot_size*spot_size:
                    px, py = sx + dx, sy + dy
                    if 0 <= px < 64 and 0 <= py < 64 and g[py, px] in (OG, YL):
                        g[py, px] = SG if spot_size > 1 else DR
    
    # ── Legs from behind (jointed, multi-tone) ──
    leg_bases = [
        (18, 42, 2),   # (x, y, size) — back-left
        (25, 43, 2),   # mid-left
        (39, 43, 2),   # mid-right
        (46, 42, 2),   # back-right
    ]
    leg_shift = frame * 2
    for i, (lx, ly, sz) in enumerate(leg_bases):
        sy = ly + leg_shift
        # Upper segment (thicker)
        for dy in range(0, 5):
            y = sy + dy
            w = 2 if dy < 3 else 3
            for x in range(lx - w, lx + w + 1):
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == -1:
                    g[y, x] = DW if dy < 3 else BR
        # Knee (dark pixel)
        knee_y = sy + 5
        for dy in range(2):
            for dx in range(-2, 3):
                px, py = lx + dx, knee_y + dy
                if 0 <= px < 64 and 0 <= py < 64 and g[py, px] == -1:
                    g[py, px] = DR
        # Lower segment (thinner, angled)
        for dy in range(0, 7):
            y = knee_y + 2 + dy
            offset = dy // 3
            mid_x = lx + offset * (-1 if i < 2 else 1)
            for x in range(mid_x - 1, mid_x + 2):
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == -1:
                    g[y, x] = DW if dy % 2 == 0 else BR
        # Claw tip
        tip_y = knee_y + 9
        for dy in range(2):
            for dx in range(-1, 2):
                px, py = lx + dx, tip_y + dy
                if 0 <= px < 64 and 0 <= py < 64 and g[py, px] == -1:
                    g[py, px] = VD
    
    # ── Green foliage at base ──
    for y in range(50, 62):
        for x in range(cx - 10, cx + 11):
            if 0 <= x < 64 and g[y, x] == -1:
                g[y, x] = GN if (x + y) % 3 != 0 else DG
    
    # ── Shadow ──
    for y in range(56, 64):
        for x in range(cx - 14, cx + 15):
            if 0 <= x < 64 and g[y, x] == -1:
                g[y, x] = SH
    
    return g


def diagonal_view(frame=0, right=True):
    """Diagonal view — blend front and side."""
    gf = front_view(frame)
    gs = side_view(frame, right=right)
    g = np.where(gf != -1, gf, gs)  # Front features on top of side body
    return g


# ── Generate all 12 frames ──
print("🦀 Generating Klawf 4-direction × 3-frame sprite set...\n")

directions = {
    'front':  front_view,
    'side_r': lambda f: side_view(f, right=True),
    'back':   back_view,
    'side_l': lambda f: side_view(f, right=False),
}

generated = []

for dir_name, dir_func in directions.items():
    for frame in range(3):
        name = f'klawf_{dir_name}_{frame}'
        grid = dir_func(frame)
        result = render_through_aseprite(name, grid, OUTPUT_DIR)
        if result:
            generated.append(result)

print(f"\n✅ Generated {len(generated)}/12 frames\n")

# ── Compile sprite sheet ──
if len(generated) == 12:
    from PIL import Image
    sheet = Image.new('RGBA', (64*3, 64*4), (0, 0, 0, 0))
    
    dir_order = ['front', 'side_r', 'back', 'side_l']
    for di, dname in enumerate(dir_order):
        for fi in range(3):
            fname = OUTPUT_DIR / f'klawf_{dname}_{fi}.png'
            if fname.exists():
                img = Image.open(fname)
                sheet.paste(img, (fi * 64, di * 64))
    
    sheet_path = OUTPUT_DIR / 'klawf_spritesheet.png'
    sheet.save(sheet_path, 'PNG')
    print(f'📊 Sprite sheet saved: {sheet_path} ({sheet_path.stat().st_size} bytes)')
    
    # Copy to image cache for Telegram delivery
    import shutil
    cache_path = Path.home() / 'AppData' / 'Local' / 'hermes' / 'image_cache' / 'klawf_spritesheet_v2.png'
    shutil.copy(sheet_path, cache_path)
    print(f'📋 Copied to: {cache_path}')
else:
    print(f'⚠ Only {len(generated)}/12 frames — skipping sheet')
