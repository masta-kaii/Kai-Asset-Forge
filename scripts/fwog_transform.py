"""
fwog_transform.py v2 — Derive multi-direction animated Fwog sprites
Reference-accurate: pure black circle eyes, short arms, long dangling legs, 
pink oval mouth, simple clean green body — matching the OG meme.

Produces: 4 directions × 3 frames = 12 Aseprite-rendered PNGs + sprite sheet.
"""
import sys, os, subprocess, importlib.util
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
GN=11  # green (body)
LGN=21 # light grass green (highlight)
SG=12  # dark green (shade)
PK=14  # pink (mouth)
OW=7   # off-white (eye catchlight)
SH=24  # shadow
VD=19  # very dark
TRANSPARENT = -1

# Bright medium green for Fwog — matches reference
FWG_GREEN = GN
FWG_LIGHT = LGN
FWG_SHADE = SG
FWG_DARK = DG


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


def fwog_front_base():
    """Reference-accurate Fwog front view.
    
    Key features from reference:
    - Simple round green body, bright medium green
    - Two PERFECT BLACK CIRCLES for eyes
    - White catchlights at TOP-LEFT of each eye
    - Small pink horizontal oval mouth
    - Short thin arms, long thin dangling legs
    - NO belly/chest detail, NO cheeks, NO eyebrows
    """
    g = np.full((64, 64), TRANSPARENT, dtype=int)
    cx, cy = 32, 30  # body center
    
    # ── SHADOW ──
    for dy in range(-2, 5):
        for dx in range(-12, 13):
            x, y = cx + dx, 56 + dy
            if 0 <= x < 64 and 0 <= y < 64:
                if abs(dx) + abs(dy * 2) < 12:
                    g[y, x] = SH
    
    # ── BODY (simple round, clean edges) ──
    body_rx, body_ry = 14, 15
    for y in range(8, 52):
        for x in range(8, 56):
            dx = (x - cx) / body_rx
            dy = (y - cy) / body_ry
            dist = np.sqrt(dx*dx + dy*dy)
            if dist < 1.0:
                # Top highlight (light green)
                if y < 20:
                    g[y, x] = FWG_LIGHT
                # Upper body (main green)
                elif y < 35:
                    g[y, x] = FWG_GREEN
                # Lower body (slightly darker)
                elif y < 44:
                    g[y, x] = FWG_GREEN if (x + y) % 4 != 0 else FWG_SHADE
                # Bottom edge
                else:
                    g[y, x] = FWG_SHADE if (x + y) % 3 != 0 else FWG_DARK
    
    # ── EYES — Perfect black circles, BIG ──
    eye_positions = [(cx-9, 18), (cx+9, 18)]  # left, right
    eye_radius = 6  # big black circles
    
    for ex, ey in eye_positions:
        for dy in range(-eye_radius, eye_radius+1):
            for dx in range(-eye_radius, eye_radius+1):
                dist = np.sqrt(dx*dx + dy*dy)
                if dist < eye_radius:
                    px, py = ex + dx, ey + dy
                    if 0 <= px < 64 and 0 <= py < 64:
                        g[py, px] = BK
        
        # Catchlight — white 2×2 dot at TOP-LEFT of eye
        clx, cly = ex - 3, ey - 3
        for dy in range(2):
            for dx in range(2):
                px, py = clx + dx, cly + dy
                if 0 <= px < 64 and 0 <= py < 64:
                    g[py, px] = OW
    
    # ── MOUTH — Small pink horizontal oval ──
    mouth_y = 33
    # Pink oval mouth
    for dy in range(-2, 3):
        mouth_hw = int(4 * np.sqrt(1 - (dy/3)**2)) if abs(dy) < 3 else 0
        for dx in range(-mouth_hw, mouth_hw+1):
            px, py = cx + dx, mouth_y + dy
            if 0 <= px < 64 and 0 <= py < 64:
                if abs(dy) >= 2 or abs(dx) >= mouth_hw - 1:
                    g[py, px] = BK  # outline
                else:
                    g[py, px] = PK  # pink fill
    
    # ── ARMS — Short, thin, dangling from sides ──
    for side, sign in [(-1, -1), (1, 1)]:
        arm_x = cx + sign * (body_rx - 1)  # at body edge
        arm_top = cy + 3
        
        # Arm — thin 3px wide, hangs down ~14px
        for dy in range(14):
            y = arm_top + dy
            # Slight outward curve
            offset = int(dy * 0.3) * sign
            for dx in range(-1, 2):
                x = arm_x + offset + dx
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == TRANSPARENT:
                    g[y, x] = FWG_GREEN if dy % 3 != 0 else FWG_SHADE
        
        # Hand/fingers — tiny nubs at end
        hand_y = arm_top + 14
        hand_x = arm_x + int(14 * 0.3) * sign
        for dx in range(-2, 3):
            x = hand_x + dx
            if 0 <= x < 64 and 0 <= hand_y < 64:
                g[hand_y, x] = FWG_GREEN
    
    # ── LEGS — LONG, thin, dangling well below body ──
    for side, sign in [(-1, -1), (1, 1)]:
        leg_x = cx + sign * 6  # inside body edge
        leg_top = cy + 12  # start below body center
        
        # Leg — thin 3px wide, hangs down LONG (~22px)
        for dy in range(22):
            y = leg_top + dy
            for dx in range(-1, 2):
                x = leg_x + dx
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == TRANSPARENT:
                    g[y, x] = FWG_GREEN if dy % 4 != 0 else FWG_SHADE
        
        # Foot — small horizontal bar at bottom
        foot_y = leg_top + 22
        for dx in range(-3, 4):
            x = leg_x + dx
            if 0 <= x < 64 and 0 <= foot_y < 64:
                g[foot_y, x] = FWG_DARK if abs(dx) > 2 else FWG_GREEN
    
    # Clean up outline — Aseprite's auto-outline will handle this
    return g


def front_view(frame=0):
    """Front view with subtle idle animation."""
    g = fwog_front_base()
    # Slight bob
    if frame > 0:
        bob = frame
        shifted = np.full((64, 64), TRANSPARENT, dtype=int)
        for y in range(64 - bob):
            shifted[y, :] = g[y + bob, :]
        g = shifted
    
    # On frame 1, arms sway slightly
    # (subtle enough that we handle via leg shift instead)
    return g


def side_view(frame=0, right=True):
    """Side view — profile, one big eye visible, limbs in profile."""
    g = np.full((64, 64), TRANSPARENT, dtype=int)
    sign = 1 if right else -1
    body_cx = 26 if right else 38
    body_cy = 30
    body_rx, body_ry = 10, 14
    
    # ── Shadow ──
    for dy in range(-2, 5):
        for dx in range(-10, 11):
            sx, sy = body_cx + dx, 56 + dy
            if 0 <= sx < 64 and 0 <= sy < 64:
                if abs(dx) + abs(dy * 2) < 10:
                    g[sy, sx] = SH
    
    # ── Body (slightly squished for profile) ──
    for y in range(10, 50):
        for x in range(body_cx - body_rx - 2, body_cx + body_rx + 3):
            dx = (x - body_cx) / body_rx
            dy = (y - body_cy) / body_ry
            dist = np.sqrt(dx*dx + dy*dy)
            if dist < 1.0 and 0 <= x < 64:
                if y < 20:
                    g[y, x] = FWG_LIGHT
                elif y < 35:
                    g[y, x] = FWG_GREEN
                elif y < 44:
                    g[y, x] = FWG_GREEN if (x + y) % 4 != 0 else FWG_SHADE
                else:
                    g[y, x] = FWG_SHADE
    
    # ── Eye — One big black circle visible from side ──
    eye_x = body_cx + sign * 2
    eye_y = 19
    eye_r = 5
    for dy in range(-eye_r, eye_r+1):
        for dx in range(-eye_r, eye_r+1):
            dist = np.sqrt(dx*dx + dy*dy)
            if dist < eye_r:
                px, py = eye_x + dx, eye_y + dy
                if 0 <= px < 64 and 0 <= py < 64:
                    g[py, px] = BK
    # Catchlight top-left
    clx, cly = eye_x - 2, eye_y - 2
    for dy in range(2):
        for dx in range(2):
            px, py = clx + dx, cly + dy
            if 0 <= px < 64 and 0 <= py < 64:
                g[py, px] = OW
    
    # ── Mouth (side profile — small pink curve) ──
    mouth_x = body_cx + sign * 4
    mouth_y = 34
    for dy in range(-1, 2):
        g[mouth_y + dy, mouth_x] = BK
    g[mouth_y, mouth_x + sign] = PK
    g[mouth_y, mouth_x + sign*2] = BK
    
    # ── Arm (visible from side, thin, dangling) ──
    arm_x = body_cx + sign * (body_rx + 1)
    arm_top = body_cy + 1
    for dy in range(13):
        y = arm_top + dy
        for dx in range(-1, 2):
            x = arm_x + dx
            if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == TRANSPARENT:
                g[y, x] = FWG_GREEN if dy % 3 != 0 else FWG_SHADE
    
    # ── Leg (long, thin, in profile) ──
    leg_x = body_cx + sign * 2
    leg_top = body_cy + 10
    for dy in range(20):
        y = leg_top + dy
        for dx in range(-1, 2):
            x = leg_x + dx
            if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == TRANSPARENT:
                g[y, x] = FWG_GREEN if dy % 4 != 0 else FWG_SHADE
    
    # Foot
    foot_y = leg_top + 20
    for dx in range(-2, 3):
        x = leg_x + dx
        if 0 <= x < 64 and 0 <= foot_y < 64:
            g[foot_y, x] = FWG_DARK if abs(dx) > 1 else FWG_GREEN
    
    return g


def back_view(frame=0):
    """Back view — all green body, no face, arms/legs from behind."""
    g = np.full((64, 64), TRANSPARENT, dtype=int)
    cx, cy = 32, 30
    body_rx, body_ry = 14, 15
    
    # ── Shadow ──
    for dy in range(-2, 5):
        for dx in range(-12, 13):
            sx, sy = cx + dx, 56 + dy
            if 0 <= sx < 64 and 0 <= sy < 64:
                if abs(dx) + abs(dy * 2) < 12:
                    g[sy, sx] = SH
    
    # ── Body (green, slightly darker overall) ──
    for y in range(8, 52):
        for x in range(8, 56):
            dx = (x - cx) / body_rx
            dy = (y - cy) / body_ry
            dist = np.sqrt(dx*dx + dy*dy)
            if dist < 1.0 and 0 <= x < 64:
                if y < 22:
                    g[y, x] = FWG_LIGHT
                elif y < 38:
                    g[y, x] = FWG_GREEN if (x + y) % 5 != 0 else FWG_SHADE
                else:
                    g[y, x] = FWG_SHADE
    
    # ── Arms from behind ──
    for side, sign in [(-1, -1), (1, 1)]:
        arm_x = cx + sign * (body_rx - 1)
        arm_top = cy + 3
        for dy in range(14):
            y = arm_top + dy
            offset = int(dy * 0.3) * sign
            for dx in range(-1, 2):
                x = arm_x + offset + dx
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == TRANSPARENT:
                    g[y, x] = FWG_SHADE if dy % 3 != 0 else FWG_DARK
    
    # ── Legs from behind ──
    for side, sign in [(-1, -1), (1, 1)]:
        leg_x = cx + sign * 6
        leg_top = cy + 12
        for dy in range(22):
            y = leg_top + dy
            for dx in range(-1, 2):
                x = leg_x + dx
                if 0 <= x < 64 and 0 <= y < 64 and g[y, x] == TRANSPARENT:
                    g[y, x] = FWG_SHADE if dy % 4 != 0 else FWG_DARK
    
    return g


# ── Generate all 12 frames ──
print("🐸 Generating Fwog v2 4-direction × 3-frame sprite set...\n")

directions = {
    'front':  front_view,
    'side_r': lambda f: side_view(f, right=True),
    'back':   back_view,
    'side_l': lambda f: side_view(f, right=False),
}

generated = []

for dir_name, dir_func in directions.items():
    for frame in range(3):
        name = f'fwog_{dir_name}_{frame}'
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
            fname = OUTPUT_DIR / f'fwog_{dname}_{fi}.png'
            if fname.exists():
                img = Image.open(fname)
                sheet.paste(img, (fi * 64, di * 64))
    
    sheet_path = OUTPUT_DIR / 'fwog_spritesheet.png'
    sheet.save(sheet_path, 'PNG')
    print(f'📊 Sprite sheet saved: {sheet_path} ({sheet_path.stat().st_size} bytes)')
    
    import shutil
    cache_path = Path.home() / 'AppData' / 'Local' / 'hermes' / 'image_cache' / 'fwog_spritesheet.png'
    shutil.copy(sheet_path, cache_path)
    print(f'📋 Copied to: {cache_path}')
else:
    print(f'⚠ Only {len(generated)}/12 frames — skipping sheet')
