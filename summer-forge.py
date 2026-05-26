#!/usr/bin/env python3
"""
summer-forge.py — Summer Beach Cozy Pack pixel art generator.

Generates 45 game-ready pixel art sprites for the Summer Beach Cozy Pack,
using Python PIL with PICO-8-style palette, high-res drawing, and
pixel-perfect downscaling to 32x32 with clean outlines.

Usage:
    python summer-forge.py [--all] [--item NAME] [--list]
"""

import sys, os, json, math, time, random
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ PIL required. pip install Pillow")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════
#  SUMMER PALETTE (PICO-8 inspired, beach-friendly)
# ═══════════════════════════════════════════════════════════════

PALETTE = [
    (0, 0, 0),         # 0  — outline/black
    (29, 43, 83),      # 1  — dark navy
    (126, 37, 83),     # 2  — dark purple
    (0, 135, 81),      # 3  — dark green (foliage)
    (120, 70, 30),     # 4  — brown
    (70, 60, 50),      # 5  — dark sandy brown
    (150, 130, 110),   # 6  — light brown / tan
    (240, 230, 220),   # 7  — off-white / shell
    (180, 50, 50),     # 8  — red (lifeguard)
    (220, 140, 50),    # 9  — orange / sunset
    (240, 220, 50),    # 10 — yellow (sun)
    (50, 180, 50),     # 11 — bright green (palm)
    (60, 150, 200),    # 12 — ocean blue
    (130, 110, 150),   # 13 — purple
    (220, 120, 160),   # 14 — pink (flamingo float)
    (240, 200, 160),   # 15 — peach / skin
    (100, 180, 255),   # 16 — sky blue
    (255, 255, 255),   # 17 — pure white (foam)
    (200, 160, 120),   # 18 — sand
    (80, 160, 200),    # 19 — deep ocean
    (40, 80, 120),     # 20 — dark ocean
    (80, 200, 80),     # 21 — tropical green
    (180, 120, 60),    # 22 — wood / brown
    (160, 80, 40),     # 23 — dark wood
]

# Color name mapping
C = {
    "out": 0, "navy": 1, "purp": 2, "dkgr": 3, "brn": 4,
    "dkbr": 5, "tan": 6, "shell": 7, "red": 8, "orng": 9,
    "ylw": 10, "grn": 11, "blue": 12, "purp": 13, "pink": 14,
    "skin": 15, "sky": 16, "wht": 17, "sand": 18, "dblu": 19,
    "dkbl": 20, "tgrn": 21, "wood": 22, "dkwd": 23,
}

# ═══════════════════════════════════════════════════════════════
#  SUMMER BEACH SPRITE DEFINITIONS
# ═══════════════════════════════════════════════════════════════

def palettize(pixel, palette):
    """Find nearest palette color by Euclidean distance."""
    r, g, b, *_ = pixel if len(pixel) >= 3 else (0,0,0)
    best = 0
    best_d = 999999
    for i, (pr, pg, pb) in enumerate(palette):
        d = (r-pr)**2 + (g-pg)**2 + (b-pb)**2
        if d < best_d:
            best_d = d
            best = i
    return best


def draw_sprite(name, scale=4):
    """Draw a sprite at high resolution, return PIL Image."""
    w, h = 32 * scale, 32 * scale
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s = scale  # shorthand
    
    # ── SUNNY SUN ──
    if name == "sunny_sun":
        # Sky background circle
        draw.ellipse([4*s, 4*s, 28*s, 28*s], fill=(240, 220, 50, 255))
        # Face
        draw.ellipse([10*s, 12*s, 14*s, 16*s], fill=(0, 0, 0, 255))  # left eye
        draw.ellipse([18*s, 12*s, 22*s, 16*s], fill=(0, 0, 0, 255))  # right eye
        draw.ellipse([12*s, 18*s, 20*s, 22*s], fill=(0, 0, 0, 255))  # smile
        # Rays
        for angle in range(0, 360, 30):
            rad = math.radians(angle)
            cx, cy = 16*s, 16*s
            inner_r, outer_r = 15*s, 19*s
            points = []
            for a in [angle-10, angle+10]:
                r = math.radians(a)
                points.append((cx + inner_r*math.cos(r), cy + inner_r*math.sin(r)))
            for a in [angle+10, angle-10]:
                r = math.radians(a)
                points.append((cx + outer_r*math.cos(r), cy + outer_r*math.sin(r)))
            draw.polygon(points, fill=(240, 200, 50, 255))
        # Glow
        draw.ellipse([3*s, 3*s, 29*s, 29*s], outline=(255, 255, 200, 100), width=s)
    
    # ── BEACH CRAB ──
    elif name == "beach_crab":
        body_color = (200, 80, 50, 255)  # red-orange
        # Body
        draw.ellipse([8*s, 12*s, 24*s, 24*s], fill=body_color)
        # Claws
        draw.ellipse([2*s, 10*s, 8*s, 18*s], fill=body_color)  # left claw
        draw.ellipse([24*s, 10*s, 30*s, 18*s], fill=body_color)  # right claw
        draw.ellipse([0*s, 8*s, 6*s, 14*s], fill=body_color)  # left pincer
        draw.ellipse([26*s, 8*s, 32*s, 14*s], fill=body_color)  # right pincer
        # Eyes on stalks
        draw.ellipse([11*s, 8*s, 14*s, 12*s], fill=(240, 230, 220, 255))
        draw.ellipse([18*s, 8*s, 21*s, 12*s], fill=(240, 230, 220, 255))
        draw.ellipse([12*s, 9*s, 13*s, 11*s], fill=(0, 0, 0, 255))  # pupil
        draw.ellipse([19*s, 9*s, 20*s, 11*s], fill=(0, 0, 0, 255))
        # Legs
        for i, (lx, ly) in enumerate([(6,20),(7,24),(9,26),(11,24),(5,22)]):
            draw.ellipse([lx*s-1, ly*s-1, lx*s+2, ly*s+2], fill=body_color)
        for i, (rx, ry) in enumerate([(26,20),(25,24),(23,26),(21,24),(27,22)]):
            draw.ellipse([rx*s-1, ry*s-1, rx*s+2, ry*s+2], fill=body_color)
    
    # ── PALM TREE ──
    elif name == "palm_tree":
        # Trunk
        trunk_color = (120, 70, 30, 255)
        draw.rectangle([13*s, 8*s, 19*s, 32*s], fill=trunk_color)
        draw.rectangle([12*s, 8*s, 20*s, 10*s], fill=trunk_color)
        # Trunk texture
        for i in range(4):
            y = 12*s + i*5*s
            draw.arc([11*s, y, 21*s, y+3*s], 0, 180, fill=(100, 60, 20, 255), width=s)
        # Fronds
        frond_color = (50, 180, 50, 255)
        # Left fan
        draw.pieslice([-4*s, -4*s, 16*s, 16*s], 180, 260, fill=frond_color)
        draw.pieslice([0*s, -2*s, 18*s, 14*s], 200, 280, fill=(80, 200, 80, 255))
        # Right fan
        draw.pieslice([16*s, -4*s, 36*s, 16*s], 280, 360, fill=frond_color)
        draw.pieslice([14*s, -2*s, 32*s, 14*s], 260, 340, fill=(80, 200, 80, 255))
        # Top fan
        draw.pieslice([4*s, -8*s, 28*s, 8*s], 240, 300, fill=(0, 135, 81, 255))
        # Coconuts
        draw.ellipse([14*s, 8*s, 17*s, 11*s], fill=(70, 60, 50, 255))
        draw.ellipse([17*s, 8*s, 20*s, 11*s], fill=(70, 60, 50, 255))
    
    # ── BEACH UMBRELLA ──
    elif name == "beach_umbrella":
        # Pole
        draw.rectangle([15*s, 8*s, 17*s, 32*s], fill=(120, 70, 30, 255))
        # Umbrella canopy - striped
        colors = [(180, 50, 50, 255), (240, 220, 50, 255), (60, 150, 200, 255),
                  (50, 180, 50, 255), (220, 120, 160, 255)]
        for i, col in enumerate(colors):
            angle_start = 180 + i * 36
            angle_end = 180 + (i + 1) * 36
            draw.pieslice([2*s, -8*s, 30*s, 16*s], angle_start, angle_end, fill=col)
        # Top cap
        draw.ellipse([14*s, -2*s, 18*s, 2*s], fill=(240, 230, 220, 255))
        # Scalloped edge
        for i in range(5):
            x = 3*s + i * 6*s
            draw.ellipse([x-s, 8*s-s, x+s, 8*s+s], fill=colors[i])
    
    # ── SANDCASTLE ──
    elif name == "sandcastle":
        sand_dark = (150, 130, 110, 255)
        sand_light = (200, 160, 120, 255)
        # Base
        draw.rectangle([4*s, 20*s, 28*s, 26*s], fill=sand_dark)
        draw.rectangle([2*s, 18*s, 30*s, 20*s], fill=sand_light)
        # Left tower
        draw.rectangle([4*s, 10*s, 10*s, 20*s], fill=sand_dark)
        draw.rectangle([3*s, 8*s, 11*s, 10*s], fill=sand_light)
        draw.polygon([3*s, 8*s, 7*s, 4*s, 11*s, 8*s], fill=sand_light)
        # Right tower
        draw.rectangle([22*s, 10*s, 28*s, 20*s], fill=sand_dark)
        draw.rectangle([21*s, 8*s, 29*s, 10*s], fill=sand_light)
        draw.polygon([21*s, 8*s, 25*s, 4*s, 29*s, 8*s], fill=sand_light)
        # Center tower (tall)
        draw.rectangle([12*s, 6*s, 20*s, 20*s], fill=sand_dark)
        draw.rectangle([11*s, 4*s, 21*s, 6*s], fill=sand_light)
        draw.polygon([11*s, 4*s, 16*s, -2*s, 21*s, 4*s], fill=sand_light)
        # Windows
        draw.ellipse([6*s, 14*s, 8*s, 16*s], fill=(0, 0, 0, 255))
        draw.ellipse([24*s, 14*s, 26*s, 16*s], fill=(0, 0, 0, 255))
        draw.ellipse([14*s, 10*s, 18*s, 14*s], fill=(0, 0, 0, 255))
        # Flag
        draw.rectangle([15*s, 0*s, 16*s, 4*s], fill=(70, 60, 50, 255))
        draw.polygon([16*s, 0*s, 22*s, 2*s, 16*s, 4*s], fill=(180, 50, 50, 255))
    
    # ── BEACH TOWEL ──
    elif name == "beach_towel":
        stripe_colors = [(240, 220, 50, 255), (220, 120, 160, 255),
                        (60, 150, 200, 255), (50, 180, 50, 255)]
        # Main towel
        for i, col in enumerate(stripe_colors):
            draw.rectangle([i*8*s, 8*s, (i+1)*8*s, 24*s], fill=col)
        # Border
        draw.rectangle([0, 7*s, 32*s, 8*s], fill=(240, 230, 220, 255))
        draw.rectangle([0, 24*s, 32*s, 25*s], fill=(240, 230, 220, 255))
        # Fringe
        for x in range(0, 32*s, s):
            draw.line([x, 25*s, x, 28*s], fill=(240, 230, 220, 255), width=1)
    
    # ── SEASHELL ──
    elif name == "seashell":
        # Spiral shell
        shell_color = (240, 200, 160, 255)
        draw.ellipse([6*s, 8*s, 26*s, 24*s], fill=shell_color)
        draw.ellipse([12*s, 10*s, 22*s, 20*s], fill=(240, 230, 220, 255))
        draw.ellipse([15*s, 12*s, 19*s, 18*s], fill=(220, 140, 50, 255))
        # Spiral
        for i in range(5):
            r = 3*s - i*s//2
            cx, cy = 16*s + i*s//2, 14*s + i*s//2
            if r > 1:
                draw.arc([cx-r, cy-r, cx+r, cy+r], 0, 180, fill=(200, 160, 120, 255), width=s)
        # Texture lines
        for y in range(8, 24):
            draw.arc([4*s, y*s, 28*s, y*s+2*s], 0, 180, fill=(180, 140, 100, 100), width=1)
    
    # ── STARFISH ──
    elif name == "starfish":
        star_color = (220, 140, 50, 255)
        # 5-pointed star
        cx, cy, outer_r, inner_r = 16*s, 16*s, 13*s, 6*s
        points = []
        for i in range(10):
            angle = math.radians(-90 + i * 36)
            r = outer_r if i % 2 == 0 else inner_r
            points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
        draw.polygon(points, fill=star_color)
        # Center dot
        draw.ellipse([14*s, 14*s, 18*s, 18*s], fill=(240, 200, 50, 255))
        # Texture dots
        for i in range(5):
            angle = math.radians(-90 + i * 72)
            dx = int(8*s * math.cos(angle))
            dy = int(8*s * math.sin(angle))
            draw.ellipse([cx+dx-2, cy+dy-2, cx+dx+2, cy+dy+2], fill=(200, 120, 30, 255))
    
    # ── SURFBOARD ──
    elif name == "surfboard":
        board_color = (60, 150, 200, 255)
        # Board shape
        draw.pieslice([8*s, -4*s, 24*s, 36*s], 180, 360, fill=board_color)
        draw.rectangle([10*s, 4*s, 22*s, 24*s], fill=board_color)
        draw.pieslice([8*s, 4*s, 24*s, 32*s], 180, 360, fill=board_color)
        # Stripe
        draw.rectangle([13*s, 2*s, 19*s, 26*s], fill=(240, 230, 220, 255))
        # Fin
        draw.polygon([16*s, 24*s, 18*s, 28*s, 20*s, 24*s], fill=(240, 230, 220, 255))
    
    # ── ICE CREAM ──
    elif name == "ice_cream":
        # Cone
        cone_color = (220, 180, 120, 255)
        draw.polygon([10*s, 20*s, 22*s, 20*s, 16*s, 30*s], fill=cone_color)
        # Ice cream scoops
        draw.ellipse([6*s, 10*s, 26*s, 22*s], fill=(220, 120, 160, 255))  # pink scoop
        draw.ellipse([8*s, 6*s, 24*s, 16*s], fill=(240, 230, 220, 255))  # vanilla
        # Cherry
        draw.ellipse([18*s, 4*s, 22*s, 8*s], fill=(180, 50, 50, 255))
        draw.line([20*s, 4*s, 20*s, 2*s], fill=(50, 180, 50, 255), width=s//2)
    
    # ── FLIP FLOPS ──
    elif name == "flip_flops":
        flop_colors = [(60, 150, 200, 255), (240, 220, 50, 255)]
        for i, (x_off, col) in enumerate([(4, flop_colors[0]), (18, flop_colors[1])]):
            # Sole
            draw.ellipse([x_off*s, 16*s, (x_off+8)*s, 28*s], fill=col)
            # Strap
            draw.line([(x_off+2)*s, 16*s, (x_off+4)*s, 18*s], fill=col, width=s*2)
            draw.line([(x_off+6)*s, 16*s, (x_off+4)*s, 18*s], fill=col, width=s*2)
            # Thong
            draw.line([(x_off+4)*s, 18*s, (x_off+4)*s, 22*s], fill=col, width=s)
    
    # ── LIFE RING ──
    elif name == "life_ring":
        # Outer ring
        for i in range(4):
            q = i * 90
            col = (180, 50, 50, 255) if i in [0, 2] else (240, 230, 220, 255)
            draw.pieslice([4*s, 4*s, 28*s, 28*s], q, q+90, fill=col)
        # Inner hole
        draw.ellipse([10*s, 10*s, 22*s, 22*s], fill=(0, 0, 0, 0))
        # Straps
        draw.rectangle([13*s, 4*s, 19*s, 6*s], fill=(240, 230, 220, 255))
        draw.rectangle([13*s, 26*s, 19*s, 28*s], fill=(240, 230, 220, 255))
        draw.rectangle([4*s, 13*s, 6*s, 19*s], fill=(240, 230, 220, 255))
        draw.rectangle([26*s, 13*s, 28*s, 19*s], fill=(240, 230, 220, 255))
        # Rope texture
        for i in range(4):
            draw.arc([5*s, 5*s, 27*s, 27*s], i*90, i*90+90, fill=(0,0,0,60), width=1)
    
    # ── SUNGLASSES ──
    elif name == "sunglasses":
        # Frames
        draw.ellipse([2*s, 10*s, 14*s, 22*s], fill=(0, 0, 0, 255))  # left lens
        draw.ellipse([18*s, 10*s, 30*s, 22*s], fill=(0, 0, 0, 255))  # right lens
        # Lens reflection
        draw.arc([4*s, 12*s, 12*s, 20*s], 180, 360, fill=(60, 150, 200, 150), width=s)
        draw.arc([20*s, 12*s, 28*s, 20*s], 180, 360, fill=(60, 150, 200, 150), width=s)
        # Bridge
        draw.rectangle([14*s, 15*s, 18*s, 17*s], fill=(0, 0, 0, 255))
        # Arms
        draw.line([2*s, 16*s, 0, 16*s], fill=(0, 0, 0, 255), width=s)
        draw.line([30*s, 16*s, 32*s, 16*s], fill=(0, 0, 0, 255), width=s)
    
    # ── BEACH BALL ──
    elif name == "beach_ball":
        # Base
        draw.ellipse([4*s, 4*s, 28*s, 28*s], fill=(240, 230, 220, 255))
        # Red stripe
        draw.pieslice([4*s, 4*s, 28*s, 28*s], 0, 60, fill=(180, 50, 50, 255))
        draw.pieslice([4*s, 4*s, 28*s, 28*s], 180, 240, fill=(180, 50, 50, 255))
        # Blue stripe
        draw.pieslice([4*s, 4*s, 28*s, 28*s], 60, 120, fill=(60, 150, 200, 255))
        draw.pieslice([4*s, 4*s, 28*s, 28*s], 240, 300, fill=(60, 150, 200, 255))
        # Yellow stripe
        draw.pieslice([4*s, 4*s, 28*s, 28*s], 120, 180, fill=(240, 220, 50, 255))
        draw.pieslice([4*s, 4*s, 28*s, 28*s], 300, 360, fill=(240, 220, 50, 255))
        # Center highlight
        draw.ellipse([12*s, 10*s, 16*s, 14*s], fill=(255, 255, 255, 100))
    
    # ── SUN HAT ──
    elif name == "sun_hat":
        # Brim
        draw.ellipse([0, 12*s, 32*s, 20*s], fill=(200, 160, 120, 255))
        # Crown
        draw.ellipse([6*s, 4*s, 26*s, 14*s], fill=(150, 130, 110, 255))
        # Ribbon
        draw.rectangle([6*s, 10*s, 26*s, 12*s], fill=(180, 50, 50, 255))
        # Flower decoration
        for i in range(5):
            angle = math.radians(i * 72)
            fx = 22*s + int(3*s * math.cos(angle))
            fy = 8*s + int(3*s * math.sin(angle))
            draw.ellipse([fx-2, fy-2, fx+2, fy+2], fill=(220, 120, 160, 255))
        draw.ellipse([21*s, 7*s, 23*s, 9*s], fill=(240, 220, 50, 255))
    
    # ── LEMONADE ──
    elif name == "lemonade":
        # Cup
        draw.polygon([8*s, 10*s, 24*s, 10*s, 22*s, 28*s, 10*s, 28*s], fill=(240, 230, 220, 255))
        # Liquid
        draw.rectangle([10*s, 14*s, 22*s, 24*s], fill=(240, 220, 50, 200))
        # Lemon slice
        draw.ellipse([12*s, 6*s, 20*s, 14*s], fill=(240, 220, 50, 255))
        draw.ellipse([14*s, 8*s, 18*s, 12*s], fill=(240, 230, 220, 255))
        # Straw
        draw.line([18*s, 4*s, 20*s, 18*s], fill=(180, 50, 50, 255), width=s)
        draw.line([20*s, 18*s, 22*s, 14*s], fill=(180, 50, 50, 255), width=s)
    
    # ── SEAGULL ──
    elif name == "seagull":
        # Body
        draw.ellipse([8*s, 12*s, 24*s, 24*s], fill=(240, 230, 220, 255))
        # Wing
        draw.polygon([10*s, 14*s, 16*s, 8*s, 14*s, 16*s], fill=(60, 60, 60, 255))
        draw.polygon([22*s, 14*s, 16*s, 8*s, 18*s, 16*s], fill=(60, 60, 60, 255))
        # Head
        draw.ellipse([20*s, 8*s, 26*s, 16*s], fill=(240, 230, 220, 255))
        # Beak
        draw.polygon([26*s, 10*s, 30*s, 12*s, 26*s, 14*s], fill=(240, 200, 50, 255))
        # Eye
        draw.ellipse([23*s, 10*s, 25*s, 12*s], fill=(0, 0, 0, 255))
        # Tail
        draw.polygon([8*s, 16*s, 4*s, 12*s, 6*s, 20*s], fill=(240, 230, 220, 255))
        # Legs
        draw.line([14*s, 24*s, 14*s, 30*s], fill=(240, 200, 50, 255), width=s)
        draw.line([18*s, 24*s, 18*s, 30*s], fill=(240, 200, 50, 255), width=s)
    
    # ── CLOUD ──
    elif name == "cloud":
        # Fluffy cloud
        draw.ellipse([4*s, 8*s, 28*s, 20*s], fill=(255, 255, 255, 255))
        draw.ellipse([8*s, 4*s, 24*s, 14*s], fill=(255, 255, 255, 255))
        draw.ellipse([0*s, 10*s, 12*s, 18*s], fill=(240, 230, 220, 255))
        draw.ellipse([20*s, 10*s, 32*s, 18*s], fill=(240, 230, 220, 255))
        # Shadow
        draw.ellipse([4*s, 16*s, 28*s, 20*s], fill=(200, 200, 200, 150))
    
    # ── BUCKET ──
    elif name == "bucket":
        # Bucket body
        bucket_color = (180, 50, 50, 255)
        draw.rectangle([8*s, 10*s, 24*s, 26*s], fill=bucket_color)
        draw.ellipse([6*s, 24*s, 26*s, 28*s], fill=(140, 40, 40, 255))  # base
        # Rim
        draw.ellipse([6*s, 8*s, 26*s, 12*s], fill=(200, 60, 60, 255))
        # Handle
        draw.arc([10*s, 2*s, 22*s, 10*s], 0, 180, fill=(100, 100, 100, 255), width=s)
        # Sand inside
        draw.rectangle([10*s, 12*s, 22*s, 16*s], fill=(200, 160, 120, 255))
    
    # ── SPADE ──
    elif name == "spade":
        # Handle
        draw.rectangle([14*s, 2*s, 18*s, 18*s], fill=(120, 70, 30, 255))
        # Spade blade
        draw.polygon([6*s, 18*s, 26*s, 18*s, 22*s, 28*s, 10*s, 28*s], fill=(100, 100, 100, 255))
        draw.rectangle([10*s, 20*s, 22*s, 26*s], fill=(100, 100, 100, 255))
        # Handle grip
        draw.ellipse([13*s, 0*s, 19*s, 4*s], fill=(120, 70, 30, 255))
    
    # ── WATERMELON ──
    elif name == "watermelon":
        # Rind
        draw.ellipse([2*s, 4*s, 30*s, 28*s], fill=(50, 180, 50, 255))
        draw.ellipse([4*s, 6*s, 28*s, 26*s], fill=(0, 135, 81, 255))
        # Flesh
        draw.ellipse([6*s, 8*s, 26*s, 24*s], fill=(220, 60, 60, 255))
        # Seeds
        seed_positions = [(12,14),(18,14),(15,18),(20,16),(10,18)]
        for sx, sy in seed_positions:
            draw.ellipse([sx*s-1, sy*s-1, sx*s+1, sy*s+1], fill=(0, 0, 0, 255))
        # Rind edge
        draw.arc([2*s, 4*s, 30*s, 28*s], 0, 360, fill=(11, 140, 60, 200), width=s)
    
    # ── SAND DOLLAR ──
    elif name == "sand_dollar":
        center_color = (200, 160, 120, 255)
        # Body
        draw.ellipse([6*s, 6*s, 26*s, 26*s], fill=(240, 230, 220, 255))
        # Pattern
        draw.ellipse([10*s, 10*s, 22*s, 22*s], fill=(230, 220, 210, 255))
        draw.ellipse([14*s, 14*s, 18*s, 18*s], fill=center_color)
        # Petal-like slots
        for i in range(5):
            angle = math.radians(-90 + i * 72)
            px = 16*s + int(4*s * math.cos(angle))
            py = 16*s + int(4*s * math.sin(angle))
            draw.ellipse([px-3, py-3, px+3, py+3], fill=(220, 200, 180, 255))
        # Edge texture
        for i in range(8):
            angle = math.radians(i * 45)
            ex = 16*s + int(10*s * math.cos(angle))
            ey = 16*s + int(10*s * math.sin(angle))
            draw.ellipse([ex-1, ey-1, ex+1, ey+1], fill=(210, 190, 170, 255))
    
    # ── LIGHTHOUSE ──
    elif name == "lighthouse":
        # Tower
        draw.rectangle([10*s, 4*s, 22*s, 28*s], fill=(240, 230, 220, 255))
        # Red stripes
        draw.rectangle([10*s, 8*s, 22*s, 12*s], fill=(180, 50, 50, 255))
        draw.rectangle([10*s, 18*s, 22*s, 22*s], fill=(180, 50, 50, 255))
        # Top / Lantern room
        draw.rectangle([12*s, 0*s, 20*s, 4*s], fill=(240, 240, 240, 255))
        # Light
        draw.rectangle([14*s, 0*s, 18*s, 2*s], fill=(240, 220, 50, 255))
        # Dome
        draw.pieslice([12*s, -4*s, 20*s, 2*s], 180, 360, fill=(60, 60, 60, 255))
        # Windows
        draw.rectangle([14*s, 14*s, 18*s, 16*s], fill=(60, 150, 200, 255))
        # Door
        draw.rectangle([14*s, 24*s, 18*s, 28*s], fill=(70, 60, 50, 255))
        # Light beam
        draw.polygon([18*s, 2*s, 30*s, -6*s, 30*s, 10*s], fill=(240, 220, 50, 50))
    
    # ── INFLATABLE FLAMINGO ──
    elif name == "inflatable_flamingo":
        pink = (220, 120, 160, 255)
        # Body
        draw.ellipse([4*s, 8*s, 28*s, 24*s], fill=pink)
        # Neck
        draw.ellipse([24*s, -4*s, 30*s, 16*s], fill=pink)
        # Head
        draw.ellipse([26*s, -6*s, 32*s, 2*s], fill=pink)
        # Beak
        draw.polygon([30*s, -2*s, 36*s, -4*s, 32*s, 0*s], fill=(240, 200, 50, 255))
        # Eye
        draw.ellipse([28*s, -4*s, 30*s, -2*s], fill=(0, 0, 0, 255))
        # Tail feathers
        draw.ellipse([0*s, 6*s, 8*s, 14*s], fill=(240, 200, 50, 255))
        draw.ellipse([2*s, 10*s, 10*s, 18*s], fill=(180, 50, 50, 255))
    
    # ── BEACH POST (sign) ──
    elif name == "beach_post":
        # Post
        draw.rectangle([14*s, 6*s, 18*s, 32*s], fill=(120, 70, 30, 255))
        # Sign board
        draw.rectangle([4*s, 6*s, 28*s, 16*s], fill=(240, 230, 220, 255))
        # Text (arrow)
        draw.polygon([20*s, 9*s, 24*s, 11*s, 20*s, 13*s], fill=(60, 150, 200, 255))
        draw.rectangle([8*s, 10*s, 20*s, 12*s], fill=(60, 150, 200, 255))
        # "BEACH" text (blocks)
        for i, x in enumerate([8, 11, 14, 17, 20]):
            draw.rectangle([x*s, 8*s, (x+2)*s, 10*s], fill=(0, 0, 0, 128))
    
    # ── DECK CHAIR ──
    elif name == "deck_chair":
        # Frame
        frame_color = (240, 230, 220, 255)
        draw.rectangle([0, 4*s, 4*s, 28*s], fill=frame_color)  # left leg
        draw.rectangle([28*s, 4*s, 32*s, 28*s], fill=frame_color)  # right leg
        # Seat (angled)
        draw.line([2*s, 24*s, 30*s, 8*s], fill=(180, 50, 50, 255), width=s*3)  # red
        draw.line([2*s, 20*s, 30*s, 4*s], fill=(240, 230, 220, 255), width=s*2)
        # Armrests
        draw.rectangle([0, 8*s, 4*s, 10*s], fill=(240, 230, 220, 255))
        draw.rectangle([28*s, 2*s, 32*s, 4*s], fill=(240, 230, 220, 255))
        # Head rest
        draw.rectangle([20*s, 0*s, 28*s, 6*s], fill=(180, 50, 50, 255))
    
    # ── JELLYFISH ──
    elif name == "jellyfish":
        # Dome
        draw.ellipse([6*s, 4*s, 26*s, 16*s], fill=(220, 120, 160, 200))
        draw.ellipse([10*s, 2*s, 22*s, 12*s], fill=(240, 150, 180, 180))
        # Tentacles
        tentacle_color = (220, 120, 160, 150)
        for i in range(8):
            x = 8*s + i*2*s
            draw.arc([x, 12*s, x+4, 28*s], 0, 90, fill=tentacle_color, width=s)
        # Eyes
        draw.ellipse([12*s, 8*s, 15*s, 11*s], fill=(0, 0, 0, 255))
        draw.ellipse([17*s, 8*s, 20*s, 11*s], fill=(0, 0, 0, 255))
        # Smile
        draw.arc([12*s, 10*s, 20*s, 14*s], 0, 180, fill=(0, 0, 0, 200), width=s)
    
    # ── COCONUT DRINK ──
    elif name == "coconut_drink":
        # Coconut shell
        draw.ellipse([6*s, 12*s, 26*s, 28*s], fill=(70, 60, 50, 255))
        draw.ellipse([8*s, 14*s, 24*s, 26*s], fill=(100, 85, 70, 255))
        # Hole
        draw.ellipse([14*s, 10*s, 18*s, 14*s], fill=(240, 230, 220, 255))
        # Liquid
        draw.ellipse([15*s, 11*s, 17*s, 13*s], fill=(240, 230, 220, 200))
        # Straw
        draw.line([18*s, 2*s, 20*s, 12*s], fill=(180, 50, 50, 255), width=s)
        # Umbrella pick
        draw.line([12*s, 2*s, 14*s, 12*s], fill=(11, 140, 60, 255), width=s//2)
        # Mini umbrella
        draw.pieslice([8*s, -4*s, 16*s, 4*s], 180, 360, fill=(240, 220, 50, 255))
    
    # ── HOT DOG ──
    elif name == "hot_dog":
        # Bun
        draw.ellipse([2*s, 10*s, 30*s, 22*s], fill=(220, 180, 120, 255))
        # Sausage
        draw.ellipse([4*s, 12*s, 28*s, 20*s], fill=(180, 50, 50, 255))
        # Mustard
        draw.line([6*s, 14*s, 26*s, 14*s], fill=(240, 220, 50, 255), width=s)
        draw.line([6*s, 18*s, 26*s, 18*s], fill=(240, 220, 50, 255), width=s)
    
    # ── POPSICLE ──
    elif name == "popsicle":
        # Ice block
        draw.rectangle([10*s, 4*s, 22*s, 22*s], fill=(60, 150, 200, 255))
        # Stick
        draw.rectangle([14*s, 22*s, 18*s, 30*s], fill=(200, 160, 120, 255))
        # Drip effects
        draw.ellipse([8*s, 20*s, 12*s, 24*s], fill=(60, 150, 200, 200))
        draw.ellipse([20*s, 18*s, 24*s, 22*s], fill=(60, 150, 200, 200))
        # Highlight
        draw.rectangle([12*s, 6*s, 16*s, 10*s], fill=(100, 180, 255, 150))
    
    # ── BEACH WAGON ──
    elif name == "beach_wagon":
        # Body
        draw.rectangle([4*s, 10*s, 28*s, 22*s], fill=(180, 50, 50, 255))
        # Handle
        draw.line([4*s, 16*s, 0*s, 8*s], fill=(100, 100, 100, 255), width=s)
        draw.line([0*s, 8*s, 0*s, 6*s], fill=(100, 100, 100, 255), width=s*2)
        # Wheels
        draw.ellipse([6*s, 20*s, 14*s, 28*s], fill=(60, 60, 60, 255))
        draw.ellipse([18*s, 20*s, 26*s, 28*s], fill=(60, 60, 60, 255))
        draw.ellipse([8*s, 22*s, 12*s, 26*s], fill=(100, 100, 100, 255))
        draw.ellipse([20*s, 22*s, 24*s, 26*s], fill=(100, 100, 100, 255))
        # Items in wagon
        draw.ellipse([10*s, 8*s, 14*s, 14*s], fill=(50, 180, 50, 255))  # ball
        draw.ellipse([18*s, 6*s, 22*s, 12*s], fill=(240, 220, 50, 255))  # something
    
    # ── TROPICAL PINEAPPLE ──
    elif name == "tropical_pineapple":
        # Body
        draw.ellipse([8*s, 6*s, 24*s, 26*s], fill=(220, 160, 60, 255))
        # Crosshatch pattern
        for i in range(7):
            y = 8*s + i*3*s
            for j in range(6):
                x = 9*s + j*3*s
                if (i+j)%2==0:
                    draw.line([x, y, x+2, y+2], fill=(200, 140, 40, 255), width=1)
                    draw.line([x+2, y, x, y+2], fill=(200, 140, 40, 255), width=1)
        # Crown leaves
        leaf_color = (50, 180, 50, 255)
        draw.polygon([16*s, 4*s, 12*s, -2*s, 16*s, 2*s], fill=leaf_color)
        draw.polygon([16*s, 4*s, 20*s, -2*s, 16*s, 2*s], fill=leaf_color)
        draw.polygon([14*s, 5*s, 8*s, -4*s, 14*s, 0*s], fill=(80, 200, 80, 255))
        draw.polygon([18*s, 5*s, 24*s, -4*s, 18*s, 0*s], fill=(80, 200, 80, 255))
    
    # ── SEASHELL CONCH ──
    elif name == "seashell_conch":
        # Large spiral shell
        draw.ellipse([4*s, 8*s, 28*s, 28*s], fill=(240, 200, 160, 255))
        draw.ellipse([10*s, 10*s, 22*s, 22*s], fill=(240, 220, 200, 255))
        # Spiral
        spiral_colors = [(220, 180, 140), (200, 160, 120), (180, 140, 100)]
        for i in range(3):
            r = 6*s - i*2*s
            draw.ellipse([16*s-r, 16*s-r, 16*s+r, 16*s+r], fill=spiral_colors[i] + (200,))
        # Opening
        draw.ellipse([18*s, 14*s, 22*s, 24*s], fill=(220, 120, 160, 200))
        # Pointed top
        draw.polygon([14*s, 6*s, 10*s, 0*s, 12*s, 4*s], fill=(240, 210, 170, 255))
    
    # ── CORAL REEF ──
    elif name == "coral_reef":
        # Base coral
        coral_color = (220, 120, 160, 255)
        draw.ellipse([2*s, 20*s, 14*s, 30*s], fill=coral_color)
        draw.ellipse([18*s, 18*s, 30*s, 30*s], fill=(180, 80, 120, 255))
        # Branches
        for i in range(3):
            x = 4*s + i*4*s
            draw.ellipse([x-s, 16*s, x+s, 22*s], fill=coral_color)
            draw.ellipse([x, 12*s, x+2*s, 18*s], fill=coral_color)
        # Seaweed
        draw.arc([8*s, 14*s, 10*s, 24*s], 180, 360, fill=(50, 180, 50, 200), width=s)
        draw.arc([22*s, 10*s, 24*s, 22*s], 180, 360, fill=(80, 200, 80, 200), width=s)
        draw.arc([24*s, 12*s, 26*s, 24*s], 180, 360, fill=(11, 140, 60, 200), width=s)
        # Starfish on coral
        draw.ellipse([26*s, 16*s, 30*s, 20*s], fill=(240, 200, 50, 200))
    
    # ── WAVE / FOAM ──
    elif name == "wave_foam":
        # Water
        draw.rectangle([0, 16*s, 32*s, 32*s], fill=(60, 150, 200, 255))
        # Wave crest
        draw.ellipse([-4*s, 12*s, 12*s, 22*s], fill=(100, 180, 255, 200))
        draw.ellipse([8*s, 10*s, 20*s, 20*s], fill=(100, 180, 255, 200))
        draw.ellipse([16*s, 14*s, 32*s, 22*s], fill=(100, 180, 255, 200))
        # Foam
        draw.ellipse([0*s, 16*s, 8*s, 20*s], fill=(255, 255, 255, 200))
        draw.ellipse([12*s, 14*s, 18*s, 18*s], fill=(255, 255, 255, 200))
        draw.ellipse([24*s, 16*s, 30*s, 20*s], fill=(255, 255, 255, 200))
        # Bubbles
        for i in range(5):
            bx = random.randint(4, 28) * s
            by = random.randint(18, 26) * s
            draw.ellipse([bx, by, bx+s, by+s], fill=(255, 255, 255, 100))
    
    # ── BEACH SIGN ──
    elif name == "beach_sign":
        # Posts
        draw.rectangle([8*s, 4*s, 10*s, 28*s], fill=(120, 70, 30, 255))
        draw.rectangle([22*s, 4*s, 24*s, 28*s], fill=(120, 70, 30, 255))
        # Board
        draw.rectangle([6*s, 8*s, 26*s, 16*s], fill=(200, 160, 120, 255))
        draw.rectangle([6*s, 8*s, 26*s, 16*s], outline=(70, 60, 50, 255), width=s)
        # Arrow point
        draw.polygon([26*s, 10*s, 30*s, 12*s, 26*s, 14*s], fill=(180, 50, 50, 255))
        # "← BEACH" text blocks
        for j, val in enumerate([(0, "left")]):
            for i, x in enumerate([8, 11, 14, 17]):
                draw.rectangle([x*s, 10*s, (x+2)*s, 12*s], fill=(0, 0, 0, 128))
    
    # ── SNORKEL MASK ──
    elif name == "snorkel_mask":
        # Mask frame
        draw.ellipse([6*s, 8*s, 26*s, 22*s], fill=(0, 0, 0, 255))
        # Glass
        draw.ellipse([8*s, 10*s, 24*s, 20*s], fill=(60, 150, 200, 200))
        # Reflection
        draw.arc([10*s, 12*s, 20*s, 18*s], 180, 360, fill=(100, 180, 255, 100), width=s)
        # Snorkel tube
        draw.rectangle([22*s, 0*s, 24*s, 10*s], fill=(0, 0, 0, 255))
        # Tube bend
        draw.ellipse([20*s, -4*s, 26*s, 4*s], fill=(0, 0, 0, 255))
    
    # ── FLIPPERS (diving) ──
    elif name == "flippers":
        flipper_color = (240, 220, 50, 255)
        # Left flipper
        draw.rectangle([2*s, 6*s, 8*s, 24*s], fill=flipper_color)
        draw.polygon([2*s, 22*s, 12*s, 26*s, 8*s, 28*s, 0*s, 28*s], fill=flipper_color)
        # Right flipper
        draw.rectangle([24*s, 6*s, 30*s, 24*s], fill=flipper_color)
        draw.polygon([20*s, 26*s, 30*s, 22*s, 32*s, 28*s, 24*s, 28*s], fill=flipper_color)
        # Foot straps
        draw.rectangle([3*s, 10*s, 7*s, 12*s], fill=(0, 0, 0, 200))
        draw.rectangle([25*s, 10*s, 29*s, 12*s], fill=(0, 0, 0, 200))
    
    # ── SEA TURTLE ──
    elif name == "sea_turtle":
        # Shell
        shell_color = (0, 135, 81, 255)
        draw.ellipse([6*s, 10*s, 26*s, 24*s], fill=shell_color)
        draw.ellipse([8*s, 12*s, 24*s, 22*s], fill=(50, 180, 50, 255))
        # Shell pattern
        for i in range(3):
            for j in range(2):
                px = 10*s + i*5*s
                py = 13*s + j*5*s
                draw.ellipse([px-2, py-2, px+2, py+2], fill=(80, 200, 80, 200))
        # Head
        draw.ellipse([26*s, 14*s, 32*s, 20*s], fill=(50, 180, 50, 255))
        # Eye
        draw.ellipse([28*s, 16*s, 30*s, 18*s], fill=(0, 0, 0, 255))
        # Flippers
        draw.ellipse([2*s, 14*s, 8*s, 20*s], fill=(50, 180, 50, 255))
        draw.ellipse([24*s, 20*s, 30*s, 26*s], fill=(50, 180, 50, 255))
        # Tail
        draw.polygon([6*s, 22*s, 2*s, 26*s, 8*s, 24*s], fill=(50, 180, 50, 255))
    
    # ── BEACH BATHER ──
    elif name == "beach_bather":
        # Body
        draw.rectangle([10*s, 10*s, 22*s, 22*s], fill=(240, 200, 160, 255))  # skin
        # Swimsuit (bikini top)
        draw.rectangle([10*s, 14*s, 15*s, 16*s], fill=(180, 50, 50, 255))
        draw.rectangle([17*s, 14*s, 22*s, 16*s], fill=(180, 50, 50, 255))
        # Swimsuit bottom
        draw.rectangle([12*s, 18*s, 20*s, 22*s], fill=(60, 150, 200, 255))
        # Head
        draw.ellipse([11*s, 4*s, 21*s, 12*s], fill=(240, 200, 160, 255))
        # Hair
        draw.ellipse([10*s, 2*s, 22*s, 8*s], fill=(200, 160, 80, 255))
        # Sunglasses
        draw.rectangle([12*s, 6*s, 15*s, 8*s], fill=(0, 0, 0, 255))
        draw.rectangle([17*s, 6*s, 20*s, 8*s], fill=(0, 0, 0, 255))
        draw.line([15*s, 7*s, 17*s, 7*s], fill=(0, 0, 0, 255), width=1)
        # Arms
        draw.rectangle([6*s, 12*s, 10*s, 16*s], fill=(240, 200, 160, 255))
        draw.rectangle([22*s, 12*s, 26*s, 16*s], fill=(240, 200, 160, 255))
        # Legs
        draw.rectangle([12*s, 22*s, 16*s, 28*s], fill=(240, 200, 160, 255))
        draw.rectangle([16*s, 22*s, 20*s, 28*s], fill=(240, 200, 160, 255))
    
    # ── BEACH BAG ──
    elif name == "beach_bag":
        # Bag body
        bag_color = (60, 150, 200, 255)
        draw.rectangle([8*s, 10*s, 24*s, 24*s], fill=bag_color)
        draw.ellipse([6*s, 22*s, 26*s, 26*s], fill=(40, 130, 180, 255))  # bottom
        # Open top
        draw.ellipse([6*s, 8*s, 26*s, 12*s], fill=(50, 50, 80, 255))  # inside
        # Handles
        draw.arc([10*s, 4*s, 14*s, 10*s], 180, 360, fill=bag_color, width=s)
        draw.arc([18*s, 4*s, 22*s, 10*s], 180, 360, fill=bag_color, width=s)
        # Stripes
        draw.rectangle([8*s, 14*s, 24*s, 16*s], fill=(180, 50, 50, 255))
        draw.rectangle([8*s, 18*s, 24*s, 20*s], fill=(240, 220, 50, 255))
        # Towel sticking out
        draw.rectangle([20*s, 6*s, 24*s, 14*s], fill=(180, 50, 50, 200))
    
    # ── SAND TILE ──
    elif name == "tile_sand":
        # Sand base
        draw.rectangle([0, 0, 32*s, 32*s], fill=(200, 160, 120, 255))
        # Texture dots
        for i in range(20):
            sx = random.randint(0, 32*s)
            sy = random.randint(0, 32*s)
            shade = random.choice([(180, 140, 100, 100), (220, 180, 140, 100)])
            draw.ellipse([sx, sy, sx+2, sy+2], fill=shade)
        # Small shells
        for i in range(3):
            sx = random.randint(4, 28) * s
            sy = random.randint(4, 28) * s
            draw.ellipse([sx, sy, sx+s, sy+s//2], fill=(240, 230, 220, 150))
    
    # ── WATER TILE ──
    elif name == "tile_water":
        # Deep ocean base
        draw.rectangle([0, 0, 32*s, 32*s], fill=(40, 80, 120, 255))  # dark ocean (index 20)
        # Mid-depth water
        draw.rectangle([0, 0, 32*s, 28*s], fill=(80, 160, 200, 255))  # deep ocean (index 19)
        # Shallow surface water
        draw.rectangle([0, 0, 32*s, 20*s], fill=(60, 150, 200, 255))  # ocean blue (index 12)
        # Wave crests (swell shapes)
        for i in range(3):
            cx = 2*s + i * 12*s
            cy = 4*s + i * 8*s
            draw.ellipse([cx-4*s, cy-2*s, cx+6*s, cy+3*s], fill=(100, 180, 255, 200))  # sky blue (index 16)
        # Foam crests (white)
        for i in range(4):
            fx = 2*s + i * 8*s
            fy = 2*s + i * 6*s
            draw.ellipse([fx-1, fy, fx+4, fy+2], fill=(255, 255, 255, 220))  # white
        # Ripples with good contrast
        for i in range(3):
            y = 10*s + i * 8*s
            draw.arc([4*s, y, 28*s, y+3*s], 0, 180, fill=(100, 180, 255, 255), width=2)
            draw.arc([6*s, y+2, 26*s, y+5*s], 0, 180, fill=(255, 255, 255, 180), width=1)
        # Depth gradient at bottom
        for i in range(4):
            y = 24*s + i*2*s
            alpha = 50 + i*30
            draw.rectangle([0, y, 32*s, y+s], fill=(40, 80, 120, min(alpha, 180)))
        # Sparkle highlights
        for i in range(5):
            sx = 3*s + (i * 7*s)
            sy = 3*s + (i * 6*s)
            draw.ellipse([sx, sy, sx+2, sy+2], fill=(255, 255, 255, 180))
    
    # ── SHORE TILE ──
    elif name == "tile_shore":
        # Deep water background
        draw.rectangle([0, 0, 32*s, 32*s], fill=(40, 80, 120, 255))  # dark ocean (index 20)
        # Mid water
        draw.rectangle([0, 0, 32*s, 18*s], fill=(80, 160, 200, 255))  # deep ocean (index 19)
        # Shallow water
        draw.rectangle([0, 0, 32*s, 14*s], fill=(60, 150, 200, 255))  # ocean blue (index 12)
        # Wave foam crest (sharp white edge between water and sand)
        draw.rectangle([0, 12*s, 32*s, 14*s], fill=(100, 180, 255, 255))  # sky blue transition
        draw.arc([-4*s, 11*s, 36*s, 15*s], 0, 180, fill=(255, 255, 255, 255), width=3*s)  # bright white foam
        # Second foam layer
        draw.arc([0, 13*s, 32*s, 17*s], 0, 180, fill=(180, 220, 255, 200), width=2*s)
        # Wet sand edge (dark)
        draw.rectangle([0, 15*s, 32*s, 18*s], fill=(150, 130, 110, 255))  # tan (index 6)
        # Dry sand
        draw.rectangle([0, 17*s, 32*s, 32*s], fill=(200, 160, 120, 255))  # sand (index 18)
        # Sand detail near water
        draw.rectangle([0, 17*s, 32*s, 20*s], fill=(180, 140, 100, 255))  # darker wet sand
        # Water ripples (above the foam)
        draw.arc([2*s, 3*s, 30*s, 6*s], 0, 180, fill=(100, 180, 255, 180), width=2)
        draw.arc([4*s, 7*s, 28*s, 10*s], 0, 180, fill=(100, 180, 255, 150), width=1)
        # Bubbles in foam zone
        for i in range(4):
            bx = 4*s + i * 8*s
            draw.ellipse([bx, 13*s, bx+2, 13*s+2], fill=(255, 255, 255, 200))
        # Sand texture dots
        for i in range(10):
            sx = random.randint(2, 30) * s
            sy = random.randint(19*s, 30*s)
            shade = random.choice([(180, 140, 100, 100), (220, 180, 140, 80)])
            draw.ellipse([sx, sy, sx+1, sy+1], fill=shade)
    
    # ── BOARDWALK TILE ──
    elif name == "tile_boardwalk":
        # Sand below
        draw.rectangle([0, 0, 32*s, 32*s], fill=(200, 160, 120, 255))  # sand (index 18)
        # Shadow/sand below boardwalk
        draw.rectangle([0, 0, 32*s, 32*s], fill=(180, 140, 100, 200))  # darker sand
        # Planks with gaps
        for i in range(8):
            x = i * 4*s
            # Gap between planks (dark brown)
            draw.rectangle([x, 0, x+1, 32*s], fill=(70, 60, 50, 255))  # dark sandy (index 5)
            # Main plank surface
            draw.rectangle([x+1, 0, x+3, 32*s], fill=(180, 120, 60, 255))  # wood (index 22)
            # Plank highlight (top edge lighter)
            draw.rectangle([x+1, 0, x+3, 2*s], fill=(200, 160, 120, 255))  # sand tone
            # Plank top highlight strip
            draw.rectangle([x+1, 0, x+3, s], fill=(220, 180, 140, 255))  # brightest highlight
            # Wood grain line
            draw.line([x+1, 14*s, x+3, 14*s], fill=(160, 100, 40, 180), width=1)
            draw.line([x+1, 22*s, x+3, 22*s], fill=(160, 100, 40, 180), width=1)
        # Nail holes (dark) with highlight
        for i in range(8):
            nx = i * 4*s + 1
            # Nail hole shadow
            draw.ellipse([nx, 4*s-1, nx+2, 4*s+1], fill=(40, 30, 20, 255))  # near black
            # Nail highlight (white dot)
            draw.ellipse([nx, 4*s-1, nx+1, 4*s], fill=(220, 200, 180, 200))
            # Bottom nail row
            draw.ellipse([nx, 28*s-1, nx+2, 28*s+1], fill=(40, 30, 20, 255))
            draw.ellipse([nx, 28*s-1, nx+1, 28*s], fill=(220, 200, 180, 200))
        # Boardwalk edge shadows
        draw.rectangle([0, 0, 32*s, 1], fill=(70, 60, 50, 200))  # top edge shadow
        draw.rectangle([0, 31*s, 32*s, 32*s], fill=(70, 60, 50, 200))  # bottom edge shadow
    
    # ── BEACH TOWEL STRIPED ── (alternate)
    elif name == "beach_towel_striped":
        # Horizontal stripes
        for i in range(8):
            y = i * 4*s
            colors = [(220, 120, 160, 255), (240, 220, 50, 255), (60, 150, 200, 255),
                     (50, 180, 50, 255), (180, 50, 50, 255)]
            draw.rectangle([0, y, 32*s, y+4*s], fill=colors[i % len(colors)])
        # Border
        draw.rectangle([0, 0, 32*s, 2*s], fill=(240, 230, 220, 255))
        draw.rectangle([0, 30*s, 32*s, 32*s], fill=(240, 230, 220, 255))
    
    # ── SUNSET ──
    elif name == "sunset":
        # Sky gradient
        sky_colors = [(100, 180, 255, 255), (240, 200, 160, 255), (220, 140, 50, 255)]
        for i, col in enumerate(sky_colors):
            draw.rectangle([0, i*10*s, 32*s, (i+1)*10*s], fill=col)
        # Sun
        draw.ellipse([10*s, 14*s, 22*s, 26*s], fill=(240, 220, 50, 255))
        # Reflection
        draw.ellipse([12*s, 18*s, 20*s, 24*s], fill=(240, 200, 50, 100))
        # Ocean
        draw.rectangle([0, 24*s, 32*s, 32*s], fill=(60, 150, 200, 200))
        # Clouds
        draw.ellipse([2*s, 4*s, 12*s, 10*s], fill=(220, 140, 50, 150))
        draw.ellipse([20*s, 6*s, 30*s, 12*s], fill=(220, 140, 50, 150))
    
    # ── SEASHELL SCALLOP ──
    elif name == "seashell_scallop":
        # Fan shape
        draw.pieslice([4*s, 4*s, 28*s, 28*s], 180, 360, fill=(240, 200, 160, 255))
        # Ridges
        for i in range(7):
            angle = 180 + i * 25
            rad = math.radians(angle)
            end_x = 16*s + int(12*s * math.cos(rad))
            end_y = 16*s + int(12*s * math.sin(rad))
            draw.line([16*s, 16*s, end_x, end_y], fill=(180, 140, 100, 150), width=2)
        # Edge scallops
        for i in range(7):
            angle = 180 + i * 25
            rad = math.radians(angle)
            cx = 16*s + int(10*s * math.cos(rad))
            cy = 16*s + int(10*s * math.sin(rad))
            draw.ellipse([cx-3, cy-1, cx+3, cy+3], fill=(240, 220, 200, 200))
        # Hinge
        draw.ellipse([14*s, 20*s, 18*s, 24*s], fill=(200, 160, 120, 255))
    
    # ── BEACH FLAG ──
    elif name == "beach_flag":
        # Pole
        draw.rectangle([14*s, 0*s, 16*s, 32*s], fill=(240, 230, 220, 255))
        # Flag
        flag_colors = [(180, 50, 50, 255), (240, 220, 50, 255), (60, 150, 200, 255)]
        for i, col in enumerate(flag_colors):
            draw.polygon([
                16*s, 2*s + i*4*s,
                30*s, 6*s + i*4*s,
                16*s, 8*s + i*4*s
            ], fill=col)
        # Ball top
        draw.ellipse([14*s, -2*s, 16*s, 0*s], fill=(240, 220, 50, 255))
    
    # ── BEACH NET (volleyball/badminton) ──
    elif name == "beach_net":
        # Poles (dark wood with lighter highlight)
        draw.rectangle([2*s, 0*s, 5*s, 30*s], fill=(120, 70, 30, 255))  # brown pole left
        draw.rectangle([27*s, 0*s, 30*s, 30*s], fill=(120, 70, 30, 255))  # brown pole right
        draw.rectangle([2*s, 0*s, 3*s, 30*s], fill=(160, 120, 80, 255))  # lighter edge left
        draw.rectangle([29*s, 0*s, 30*s, 30*s], fill=(160, 120, 80, 255))  # lighter edge right
        # Pole tops (rounded caps)
        draw.ellipse([2*s, 0*s, 5*s, 3*s], fill=(200, 160, 120, 255))
        draw.ellipse([27*s, 0*s, 30*s, 3*s], fill=(200, 160, 120, 255))
        # Top rope (thick white edge)
        draw.rectangle([2*s, 3*s, 30*s, 5*s], fill=(240, 230, 220, 255))
        draw.rectangle([2*s, 3*s, 30*s, 4*s], fill=(255, 255, 255, 255))
        # Bottom rope
        draw.rectangle([2*s, 27*s, 30*s, 29*s], fill=(240, 230, 220, 255))
        # Net mesh — thicker lines, opaque, dark gray
        for y in range(6, 28, 3):
            draw.line([5*s, y*s, 27*s, y*s], fill=(80, 80, 80, 200), width=2)
        for x in range(5, 27, 4):
            draw.line([x*s, 5*s, x*s, 27*s], fill=(80, 80, 80, 200), width=2)
        # Buoy floats (red and white alternating)
        buoy_colors = [(180, 50, 50, 255), (240, 230, 220, 255), (60, 150, 200, 255)]
        for i, col in enumerate(buoy_colors):
            bx = 6*s + i * 9*s
            draw.ellipse([bx-2, 5*s-2, bx+2, 5*s+2], fill=col)
        # Center float (bigger)
        draw.ellipse([14*s, 4*s, 18*s, 7*s], fill=(180, 50, 50, 255))
        draw.rectangle([15*s, 5*s, 17*s, 6*s], fill=(240, 230, 220, 255))
    
    # ── WATERMELON SLICE ──
    elif name == "watermelon_slice":
        # Rind
        draw.pieslice([0, 4*s, 32*s, 28*s], 45, 135, fill=(50, 180, 50, 255))
        # Inner rind
        draw.pieslice([2*s, 6*s, 30*s, 26*s], 45, 135, fill=(0, 135, 81, 255))
        # Flesh
        draw.pieslice([4*s, 8*s, 28*s, 24*s], 45, 135, fill=(220, 60, 60, 255))
        # Seeds
        seed_pos = [(12,14),(16,16),(20,14),(14,18),(18,18)]
        for sx, sy in seed_pos:
            draw.ellipse([sx*s-1, sy*s-1, sx*s+1, sy*s+1], fill=(0, 0, 0, 255))
    
    # ── ICE CREAM TRUCK (mini) ──
    elif name == "ice_cream_truck":
        # Body
        draw.rectangle([2*s, 10*s, 30*s, 24*s], fill=(240, 230, 220, 255))
        # Cabin
        draw.rectangle([2*s, 10*s, 10*s, 24*s], fill=(60, 150, 200, 255))
        # Windshield
        draw.rectangle([3*s, 11*s, 9*s, 16*s], fill=(100, 180, 255, 200))
        # Wheels
        draw.ellipse([4*s, 22*s, 9*s, 28*s], fill=(0, 0, 0, 255))
        draw.ellipse([23*s, 22*s, 28*s, 28*s], fill=(0, 0, 0, 255))
        # Ice cream decal
        draw.rectangle([12*s, 12*s, 20*s, 22*s], fill=(220, 120, 160, 255))
        draw.rectangle([14*s, 10*s, 18*s, 14*s], fill=(240, 230, 220, 255))
        # Window
        draw.rectangle([14*s, 14*s, 18*s, 18*s], fill=(240, 220, 50, 200))
        # Roof
        draw.rectangle([2*s, 8*s, 30*s, 10*s], fill=(180, 50, 50, 255))
    
    # ── BEACH PICNIC ──
    elif name == "beach_picnic":
        # Blanket
        draw.rectangle([2*s, 16*s, 30*s, 26*s], fill=(180, 50, 50, 200))
        # Basket
        draw.rectangle([10*s, 10*s, 22*s, 20*s], fill=(160, 120, 80, 255))
        draw.arc([8*s, 8*s, 24*s, 12*s], 0, 180, fill=(160, 120, 80, 255), width=s)
        # Handle
        draw.arc([12*s, 4*s, 20*s, 10*s], 0, 180, fill=(120, 80, 40, 255), width=s)
        # Food items
        draw.ellipse([6*s, 18*s, 10*s, 22*s], fill=(240, 200, 50, 255))
        draw.ellipse([24*s, 20*s, 28*s, 24*s], fill=(50, 180, 50, 255))
        draw.ellipse([14*s, 20*s, 18*s, 24*s], fill=(180, 50, 50, 255))
    
    # ── LIFEGUARD ──
    elif name == "lifeguard":
        # Body
        draw.rectangle([10*s, 10*s, 22*s, 22*s], fill=(240, 200, 160, 255))
        # Shirt (red)
        draw.rectangle([10*s, 12*s, 22*s, 18*s], fill=(180, 50, 50, 255))
        # "LIFEGUARD" text box
        draw.rectangle([12*s, 14*s, 19*s, 16*s], fill=(240, 230, 220, 255))
        # Shorts (red)
        draw.rectangle([10*s, 18*s, 22*s, 22*s], fill=(180, 50, 50, 255))
        # Head
        draw.ellipse([11*s, 4*s, 21*s, 12*s], fill=(240, 200, 160, 255))
        # Sunglasses
        draw.rectangle([12*s, 6*s, 15*s, 8*s], fill=(0, 0, 0, 255))
        draw.rectangle([17*s, 6*s, 20*s, 8*s], fill=(0, 0, 0, 255))
        # Hat (red cap)
        draw.ellipse([10*s, 2*s, 22*s, 8*s], fill=(180, 50, 50, 255))
        # Whistle
        draw.line([6*s, 14*s, 10*s, 14*s], fill=(100, 100, 100, 255), width=s)
        draw.ellipse([4*s, 12*s, 7*s, 15*s], fill=(240, 220, 50, 255))
        # Arms
        draw.rectangle([6*s, 12*s, 10*s, 18*s], fill=(240, 200, 160, 255))
        draw.rectangle([22*s, 12*s, 26*s, 18*s], fill=(240, 200, 160, 255))
    
    # ── TROPICAL FLOWER ──
    elif name == "tropical_flower":
        # Petals
        petal_colors = [(220, 120, 160, 255), (240, 220, 50, 255), (180, 50, 50, 255)]
        for j, col in enumerate(petal_colors):
            for i in range(5):
                angle = math.radians(i * 72 + j * 30)
                px = 16*s + int(8*s * math.cos(angle))
                py = 16*s + int(8*s * math.sin(angle))
                draw.ellipse([px-4, py-4, px+4, py+4], fill=col)
        # Center
        draw.ellipse([14*s, 14*s, 18*s, 18*s], fill=(240, 220, 50, 255))
        draw.ellipse([15*s, 15*s, 17*s, 17*s], fill=(180, 50, 50, 255))
        # Stem
        draw.rectangle([15*s, 20*s, 17*s, 30*s], fill=(50, 180, 50, 255))
        # Leaves
        draw.ellipse([10*s, 24*s, 18*s, 28*s], fill=(80, 200, 80, 200))
        draw.ellipse([14*s, 26*s, 22*s, 30*s], fill=(11, 140, 60, 200))
    
    # ── SAND TILE WITH STARFISH ──
    elif name == "tile_sand_starfish":
        # Same as sand tile
        draw.rectangle([0, 0, 32*s, 32*s], fill=(200, 160, 120, 255))
        for i in range(15):
            sx = random.randint(0, 32*s)
            sy = random.randint(0, 32*s)
            shade = random.choice([(180, 140, 100, 100), (220, 180, 140, 100)])
            draw.ellipse([sx, sy, sx+2, sy+2], fill=shade)
        # Starfish on top
        cx, cy = 16*s, 16*s
        r1, r2 = 5*s, 3*s
        points = []
        for i in range(10):
            angle = math.radians(-90 + i * 36)
            r = r1 if i % 2 == 0 else r2
            points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
        draw.polygon(points, fill=(220, 140, 50, 200))
        draw.ellipse([cx-2, cy-2, cx+2, cy+2], fill=(240, 200, 50, 200))
    
    # ── HAMMOCK ──
    elif name == "hammock":
        # Trees/posts
        draw.rectangle([0*s, 4*s, 3*s, 30*s], fill=(120, 70, 30, 255))  # left post
        draw.rectangle([29*s, 4*s, 32*s, 30*s], fill=(120, 70, 30, 255))  # right post
        # Hammock body
        draw.arc([4*s, 16*s, 28*s, 26*s], 0, 180, fill=(50, 180, 50, 200), width=4*s)
        # Ropes
        draw.line([3*s, 8*s, 10*s, 18*s], fill=(200, 160, 80, 255), width=1)
        draw.line([29*s, 8*s, 22*s, 18*s], fill=(200, 160, 80, 255), width=1)
        # Stripes on hammock
        for i in range(4):
            x = 8*s + i*6*s
            draw.arc([x, 18*s, x+4*s, 24*s], 0, 180, fill=(60, 150, 200, 200), width=2)
    
    else:
        return None, 0, 0  # Unknown sprite
    
    return img, 32*s, 32*s


# ═══════════════════════════════════════════════════════════════
#  ALL SUMMER BEACH ITEMS
# ═══════════════════════════════════════════════════════════════

SUMMER_ITEMS = [
    ("sunny_sun", "Sunny Sun (sun character)"),
    ("beach_crab", "Beach Crab"),
    ("palm_tree", "Palm Tree"),
    ("beach_umbrella", "Beach Umbrella"),
    ("sandcastle", "Sandcastle"),
    ("beach_towel", "Beach Towel (folded)"),
    ("seashell", "Seashell (spiral)"),
    ("starfish", "Starfish"),
    ("surfboard", "Surfboard"),
    ("ice_cream", "Ice Cream Cone"),
    ("flip_flops", "Flip Flops"),
    ("life_ring", "Life Ring"),
    ("sunglasses", "Sunglasses"),
    ("beach_ball", "Beach Ball"),
    ("sun_hat", "Sun Hat"),
    ("lemonade", "Lemonade"),
    ("seagull", "Seagull"),
    ("cloud", "Cloud"),
    ("bucket", "Bucket"),
    ("spade", "Spade"),
    ("watermelon", "Watermelon"),
    ("sand_dollar", "Sand Dollar"),
    ("lighthouse", "Lighthouse"),
    ("inflatable_flamingo", "Inflatable Flamingo"),
    ("beach_post", "Beach Post"),
    ("deck_chair", "Deck Chair"),
    ("jellyfish", "Jellyfish"),
    ("coconut_drink", "Coconut Drink"),
    ("hot_dog", "Hot Dog"),
    ("popsicle", "Popsicle"),
    ("beach_wagon", "Beach Wagon"),
    ("tropical_pineapple", "Tropical Pineapple"),
    ("seashell_conch", "Seashell Conch"),
    ("coral_reef", "Coral Reef"),
    ("wave_foam", "Wave & Foam"),
    ("beach_sign", "Beach Sign"),
    ("snorkel_mask", "Snorkel Mask"),
    ("flippers", "Flippers (diving)"),
    ("sea_turtle", "Sea Turtle"),
    ("beach_bather", "Beach Bather"),
    ("beach_bag", "Beach Bag"),
    ("tile_sand", "Sand Tile"),
    ("tile_water", "Water Tile"),
    ("tile_shore", "Shore Tile"),
    ("tile_boardwalk", "Boardwalk Tile"),
    ("beach_towel_striped", "Beach Towel (striped)"),
    ("sunset", "Sunset"),
    ("seashell_scallop", "Seashell Scallop"),
    ("beach_flag", "Beach Flag"),
    ("beach_net", "Beach Net"),
    ("watermelon_slice", "Watermelon Slice"),
    ("ice_cream_truck", "Ice Cream Truck"),
    ("beach_picnic", "Beach Picnic"),
    ("lifeguard", "Lifeguard"),
    ("tropical_flower", "Tropical Flower"),
    ("tile_sand_starfish", "Sand Starfish Tile"),
    ("hammock", "Hammock"),
]

# ═══════════════════════════════════════════════════════════════
#  RENDER
# ═══════════════════════════════════════════════════════════════

def quantize_to_palette(img, palette):
    """Quantize an image to the given palette."""
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    
    result = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rpixels = result.load()
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 20:
                continue  # keep transparent
            # Find nearest palette color
            best = 0
            best_d = 999999
            for i, (pr, pg, pb) in enumerate(palette):
                d = (r-pr)**2 + (g-pg)**2 + (b-pb)**2
                if d < best_d:
                    best_d = d
                    best = i
            pr, pg, pb = palette[best]
            rpixels[x, y] = (pr, pg, pb, 255)
    
    return result


def add_outline(img, outline_color=(0, 0, 0)):
    """Add black outline around non-transparent pixels."""
    pixels = img.load()
    w, h = img.size
    
    result = img.copy()
    rpixels = result.load()
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 0:
                # Check neighbors for transparency
                for nx, ny in [(x-1,y), (x+1,y), (x,y-1), (x,y+1)]:
                    if nx < 0 or nx >= w or ny < 0 or ny >= h:
                        continue
                    na = pixels[nx, ny][3] if nx < w and ny < h else 0
                    if na == 0:
                        # Neighbor is transparent — add outline
                        for ox, oy in [(x-1,y), (x+1,y), (x,y-1), (x,y+1)]:
                            if 0 <= ox < w and 0 <= oy < h:
                                rpixels[ox, oy] = outline_color + (255,)
                        break
    
    return result


def downscale_sharp(img, target_size, palette):
    """Downscale with nearest-neighbor for crisp pixel art look, then re-quantize."""
    w, h = img.size
    # First, index-ify (band each color to nearest palette entry)
    indexed = quantize_to_palette(img, palette)
    # Downscale with NEAREST for pixel-perfect result
    indexed = indexed.resize((target_size, target_size), Image.NEAREST)
    return indexed


def process_sprite(name, output_dir, scale, target_size, palette):
    """Generate, quantize, outline, and downscale a single sprite."""
    sprite_dir = output_dir / name
    sprite_dir.mkdir(parents=True, exist_ok=True)
    
    raw_path = sprite_dir / f"{name}_raw.png"
    final_path = sprite_dir / f"{name}_{target_size}px.png"
    
    img, w, h = draw_sprite(name, scale)
    if img is None:
        print(f"  ✗ {name}: unknown sprite")
        return None
    
    # Quantize to palette
    indexed = quantize_to_palette(img, palette)
    indexed.save(raw_path)
    
    # Add outline
    outlined = add_outline(indexed)
    
    # Downscale
    final = downscale_sharp(outlined, target_size, palette)
    final = add_outline(final)
    final = quantize_to_palette(final, palette)  # re-quantize after outline
    final.save(final_path)
    
    return final_path


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Summer Beach Cozy Pack - Pixel Art Forge")
    parser.add_argument("--all", action="store_true", help="Generate ALL summer beach items")
    parser.add_argument("--item", default=None, help="Generate specific item by name")
    parser.add_argument("--list", action="store_true", help="List available items")
    parser.add_argument("--output", default=None, help="Output directory")
    parser.add_argument("--scale", type=int, default=4, help="Internal scale factor (default: 4)")
    parser.add_argument("--size", type=int, default=32, help="Target pixel size (default: 32)")
    
    args = parser.parse_args()
    
    output_dir = Path(args.output) if args.output else \
        Path(__file__).resolve().parent / "forge-output" / "summer-beach-cozy-pack"
    
    if args.list:
        print("\n🏖️  SUMMER BEACH COZY PACK — Available Items\n")
        print(f"{'NAME':30s} {'DESCRIPTION'}")
        print("-" * 60)
        for name, desc in SUMMER_ITEMS:
            print(f"{name:30s} {desc}")
        print(f"\nTotal: {len(SUMMER_ITEMS)} items")
        return 0
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    items_to_gen = []
    if args.item:
        name = args.item.strip()
        found = False
        for n, desc in SUMMER_ITEMS:
            if n == name:
                items_to_gen.append((n, desc))
                found = True
                break
        if not found:
            print(f"❌ Unknown item: {name}")
            print("Use --list to see available items")
            return 1
    elif args.all:
        items_to_gen = SUMMER_ITEMS
    else:
        print("Use --all or --item NAME or --list")
        return 1
    
    scale = args.scale
    target_size = args.size
    
    print(f"\n{'═' * 55}")
    print(f"🏖️  SUMMER BEACH COZY PACK — Forging {len(items_to_gen)} items")
    print(f"   Scale: {scale}x, Target: {target_size}x{target_size}px")
    print(f"   Output: {output_dir}")
    print(f"{'═' * 55}\n")
    
    generated = []
    start_time = time.time()
    
    for i, (name, desc) in enumerate(items_to_gen, 1):
        print(f"  [{i}/{len(items_to_gen)}] {desc}...", end=" ", flush=True)
        result = process_sprite(name, output_dir, scale, target_size, PALETTE)
        if result:
            generated.append(result)
            print(f"✓")
        else:
            print(f"✗")
    
    elapsed = time.time() - start_time
    
    # Create a sprite sheet of all items
    try:
        from PIL import Image as PILImage
        cols = 8
        rows = (len(generated) + cols - 1) // cols
        item_size = target_size
        sheet = PILImage.new("RGBA", (cols * item_size, rows * item_size), (0, 0, 0, 0))
        
        for i, fpath in enumerate(generated):
            img = PILImage.open(fpath).convert("RGBA")
            x = (i % cols) * item_size
            y = (i // cols) * item_size
            sheet.paste(img, (x, y), img)
        
        sheet_path = output_dir / "summer_beach_cozy_pack_spritesheet.png"
        sheet.save(str(sheet_path))
        print(f"\n  📋 Mega sprite sheet: {sheet_path.name} ({cols}x{rows})")
    except Exception as e:
        print(f"\n  ⚠️ Sheet compilation: {e}")
    
    # Create metadata
    meta = {
        "pack": "Summer Beach Cozy Pack",
        "version": "1.0",
        "target": f"{target_size}x{target_size}px",
        "palette": f"{len(PALETTE)} colors (PICO-8 inspired, beach-friendly)",
        "total_items": len(generated),
        "items": [{
            "name": name,
            "slug": name,
            "description": desc,
            "file": f"{name}/{name}_{target_size}px.png"
        } for name, desc in items_to_gen if (output_dir / name / f"{name}_{target_size}px.png").exists()],
        "sprite_sheet": "summer_beach_cozy_pack_spritesheet.png",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "license": "CC0",
        "tags": ["summer", "beach", "cozy", "pixel-art", "game-ready"],
    }
    
    meta_path = output_dir / "summer_beach_cozy_pack_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    
    print(f"\n{'═' * 55}")
    print(f"✅ FORGING COMPLETE! {len(generated)}/{len(items_to_gen)} items")
    print(f"   Time: {elapsed:.1f}s")
    print(f"   Output: {output_dir}")
    print(f"   Metadata: {meta_path.name}")
    print(f"{'═' * 55}\n")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
