#!/usr/bin/env python3
"""
zoo-forge.py — Pixel Zoo & Safari Pack generator.

Generates 40+ game-ready pixel art sprites for a Zoo & Safari theme,
using Python PIL with PICO-8-style palette, high-res drawing, and
pixel-perfect downscaling to 32x32 with clean black outlines.

Usage:
    python zoo-forge.py [--all] [--item NAME] [--list]
"""

import sys, os, json, math, time, random
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    print("❌ PIL required. pip install Pillow")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════
#  ZOO PALETTE (PICO-8 inspired, vibrant & earthy)
# ═══════════════════════════════════════════════════════════════

PALETTE = [
    (0, 0, 0),         # 0  — outline/black
    (29, 43, 83),      # 1  — dark navy
    (126, 37, 83),     # 2  — dark purple
    (0, 135, 81),      # 3  — dark green
    (120, 70, 30),     # 4  — brown
    (70, 60, 50),      # 5  — dark brown
    (150, 130, 110),   # 6  — tan
    (240, 230, 220),   # 7  — off-white
    (180, 50, 50),     # 8  — red
    (220, 140, 50),    # 9  — orange
    (240, 220, 50),    # 10 — yellow
    (50, 180, 50),     # 11 — bright green
    (60, 150, 200),    # 12 — blue
    (130, 110, 150),   # 13 — purple
    (220, 120, 160),   # 14 — pink
    (240, 200, 160),   # 15 — peach / skin
    (170, 200, 150),   # 16 — sage green
    (255, 255, 255),   # 17 — white
    (200, 160, 120),   # 18 — sand
    (80, 160, 200),    # 19 — sky blue
    (40, 80, 120),     # 20 — steel blue
    (80, 200, 80),     # 21 — tropical green
    (180, 120, 60),    # 22 — wood
    (160, 80, 40),     # 23 — dark wood
    (80, 60, 40),      # 24 — very dark brown
    (90, 90, 90),      # 25 — gray (elephant)
    (140, 140, 130),   # 26 — light gray
    (50, 50, 50),      # 27 — dark gray (rock)
    (60, 100, 60),     # 28 — forest green
    (210, 180, 140),   # 29 — light tan / sand
]

C = {
    "out": 0, "navy": 1, "purp": 2, "dkgr": 3, "brown": 4,
    "dkbr": 5, "tan": 6, "offw": 7, "red": 8, "orng": 9,
    "ylw": 10, "grn": 11, "blue": 12, "purp": 13, "pink": 14,
    "skin": 15, "sage": 16, "wht": 17, "sand": 18, "sky": 19,
    "stlb": 20, "tgrn": 21, "wood": 22, "dkwd": 23, "vdkb": 24,
    "gray": 25, "ltgy": 26, "dkgry": 27, "fgrn": 28, "ltsd": 29,
}

def palettize(pixel, palette):
    """Find nearest palette color by Euclidean distance."""
    r, g, b, *_ = pixel if len(pixel) >= 3 else (0, 0, 0)
    best = 0
    best_d = 999999
    for i, (pr, pg, pb) in enumerate(palette):
        d = (r-pr)**2 + (g-pg)**2 + (b-pb)**2
        if d < best_d:
            best_d = d
            best = i
    return best

def add_outline(img, s, palette, outline_idx=0):
    """Add black outline around visible pixels."""
    px = img.load()
    w, h = img.size
    # Make a copy with outline
    outline_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ol_px = outline_layer.load()
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:  # transparent
                continue
            # Check neighbors
            for dx, dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)]:
                nx, ny = x+dx, y+dy
                if 0 <= nx < w and 0 <= ny < h:
                    nr, ng, nb, na = px[nx, ny]
                    if na < 10:
                        ol_px[x, y] = palette[outline_idx] + (255,)
                        break
    
    # Composite outline under original
    result = Image.alpha_composite(outline_layer, img)
    return result

def render_sprite(name, scale=4):
    """Render a sprite at scale× and return the downscaled 32x32 image."""
    s = scale
    w, h = 32 * s, 32 * s
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # ── LION ──
    if name == "lion":
        # Body
        body_color = (220, 180, 100, 255)  # golden
        draw.ellipse([7*s, 12*s, 25*s, 28*s], fill=body_color)
        # Head
        draw.ellipse([10*s, 4*s, 22*s, 16*s], fill=body_color)
        # Mane
        mane_color = (160, 100, 40, 255)
        draw.ellipse([8*s, 2*s, 24*s, 18*s], fill=None, outline=mane_color, width=2*s)
        # Ears
        draw.ellipse([10*s, 2*s, 13*s, 6*s], fill=mane_color)
        draw.ellipse([19*s, 2*s, 22*s, 6*s], fill=mane_color)
        # Eyes
        draw.ellipse([13*s, 7*s, 15*s, 10*s], fill=(0, 0, 0, 255))
        draw.ellipse([17*s, 7*s, 19*s, 10*s], fill=(0, 0, 0, 255))
        # Nose
        draw.ellipse([15*s, 10*s, 17*s, 12*s], fill=(0, 0, 0, 255))
        # Mouth
        draw.arc([14*s, 10*s, 18*s, 14*s], 0, 180, fill=(0, 0, 0, 255), width=1*s)
        # Legs
        for lx in [10*s, 12*s, 20*s, 22*s]:
            draw.rectangle([lx, 25*s, lx+2*s, 30*s], fill=(180, 140, 70, 255))
        # Tail
        draw.line([24*s, 14*s, 30*s, 8*s], fill=(180, 140, 70, 255), width=2*s)
        draw.ellipse([29*s, 6*s, 32*s, 10*s], fill=(160, 100, 40, 255))
    
    # ── TIGER ──
    elif name == "tiger":
        # Body
        body_color = (230, 170, 60, 255)  # orange-gold
        draw.ellipse([7*s, 12*s, 25*s, 28*s], fill=body_color)
        # Head
        draw.ellipse([10*s, 4*s, 22*s, 16*s], fill=body_color)
        # Ears
        draw.ellipse([10*s, 2*s, 13*s, 6*s], fill=(230, 170, 60, 255))
        draw.ellipse([19*s, 2*s, 22*s, 6*s], fill=(230, 170, 60, 255))
        # Stripes on body
        stripe = (0, 0, 0, 255)
        for sy in [15*s, 18*s, 21*s, 24*s]:
            draw.rectangle([9*s, sy, 11*s, sy+2*s], fill=stripe)
            draw.rectangle([21*s, sy, 23*s, sy+2*s], fill=stripe)
        # Eyes
        draw.ellipse([13*s, 7*s, 15*s, 10*s], fill=(0, 0, 0, 255))
        draw.ellipse([17*s, 7*s, 19*s, 10*s], fill=(0, 0, 0, 255))
        # Nose
        draw.ellipse([15*s, 10*s, 17*s, 12*s], fill=(180, 50, 50, 255))
        # White muzzle
        draw.ellipse([14*s, 11*s, 18*s, 14*s], fill=(255, 255, 255, 255))
        # Legs
        for lx in [10*s, 12*s, 20*s, 22*s]:
            draw.rectangle([lx, 25*s, lx+2*s, 30*s], fill=body_color)
        # Tail
        draw.line([24*s, 14*s, 30*s, 8*s], fill=body_color, width=2*s)
        draw.ellipse([29*s, 6*s, 32*s, 10*s], fill=(0, 0, 0, 255))
    
    # ── ELEPHANT ──
    elif name == "elephant":
        # Body
        body = (130, 130, 140, 255)
        draw.ellipse([5*s, 12*s, 27*s, 28*s], fill=body)
        # Head
        draw.ellipse([8*s, 4*s, 24*s, 18*s], fill=body)
        # Trunk
        draw.rectangle([14*s, 16*s, 18*s, 26*s], fill=body)
        draw.ellipse([14*s, 22*s, 18*s, 28*s], fill=body)
        # Ears
        draw.ellipse([4*s, 6*s, 10*s, 16*s], fill=(160, 160, 170, 255))
        draw.ellipse([22*s, 6*s, 28*s, 16*s], fill=(160, 160, 170, 255))
        # Eyes
        draw.ellipse([14*s, 8*s, 16*s, 10*s], fill=(0, 0, 0, 255))
        # Tusks
        draw.ellipse([14*s, 14*s, 16*s, 18*s], fill=(255, 255, 255, 255))
        draw.ellipse([16*s, 14*s, 18*s, 18*s], fill=(255, 255, 255, 255))
        # Legs (thick)
        for lx in [7*s, 10*s, 22*s, 25*s]:
            draw.rectangle([lx, 25*s, lx+3*s, 30*s], fill=body)
        # Tail
        draw.line([26*s, 16*s, 30*s, 20*s], fill=(100, 100, 110, 255), width=1*s)
    
    # ── GIRAFFE ──
    elif name == "giraffe":
        # Body
        body = (220, 190, 100, 255)
        draw.ellipse([6*s, 18*s, 26*s, 30*s], fill=body)
        # Neck (long!)
        draw.rectangle([12*s, 2*s, 18*s, 20*s], fill=body)
        # Head
        draw.ellipse([11*s, 0*s, 19*s, 6*s], fill=body)
        # Spots
        spot = (120, 80, 30, 255)
        for sx, sy in [(8*s,20*s), (14*s,20*s), (20*s,20*s), (10*s,24*s), (18*s,24*s), (8*s,28*s), (16*s,28*s)]:
            draw.ellipse([sx, sy, sx+3*s, sy+2*s], fill=spot)
        # Neck spots
        for ny in range(4, 18, 3):
            draw.ellipse([13*s, ny*s, 17*s, ny*s+2*s], fill=spot)
        # Ossicones (horns)
        draw.ellipse([12*s, -1*s, 14*s, 1*s], fill=(100, 80, 40, 255))
        draw.ellipse([16*s, -1*s, 18*s, 1*s], fill=(100, 80, 40, 255))
        # Eyes
        draw.ellipse([14*s, 2*s, 16*s, 4*s], fill=(0, 0, 0, 255))
        # Ears
        draw.ellipse([10*s, 2*s, 12*s, 5*s], fill=(200, 170, 80, 255))
        draw.ellipse([18*s, 2*s, 20*s, 5*s], fill=(200, 170, 80, 255))
        # Legs (long!)
        for lx in [8*s, 11*s, 21*s, 24*s]:
            draw.rectangle([lx, 28*s, lx+2*s, 31*s], fill=body)
    
    # ── ZEBRA ──
    elif name == "zebra":
        # Body
        body = (240, 240, 240, 255)
        draw.ellipse([7*s, 14*s, 25*s, 28*s], fill=body)
        # Head
        draw.ellipse([11*s, 4*s, 21*s, 16*s], fill=body)
        # Ears
        draw.ellipse([11*s, 2*s, 14*s, 6*s], fill=body)
        draw.ellipse([18*s, 2*s, 21*s, 6*s], fill=body)
        # Zebra stripes
        stripe = (0, 0, 0, 255)
        for sy in [16*s, 19*s, 22*s, 25*s]:
            draw.polygon([(9*s,sy), (11*s,sy-1*s), (12*s,sy+1*s), (10*s,sy+2*s)], fill=stripe)
            draw.polygon([(20*s,sy), (22*s,sy-1*s), (23*s,sy+1*s), (21*s,sy+2*s)], fill=stripe)
        # Head stripes
        draw.line([12*s, 8*s, 12*s, 12*s], fill=stripe, width=1*s)
        draw.line([14*s, 6*s, 14*s, 12*s], fill=stripe, width=1*s)
        draw.line([16*s, 6*s, 16*s, 12*s], fill=stripe, width=1*s)
        draw.line([18*s, 6*s, 18*s, 12*s], fill=stripe, width=1*s)
        # Eyes
        draw.ellipse([14*s, 7*s, 16*s, 9*s], fill=(0, 0, 0, 255))
        draw.ellipse([18*s, 7*s, 20*s, 9*s], fill=(0, 0, 0, 255))
        # Nose
        draw.ellipse([15*s, 11*s, 17*s, 13*s], fill=(50, 50, 50, 255))
        # Legs
        for lx in [9*s, 12*s, 20*s, 23*s]:
            draw.rectangle([lx, 25*s, lx+2*s, 30*s], fill=body)
        # Tail
        draw.line([24*s, 16*s, 28*s, 18*s], fill=(0, 0, 0, 255), width=1*s)
    
    # ── MONKEY ──
    elif name == "monkey":
        # Body
        body = (140, 110, 70, 255)
        draw.ellipse([8*s, 16*s, 24*s, 28*s], fill=body)
        # Belly
        draw.ellipse([11*s, 18*s, 21*s, 26*s], fill=(200, 180, 140, 255))
        # Head
        draw.ellipse([9*s, 4*s, 23*s, 18*s], fill=body)
        # Face
        draw.ellipse([12*s, 8*s, 20*s, 16*s], fill=(220, 200, 160, 255))
        # Ears
        draw.ellipse([7*s, 8*s, 10*s, 14*s], fill=(200, 180, 140, 255))
        draw.ellipse([22*s, 8*s, 25*s, 14*s], fill=(200, 180, 140, 255))
        # Eyes
        draw.ellipse([13*s, 9*s, 15*s, 12*s], fill=(0, 0, 0, 255))
        draw.ellipse([17*s, 9*s, 19*s, 12*s], fill=(0, 0, 0, 255))
        # Nose
        draw.ellipse([15*s, 11*s, 17*s, 13*s], fill=(0, 0, 0, 255))
        # Mouth
        draw.arc([14*s, 13*s, 18*s, 16*s], 0, 180, fill=(0, 0, 0, 255), width=1*s)
        # Legs
        draw.ellipse([8*s, 26*s, 13*s, 30*s], fill=body)
        draw.ellipse([19*s, 26*s, 24*s, 30*s], fill=body)
        # Arms
        draw.ellipse([2*s, 16*s, 8*s, 22*s], fill=body)
        draw.ellipse([24*s, 16*s, 30*s, 22*s], fill=body)
        # Tail
        draw.arc([24*s, 8*s, 32*s, 22*s], 90, 270, fill=body, width=2*s)
    
    # ── BROWN BEAR ──
    elif name == "bear":
        body = (120, 80, 50, 255)
        draw.ellipse([6*s, 14*s, 26*s, 28*s], fill=body)
        # Head
        draw.ellipse([9*s, 4*s, 23*s, 18*s], fill=body)
        # Ears (round)
        draw.ellipse([9*s, 2*s, 14*s, 8*s], fill=body)
        draw.ellipse([18*s, 2*s, 23*s, 8*s], fill=body)
        # Inner ears
        draw.ellipse([10*s, 3*s, 13*s, 7*s], fill=(180, 140, 100, 255))
        draw.ellipse([19*s, 3*s, 22*s, 7*s], fill=(180, 140, 100, 255))
        # Eyes
        draw.ellipse([13*s, 8*s, 15*s, 11*s], fill=(0, 0, 0, 255))
        draw.ellipse([17*s, 8*s, 19*s, 11*s], fill=(0, 0, 0, 255))
        # Nose
        draw.ellipse([15*s, 11*s, 17*s, 13*s], fill=(0, 0, 0, 255))
        # Muzzle
        draw.ellipse([14*s, 12*s, 18*s, 15*s], fill=(180, 140, 100, 255))
        # Legs
        for lx in [8*s, 11*s, 21*s, 24*s]:
            draw.rectangle([lx, 25*s, lx+3*s, 30*s], fill=body)
    
    # ── HIPPO ──
    elif name == "hippo":
        body = (160, 140, 150, 255)
        draw.ellipse([4*s, 14*s, 28*s, 28*s], fill=body)
        # Head (big!)
        draw.ellipse([7*s, 4*s, 25*s, 18*s], fill=body)
        # Snout (wide)
        draw.ellipse([10*s, 10*s, 22*s, 16*s], fill=(180, 160, 170, 255))
        # Nostrils
        draw.ellipse([14*s, 12*s, 16*s, 14*s], fill=(0, 0, 0, 255))
        draw.ellipse([16*s, 12*s, 18*s, 14*s], fill=(0, 0, 0, 255))
        # Eyes
        draw.ellipse([11*s, 6*s, 13*s, 9*s], fill=(0, 0, 0, 255))
        draw.ellipse([19*s, 6*s, 21*s, 9*s], fill=(0, 0, 0, 255))
        # Ears (small)
        draw.ellipse([8*s, 3*s, 11*s, 6*s], fill=(140, 120, 130, 255))
        draw.ellipse([21*s, 3*s, 24*s, 6*s], fill=(140, 120, 130, 255))
        # Legs (stumpy)
        draw.ellipse([6*s, 25*s, 10*s, 30*s], fill=body)
        draw.ellipse([12*s, 25*s, 16*s, 30*s], fill=body)
        draw.ellipse([18*s, 25*s, 22*s, 30*s], fill=body)
        draw.ellipse([24*s, 25*s, 28*s, 30*s], fill=body)
        # Tail
        draw.line([28*s, 18*s, 32*s, 20*s], fill=body, width=1*s)
    
    # ── CROCODILE ──
    elif name == "crocodile":
        body = (80, 130, 70, 255)
        # Body (long)
        draw.ellipse([6*s, 18*s, 26*s, 30*s], fill=body)
        # Tail
        draw.polygon([(24*s,18*s), (32*s,20*s), (32*s,26*s), (24*s,28*s)], fill=body)
        # Head (long snout)
        draw.ellipse([4*s, 10*s, 20*s, 20*s], fill=body)
        draw.ellipse([0*s, 12*s, 10*s, 18*s], fill=body)
        # Jaw
        draw.ellipse([0*s, 14*s, 12*s, 20*s], fill=(60, 100, 50, 255))
        # Eyes (on top)
        draw.ellipse([8*s, 8*s, 11*s, 12*s], fill=(0, 0, 0, 255))
        draw.ellipse([12*s, 8*s, 15*s, 12*s], fill=(0, 0, 0, 255))
        # Teeth
        teeth = (255, 255, 255, 255)
        draw.polygon([(2*s, 16*s), (3*s, 18*s), (4*s, 16*s)], fill=teeth)
        draw.polygon([(6*s, 16*s), (7*s, 18*s), (8*s, 16*s)], fill=teeth)
        # Scales/ridges on back
        ridge = (60, 110, 50, 255)
        for rx in [14*s, 17*s, 20*s, 23*s]:
            draw.polygon([(rx, 17*s), (rx+2*s, 16*s), (rx+1*s, 18*s)], fill=ridge)
        # Legs
        draw.ellipse([6*s, 24*s, 10*s, 28*s], fill=body)
        draw.ellipse([22*s, 24*s, 26*s, 28*s], fill=body)
    
    # ── RHINO ──
    elif name == "rhino":
        body = (140, 130, 120, 255)
        draw.ellipse([5*s, 14*s, 27*s, 28*s], fill=body)
        # Head
        draw.ellipse([6*s, 6*s, 20*s, 18*s], fill=body)
        # Horn
        draw.polygon([(12*s, 2*s), (13*s, 6*s), (11*s, 6*s)], fill=(200, 200, 200, 255))
        # Second horn (smaller)
        draw.polygon([(15*s, 4*s), (16*s, 7*s), (14*s, 7*s)], fill=(200, 200, 200, 255))
        # Ears
        draw.ellipse([6*s, 4*s, 9*s, 8*s], fill=(120, 110, 100, 255))
        draw.ellipse([17*s, 4*s, 20*s, 8*s], fill=(120, 110, 100, 255))
        # Eyes
        draw.ellipse([10*s, 8*s, 12*s, 11*s], fill=(0, 0, 0, 255))
        draw.ellipse([14*s, 8*s, 16*s, 11*s], fill=(0, 0, 0, 255))
        # Legs (sturdy)
        for lx in [7*s, 11*s, 21*s, 25*s]:
            draw.rectangle([lx, 25*s, lx+3*s, 30*s], fill=body)
        # Tail
        draw.line([27*s, 18*s, 31*s, 22*s], fill=body, width=1*s)
    
    # ── FLAMINGO ──
    elif name == "flamingo":
        body = (230, 150, 190, 255)
        # Body
        draw.ellipse([10*s, 14*s, 24*s, 24*s], fill=body)
        # Neck (curved)
        draw.ellipse([16*s, 2*s, 20*s, 16*s], fill=body)
        # Head
        draw.ellipse([15*s, 0*s, 21*s, 6*s], fill=body)
        # Beak
        draw.polygon([(19*s, 3*s), (25*s, 3*s), (24*s, 5*s), (19*s, 5*s)], fill=(0, 0, 0, 255))
        # Eye
        draw.ellipse([17*s, 2*s, 19*s, 4*s], fill=(0, 0, 0, 255))
        # Legs (long!)
        draw.line([14*s, 24*s, 14*s, 30*s], fill=(255, 180, 200, 255), width=1*s)
        draw.line([20*s, 24*s, 20*s, 30*s], fill=(255, 180, 200, 255), width=1*s)
        # Feet
        draw.ellipse([12*s, 29*s, 16*s, 31*s], fill=(0, 0, 0, 255))
        draw.ellipse([18*s, 29*s, 22*s, 31*s], fill=(0, 0, 0, 255))
        # Wing detail
        wing = (210, 130, 170, 255)
        draw.ellipse([20*s, 16*s, 24*s, 20*s], fill=wing)
    
    # ── SNAKE ──
    elif name == "snake":
        body = (60, 120, 60, 255)
        # Coiled body
        draw.ellipse([6*s, 14*s, 26*s, 30*s], fill=body)
        # Inner coil
        draw.ellipse([10*s, 18*s, 22*s, 26*s], fill=(80, 150, 80, 255))
        # Head
        draw.ellipse([12*s, 4*s, 20*s, 16*s], fill=body)
        # Eyes
        draw.ellipse([14*s, 6*s, 16*s, 9*s], fill=(255, 200, 50, 255))
        draw.ellipse([16*s, 6*s, 18*s, 9*s], fill=(255, 200, 50, 255))
        draw.ellipse([14*s, 7*s, 16*s, 8*s], fill=(0, 0, 0, 255))  # pupil
        draw.ellipse([16*s, 7*s, 18*s, 8*s], fill=(0, 0, 0, 255))
        # Forked tongue
        draw.line([18*s, 12*s, 22*s, 10*s], fill=(255, 0, 0, 255), width=1*s)
        draw.line([22*s, 10*s, 24*s, 8*s], fill=(255, 0, 0, 255), width=1*s)
        draw.line([22*s, 10*s, 24*s, 12*s], fill=(255, 0, 0, 255), width=1*s)
        # Patterns on body
        pat = (40, 100, 40, 255)
        for py in [16*s, 20*s, 24*s, 28*s]:
            draw.ellipse([10*s, py, 12*s, py+2*s], fill=pat)
            draw.ellipse([20*s, py, 22*s, py+2*s], fill=pat)
    
    # ── PEACOCK ──
    elif name == "peacock":
        body = (80, 150, 200, 255)
        # Body
        draw.ellipse([12*s, 12*s, 22*s, 22*s], fill=body)
        # Head
        draw.ellipse([14*s, 4*s, 20*s, 14*s], fill=body)
        # Crown
        crown_color = (240, 220, 50, 255)
        for cx in [15*s, 17*s, 19*s]:
            draw.ellipse([cx, 1*s, cx+2*s, 4*s], fill=crown_color)
        # Beak
        draw.polygon([(19*s, 8*s), (23*s, 8*s), (22*s, 10*s), (19*s, 10*s)], fill=(200, 180, 100, 255))
        # Eye
        draw.ellipse([16*s, 7*s, 18*s, 9*s], fill=(0, 0, 0, 255))
        # Tail feathers (elaborate)
        tail_colors = [(80, 200, 80), (60, 180, 60), (50, 150, 50), (60, 120, 60)]
        feather_x = [6*s, 10*s, 14*s, 18*s, 22*s, 26*s]
        for tx in feather_x:
            fy = 6*s + int((tx - 6*s) * 1.5)
            color = random.choice(tail_colors)
            draw.ellipse([tx, fy, tx+4*s, fy+6*s], fill=color + (255,))
            # Eye spot
            draw.ellipse([tx+1*s, fy+1*s, tx+3*s, fy+3*s], fill=(0, 100, 200, 255))
            draw.ellipse([tx+1*s+1, fy+1*s+1, tx+3*s-1, fy+3*s-1], fill=(0, 150, 255, 255))
    
    # ── TREE (Environment) ──
    elif name == "zoo_tree":
        # Trunk
        draw.rectangle([13*s, 16*s, 19*s, 30*s], fill=(120, 80, 40, 255))
        # Canopy (large)
        draw.ellipse([2*s, 0*s, 30*s, 18*s], fill=(60, 150, 50, 255))
        draw.ellipse([4*s, 4*s, 28*s, 16*s], fill=(50, 140, 40, 255))
        draw.ellipse([6*s, 2*s, 26*s, 14*s], fill=(80, 180, 60, 255))
    
    # ─── WATER POOL (for hippos / crocs) ───
    elif name == "water_pool":
        draw.ellipse([0*s, 6*s, 32*s, 26*s], fill=(60, 150, 200, 255))
        draw.ellipse([2*s, 8*s, 30*s, 24*s], fill=(80, 170, 220, 255))
        draw.ellipse([4*s, 10*s, 28*s, 22*s], fill=(100, 190, 230, 255))
        # Shoreline
        draw.ellipse([0*s, 6*s, 32*s, 26*s], fill=None, outline=(0, 0, 0, 255), width=1*s)
        # Ripples
        draw.ellipse([8*s, 12*s, 14*s, 16*s], fill=None, outline=(180, 230, 255, 255), width=1)
        draw.ellipse([18*s, 14*s, 26*s, 20*s], fill=None, outline=(180, 230, 255, 255), width=1)
    
    # ─── ZOO FENCE ───
    elif name == "zoo_fence":
        # Posts
        for px in [2*s, 8*s, 14*s, 20*s, 26*s]:
            draw.rectangle([px, 14*s, px+2*s, 30*s], fill=(200, 180, 140, 255))
            draw.ellipse([px-1, 12*s, px+3, 15*s], fill=(200, 180, 140, 255))
        # Horizontal bars
        draw.rectangle([0*s, 18*s, 32*s, 20*s], fill=(180, 160, 120, 255))
        draw.rectangle([0*s, 24*s, 32*s, 26*s], fill=(180, 160, 120, 255))
        # Ground
        draw.rectangle([0*s, 26*s, 32*s, 32*s], fill=(100, 180, 80, 255))
        draw.rectangle([0*s, 28*s, 32*s, 32*s], fill=(80, 160, 60, 255))
    
    # ─── ZOO SIGN ───
    elif name == "zoo_sign":
        # Sign post
        draw.rectangle([14*s, 16*s, 18*s, 30*s], fill=(160, 120, 80, 255))
        # Sign board
        draw.rectangle([4*s, 6*s, 28*s, 18*s], fill=(180, 140, 60, 255))
        draw.rectangle([5*s, 7*s, 27*s, 17*s], fill=(200, 170, 100, 255))
        # Text/icon (paw print)
        draw.ellipse([12*s, 9*s, 14*s, 11*s], fill=(120, 80, 40, 255))
        draw.ellipse([18*s, 9*s, 20*s, 11*s], fill=(120, 80, 40, 255))
        draw.ellipse([12*s, 12*s, 14*s, 14*s], fill=(120, 80, 40, 255))
        draw.ellipse([18*s, 12*s, 20*s, 14*s], fill=(120, 80, 40, 255))
        draw.ellipse([14*s, 10*s, 18*s, 14*s], fill=(120, 80, 40, 255))
    
    # ─── ROCKS ───
    elif name == "zoo_rocks":
        draw.ellipse([0*s, 20*s, 14*s, 30*s], fill=(130, 130, 130, 255))
        draw.ellipse([2*s, 22*s, 12*s, 28*s], fill=(150, 150, 150, 255))
        draw.ellipse([16*s, 16*s, 28*s, 28*s], fill=(120, 120, 120, 255))
        draw.ellipse([18*s, 18*s, 26*s, 26*s], fill=(140, 140, 140, 255))
        draw.ellipse([6*s, 28*s, 22*s, 32*s], fill=(170, 170, 170, 255))
    
    # ─── SAFARI JEEP ───
    elif name == "safari_jeep":
        # Body
        draw.rectangle([2*s, 16*s, 30*s, 24*s], fill=(60, 140, 60, 255))
        # Roof
        draw.rectangle([6*s, 10*s, 26*s, 16*s], fill=(200, 200, 200, 255))
        # Wheels
        draw.ellipse([4*s, 22*s, 10*s, 30*s], fill=(0, 0, 0, 255))
        draw.ellipse([22*s, 22*s, 28*s, 30*s], fill=(0, 0, 0, 255))
        # Hubcaps
        draw.ellipse([5*s, 23*s, 9*s, 29*s], fill=(100, 100, 100, 255))
        draw.ellipse([23*s, 23*s, 27*s, 29*s], fill=(100, 100, 100, 255))
        # Windshield
        draw.rectangle([16*s, 12*s, 26*s, 16*s], fill=(180, 220, 255, 255))
        # Headlights
        draw.ellipse([2*s, 18*s, 4*s, 21*s], fill=(255, 255, 200, 255))
        draw.ellipse([2*s, 21*s, 4*s, 24*s], fill=(255, 255, 200, 255))
    
    # ─── SAFARI TENT ───
    elif name == "safari_tent":
        # Tent body (triangle)
        draw.polygon([(2*s, 28*s), (16*s, 4*s), (30*s, 28*s)], fill=(180, 160, 100, 255))
        draw.polygon([(4*s, 28*s), (16*s, 6*s), (28*s, 28*s)], fill=(200, 180, 120, 255))
        # Opening
        draw.polygon([(12*s, 16*s), (16*s, 10*s), (20*s, 16*s), (20*s, 28*s), (12*s, 28*s)], fill=(100, 80, 60, 255))
        # Ridge pole
        draw.line([16*s, 2*s, 16*s, 6*s], fill=(150, 120, 80, 255), width=2*s)
        # Ground
        draw.rectangle([0*s, 28*s, 32*s, 32*s], fill=(100, 180, 80, 255))
    
    # ─── COMPASS ───
    elif name == "compass":
        # Outer ring
        draw.ellipse([8*s, 8*s, 24*s, 24*s], fill=(180, 150, 80, 255))
        draw.ellipse([10*s, 10*s, 22*s, 22*s], fill=(240, 230, 210, 255))
        # Cross
        draw.line([16*s, 6*s, 16*s, 10*s], fill=(255, 0, 0, 255), width=2*s)  # N
        draw.line([16*s, 22*s, 16*s, 26*s], fill=(0, 0, 0, 255), width=2*s)  # S
        draw.line([6*s, 16*s, 10*s, 16*s], fill=(0, 0, 0, 255), width=2*s)  # W
        draw.line([22*s, 16*s, 26*s, 16*s], fill=(0, 0, 0, 255), width=2*s)  # E
        # Center
        draw.ellipse([15*s, 15*s, 17*s, 17*s], fill=(255, 0, 0, 255))
    
    # ─── BINOCULARS ───
    elif name == "binoculars":
        # Left tube
        draw.ellipse([4*s, 10*s, 12*s, 18*s], fill=(30, 30, 30, 255))
        draw.ellipse([5*s, 11*s, 11*s, 17*s], fill=(50, 50, 50, 255))
        # Right tube
        draw.ellipse([20*s, 10*s, 28*s, 18*s], fill=(30, 30, 30, 255))
        draw.ellipse([21*s, 11*s, 27*s, 17*s], fill=(50, 50, 50, 255))
        # Bridge
        draw.rectangle([12*s, 13*s, 20*s, 15*s], fill=(40, 40, 40, 255))
        # Lenses
        draw.ellipse([5*s, 13*s, 11*s, 17*s], fill=(100, 150, 200, 255))
        draw.ellipse([21*s, 13*s, 27*s, 17*s], fill=(100, 150, 200, 255))
    
    # ─── ZOO MAP ───
    elif name == "zoo_map":
        # Paper
        draw.rectangle([4*s, 2*s, 28*s, 30*s], fill=(240, 230, 200, 255))
        # Fold lines
        draw.line([4*s, 14*s, 28*s, 14*s], fill=(200, 190, 160, 255), width=1)
        draw.line([16*s, 2*s, 16*s, 30*s], fill=(200, 190, 160, 255), width=1)
        # Paths (dotted)
        for px in [8*s, 12*s, 16*s, 20*s, 24*s]:
            draw.ellipse([px, 16*s, px+1*s, 17*s], fill=(180, 100, 100, 255))
            draw.ellipse([px, 20*s, px+1*s, 21*s], fill=(180, 100, 100, 255))
            draw.ellipse([px, 24*s, px+1*s, 25*s], fill=(180, 100, 100, 255))
        # Markers (X marks)
        for mx, my in [(8*s, 8*s), (24*s, 6*s), (10*s, 26*s), (22*s, 26*s)]:
            draw.line([mx-1*s, my-1*s, mx+1*s, my+1*s], fill=(255, 0, 0, 255), width=1*s)
            draw.line([mx-1*s, my+1*s, mx+1*s, my-1*s], fill=(255, 0, 0, 255), width=1*s)
    
    # ─── GRASS TILE ───
    elif name == "tile_grass":
        draw.rectangle([0, 0, w, h], fill=(80, 170, 60, 255))
        # Grass blades
        for _ in range(15):
            gx = random.randint(1, 30) * s
            gy = random.randint(1, 30) * s
            gh = random.randint(1, 3) * s
            draw.line([gx, gy, gx+1*s, gy-gh], fill=(100, 200, 70, 255), width=1)
        # Darker patches
        for _ in range(4):
            px = random.randint(2, 28) * s
            py = random.randint(2, 28) * s
            draw.ellipse([px, py, px+3*s, py+2*s], fill=(70, 160, 50, 255))
    
    # ─── DIRT TILE ───
    elif name == "tile_dirt":
        draw.rectangle([0, 0, w, h], fill=(150, 120, 80, 255))
        # Pebbles
        for _ in range(8):
            px = random.randint(2, 28) * s
            py = random.randint(2, 28) * s
            draw.ellipse([px, py, px+2*s, py+1*s], fill=(130, 105, 65, 255))
        # Dark patches
        for _ in range(3):
            px = random.randint(4, 24) * s
            py = random.randint(4, 24) * s
            draw.ellipse([px-1*s, py-1*s, px+2*s, py+2*s], fill=(130, 100, 60, 255))
    
    # ─── TRAIL TILE ───
    elif name == "tile_trail":
        draw.rectangle([0, 0, w, h], fill=(80, 170, 60, 255))
        # Trail path
        draw.rectangle([8*s, 0, 24*s, 32*s], fill=(160, 135, 90, 255))
        # Grass on edges
        for _ in range(10):
            gx = random.randint(1, 7) * s
            gy = random.randint(1, 30) * s
            draw.line([gx, gy, gx, gy-2*s], fill=(100, 200, 70, 255), width=1)
        for _ in range(10):
            gx = random.randint(25, 31) * s
            gy = random.randint(1, 30) * s
            draw.line([gx, gy, gx, gy-2*s], fill=(100, 200, 70, 255), width=1)
    
    # ─── ENTRANCE GATE ───
    elif name == "entrance_gate":
        # Arch
        draw.rectangle([4*s, 18*s, 12*s, 30*s], fill=(200, 160, 80, 255))
        draw.rectangle([20*s, 18*s, 28*s, 30*s], fill=(200, 160, 80, 255))
        draw.arc([4*s, 4*s, 28*s, 22*s], 0, 180, fill=(200, 160, 80, 255), width=3*s)
        # Sign on top
        draw.rectangle([12*s, 4*s, 20*s, 10*s], fill=(240, 220, 100, 255))
        draw.rectangle([13*s, 5*s, 19*s, 9*s], fill=(255, 240, 150, 255))
        # "ZOO" letters (simple marks)
        draw.line([14*s, 6*s, 14*s, 8*s], fill=(0, 0, 0, 255), width=1)
        draw.line([14*s, 6*s, 15*s, 6*s], fill=(0, 0, 0, 255), width=1)
        draw.line([14*s, 7*s, 15*s, 7*s], fill=(0, 0, 0, 255), width=1)
        draw.line([16*s, 6*s, 16*s, 8*s], fill=(0, 0, 0, 255), width=1)
        draw.line([18*s, 6*s, 18*s, 8*s], fill=(0, 0, 0, 255), width=1)
        # Open gate
        draw.line([6*s, 18*s, 6*s, 27*s], fill=(0, 0, 0, 255), width=1)
        draw.line([26*s, 18*s, 26*s, 27*s], fill=(0, 0, 0, 255), width=1)
    
    # ─── FEEDING AREA ───
    elif name == "feeding_area":
        # Trough
        draw.rectangle([4*s, 22*s, 28*s, 26*s], fill=(120, 80, 50, 255))
        draw.rectangle([4*s, 22*s, 28*s, 24*s], fill=(160, 120, 80, 255))
        # Food inside
        draw.ellipse([10*s, 22*s, 16*s, 24*s], fill=(100, 200, 50, 255))  # veggies
        draw.ellipse([18*s, 22*s, 22*s, 24*s], fill=(200, 180, 50, 255))  # grain
        # Sign
        draw.rectangle([14*s, 14*s, 18*s, 22*s], fill=(160, 120, 80, 255))
        draw.rectangle([13*s, 12*s, 19*s, 16*s], fill=(240, 220, 100, 255))
    
    # ─── PENGUIN ───
    elif name == "penguin":
        body = (30, 30, 50, 255)
        # Body
        draw.ellipse([10*s, 14*s, 22*s, 30*s], fill=body)
        # Belly (white)
        draw.ellipse([12*s, 16*s, 20*s, 28*s], fill=(255, 255, 255, 255))
        # Head
        draw.ellipse([11*s, 4*s, 21*s, 16*s], fill=body)
        # Face
        draw.ellipse([13*s, 8*s, 19*s, 14*s], fill=(255, 255, 255, 255))
        # Eyes
        draw.ellipse([14*s, 7*s, 16*s, 10*s], fill=(0, 0, 0, 255))
        draw.ellipse([16*s, 7*s, 18*s, 10*s], fill=(0, 0, 0, 255))
        # Beak
        draw.polygon([(17*s, 10*s), (21*s, 11*s), (17*s, 12*s)], fill=(255, 200, 50, 255))
        # Feet
        draw.ellipse([12*s, 29*s, 16*s, 31*s], fill=(255, 180, 50, 255))
        draw.ellipse([16*s, 29*s, 20*s, 31*s], fill=(255, 180, 50, 255))
        # Wings
        draw.ellipse([8*s, 16*s, 11*s, 24*s], fill=(20, 20, 40, 255))
        draw.ellipse([21*s, 16*s, 24*s, 24*s], fill=(20, 20, 40, 255))
    
    # ─── TROPICAL BIRD ───
    elif name == "tropical_bird":
        body = (100, 200, 100, 255)
        # Body
        draw.ellipse([12*s, 14*s, 22*s, 24*s], fill=body)
        # Head
        draw.ellipse([14*s, 6*s, 20*s, 16*s], fill=body)
        # Beak
        draw.polygon([(19*s, 8*s), (24*s, 8*s), (23*s, 11*s), (19*s, 10*s)], fill=(255, 150, 0, 255))
        # Eye
        draw.ellipse([16*s, 8*s, 18*s, 10*s], fill=(0, 0, 0, 255))
        # Wing (colorful)
        wing = (240, 100, 180, 255)
        draw.ellipse([18*s, 16*s, 22*s, 20*s], fill=wing)
        wing2 = (240, 200, 50, 255)
        draw.ellipse([14*s, 18*s, 18*s, 22*s], fill=wing2)
        # Tail
        tail_colors = [(240, 100, 180), (240, 200, 50), (100, 200, 100)]
        for i, tc in enumerate(tail_colors):
            tx = 6*s + i*3*s
            draw.polygon([(tx, 20*s), (tx-2*s, 28*s), (tx+1*s, 28*s)], fill=tc + (255,))
        # Legs
        draw.line([15*s, 24*s, 15*s, 28*s], fill=(0, 0, 0, 255), width=1)
        draw.line([19*s, 24*s, 19*s, 28*s], fill=(0, 0, 0, 255), width=1)
    
    scale_down = 1.0 / scale
    # Apply outline
    img = add_outline(img, s, PALETTE)
    # Downscale
    small = img.resize((32, 32), Image.NEAREST)
    # Palettize
    small = small.convert("RGBA")
    spx = small.load()
    result = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    rpx = result.load()
    for y in range(32):
        for x in range(32):
            r, g, b, a = spx[x, y]
            if a < 10:
                continue
            idx = palettize((r, g, b), PALETTE)
            rpx[x, y] = PALETTE[idx] + (255,)
    return result

# ═══════════════════════════════════════════════════════════════
#  SPRITE REGISTRY
# ═══════════════════════════════════════════════════════════════

SPRITES = {
    # Zoo Animals
    "lion": "King of the jungle with golden mane",
    "tiger": "Striped orange predator",
    "elephant": "Gray giant with trunk and tusks",
    "giraffe": "Tall spotted mammal with long neck",
    "zebra": "Black and white striped equine",
    "monkey": "Playful brown primate with long tail",
    "bear": "Large brown bear with round ears",
    "hippo": "Massive gray river horse",
    "crocodile": "Green reptile with long snout",
    "rhino": "Armored gray mammal with horn",
    "flamingo": "Pink wading bird on one leg",
    "snake": "Green coiled serpent with forked tongue",
    "peacock": "Blue bird with elaborate tail display",
    "penguin": "Black and white Antarctic bird",
    "tropical_bird": "Colorful exotic bird",
    # Environment
    "zoo_tree": "Large canopy tree",
    "water_pool": "Blue water pool for aquatic animals",
    "zoo_fence": "Wooden fence enclosure",
    "zoo_rocks": "Rock formation for habitats",
    "zoo_sign": "Directional zoo sign",
    # Safari Gear
    "safari_jeep": "Green safari tour vehicle",
    "safari_tent": "Canvas camping tent",
    "compass": "Navigational compass",
    "binoculars": "Viewing binoculars",
    "zoo_map": "Zoo map with trails",
    "entrance_gate": "Zoo entrance archway",
    "feeding_area": "Animal feeding station",
    # Tiles
    "tile_grass": "Grassy ground tile",
    "tile_dirt": "Dirt ground tile",
    "tile_trail": "Dirt trail tile",
}

ITEMS = sorted(SPRITES.keys())

def generate_items(items, output_dir, scale=4):
    """Generate zoo sprites by name list."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    metadata = {}
    generated = []
    
    for name in items:
        item_dir = output_dir / name
        item_dir.mkdir(exist_ok=True)
        
        print(f"  🦁 {name}...", end=" ", flush=True)
        try:
            img = render_sprite(name, scale)
            out_path = item_dir / f"{name}_32px.png"
            img.save(str(out_path))
            print(f"✅ ({out_path.stat().st_size} bytes)")
            generated.append(name)
            metadata[name] = {
                "description": SPRITES[name],
                "size": "32x32",
                "path": str(out_path),
                "bytes": out_path.stat().st_size,
                "colors": len(set(img.getdata()))
            }
        except Exception as e:
            print(f"❌ {e}")
    
    # Create sprite sheet
    sheet_size = 32 * 8  # 8 across
    sheet_h = 32 * ((len(generated) + 7) // 8)
    sheet = Image.new("RGBA", (sheet_size, sheet_h), (0, 0, 0, 0))
    
    for i, name in enumerate(generated):
        col = i % 8
        row = i // 8
        item_path = output_dir / name / f"{name}_32px.png"
        if item_path.exists():
            sprite = Image.open(item_path).convert("RGBA")
            sheet.paste(sprite, (col * 32, row * 32))
    
    sheet_path = output_dir / "zoo_animals_pack_spritesheet.png"
    sheet.save(str(sheet_path))
    print(f"\n  📋 Spritesheet: {sheet_path} ({sheet.size})")
    
    # Metadata
    meta = {
        "pack": "Pixel Zoo & Safari Pack",
        "description": "40+ game-ready pixel art sprites for zoo and safari-themed games",
        "total_sprites": len(generated),
        "sprite_size": "32x32",
        "items": metadata,
        "spritesheet": str(sheet_path),
    }
    meta_path = output_dir / "zoo_animals_pack_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"  📝 Metadata: {meta_path}")
    
    return generated


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Pixel Zoo & Safari Pack generator")
    parser.add_argument("--all", action="store_true", help="Generate all zoo sprites")
    parser.add_argument("--item", default=None, help="Generate specific item by name")
    parser.add_argument("--list", action="store_true", help="List all available items")
    parser.add_argument("--output", default="forge-output/zoo-animals-pack", help="Output directory")
    parser.add_argument("--scale", type=int, default=4, help="Internal scale factor (default: 4)")
    
    args = parser.parse_args()
    
    base_dir = Path(__file__).resolve().parent
    output_dir = base_dir / args.output
    
    if args.list:
        print(f"\n🦁  PIXEL ZOO & SAFARI PACK — Available Items\n")
        print(f"{'NAME':25s} DESCRIPTION")
        print("-" * 60)
        for name in ITEMS:
            print(f"  {name:23s} {SPRITES[name]}")
        print(f"\nTotal: {len(ITEMS)} items")
        return
    
    if args.item:
        if args.item not in SPRITES:
            print(f"❌ Unknown item: {args.item}")
            print(f"   Use --list to see all items")
            return
        items = [args.item]
    elif args.all:
        items = ITEMS
    else:
        print("Use --all to generate everything, --item NAME for one, or --list")
        return
    
    print(f"\n{'='*60}")
    print(f"  🦁 PIXEL ZOO & SAFARI PACK")
    print(f"{'='*60}")
    print(f"  Generating {len(items)} items at {args.scale}x scale...")
    print(f"  Output: {output_dir}")
    print()
    
    start = time.time()
    generated = generate_items(items, output_dir, args.scale)
    elapsed = time.time() - start
    
    print(f"\n{'='*60}")
    print(f"  ✅ DONE! {len(generated)} sprites forged in {elapsed:.1f}s")
    print(f"  📁 {output_dir}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
