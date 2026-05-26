#!/usr/bin/env python3
"""
sprite-forge v2 — Procedural pixel art at 0x72 quality.

Generates game-ready pixel art with proper shading, dithering, and animation.
Uses shape-based rendering at 4x resolution + pixel-perfect downscale.

Usage:
    python sprite-forge.py --character dwarf --palette pico8
    python sprite-forge.py --character elf,wizard,orc --all
    python sprite-forge.py --list
"""

import sys, os, json, time, math, random, argparse
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple, List, Dict

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ Need Pillow: pip install Pillow")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════
#  PALETTES
# ═══════════════════════════════════════════════════════════════

PICO8 = [
    (0,0,0),(29,43,83),(126,37,83),(0,135,81),(171,82,54),(95,87,79),
    (194,195,199),(255,241,232),(255,0,77),(255,163,0),(255,236,39),
    (0,228,54),(41,173,255),(131,118,156),(255,119,168),(255,204,170),
]

PALETTES = {"pico8": PICO8}

# ═══════════════════════════════════════════════════════════════
#  COLOR SCHEMES  — each role maps to PICO-8 index
# ═══════════════════════════════════════════════════════════════

SCHEMES = {
    "dwarf": {
        # role: [outline, shadow, base, highlight]
        "skin":      [0, 5, 7, 7],
        "hair":      [0, 1, 2, 2],
        "beard":     [0, 5, 5, 6],
        "shirt":     [0, 5, 4, 9],
        "belt":      [0, 1, 5, 5],
        "pants":     [0, 1, 5, 5],
        "boots":     [0, 1, 5, 5],
        "helmet":    [0, 5, 1, 12],
        "metal":     [0, 5, 6, 7],
        "eyes":      [0, 0, 7, 12],
    },
    "elf": {
        "skin":      [0, 5, 7, 7],
        "hair":      [0, 2, 9, 10],
        "shirt":     [0, 1, 12, 12],
        "pants":     [0, 3, 3, 11],
        "boots":     [0, 1, 5, 5],
        "belt":      [0, 1, 5, 9],
        "ears":      [0, 5, 7, 15],
        "eyes":      [0, 0, 7, 12],
        "metal":     [0, 5, 6, 7],
    },
    "wizard": {
        "skin":      [0, 5, 7, 7],
        "hair":      [0, 2, 15, 7],
        "beard":     [0, 5, 15, 7],
        "robe":      [0, 1, 1, 12],
        "hat":       [0, 2, 1, 12],
        "belt":      [0, 5, 9, 10],
        "boots":     [0, 1, 5, 5],
        "eyes":      [0, 0, 7, 8],
        "metal":     [0, 5, 6, 10],
    },
    "orc": {
        "skin":      [0, 3, 3, 11],
        "hair":      [0, 1, 5, 5],
        "shirt":     [0, 5, 8, 9],
        "belt":      [0, 1, 1, 9],
        "pants":     [0, 1, 5, 5],
        "boots":     [0, 1, 5, 5],
        "metal":     [0, 5, 6, 6],
        "eyes":      [0, 0, 7, 8],
        "teeth":     [0, 5, 7, 7],
    },
    "knight": {
        "skin":      [0, 5, 7, 7],
        "armor":     [0, 5, 6, 7],
        "helmet":    [0, 1, 5, 6],
        "pants":     [0, 1, 5, 5],
        "boots":     [0, 1, 5, 6],
        "metal":     [0, 5, 6, 7],
        "eyes":      [0, 0, 7, 8],
        "cloth":     [0, 8, 8, 9],
        "shield":    [0, 2, 8, 9],
    },
    "angel": {
        "skin":      [0, 5, 7, 7],
        "hair":      [0, 9, 10, 10],
        "robe":      [0, 5, 15, 7],
        "wings":     [0, 5, 7, 15],
        "halo":      [0, 9, 10, 10],
        "eyes":      [0, 0, 7, 12],
        "boots":     [0, 9, 10, 10],
    },
    "pumpkin": {
        "skin":      [0, 5, 7, 7],
        "shirt":     [0, 5, 5, 6],
        "pants":     [0, 1, 5, 5],
        "boots":     [0, 1, 5, 5],
        "pumpkin":   [0, 2, 9, 10],
        "stem":      [0, 3, 3, 11],
        "eyes":      [0, 0, 7, 10],
        "belt":      [0, 1, 5, 9],
    },
}

# ═══════════════════════════════════════════════════════════════
#  SHAPE-BASED BODY DEFINITIONS  (at 4x target resolution)
# ═══════════════════════════════════════════════════════════════
# Each body part defined as {shape, x, y, w, h, material, anim_offset}
# x,y at 4x resolution (64x112 for a 16x28 target)

SCALE = 4

@dataclass
class BodyPart:
    """A body part shape definition."""
    shape: str       # 'rect', 'roundrect', 'ellipse', 'triangle'
    x: int           # 4x position
    y: int
    w: int
    h: int
    material: str    # references color scheme key
    z: int = 0       # z-order (higher = on top)
    # Animation offsets (shift per frame for idle/walk)
    idle_offset: Tuple[int,int] = (0, 0)
    walk_offset: Tuple[int,int] = (0, 0)
    walk_alt: bool = False  # alternate between walk_offset and -walk_offset

def get_anim_offset(part: BodyPart, anim_type: str, frame: int, frame_count: int) -> Tuple[int,int]:
    """Calculate animation offset for a body part."""
    if anim_type == "idle":
        # Gentle breathing bob
        cycle = math.sin(frame * math.pi * 2 / frame_count)
        return (int(cycle * 0.3), int(abs(cycle) * 1.0))
    elif anim_type == "walk":
        # Walking: left/right leg swing
        cycle = math.sin(frame * math.pi * 2 / frame_count)
        alt = 1 if frame % 2 == 0 else -1
        return (int(cycle * 1.5), int(abs(cycle) * 0.5))
    elif anim_type == "hit":
        # Knockback
        return (2, -1)
    return (0, 0)

# ── CHARACTER DEFINITIONS ──

CHARACTERS = {}

def add_char(name: str, target_w: int, target_h: int, parts: List[BodyPart], desc: str = ""):
    """Register a character template."""
    CHARACTERS[name] = {
        "target_w": target_w,
        "target_h": target_h,
        "scale": SCALE,
        "parts": parts,
        "desc": desc or name,
    }

# -- Dwarf --
add_char("dwarf", 16, 28, [
    # Body/legs (back layer)
    BodyPart("rect", 22, 72, 20, 32, "pants", z=0, walk_alt=True),
    BodyPart("rect", 22, 72, 20, 32, "boots", z=1, walk_alt=True),
    # Left leg
    BodyPart("roundrect", 22, 72, 8, 36, "pants", z=1, walk_offset=(0, 4)),
    BodyPart("roundrect", 22, 100, 8, 10, "boots", z=2, walk_offset=(0, 4)),
    # Right leg
    BodyPart("roundrect", 34, 72, 8, 36, "pants", z=1, walk_offset=(0, -4)),
    BodyPart("roundrect", 34, 100, 8, 10, "boots", z=2, walk_offset=(0, -4)),
    # Torso
    BodyPart("roundrect", 18, 36, 28, 40, "shirt", z=2),
    BodyPart("rect", 20, 64, 24, 6, "belt", z=3),
    # Belt buckle
    BodyPart("rect", 28, 64, 8, 8, "metal", z=4),
    # Arms
    BodyPart("roundrect", 10, 38, 8, 30, "shirt", z=2, walk_offset=(3, 0)),
    BodyPart("roundrect", 46, 38, 8, 30, "shirt", z=2, walk_offset=(-3, 0)),
    # Hands
    BodyPart("ellipse", 12, 64, 6, 6, "skin", z=3),
    BodyPart("ellipse", 46, 64, 6, 6, "skin", z=3),
    # Head
    BodyPart("roundrect", 18, 4, 28, 28, "skin", z=4),
    # Helmet
    BodyPart("roundrect", 18, 0, 28, 16, "helmet", z=5),
    BodyPart("rect", 18, 8, 28, 4, "helmet", z=5),
    # Eyes
    BodyPart("ellipse", 22, 18, 6, 4, "eyes", z=6),
    BodyPart("ellipse", 36, 18, 6, 4, "eyes", z=6),
    # Beard
    BodyPart("triangle", 22, 24, 20, 18, "beard", z=5),
    # Nose
    BodyPart("ellipse", 29, 20, 6, 4, "skin", z=6),
], "Dwarf warrior with helmet and beard")

# -- Elf --
add_char("elf", 16, 28, [
    BodyPart("roundrect", 22, 72, 20, 32, "pants", z=0, walk_alt=True),
    BodyPart("roundrect", 22, 72, 8, 36, "pants", z=1, walk_offset=(0, 4)),
    BodyPart("roundrect", 34, 72, 8, 36, "pants", z=1, walk_offset=(0, -4)),
    BodyPart("roundrect", 22, 100, 8, 10, "boots", z=2, walk_offset=(0, 4)),
    BodyPart("roundrect", 34, 100, 8, 10, "boots", z=2, walk_offset=(0, -4)),
    BodyPart("roundrect", 18, 36, 28, 38, "shirt", z=2),
    BodyPart("rect", 20, 60, 24, 4, "belt", z=3),
    BodyPart("rect", 28, 60, 8, 6, "metal", z=4),
    BodyPart("roundrect", 10, 38, 8, 30, "shirt", z=2, walk_offset=(3, 0)),
    BodyPart("roundrect", 46, 38, 8, 30, "shirt", z=2, walk_offset=(-3, 0)),
    BodyPart("ellipse", 12, 62, 6, 6, "skin", z=3),
    BodyPart("ellipse", 46, 62, 6, 6, "skin", z=3),
    # Head
    BodyPart("roundrect", 20, 4, 24, 28, "skin", z=4),
    # Hair (long elf hair)
    BodyPart("roundrect", 18, 0, 28, 12, "hair", z=5),
    BodyPart("rect", 18, 6, 28, 4, "hair", z=5),
    BodyPart("rect", 20, 28, 4, 8, "hair", z=4),
    BodyPart("rect", 40, 28, 4, 8, "hair", z=4),
    # Ears (pointed)
    BodyPart("triangle", 12, 12, 8, 4, "ears", z=4),
    BodyPart("triangle", 44, 12, 8, 4, "ears", z=4),
    # Eyes
    BodyPart("ellipse", 24, 16, 6, 4, "eyes", z=6),
    BodyPart("ellipse", 34, 16, 6, 4, "eyes", z=6),
], "Elven archer with pointed ears and long hair")

# -- Wizard --
add_char("wizard", 16, 28, [
    BodyPart("roundrect", 24, 80, 16, 28, "robe", z=0, walk_alt=True),
    BodyPart("roundrect", 20, 36, 24, 50, "robe", z=2),
    BodyPart("rect", 20, 70, 24, 6, "belt", z=3),
    BodyPart("roundrect", 10, 40, 8, 28, "robe", z=2, walk_offset=(3, 0)),
    BodyPart("roundrect", 46, 40, 8, 28, "robe", z=2, walk_offset=(-3, 0)),
    # Head
    BodyPart("roundrect", 22, 8, 20, 24, "skin", z=4),
    # Wizard hat (pointed)
    BodyPart("triangle", 18, -8, 28, 20, "hat", z=5),
    BodyPart("roundrect", 18, 8, 28, 8, "hat", z=5),
    # Eyes
    BodyPart("ellipse", 26, 16, 6, 4, "eyes", z=6),
    BodyPart("ellipse", 34, 16, 6, 4, "eyes", z=6),
    # Beard
    BodyPart("triangle", 24, 26, 16, 22, "beard", z=5),
    # Nose
    BodyPart("ellipse", 30, 20, 4, 4, "skin", z=6),
], "Wizard with pointed hat and long beard")

# -- Orc --
add_char("orc", 16, 28, [
    BodyPart("roundrect", 20, 72, 24, 36, "pants", z=0, walk_alt=True),
    BodyPart("roundrect", 20, 72, 10, 40, "pants", z=1, walk_offset=(0, 4)),
    BodyPart("roundrect", 34, 72, 10, 40, "pants", z=1, walk_offset=(0, -4)),
    BodyPart("roundrect", 20, 104, 10, 10, "boots", z=2, walk_offset=(0, 4)),
    BodyPart("roundrect", 34, 104, 10, 10, "boots", z=2, walk_offset=(0, -4)),
    BodyPart("roundrect", 16, 34, 32, 42, "shirt", z=2),
    BodyPart("rect", 18, 64, 28, 6, "belt", z=3),
    BodyPart("rect", 28, 64, 8, 8, "metal", z=4),
    BodyPart("roundrect", 8, 36, 8, 34, "shirt", z=2, walk_offset=(3, 0)),
    BodyPart("roundrect", 48, 36, 8, 34, "shirt", z=2, walk_offset=(-3, 0)),
    BodyPart("ellipse", 10, 64, 6, 6, "skin", z=3),
    BodyPart("ellipse", 48, 64, 6, 6, "skin", z=3),
    # Head (bigger orc head)
    BodyPart("roundrect", 14, 0, 36, 32, "skin", z=4),
    # Orc hair (mohawk)
    BodyPart("rect", 16, -4, 32, 8, "hair", z=5),
    BodyPart("roundrect", 18, -4, 28, 6, "hair", z=5),
    # Eyes (angry)
    BodyPart("ellipse", 20, 14, 8, 4, "eyes", z=6),
    BodyPart("ellipse", 36, 14, 8, 4, "eyes", z=6),
    # Tusks
    BodyPart("triangle", 24, 28, 6, 8, "teeth", z=5),
    BodyPart("triangle", 34, 28, 6, 8, "teeth", z=5),
    # Nose
    BodyPart("ellipse", 28, 18, 8, 6, "skin", z=6),
], "Brutal orc with tusks and mohawk")

# -- Knight --
add_char("knight", 16, 28, [
    BodyPart("roundrect", 22, 74, 20, 34, "pants", z=0, walk_alt=True),
    BodyPart("roundrect", 22, 74, 8, 36, "pants", z=1, walk_offset=(0, 4)),
    BodyPart("roundrect", 34, 74, 8, 36, "pants", z=1, walk_offset=(0, -4)),
    BodyPart("roundrect", 22, 104, 8, 8, "boots", z=2, walk_offset=(0, 4)),
    BodyPart("roundrect", 34, 104, 8, 8, "boots", z=2, walk_offset=(0, -4)),
    BodyPart("roundrect", 16, 34, 32, 44, "armor", z=2),
    BodyPart("rect", 18, 62, 28, 4, "cloth", z=3),
    BodyPart("rect", 28, 62, 8, 6, "metal", z=4),
    # Shoulder pads
    BodyPart("roundrect", 10, 34, 10, 10, "metal", z=3, walk_offset=(3, 0)),
    BodyPart("roundrect", 44, 34, 10, 10, "metal", z=3, walk_offset=(-3, 0)),
    # Arms
    BodyPart("roundrect", 12, 42, 8, 28, "armor", z=2, walk_offset=(3, 0)),
    BodyPart("roundrect", 44, 42, 8, 28, "armor", z=2, walk_offset=(-3, 0)),
    # Head (full helmet)
    BodyPart("roundrect", 18, 0, 28, 30, "helmet", z=5),
    BodyPart("rect", 18, 6, 28, 6, "metal", z=5),  # visor
    BodyPart("roundrect", 18, 10, 28, 4, "metal", z=5),
    # Visor slit
    BodyPart("rect", 22, 14, 20, 2, "eyes", z=6),
    # Helmet plume
    BodyPart("triangle", 20, -4, 24, 10, "cloth", z=6),
], "Armored knight with full plate and helmet")

# -- Angel --
add_char("angel", 16, 22, [
    BodyPart("roundrect", 24, 56, 16, 24, "robe", z=0, walk_alt=True),
    BodyPart("ellipse", 20, 28, 24, 30, "robe", z=2),
    # Wings (behind)
    BodyPart("triangle", 0, 24, 20, 20, "wings", z=0),
    BodyPart("triangle", 44, 24, 20, 20, "wings", z=0),
    BodyPart("roundrect", 10, 30, 8, 20, "robe", z=2, walk_offset=(2, 0)),
    BodyPart("roundrect", 46, 30, 8, 20, "robe", z=2, walk_offset=(-2, 0)),
    # Head
    BodyPart("roundrect", 22, 4, 20, 22, "skin", z=4),
    # Hair
    BodyPart("roundrect", 20, 0, 24, 10, "hair", z=5),
    # Halo
    BodyPart("ellipse", 18, -4, 28, 10, "halo", z=6),
    # Eyes
    BodyPart("ellipse", 26, 14, 5, 3, "eyes", z=6),
    BodyPart("ellipse", 33, 14, 5, 3, "eyes", z=6),
], "Angelic being with golden halo and wings")

# -- Pumpkin Dude --
add_char("pumpkin", 16, 22, [
    BodyPart("roundrect", 22, 56, 18, 24, "pants", z=0, walk_alt=True),
    BodyPart("roundrect", 22, 56, 8, 26, "pants", z=1, walk_offset=(0, 3)),
    BodyPart("roundrect", 34, 56, 8, 26, "pants", z=1, walk_offset=(0, -3)),
    BodyPart("roundrect", 20, 32, 24, 24, "shirt", z=2),
    BodyPart("rect", 22, 48, 20, 4, "belt", z=3),
    BodyPart("rect", 30, 48, 4, 6, "metal", z=4),
    BodyPart("roundrect", 12, 34, 8, 18, "shirt", z=2, walk_offset=(2, 0)),
    BodyPart("roundrect", 44, 34, 8, 18, "shirt", z=2, walk_offset=(-2, 0)),
    # Pumpkin head
    BodyPart("roundrect", 16, -2, 32, 30, "pumpkin", z=4),
    # Pumpkin stem
    BodyPart("rect", 28, -6, 8, 6, "stem", z=5),
    # Jack-o-lantern face
    BodyPart("triangle", 20, 8, 8, 6, "eyes", z=6),   # left eye
    BodyPart("triangle", 36, 8, 8, 6, "eyes", z=6),    # right eye
    BodyPart("triangle", 24, 18, 16, 8, "eyes", z=6),  # mouth
], "Pumpkin-headed scarecrow creature")

# ═══════════════════════════════════════════════════════════════
#  RENDERING ENGINE
# ═══════════════════════════════════════════════════════════════

def draw_shape(draw, part: BodyPart, color: Tuple[int,int,int,int],
               scale: int, offset: Tuple[int,int] = (0, 0)):
    """Draw a body part shape on a PIL ImageDraw."""
    x = part.x + offset[0]
    y = part.y + offset[1]
    w, h = part.w, part.h
    shape = part.shape

    if shape == "rect":
        draw.rectangle([x, y, x+w-1, y+h-1], fill=color)
    elif shape == "roundrect":
        r = min(w, h) // 3
        draw.rounded_rectangle([x, y, x+w-1, y+h-1], radius=r, fill=color)
    elif shape == "ellipse":
        draw.ellipse([x, y, x+w-1, y+h-1], fill=color)
    elif shape == "triangle":
        draw.polygon([(x+w//2, y), (x, y+h-1), (x+w-1, y+h-1)], fill=color)


def render_character(char_name: str, scheme_name: str,
                     anim_type: str = "idle", frame: int = 0,
                     pal_name: str = "pico8",
                     scale: int = SCALE) -> Image.Image:
    """
    Render one animation frame of a character at SCALE resolution.
    Returns a PIL Image at (target_w*scale) × (target_h*scale)
    which should be downscaled to final pixel art size.
    """
    if char_name not in CHARACTERS:
        print(f"❌ Unknown character: {char_name}")
        return None
    
    if scheme_name not in SCHEMES:
        print(f"❌ Unknown scheme: {scheme_name}")
        return None

    char = CHARACTERS[char_name]
    scheme = SCHEMES[scheme_name]
    palette = PALETTES.get(pal_name, PALETTES["pico8"])
    
    tw = char["target_w"] * scale
    th = char["target_h"] * scale
    
    img = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Determine number of frames for this anim type
    frame_count = {"idle": 4, "walk": 4, "hit": 1}.get(anim_type, 4)
    
    # Sort parts by z-order
    parts = sorted(char["parts"], key=lambda p: p.z)
    
    for part in parts:
        # Get material colors from scheme
        mat = part.material
        if mat not in scheme:
            continue
        
        colors = scheme[mat]
        # colors = [outline_idx, shadow_idx, base_idx, highlight_idx]
        base_idx = colors[2]  # base color
        
        if base_idx >= len(palette):
            continue
        
        base_color = palette[base_idx] + (255,)  # RGBA
        
        # Calculate animation offset
        offset = get_anim_offset(part, anim_type, frame, frame_count)
        
        # Draw base shape
        draw_shape(draw, part, base_color, scale, offset)
        
        # Add shadow (on bottom side)
        shadow_idx = colors[1]
        if shadow_idx < len(palette) and shadow_idx != base_idx:
            shadow_color = palette[shadow_idx] + (200,)  # semi-transparent
            sh_height = max(1, int(part.h * 0.25))
            if part.shape == "roundrect":
                # Shadow on bottom 25%
                sx = part.x + offset[0]
                sy = part.y + offset[1] + part.h - sh_height
                sw = part.w
                sh = sh_height
                if sy >= part.y + offset[1]:  # Only if valid
                    draw.rectangle([sx, sy, sx+sw-1, sy+sh-1], fill=shadow_color)
            elif part.shape in ("rect", "ellipse"):
                sx = part.x + offset[0]
                sy = part.y + offset[1] + part.h - sh_height
                sw = part.w
                sh = sh_height
                if sy >= part.y + offset[1]:
                    draw.rectangle([sx, sy, sx+sw-1, sy+sh-1], fill=shadow_color)
        
        # Add highlight (on top edge)
        highlight_idx = colors[3]
        if highlight_idx < len(palette) and highlight_idx != base_idx and highlight_idx != shadow_idx:
            h_color = palette[highlight_idx] + (180,)
            if part.shape == "roundrect":
                hx = part.x + offset[0]
                hy = part.y + offset[1]
                hw = part.w
                hh = max(2, int(part.h * 0.15))
                draw.rectangle([hx, hy, hx+hw-1, hy+hh-1], fill=h_color)
    
    return img


def downscale_to_pixel(img: Image.Image, target_w: int, target_h: int,
                       pal_name: str = "pico8") -> Image.Image:
    """Downscale a hi-res render to pixel art size with palette quantization."""
    palette = PALETTES.get(pal_name, PALETTES["pico8"])
    
    # Nearest-neighbor downscale (preserves hard edges)
    pixel_img = img.resize((target_w, target_h), Image.NEAREST)
    
    # Quantize to palette
    quantized = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    for y in range(target_h):
        for x in range(target_w):
            r, g, b, a = pixel_img.getpixel((x, y))
            if a < 128:
                continue  # transparent
            # Find nearest palette color
            nearest = min(range(len(palette)),
                         key=lambda i: (r-palette[i][0])**2 +
                                       (g-palette[i][1])**2 +
                                       (b-palette[i][2])**2)
            pr, pg, pb = palette[nearest]
            quantized.putpixel((x, y), (pr, pg, pb, 255))
    
    # Add 1px outline
    pixels = quantized.load()
    outline_color = palette[0]  # index 0 = outline (usually black)
    for y in range(target_h):
        for x in range(target_w):
            r, g, b, a = quantized.getpixel((x, y))
            if a < 128:
                continue
            # Check if this pixel has a transparent neighbor
            neighbors = [(x-1,y), (x+1,y), (x,y-1), (x,y+1)]
            has_transparent = False
            for nx, ny in neighbors:
                if nx < 0 or nx >= target_w or ny < 0 or ny >= target_h:
                    has_transparent = True
                else:
                    nr, ng, nb, na = quantized.getpixel((nx, ny))
                    if na < 128:
                        has_transparent = True
            if has_transparent:
                quantized.putpixel((x, y), outline_color + (255,))
    
    return quantized


def generate_sprite(char_name: str, scheme_name: str,
                    pal_name: str = "pico8",
                    output_dir: str = None) -> dict:
    """Generate a full sprite set with all animation frames."""
    if char_name not in CHARACTERS:
        print(f"❌ Unknown character: {char_name}")
        return None
    
    char = CHARACTERS[char_name]
    tw, th = char["target_w"], char["target_h"]
    
    if output_dir:
        out = Path(output_dir)
    else:
        out = Path("forge-output") / f"sprite-v2_{char_name}_{scheme_name}"
    out.mkdir(parents=True, exist_ok=True)
    
    all_frames = []
    all_meta = []
    
    for anim_type in ["idle", "walk", "hit"]:
        n_frames = {"idle": 4, "walk": 4, "hit": 1}.get(anim_type, 1)
        for frame in range(n_frames):
            # Render at 4x
            high_res = render_character(char_name, scheme_name, anim_type, frame, pal_name)
            if high_res is None:
                continue
            
            # Downscale to pixel art
            pixel = downscale_to_pixel(high_res, tw, th, pal_name)
            
            filename = f"{char_name}_{scheme_name}_{anim_type}_f{frame}.png"
            pixel.save(str(out / filename))
            
            all_frames.append(pixel)
            all_meta.append({
                "type": anim_type,
                "frame": frame,
                "file": filename,
                "size": f"{tw}x{th}",
                "bytes": os.path.getsize(str(out / filename)),
            })
    
    # Create sprite sheet
    cols = 4
    rows = (len(all_frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (tw * cols, th * rows), (0, 0, 0, 0))
    for i, f in enumerate(all_frames):
        x = (i % cols) * tw
        y = (i // cols) * th
        sheet.paste(f, (x, y), f)
    
    sheet_path = out / f"{char_name}_{scheme_name}_spritesheet.png"
    sheet.save(str(sheet_path))
    
    # Metadata
    meta = {
        "character": char_name,
        "scheme": scheme_name,
        "palette": pal_name,
        "pixel_size": f"{tw}x{th}",
        "frames": all_meta,
        "frame_count": len(all_frames),
        "animations": {"idle": 4, "walk": 4, "hit": 1},
        "sheet_file": sheet_path.name,
        "files": [m["file"] for m in all_meta] + [sheet_path.name],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "engine": "sprite-forge-v2-shape-based",
    }
    
    meta_path = out / f"{char_name}_{scheme_name}_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    
    print(f"\n{'═' * 50}")
    print(f"✅ GENERATED: {char_name} ({scheme_name})  [{tw}x{th}]")
    print(f"{'═' * 50}")
    print(f"   Palette: {pal_name}")
    print(f"   Animations: idle(4) walk(4) hit(1) = {len(all_frames)} frames")
    print(f"   Sheet: {sheet_path}")
    print(f"   Output: {out}")
    print()
    
    return meta


def main():
    parser = argparse.ArgumentParser(description="Sprite Forge v2 — shape-based pixel art")
    parser.add_argument("--character", default=None,
                        help="Character(s) to generate (comma-separated)")
    parser.add_argument("--scheme", default=None,
                        help="Color scheme (default: same as character)")
    parser.add_argument("--palette", default="pico8", choices=["pico8"],
                        help="Retro palette")
    parser.add_argument("--output", default=None, help="Output directory")
    parser.add_argument("--list", action="store_true", help="List templates")
    parser.add_argument("--all", action="store_true", help="Generate ALL characters")
    
    args = parser.parse_args()
    
    if args.list:
        print(f"\n{'═' * 50}")
        print("Available Characters:")
        print(f"{'═' * 50}")
        for name, c in sorted(CHARACTERS.items()):
            print(f"  {name:15s}  ({c['target_w']}x{c['target_h']})  {c['desc']}")
        print(f"\nColor Schemes: {', '.join(sorted(SCHEMES.keys()))}")
        print(f"Palettes: {', '.join(PALETTES.keys())}")
        print()
        return 0
    
    chars = []
    if args.all:
        chars = list(CHARACTERS.keys())
    elif args.character:
        chars = [c.strip() for c in args.character.split(",")]
    else:
        print("❌ Use --character NAME, --all, or --list")
        return 1
    
    results = []
    for c in chars:
        scheme = args.scheme or c
        if scheme not in SCHEMES:
            print(f"⚠️ No scheme '{scheme}', trying '{c}'...")
            scheme = c
            if scheme not in SCHEMES:
                print(f"❌ Skipping {c} — no scheme")
                continue
        meta = generate_sprite(c, scheme, args.palette, args.output)
        if meta:
            results.append(meta)
    
    print(f"✅ Generated {len(results)} character(s)!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
