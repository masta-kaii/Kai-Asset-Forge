"""
Klawf Crab Sprite Sheet Generator
64x64 sprites, 4 directions × 3 frames = 12 sprites
Based on K's reference image
"""

from PIL import Image, ImageDraw
import math, os

# ── Palette ──
OUTLINE = (0, 0, 0, 255)
ORANGE  = (220, 120, 40, 255)
ORANGE_DARK = (180, 80, 20, 255)
ORANGE_LIGHT = (250, 160, 80, 255)
BEIGE   = (240, 210, 170, 255)
BEIGE_DARK = (210, 180, 140, 255)
WHITE   = (255, 255, 255, 255)
PUPIL   = (20, 20, 20, 255)
PINK    = (240, 140, 160, 255)
GREEN   = (60, 150, 50, 255)
GREEN_DARK = (30, 100, 30, 255)
MOUTH   = (80, 40, 20, 255)
LEG     = (160, 100, 40, 255)
LEG_DARK = (120, 70, 20, 255)
SHADOW  = (10, 10, 10, 128)
CLAW_OUTER = (200, 90, 30, 255)
CLAW_INNER = (240, 140, 60, 255)

S = 64  # sprite size

def draw_circle_filled(draw, cx, cy, r, color):
    """Draw filled circle"""
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=color)

def draw_oval(draw, x, y, w, h, color):
    d.ellipse([x, y, x+w, y+h], fill=color)

def draw_rect(draw, x, y, w, h, color):
    draw.rectangle([x, y, x+w, y+h], fill=color)

def outlined(c, count=1):
    """Return darker version of color for outline/shading"""
    return tuple(max(0, int(v*0.6)) for v in c[:3]) + (255,)

def lighter(c, amount=0.3):
    return tuple(min(255, int(v*(1+amount))) for v in c[:3]) + (255,)

def draw_klawf_front(frame=0):
    """Front-facing Klawf crab"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    bob = frame * 2  # bob offset for animation
    leg_shift = frame  # leg animation offset
    
    # ── SHADOW ──
    draw_oval(d, 10, S-8, S-20, 8, SHADOW)
    
    # ── BACK LEGS (behind body) ──
    for side, sx in [(-1, 8), (1, S-24)]:
        for i in range(3):
            lx = sx + side*i*2 + (leg_shift if side>0 else -leg_shift)
            ly = 35 + i*6
            draw_rect(d, lx, ly, 6, 4, LEG_DARK)
            draw_rect(d, lx+2, ly-2, 4, 4, LEG)
    
    # ── BODY / SHELL ──
    # Main shell (round rectangle)
    d.rounded_rectangle([10, 12, S-10, S-16], radius=12, fill=ORANGE, outline=OUTLINE)
    
    # Shell highlights
    d.rounded_rectangle([14, 16, S-14, 30], radius=8, fill=ORANGE_LIGHT)
    
    # Shell segments (horizontal lines)
    for seg_y in [26, 34, 42]:
        d.line([(16, seg_y), (S-16, seg_y)], fill=ORANGE_DARK, width=1)
    
    # Shell darker bottom
    d.rounded_rectangle([12, 38, S-12, S-18], radius=6, fill=ORANGE_DARK)
    
    # ── BELLY ──
    draw_oval(d, 18, 24, S-36, 20, BEIGE)
    draw_oval(d, 22, 26, S-44, 16, BEIGE_DARK)
    
    # ── MOUTH ──
    mouth_y = 28 + bob//2
    draw_rect(d, 18, mouth_y, S-36, 6, MOUTH)
    draw_rect(d, 22, mouth_y+2, S-44, 2, (40, 20, 10, 255))
    
    # ── EYES (on stalks) ──
    for ex in [16, 40]:
        # Stalk
        draw_rect(d, ex+2, 8, 4, 8, ORANGE_DARK)
        # Eye white
        draw_oval(d, ex-2, 2-bob, 12, 10, WHITE)
        d.ellipse([ex-2, 2-bob, ex+10, 12-bob], fill=WHITE, outline=OUTLINE)
        # Pupil
        px = ex+3 + (1 if frame==1 else 0)
        draw_oval(d, px, 4-bob, 5, 4, PUPIL)
    
    # ── PINK CHEEKS ──
    draw_oval(d, 10, 30+bob//2, 8, 6, PINK)
    draw_oval(d, S-18, 30+bob//2, 8, 6, PINK)
    
    # ── CLAWS ──
    for cx, dir in [(6, -1), (S-22, 1)]:
        claw_open = frame % 2  # alternate open/close
        # Claw arm
        draw_rect(d, cx+4 if dir>0 else cx, 18, 10, 6, CLAW_OUTER)
        # Claw pincer
        pincer_base = cx+2 if dir>0 else cx-2
        d.arc([pincer_base-8, 10, pincer_base+8, 24], 0, 180, fill=CLAW_OUTER)
        draw_rect(d, pincer_base-4+claw_open*2, 14, 8, 3, CLAW_INNER)
    
    # ── FRONT LEGS ──
    for side, sx in [(-1, 12), (1, S-28)]:
        for i in range(2):
            lx = sx + i*3 + (leg_shift*2 if side>0 else -leg_shift*2)
            ly = 44 + i*7
            draw_rect(d, lx, ly, 5, 3, LEG)
    
    # ── GREEN LEAF BITS ──
    for gx in [6, S-20, 20, S-34]:
        draw_oval(d, gx, S-14, 12, 10, GREEN_DARK)
        draw_oval(d, gx+2, S-12, 8, 6, GREEN)
    
    return img


def draw_klawf_side(frame=0, facing_right=True):
    """Side-facing Klawf crab"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    bob = frame
    dir = 1 if facing_right else -1
    
    # Shadow
    draw_oval(d, 8, S-6, S-16, 6, SHADOW)
    
    # ── LEGS (4 visible from side) ──
    for i in range(4):
        lx = 12 + i*2 if facing_right else S-20 - i*2
        ly = 28 + i*10
        d.line([(lx, ly), (lx+dir*14, ly+4)], fill=LEG_DARK, width=4)
        d.line([(lx, ly+1), (lx+dir*12, ly+3)], fill=LEG, width=3)
    
    # ── BODY (oval from side) ──
    if facing_right:
        draw_oval(d, 10, 10, 38, 40, ORANGE)
        draw_oval(d, 12, 12, 34, 36, ORANGE_LIGHT)
        # Eye stalk
        draw_rect(d, 30, 4, 6, 10, ORANGE_DARK)
        draw_oval(d, 26, 0-bob, 14, 10, WHITE)
        draw_oval(d, 32, 2-bob, 6, 4, PUPIL)
        # Claw
        draw_oval(d, 4, 14, 16, 12, CLAW_OUTER)
        draw_oval(d, 0, 16, 10, 8, CLAW_INNER)
        # Green bits
        draw_oval(d, 10, S-12, 10, 8, GREEN)
    else:
        draw_oval(d, 16, 10, 38, 40, ORANGE)
        draw_oval(d, 18, 12, 34, 36, ORANGE_LIGHT)
        draw_rect(d, 28, 4, 6, 10, ORANGE_DARK)
        draw_oval(d, 24, 0-bob, 14, 10, WHITE)
        draw_oval(d, 26, 2-bob, 6, 4, PUPIL)
        draw_oval(d, 44, 14, 16, 12, CLAW_OUTER)
        draw_oval(d, 54, 16, 10, 8, CLAW_INNER)
        draw_oval(d, 44, S-12, 10, 8, GREEN)
    
    # Mouth  
    if facing_right:
        draw_rect(d, 30, 28, 8, 4, MOUTH)
    else:
        draw_rect(d, 26, 28, 8, 4, MOUTH)
    
    # Pink cheek
    draw_oval(d, 34 if facing_right else 24, 24, 6, 4, PINK)
    
    # Shell segments
    for seg_y in [20, 30, 40]:
        d.line([(16, seg_y), (46, seg_y)], fill=ORANGE_DARK, width=1)
    
    return img


def draw_klawf_back(frame=0):
    """Back-facing Klawf crab"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    bob = frame
    leg_shift = frame
    
    # Shadow
    draw_oval(d, 10, S-8, S-20, 8, SHADOW)
    
    # ── BACK LEGS ──
    for side, sx in [(-1, 10), (1, S-26)]:
        for i in range(3):
            lx = sx + side*i*2 + (leg_shift if side>0 else -leg_shift)
            ly = 32 + i*7
            draw_rect(d, lx, ly, 5, 3, LEG_DARK)
    
    # ── SHELL (back is all shell) ──
    d.rounded_rectangle([8, 10, S-8, S-14], radius=14, fill=ORANGE, outline=OUTLINE)
    
    # Shell highlight (center)
    d.rounded_rectangle([16, 14, S-16, 34], radius=10, fill=ORANGE_LIGHT)
    
    # Shell texture lines (like turtle shell)
    d.line([(S//2, 14), (S//2, 42)], fill=ORANGE_DARK, width=2)
    d.line([(16, 22), (S-16, 22)], fill=ORANGE_DARK, width=1)
    d.line([(20, 34), (S-20, 34)], fill=ORANGE_DARK, width=1)
    
    # Shell segments
    for i in range(3):
        sy = 16 + i*10
        d.arc([12, sy, S-12, sy+16], -30, 210, fill=ORANGE_DARK, width=2)
    
    # ── GREEN LEAF BITS (on back) ──
    for gx in [8, S-22, 24, S-38]:
        draw_oval(d, gx, S-12, 12, 8, GREEN_DARK)
        draw_oval(d, gx+2, S-10, 8, 5, GREEN)
    
    # ── LEG JOINTS (visible from back) ──
    for side, sx in [(-1, 10), (1, S-18)]:
        draw_oval(d, sx, 30, 8, 6, ORANGE_DARK)
    
    return img


def generate_sprite_sheet():
    """Generate 4×3 sprite sheet (4 directions × 3 frames)"""
    directions = [
        ("front", draw_klawf_front),
        ("left", lambda f: draw_klawf_side(f, facing_right=False)),
        ("right", lambda f: draw_klawf_side(f, facing_right=True)),
        ("back", draw_klawf_back),
    ]
    
    frames = [0, 1, 2]
    
    sprites = []
    for dir_name, draw_fn in directions:
        for f in frames:
            sprite = draw_fn(f)
            sprites.append((dir_name, f, sprite))
    
    # Compile sprite sheet: 4 rows × 3 cols
    cols, rows = 3, 4
    sheet_w = cols * S
    sheet_h = rows * S
    sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    
    for i, (dir_name, f, sprite) in enumerate(sprites):
        row = i // cols
        col = i % cols
        sheet.paste(sprite, (col * S, row * S))
    
    # Save
    out = "C:/Users/khair/AppData/Local/hermes/image_cache/klawf_spritesheet.png"
    sheet.save(out)
    print(f"✅ Sprite sheet: {out} ({sheet_w}×{sheet_h})")
    
    # Also save individual sprites
    individual_dir = "C:/Users/khair/Kai-Asset-Forge/forge-output/aseprite/k_custom"
    os.makedirs(individual_dir, exist_ok=True)
    for dir_name, f, sprite in sprites:
        sprite.save(f"{individual_dir}/klawf_{dir_name}_{f}.png")
    
    return out

if __name__ == "__main__":
    generate_sprite_sheet()
