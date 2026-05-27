#!/usr/bin/env python3
"""
Haunted Dungeon Denizens — Pixel Art Forge
Generates 10 haunted creature sprites with animation frames
in 0x72 Dungeon Tileset style. 32x32 output with haunted palette.

Usage:
    python haunted-denizens-forge.py [--output DIR] [--list]
"""

import sys, os, json, math, itertools
from pathlib import Path
from PIL import Image, ImageFilter

# ═══════════════════════════════════════════════════════════════
# HAUNTED PALETTE
# ═══════════════════════════════════════════════════════════════

HAUNTED_PALETTE = [
    (13, 0, 26),       # 0  — deepest void (near black)
    (26, 0, 48),       # 1  — deep dark purple
    (45, 10, 75),      # 2  — dark purple
    (58, 25, 80),      # 3  — mid purple
    (80, 40, 105),     # 4  — purple
    (100, 55, 130),    # 5  — light purple
    (0, 212, 170),     # 6  — spectral teal
    (0, 180, 145),     # 7  — teal dark
    (102, 255, 204),   # 8  — bright teal glow
    (232, 224, 240),   # 9  — ghostly white light
    (255, 255, 255),   # 10 — pure white (brightest)
    (200, 190, 220),   # 11 — ghostly gray
    (160, 140, 190),   # 12 — faded purple
    (220, 100, 180),   # 13 — spectral pink
    (255, 80, 120),    # 14 — blood red
    (180, 50, 50),     # 15 — dark red
    (100, 60, 40),     # 16 — rotten brown
    (60, 40, 20),      # 17 — dark wood
    (200, 180, 100),   # 18 — gold trim
    (120, 130, 150),   # 19 — stone gray
    (60, 70, 90),      # 20 — dark stone
    (40, 50, 70),      # 21 — deeper stone
    (30, 30, 40),      # 22 — shadow
    (0, 180, 200),     # 23 — cyan glow
    (80, 0, 0),        # 24 — blood dark
    (50, 30, 80),      # 25 — deep violet
    (140, 80, 200),    # 26 — bright violet
    (0, 100, 80),      # 27 — dark teal
    (0, 140, 110),     # 28 — mid teal
    (40, 20, 60),      # 29 — purple shadow
    (60, 140, 200),    # 30 — ethereal blue
    (100, 200, 255),   # 31 — bright ethereal blue
]

# Color name to palette index
O = 0   # outline/void
DP = 1  # deep purple
D2 = 2  # dark purple 2
M3 = 3  # mid purple 3
P4 = 4  # purple 4
P5 = 5  # light purple 5
T6 = 6  # spectral teal
T7 = 7  # teal dark
T8 = 8  # teal bright glow
W9 = 9  # ghostly white light
W10 = 10 # pure white
G11 = 11 # ghostly gray
P12 = 12 # faded purple
PK13 = 13 # spectral pink
R14 = 14 # blood red
R15 = 15 # dark red
BR16 = 16 # rotten brown
WD17 = 17 # dark wood
G18 = 18 # gold trim
S19 = 19 # stone gray
S20 = 20 # dark stone
SH21 = 21 # shadow stone
SH22 = 22 # shadow
C23 = 23 # cyan glow
BD24 = 24 # blood dark
V25 = 25 # deep violet
V26 = 26 # bright violet
DT27 = 27 # dark teal
M28 = 28 # mid teal
PS29 = 29 # purple shadow
B30 = 30 # ethereal blue
B31 = 31 # bright ethereal blue

# ═══════════════════════════════════════════════════════════════
# PIXEL DRAWING PRIMITIVES
# ═══════════════════════════════════════════════════════════════

SIZE = 32

def new_sprite(size=SIZE):
    """Create a blank 32x32 indexed color image with haunted palette."""
    img = Image.new("P", (size, size), 0)
    # Set palette
    flat = []
    for r, g, b in HAUNTED_PALETTE:
        flat.extend([r, g, b])
    # Pad to 768 (256 colors * 3)
    while len(flat) < 768:
        flat.extend([0, 0, 0])
    img.putpalette(flat)
    return img

def px(img, x, y, c):
    """Set pixel if in bounds."""
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)

def rect(img, x, y, w, h, c):
    """Fill rectangle."""
    for dy in range(h):
        for dx in range(w):
            px(img, x + dx, y + dy, c)

def hline(img, x, y, length, c):
    """Horizontal line."""
    for dx in range(length):
        px(img, x + dx, y, c)

def vline(img, x, y, length, c):
    """Vertical line."""
    for dy in range(length):
        px(img, x, y + dy, c)

def circle(img, cx, cy, r, c, fill=True):
    """Draw (filled) circle."""
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx*dx + dy*dy <= r*r:
                px(img, cx + dx, cy + dy, c)

def add_outlines(img):
    """Add 1px black outlines around non-black pixels."""
    w, h = img.size
    output = img.copy()
    for y in range(h):
        for x in range(w):
            c = img.getpixel((x, y))
            if c != 0:
                # Check 4 neighbors
                for nx, ny in [(x-1,y), (x+1,y), (x,y-1), (x,y+1)]:
                    if 0 <= nx < w and 0 <= ny < h:
                        nc = img.getpixel((nx, ny))
                        if nc == 0:  # neighbor is transparent/void
                            output.putpixel((nx, ny), O)
    return output

def glow_effect(img, color_idx, radius=2, intensity=0.5):
    """Add glow around bright areas. Simulates spectral glow."""
    w, h = img.size
    glow_img = img.copy()
    color = HAUNTED_PALETTE[color_idx]
    
    for y in range(h):
        for x in range(w):
            c = img.getpixel((x, y))
            if c == 0:
                continue
            # Check if this pixel is adjacent to the glow color
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        nc = img.getpixel((nx, ny))
                        if nc == color_idx:
                            # Add faint glow pixel
                            dist = math.sqrt(dx*dx + dy*dy)
                            if dist <= radius and dist > 0:
                                if nc == 0:
                                    px(glow_img, nx, ny, color_idx)
    return glow_img

def sprite_to_rgba(img):
    """Convert indexed to RGBA for saving."""
    return img.convert("RGBA")

# ═══════════════════════════════════════════════════════════════
# CREATURE DEFINITIONS — Each returns a list of PIL Images (frames)
# ═══════════════════════════════════════════════════════════════

def make_wandering_armor():
    """Wandering Armor — Empty haunted suit, patrols corridors. 4 frames."""
    frames = []
    
    for f in range(4):
        img = new_sprite()
        sway = int(math.sin(f * math.pi / 2) * 1)  # slight sway for animation
        
        # Feet / Leg plates
        rect(img, 12, 24, 3, 5, S20)   # left leg plate
        rect(img, 17, 24, 3, 5, S20)   # right leg plate
        rect(img, 11, 28, 4, 3, S19)   # left boot
        rect(img, 17, 28, 4, 3, S19)   # right boot
        
        # Sabatons (feet armor)
        rect(img, 11, 29, 5, 3, S19)
        rect(img, 17, 29, 5, 3, S19)
        
        # Torso — plate armor
        rect(img, 10 + sway, 12, 12, 13, S20)
        rect(img, 11 + sway, 13, 10, 11, S19)
        
        # Breastplate detail
        rect(img, 13 + sway, 15, 6, 4, G18)  # gold trim
        rect(img, 14 + sway, 14, 4, 1, G18)
        
        # Belt
        rect(img, 11 + sway, 22, 10, 2, WD17)
        rect(img, 15 + sway, 22, 2, 2, G18)  # buckle
        
        # Shoulder pads
        rect(img, 7 + sway, 11, 4, 4, S19)
        rect(img, 21 + sway, 11, 4, 4, S19)
        
        # Arms
        rect(img, 8 + sway, 14, 3, 9, S20)
        rect(img, 21 + sway, 14, 3, 9, S20)
        
        # Gauntlets
        rect(img, 8 + sway, 21, 3, 3, S19)
        rect(img, 21 + sway, 21, 3, 3, S19)
        
        # Sword (right hand)
        rect(img, 24, 14, 2, 14, S19)
        rect(img, 24, 12, 2, 3, G18)
        rect(img, 23, 11, 4, 1, T8)  # blade tip glow
        
        # Empty helmet — no head inside! Dark void
        rect(img, 11 + sway, 2, 10, 10, S20)
        rect(img, 12 + sway, 3, 8, 8, S19)
        
        # Visor slit — dark empty void
        rect(img, 13 + sway, 5, 6, 3, O)
        
        # Helmet plume
        rect(img, 14 + sway, 0, 4, 3, R14)
        rect(img, 15 + sway, -1, 2, 1, R14)
        
        # Spectral eyes glowing inside helmet
        if f == 0 or f == 2:
            px(img, 14 + sway, 5, T8)
            px(img, 17 + sway, 5, T8)
        elif f == 1 or f == 3:
            px(img, 14 + sway, 6, T8)
            px(img, 17 + sway, 6, T8)
        
        # Ethereal wisps coming from armor gaps
        if f == 0:
            px(img, 13 + sway, 8, T6)
            px(img, 18 + sway, 8, T6)
        elif f == 1:
            px(img, 12 + sway, 8, T6)
            px(img, 19 + sway, 8, T6)
        elif f == 2:
            px(img, 13 + sway, 9, T6)
            px(img, 18 + sway, 9, T6)
        elif f == 3:
            px(img, 14 + sway, 8, T6)
            px(img, 17 + sway, 8, T6)
        
        # Outlines
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_spectral_slime():
    """Spectral Slime — Translucent ghost-slime with eerie glow. 4 frames."""
    frames = []
    
    for f in range(4):
        img = new_sprite()
        
        # Base wobble — the slime squishes and stretches
        squish = math.sin(f * math.pi / 2) * 2
        
        # Main body — translucent blob
        cx, cy = 16, 18
        r_base = 11 + int(squish * 0.5)
        
        circle(img, cx, cy, r_base, T7)
        circle(img, cx, cy, r_base - 2, T6)
        circle(img, cx, cy, r_base - 4, T8)
        
        # Top dome
        for dy in range(-r_base, 0):
            for dx in range(-r_base + 1, r_base):
                if dx*dx + dy*dy <= r_base*r_base:
                    # Gradient effect — brighter at top
                    bright = T8 if dy < -r_base//2 else T6
                    px(img, cx + dx, cy + dy, bright)
        
        # Eyes (glowing)
        eye_y = cy - 4 + (f % 2)
        px(img, cx - 3, eye_y, T8)
        px(img, cx + 3, eye_y, T8)
        px(img, cx - 3, eye_y, W10)
        px(img, cx + 3, eye_y, W10)
        
        # Mouth (varies per frame)
        mouth_offsets = [-1, 0, 1, 0]
        mo = mouth_offsets[f]
        hline(img, cx - 3, cy, 7, O)
        px(img, cx - 2 + mo, cy + 1, O)
        px(img, cx + 2 - mo, cy + 1, O)
        
        # Drip effect at bottom
        drips = [(0, 3), (-3, 2), (3, 2)]
        for dx, dy in drips:
            if f == 1 and dx == 0:
                px(img, cx + dx, cy + r_base + 1, T7)
                px(img, cx + dx, cy + r_base + 2, T6)
            elif f == 3 and dx != 0:
                px(img, cx + dx, cy + r_base + 1, T7)
        
        # Glow aura
        for ay in range(-r_base-1, r_base+2):
            for ax in range(-r_base-1, r_base+2):
                dist = math.sqrt(ax*ax + ay*ay)
                if r_base < dist <= r_base + 2:
                    nx, ny = cx + ax, cy + ay
                    if 0 <= nx < SIZE and 0 <= ny < SIZE:
                        if img.getpixel((nx, ny)) == 0:
                            px(img, nx, ny, DT27)
        
        # Core inner glow
        circle(img, cx, cy, r_base - 6, T8)
        circle(img, cx, cy, r_base - 8, C23)
        
        # Sparkle highlights
        if f % 2 == 0:
            px(img, cx - 4, cy - 8, W10)
            px(img, cx + 5, cy - 6, W10)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_poltergeist_chest():
    """Poltergeist Chest — Mimic chest that floats and throws debris. 3 frames."""
    frames = []
    
    for f in range(3):
        img = new_sprite()
        
        # Floating offset
        float_y = -int(math.sin(f * math.pi / 2) * 2)
        
        # Chest body
        rect(img, 8, 9 + float_y, 16, 14, WD17)  # dark wood
        rect(img, 9, 10 + float_y, 14, 12, M3)   # wood grain
        rect(img, 10, 11 + float_y, 12, 10, WD17)
        
        # Metal bands
        rect(img, 8, 13 + float_y, 16, 2, S19)
        rect(img, 8, 19 + float_y, 16, 2, S19)
        
        # Lid (slightly open or closed)
        if f == 0:
            # Closed — trap waiting
            rect(img, 8, 8 + float_y, 16, 2, WD17)
            rect(img, 9, 8 + float_y, 14, 1, M3)
        elif f == 1:
            # Opening — teeth revealed
            rect(img, 8, 7 + float_y, 16, 3, WD17)
            rect(img, 10, 9 + float_y, 2, 2, R14)  # tongue
            # Teeth
            for tx in range(10, 20, 2):
                rect(img, tx, 10 + float_y, 1, 2, W10)
        elif f == 2:
            # Fully open — attacking
            rect(img, 8, 5 + float_y, 16, 6, WD17)
            rect(img, 9, 9 + float_y, 14, 2, R14)  # tongue
            # More teeth
            for tx in range(10, 22, 2):
                rect(img, tx, 9 + float_y, 1, 2, W10)
            for tx in range(10, 22, 2):
                rect(img, tx, 10 + float_y, 1, 1, R14)
        
        # Lock/keyhole
        if f == 0:
            rect(img, 15, 16 + float_y, 2, 2, G18)  # lock
            px(img, 16, 17 + float_y, O)
        else:
            # Lock broken/glowing
            px(img, 15, 16 + float_y, T8)
            px(img, 16, 16 + float_y, T8)
            px(img, 15, 17 + float_y, T8)
            px(img, 16, 17 + float_y, T8)
        
        # Glowing eyes on the chest (mimic eyes)
        eye_color = R14 if f == 2 else T8
        px(img, 13, 14 + float_y, eye_color)
        px(img, 19, 14 + float_y, eye_color)
        px(img, 13, 14 + float_y, W10)
        px(img, 19, 14 + float_y, W10)
        
        # Spectral glow underneath (floating effect)
        if f <= 1:
            px(img, 14, 24 + float_y, T6)
            px(img, 18, 24 + float_y, T6)
        else:
            # Attack mode — more glow
            px(img, 12, 24 + float_y, T8)
            px(img, 16, 24 + float_y, T8)
            px(img, 20, 24 + float_y, T8)
        
        # Debris particles (attack frame)
        if f == 2:
            debris = [(6, 6), (26, 8), (4, 20), (28, 18), (8, 28), (24, 26)]
            for dx, dy in debris:
                px(img, dx, dy + float_y, S19)
                px(img, dx, dy + float_y, T6)
        
        # Shadow below
        if f == 0:
            rect(img, 12, 27, 8, 3, SH22)
        elif f == 1:
            rect(img, 12, 27, 8, 2, SH22)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_wraith_archer():
    """Wraith Archer — Hooded spectral archer. 3 frames."""
    frames = []
    
    for f in range(3):
        img = new_sprite()
        
        # Wraith floats — slight bob
        bob_y = int(math.sin(f * math.pi * 0.5) * 1.5)
        
        # Bottom — spectral trail/robe fading out
        rect(img, 10, 22 + bob_y, 12, 8, PS29)
        rect(img, 11, 24 + bob_y, 10, 5, V25)
        rect(img, 12, 26 + bob_y, 8, 4, DP)
        
        # Hooded body
        rect(img, 11, 12 + bob_y, 10, 11, V25)
        rect(img, 12, 13 + bob_y, 8, 9, P5)
        
        # Hood
        rect(img, 10, 5 + bob_y, 12, 9, V25)
        rect(img, 11, 5 + bob_y, 10, 8, PS29)
        rect(img, 12, 5 + bob_y, 8, 6, P5)
        
        # Face — shadowy void
        rect(img, 13, 8 + bob_y, 6, 5, DP)
        
        # Glowing eyes
        px(img, 14, 10 + bob_y, T8)
        px(img, 17, 10 + bob_y, T8)
        
        # Left arm — holding ethereal bow
        rect(img, 6, 14 + bob_y, 5, 3, PS29)
        rect(img, 6, 16 + bob_y, 4, 1, V25)
        
        # Right arm — drawing bowstring
        rect(img, 21, 14 + bob_y, 5, 3, PS29)
        rect(img, 22, 16 + bob_y, 4, 1, V25)
        
        # Ethereal bow
        if f == 0:
            # Bow held at rest
            rect(img, 4, 11 + bob_y, 2, 9, T7)
            rect(img, 5, 12 + bob_y, 1, 7, T6)
            # Bowstring
            hline(img, 6, 20 + bob_y, 14, T6)
        elif f == 1:
            # Bow drawn — arrow forming
            rect(img, 4, 10 + bob_y, 2, 10, T7)
            rect(img, 5, 11 + bob_y, 1, 8, T6)
            # Bowstring pulled back
            vline(img, 23, 11 + bob_y, 9, T6)
            # Arrow forming (glowing energy)
            hline(img, 10, 15 + bob_y, 12, T8)
            px(img, 22, 15 + bob_y, W10)
        elif f == 2:
            # Arrow released — shot frame
            rect(img, 4, 10 + bob_y, 2, 10, T7)
            rect(img, 5, 11 + bob_y, 1, 8, T6)
            # Bowstring forward
            vline(img, 6, 11 + bob_y, 9, T6)
            # Arrow in flight
            hline(img, 14, 15 + bob_y, 15, T8)
            px(img, 28, 15 + bob_y, W10)  # arrow tip
            # Trail
            hline(img, 16, 16 + bob_y, 6, T6)
            px(img, 22, 16 + bob_y, T6)
        
        # Phase-shift shimmer
        if f == 2:
            # Vanishing particles
            for px_x, px_y in [(8, 20), (24, 18), (10, 8), (22, 22), (14, 26)]:
                px(img, px_x, px_y + bob_y, T8)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_cursed_statue():
    """Cursed Statue — Gargoyle statue. 3 states: still, awakening, active."""
    frames = []
    
    for f in range(3):
        img = new_sprite()
        
        if f == 0:
            # STILL — looks like a regular stone gargoyle statue
            # Base/pedestal
            rect(img, 10, 27, 12, 4, S20)
            rect(img, 11, 27, 10, 3, S19)
            
            # Legs (stone)
            rect(img, 11, 21, 3, 7, S20)
            rect(img, 18, 21, 3, 7, S20)
            rect(img, 12, 22, 2, 5, S19)
            rect(img, 19, 22, 2, 5, S19)
            
            # Body (stone statue)
            rect(img, 10, 12, 12, 10, S20)
            rect(img, 11, 13, 10, 8, S19)
            
            # Stone wings (folded)
            rect(img, 6, 10, 4, 8, S20)
            rect(img, 22, 10, 4, 8, S20)
            rect(img, 7, 11, 3, 6, S19)
            rect(img, 23, 11, 3, 6, S19)
            
            # Head (gargoyle face, stone)
            rect(img, 12, 3, 8, 10, S20)
            rect(img, 13, 4, 6, 8, S19)
            
            # Horns
            rect(img, 12, 0, 2, 4, S20)
            rect(img, 18, 0, 2, 4, S20)
            
            # Eyes (closed — dormant)
            hline(img, 13, 6, 2, S20)
            hline(img, 17, 6, 2, S20)
            
            # Mouth (closed)
            hline(img, 14, 9, 4, S20)
            
            # Nothing special — just a statue
            
        elif f == 1:
            # AWAKENING — cracks, glowing eyes
            rect(img, 10, 27, 12, 4, S20)
            rect(img, 11, 27, 10, 3, S19)
            
            rect(img, 11, 21, 3, 7, S20)
            rect(img, 18, 21, 3, 7, S20)
            rect(img, 12, 22, 2, 5, S19)
            rect(img, 19, 22, 2, 5, S19)
            
            rect(img, 10, 12, 12, 10, S20)
            rect(img, 11, 13, 10, 8, S19)
            
            # Wings starting to spread
            rect(img, 5, 9, 5, 10, S20)
            rect(img, 22, 9, 5, 10, S20)
            rect(img, 6, 10, 4, 8, S19)
            rect(img, 23, 10, 4, 8, S19)
            
            rect(img, 12, 3, 8, 10, S20)
            rect(img, 13, 4, 6, 8, S19)
            
            rect(img, 12, 0, 2, 4, S20)
            rect(img, 18, 0, 2, 4, S20)
            
            # Eyes GLOWING
            px(img, 14, 6, T8)
            px(img, 17, 6, T8)
            px(img, 14, 6, W10)
            px(img, 17, 6, W10)
            
            # Mouth cracking open
            px(img, 14, 9, R14)
            px(img, 15, 9, R14)
            px(img, 16, 9, R14)
            px(img, 17, 9, R14)
            
            # Cracks on the stone
            px(img, 15, 8, T8)
            px(img, 13, 12, T6)
            px(img, 19, 14, T6)
            px(img, 14, 18, T6)
            
        elif f == 2:
            # ACTIVE — fully animated gargoyle
            rect(img, 10, 27, 12, 4, S20)
            rect(img, 11, 27, 10, 3, S19)
            
            rect(img, 11, 21, 3, 7, S20)
            rect(img, 18, 21, 3, 7, S20)
            rect(img, 12, 22, 2, 5, S19)
            rect(img, 19, 22, 2, 5, S19)
            
            # Body — with glowing runes
            rect(img, 10, 12, 12, 10, S20)
            rect(img, 11, 13, 10, 8, S19)
            # Glowing runes on chest
            px(img, 15, 15, T8)
            px(img, 16, 15, T8)
            px(img, 15, 16, T8)
            px(img, 16, 16, T8)
            px(img, 14, 17, T8)
            px(img, 17, 17, T8)
            
            # Wings fully spread
            rect(img, 2, 8, 8, 12, S20)
            rect(img, 22, 8, 8, 12, S20)
            rect(img, 3, 9, 6, 10, S19)
            rect(img, 23, 9, 6, 10, S19)
            # Wing tips — sharp
            px(img, 2, 8, S19)
            px(img, 1, 9, S19)
            px(img, 29, 8, S19)
            px(img, 30, 9, S19)
            
            # Head — aggressive
            rect(img, 12, 2, 8, 11, S20)
            rect(img, 13, 3, 6, 9, S19)
            
            # Horns larger
            rect(img, 11, -1, 3, 5, S20)
            rect(img, 18, -1, 3, 5, S20)
            px(img, 11, 0, T8)
            px(img, 20, 0, T8)
            
            # Eyes — blazing
            px(img, 14, 5, T8)
            px(img, 17, 5, T8)
            px(img, 14, 5, W10)
            px(img, 17, 5, W10)
            
            # Mouth — open growling
            rect(img, 14, 9, 4, 2, R14)
            px(img, 14, 9, W10)  # teeth
            px(img, 17, 9, W10)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_shadow_stalker():
    """Shadow Stalker — 2D shadow on walls/ceiling. 3 anim frames."""
    frames = []
    
    for f in range(3):
        img = new_sprite()
        
        # Shadow is drawn horizontally (crawling on wall)
        # Body — amorphous shadow shape
        if f == 0:
            # CREEP — elongated shadow crawling
            rect(img, 4, 14, 24, 8, DP)
            rect(img, 5, 13, 22, 10, D2)
            rect(img, 6, 12, 20, 12, M3)
            
            # Head shape
            circle(img, 10, 18, 5, O)
            rect(img, 7, 13, 6, 8, O)
            
            # Clawed hands creeping forward
            rect(img, 2, 12, 4, 3, O)
            rect(img, 1, 16, 3, 2, O)
            
            # Back limbs
            rect(img, 24, 18, 5, 3, O)
            rect(img, 26, 12, 3, 4, O)
            
            # Glowing eyes (malevolent)
            px(img, 9, 16, T8)
            px(img, 12, 16, T8)
            
        elif f == 1:
            # POUNCE — coiled, about to spring
            rect(img, 6, 10, 20, 12, DP)
            rect(img, 5, 9, 22, 14, D2)
            rect(img, 6, 8, 20, 16, M3)
            
            # Body compressed (coiled)
            circle(img, 14, 16, 8, O)
            
            # Head rearing back
            circle(img, 10, 12, 6, O)
            
            # Claws extended
            rect(img, 2, 8, 5, 3, O)
            rect(img, 0, 12, 4, 3, O)
            rect(img, 3, 19, 3, 5, O)
            rect(img, 25, 10, 5, 3, O)
            
            # Eyes — wide and bright (about to strike)
            px(img, 8, 11, T8)
            px(img, 11, 11, T8)
            px(img, 8, 11, W10)
            px(img, 11, 11, W10)
            
            # Mouth — jagged
            hline(img, 7, 15, 6, R14)
            px(img, 7, 14, R14)
            px(img, 12, 14, R14)
            
        elif f == 2:
            # RETREAT — fading back into shadows
            rect(img, 8, 14, 16, 6, DP)
            rect(img, 9, 13, 14, 8, D2)
            rect(img, 10, 12, 12, 10, M3)
            
            # Stretching out
            circle(img, 16, 17, 7, O)
            
            # Head
            circle(img, 12, 15, 5, O)
            
            # Limbs retracting
            rect(img, 4, 14, 4, 3, O)
            rect(img, 22, 14, 4, 3, O)
            rect(img, 5, 19, 3, 4, O)
            rect(img, 23, 19, 3, 4, O)
            
            # Fading eyes
            px(img, 10, 14, T7)
            px(img, 13, 14, T7)
            
            # Dissipating shadow wisps
            px(img, 6, 10, D2)
            px(img, 24, 10, D2)
            px(img, 8, 22, D2)
            px(img, 22, 22, D2)
            px(img, 4, 18, DP)
            px(img, 26, 18, DP)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_banshee_priestess():
    """Banshee Priestess — Floating undead mage. 3 anim."""
    frames = []
    
    for f in range(3):
        img = new_sprite()
        
        # Floating bob
        bob_y = int(math.sin(f * math.pi * 0.5) * 2)
        
        # Bottom — spectral robe fading to wisps
        rect(img, 9, 22 + bob_y, 14, 8, V25)
        rect(img, 8, 24 + bob_y, 16, 6, PS29)
        rect(img, 9, 26 + bob_y, 14, 4, DP)
        
        # Wispy trail
        if f == 0:
            px(img, 7, 28 + bob_y, PS29)
            px(img, 25, 28 + bob_y, PS29)
        elif f == 1:
            px(img, 6, 27 + bob_y, PS29)
            px(img, 26, 27 + bob_y, PS29)
        elif f == 2:
            px(img, 8, 29 + bob_y, PS29)
            px(img, 24, 29 + bob_y, PS29)
        
        # Robe body
        rect(img, 10, 12 + bob_y, 12, 11, V25)
        rect(img, 11, 13 + bob_y, 10, 9, P5)
        
        # Arms — outstretched, spectral
        if f == 0:
            # Weeping pose — arms crossed
            rect(img, 7, 13 + bob_y, 4, 8, V25)
            rect(img, 21, 13 + bob_y, 4, 8, V25)
            rect(img, 8, 14 + bob_y, 3, 6, PS29)
            rect(img, 22, 14 + bob_y, 3, 6, PS29)
        elif f == 1:
            # Scream pose — arms thrown wide
            rect(img, 4, 12 + bob_y, 6, 7, V25)
            rect(img, 22, 12 + bob_y, 6, 7, V25)
            rect(img, 5, 13 + bob_y, 5, 5, PS29)
            rect(img, 23, 13 + bob_y, 5, 5, PS29)
        elif f == 2:
            # Summon pose — arms raised
            rect(img, 6, 8 + bob_y, 5, 8, V25)
            rect(img, 21, 8 + bob_y, 5, 8, V25)
            rect(img, 7, 9 + bob_y, 4, 6, PS29)
            rect(img, 22, 9 + bob_y, 4, 6, PS29)
        
        # Head
        rect(img, 12, 4 + bob_y, 8, 9, W9)
        rect(img, 13, 5 + bob_y, 6, 7, G11)
        
        # Long flowing hair (white/ghostly)
        rect(img, 11, 2 + bob_y, 10, 8, W9)
        rect(img, 11, 3 + bob_y, 2, 7, W9)
        rect(img, 19, 3 + bob_y, 2, 7, W9)
        
        # Hair flowing down
        rect(img, 12, 10 + bob_y, 3, 6, W9)
        rect(img, 17, 10 + bob_y, 3, 6, W9)
        rect(img, 11, 14 + bob_y, 2, 4, G11)
        rect(img, 19, 14 + bob_y, 2, 4, G11)
        
        # Face — skeletal/decayed
        # Eyes
        if f == 0:
            # Weeping — crying blood
            px(img, 14, 6 + bob_y, T8)
            px(img, 17, 6 + bob_y, T8)
            px(img, 14, 7 + bob_y, R14)
            px(img, 17, 7 + bob_y, R14)
        elif f == 1:
            # Screaming — wide open
            px(img, 14, 6 + bob_y, T8)
            px(img, 17, 6 + bob_y, T8)
            px(img, 14, 6 + bob_y, W10)
            px(img, 17, 6 + bob_y, W10)
            # Mouth — wide scream
            rect(img, 14, 9 + bob_y, 4, 3, DP)
            px(img, 14, 9 + bob_y, W10)
            px(img, 17, 9 + bob_y, W10)
        elif f == 2:
            # Summon — chanting
            px(img, 14, 6 + bob_y, T8)
            px(img, 17, 6 + bob_y, T8)
            # Mouth — open chanting
            rect(img, 15, 9 + bob_y, 2, 2, DP)
        
        # Crown / headdress (broken)
        rect(img, 13, 0 + bob_y, 6, 3, G18)
        px(img, 12, 1 + bob_y, G18)
        px(img, 19, 1 + bob_y, G18)
        # Broken crown piece
        px(img, 14, -1 + bob_y, G18)
        px(img, 17, -1 + bob_y, G18)
        
        # Spectral effect
        if f == 1:
            # Sound wave effect
            px(img, 10, 10 + bob_y, T8)
            px(img, 6, 11 + bob_y, T6)
            px(img, 22, 10 + bob_y, T8)
            px(img, 26, 11 + bob_y, T6)
            px(img, 16, 2 + bob_y, T8)
        elif f == 2:
            # Summoning spirits — wisps around
            px(img, 4, 18 + bob_y, T8)
            px(img, 28, 16 + bob_y, T8)
            px(img, 8, 4 + bob_y, T6)
            px(img, 24, 6 + bob_y, T6)
            # Glowing hands
            px(img, 7, 11 + bob_y, T8)
            px(img, 25, 11 + bob_y, T8)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_ghost_rat_swarm():
    """Ghost Rat Swarm — Cluster of ghost rats. 3 states."""
    frames = []
    
    for f in range(3):
        img = new_sprite()
        
        if f == 0:
            # SCATTER — individual rats spread out
            # Rat 1 (left)
            cx1, cy1 = 8, 16
            rect(img, cx1-3, cy1-2, 6, 4, G11)
            rect(img, cx1-2, cy1-3, 4, 3, G11)
            px(img, cx1-3, cy1-1, W9)
            px(img, cx1+2, cy1-1, W9)
            # Eyes
            px(img, cx1-2, cy1-3, T8)
            px(img, cx1, cy1-3, T8)
            # Tail
            hline(img, cx1+3, cy1+1, 4, G11)
            px(img, cx1+6, cy1, G11)
            
            # Rat 2 (right)
            cx2, cy2 = 22, 12
            rect(img, cx2-3, cy2-2, 6, 4, G11)
            rect(img, cx2-2, cy2-3, 4, 3, G11)
            px(img, cx2-3, cy2-1, W9)
            px(img, cx2+2, cy2-1, W9)
            px(img, cx2-2, cy2-3, T8)
            px(img, cx2, cy2-3, T8)
            hline(img, cx2+3, cy2+1, 5, G11)
            
            # Rat 3 (bottom)
            cx3, cy3 = 16, 24
            rect(img, cx3-3, cy3-2, 6, 4, G11)
            rect(img, cx3-2, cy3-3, 4, 3, G11)
            px(img, cx3-3, cy3-1, W9)
            px(img, cx3+2, cy3-1, W9)
            px(img, cx3-2, cy3-3, T8)
            px(img, cx3, cy3-3, T8)
            hline(img, cx3+3, cy3+1, 3, G11)
            
            # Rat 4 (top)
            cx4, cy4 = 16, 8
            rect(img, cx4-3, cy4-2, 6, 4, G11)
            rect(img, cx4-2, cy4-3, 4, 3, G11)
            px(img, cx4-2, cy4-3, T8)
            px(img, cx4, cy4-3, T8)
            hline(img, cx4+3, cy4+1, 4, G11)
            
        elif f == 1:
            # MERGE — rats clustering together
            # Central mass forming
            rect(img, 10, 10, 12, 12, G11)
            rect(img, 11, 9, 10, 14, P12)
            rect(img, 12, 11, 8, 10, G11)
            
            # Rat heads poking out
            # Head 1
            rect(img, 8, 12, 5, 4, G11)
            px(img, 9, 11, T8)
            px(img, 11, 11, T8)
            px(img, 7, 13, W9)
            
            # Head 2
            rect(img, 19, 14, 5, 4, G11)
            px(img, 20, 13, T8)
            px(img, 22, 13, T8)
            
            # Head 3
            rect(img, 13, 8, 5, 4, G11)
            px(img, 14, 7, T8)
            px(img, 16, 7, T8)
            px(img, 13, 8, W9)
            
            # Tails
            hline(img, 7, 16, 4, G11)
            hline(img, 22, 18, 5, G11)
            hline(img, 12, 23, 4, G11)
            hline(img, 18, 22, 4, G11)
            
            # Glowing eyes everywhere
            px(img, 14, 17, T8)
            px(img, 16, 19, T8)
            px(img, 10, 18, T8)
            px(img, 20, 17, T8)
            
        elif f == 2:
            # SWARM — dense writhing mass
            # Tight cluster
            circle(img, 16, 16, 10, G11)
            circle(img, 16, 16, 8, P12)
            circle(img, 16, 16, 6, G11)
            circle(img, 16, 16, 4, W9)
            
            # Many glowing eyes throughout
            eye_positions = [(10,13), (13,11), (17,11), (20,13), 
                           (22,16), (20,19), (17,21), (13,21),
                           (10,19), (8,16)]
            for ex, ey in eye_positions:
                px(img, ex, ey, T8)
            
            # Tails writhing out
            for tx, ty, length in [(6,14,5), (24,14,5), (16,24,4),
                                  (8,20,4), (22,20,4), (12,8,4)]:
                hline(img, tx, ty, length, G11)
                px(img, tx + length, ty, P12)
            
            # Eerie glow
            px(img, 14, 14, T8)
            px(img, 18, 14, T8)
            px(img, 14, 18, T8)
            px(img, 18, 18, T8)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_haunted_chandelier():
    """Haunted Chandelier — Environmental hazard. 3 anim."""
    frames = []
    
    for f in range(3):
        img = new_sprite()
        
        # Chain (top)
        rect(img, 15, 0, 2, 6, S19)
        px(img, 15, 1, S20)
        px(img, 16, 3, S20)
        px(img, 15, 5, S20)
        
        if f == 0:
            # SWING — chandelier gently swaying
            swing = 1
            
            # Main ring
            circle(img, 16 + swing, 12, 8, G18)
            circle(img, 16 + swing, 12, 6, M3)
            
            # Arms (curved)
            rect(img, 6 + swing, 8, 3, 8, G18)
            rect(img, 22 + swing, 8, 3, 8, G18)
            rect(img, 24 + swing, 12, 3, 5, G18)
            rect(img, 4 + swing, 12, 3, 5, G18)
            
            # Candles
            rect(img, 6 + swing, 5, 2, 5, W9)
            rect(img, 23 + swing, 5, 2, 5, W9)
            rect(img, 13 + swing, 4, 2, 5, W9)
            rect(img, 19 + swing, 4, 2, 5, W9)
            
            # Flames (ghostly blue)
            px(img, 7 + swing, 4, B31)
            px(img, 24 + swing, 4, B31)
            px(img, 14 + swing, 3, B31)
            px(img, 20 + swing, 3, B31)
            px(img, 6 + swing, 3, B30)
            px(img, 23 + swing, 3, B30)
            
            # Center decoration
            circle(img, 16 + swing, 14, 3, G18)
            px(img, 16 + swing, 17, G18)
            
        elif f == 1:
            # DROP FIRE — chandelier drops, fire spreading
            swing = 0
            
            circle(img, 16, 14, 8, G18)
            circle(img, 16, 14, 6, M3)
            
            rect(img, 6, 10, 3, 8, G18)
            rect(img, 22, 10, 3, 8, G18)
            rect(img, 24, 14, 3, 5, G18)
            rect(img, 4, 14, 3, 5, G18)
            
            # Candles with larger flames
            rect(img, 6, 7, 2, 5, W9)
            rect(img, 23, 7, 2, 5, W9)
            rect(img, 13, 6, 2, 5, W9)
            rect(img, 19, 6, 2, 5, W9)
            
            # Bigger flames
            px(img, 7, 6, R14)
            px(img, 7, 5, R14)
            px(img, 6, 5, R14)
            px(img, 24, 6, R14)
            px(img, 24, 5, R14)
            px(img, 23, 5, R14)
            px(img, 14, 5, R14)
            px(img, 14, 4, R14)
            px(img, 13, 4, R14)
            px(img, 20, 5, R14)
            px(img, 20, 4, R14)
            px(img, 19, 4, R14)
            
            # Fire particles falling
            px(img, 10, 22, R14)
            px(img, 20, 24, R14)
            px(img, 14, 26, R14)
            px(img, 22, 20, R14)
            
            # Chain breaking
            rect(img, 15, 0, 2, 4, S19)
            px(img, 14, 4, S20)
            
            # Chain sparks
            px(img, 14, 1, R14)
            px(img, 17, 2, R14)
            
        elif f == 2:
            # CRASH DOWN — on the ground, destroyed
            # Broken pieces on ground
            rect(img, 6, 22, 8, 4, G18)
            rect(img, 16, 25, 6, 2, G18)
            rect(img, 12, 27, 4, 3, S19)
            
            # Main ring crushed
            circle(img, 14, 26, 5, G18)
            
            # Arm pieces scattered
            rect(img, 4, 24, 3, 2, G18)
            rect(img, 22, 23, 4, 2, G18)
            rect(img, 24, 26, 2, 3, G18)
            rect(img, 2, 27, 3, 2, G18)
            
            # Fire on ground
            px(img, 8, 21, R14)
            px(img, 10, 20, R14)
            px(img, 14, 21, R14)
            px(img, 18, 20, R14)
            px(img, 20, 21, R14)
            
            px(img, 9, 19, R14)
            px(img, 11, 19, R14)
            px(img, 13, 19, R14)
            px(img, 17, 19, R14)
            
            px(img, 10, 18, R14)
            px(img, 14, 18, R14)
            
            # Smoke
            px(img, 12, 17, S19)
            px(img, 16, 17, S19)
            px(img, 14, 16, S19)
            px(img, 10, 16, S19)
            
            # Chain broken on ground
            rect(img, 14, 28, 3, 2, S19)
            
            # Sparks
            px(img, 6, 20, R14)
            px(img, 22, 22, R14)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

def make_dullahan_knight():
    """Dullahan Knight — Headless knight boss. 4 anim frames."""
    frames = []
    
    for f in range(4):
        img = new_sprite()
        
        # The Dullahan is a large boss — fills most of the 32x32
        
        if f == 0:
            # IDLE — standing menacingly
            # Hooves
            rect(img, 11, 28, 3, 2, S20)
            rect(img, 18, 28, 3, 2, S20)
            
            # Legs (armored)
            rect(img, 11, 22, 3, 7, S20)
            rect(img, 18, 22, 3, 7, S20)
            rect(img, 12, 23, 2, 5, S19)
            rect(img, 19, 23, 2, 5, S19)
            
            # Body — massive black armor
            rect(img, 8, 10, 16, 13, S20)
            rect(img, 9, 11, 14, 11, S19)
            
            # Chest plate with skull emblem
            rect(img, 13, 13, 6, 5, S20)
            circle(img, 16, 15, 2, G18)
            px(img, 16, 16, DP)
            
            # Belt
            rect(img, 9, 21, 14, 2, WD17)
            rect(img, 15, 21, 2, 2, G18)
            
            # Cape (dark, tattered)
            rect(img, 6, 11, 3, 15, R15)
            rect(img, 23, 11, 3, 15, R15)
            rect(img, 5, 12, 2, 12, R15)
            rect(img, 24, 12, 2, 12, R15)
            rect(img, 7, 24, 2, 5, BD24)
            rect(img, 23, 24, 2, 5, BD24)
            
            # Shoulder pads (large)
            rect(img, 5, 9, 5, 4, S20)
            rect(img, 22, 9, 5, 4, S20)
            rect(img, 6, 10, 4, 3, G18)
            rect(img, 23, 10, 4, 3, G18)
            
            # Arms
            rect(img, 5, 12, 3, 10, S20)
            rect(img, 24, 12, 3, 10, S20)
            
            # LEFT hand — holding own severed head
            # Severed head (held at side)
            circle(img, 7, 20, 4, W9)
            circle(img, 7, 20, 3, G11)
            # Head eyes (glowing)
            px(img, 6, 19, T8)
            px(img, 8, 19, T8)
            px(img, 6, 19, W10)
            px(img, 8, 19, W10)
            # Head hair
            rect(img, 5, 16, 4, 3, D2)
            px(img, 6, 15, D2)
            
            # RIGHT hand — holding giant axe
            rect(img, 27, 8, 2, 14, WD17)  # handle
            rect(img, 26, 6, 4, 3, S19)    # blade
            rect(img, 25, 5, 6, 2, S20)
            px(img, 26, 4, T8)  # blade glow
            px(img, 28, 4, T8)
            
            # Neck stump — where head should be
            rect(img, 14, 6, 4, 4, R15)
            rect(img, 15, 7, 2, 3, R14)
            
            # Ghostly flame from neck
            px(img, 16, 5, T8)
            px(img, 15, 4, T6)
            px(img, 17, 4, T6)
            px(img, 14, 5, T6)
            px(img, 18, 5, T6)
            
            # Spooky aura
            px(img, 10, 5, PS29)
            px(img, 22, 5, PS29)
            
        elif f == 1:
            # SWING — axe attack
            # Legs braced
            rect(img, 10, 27, 3, 3, S20)
            rect(img, 19, 27, 3, 3, S20)
            rect(img, 10, 22, 3, 6, S20)
            rect(img, 19, 22, 3, 6, S20)
            
            rect(img, 8, 10, 16, 13, S20)
            rect(img, 9, 11, 14, 11, S19)
            
            # Chest skull
            rect(img, 13, 13, 6, 5, S20)
            circle(img, 16, 15, 2, G18)
            
            # Belt
            rect(img, 9, 21, 14, 2, WD17)
            rect(img, 15, 21, 2, 2, G18)
            
            # Cape billowing
            rect(img, 4, 11, 4, 15, R15)
            rect(img, 24, 11, 4, 15, R15)
            rect(img, 3, 13, 2, 11, R15)
            
            # Shoulder pads
            rect(img, 5, 9, 5, 4, S20)
            rect(img, 22, 9, 5, 4, S20)
            
            # Arms — in swing motion
            rect(img, 4, 11, 4, 7, S20)    # left arm back
            rect(img, 26, 10, 4, 9, S20)   # right arm forward
            
            # Severed head — dropped, floating
            circle(img, 6, 22, 4, W9)
            px(img, 5, 21, T8)
            px(img, 7, 21, T8)
            
            # Giant axe — mid swing
            rect(img, 24, 5, 2, 14, WD17)
            rect(img, 22, 3, 6, 4, S19)
            rect(img, 21, 2, 8, 2, S20)
            # Axe glow trail
            px(img, 20, 2, T8)
            px(img, 19, 3, T8)
            px(img, 18, 4, T6)
            px(img, 17, 5, T6)
            
            # Neck flame
            px(img, 16, 5, T8)
            px(img, 15, 4, T8)
            px(img, 17, 4, T8)
            px(img, 14, 5, T6)
            px(img, 18, 5, T6)
            
        elif f == 2:
            # CHARGE — rushing forward
            # Legs in running pose
            rect(img, 9, 27, 3, 3, S20)
            rect(img, 20, 26, 3, 4, S20)
            rect(img, 9, 22, 3, 6, S20)
            rect(img, 20, 22, 3, 6, S20)
            
            rect(img, 7, 10, 16, 13, S20)
            rect(img, 8, 11, 14, 11, S19)
            
            # Chest
            rect(img, 12, 13, 6, 5, S20)
            circle(img, 15, 15, 2, G18)
            
            rect(img, 8, 21, 14, 2, WD17)
            rect(img, 14, 21, 2, 2, G18)
            
            # Cape streaming behind
            rect(img, 3, 10, 5, 15, R15)
            rect(img, 2, 12, 2, 11, R15)
            rect(img, 24, 10, 3, 15, R15)
            
            # Shoulder pads
            rect(img, 4, 9, 5, 4, S20)
            rect(img, 23, 9, 5, 4, S20)
            
            # Arms — charging pose
            rect(img, 4, 12, 3, 8, S20)
            rect(img, 25, 12, 3, 8, S20)
            
            # Severed head — held forward
            circle(img, 10, 16, 4, W9)
            px(img, 9, 15, T8)
            px(img, 11, 15, T8)
            
            # Axe — charging position
            rect(img, 26, 7, 2, 12, WD17)
            rect(img, 24, 5, 5, 3, S19)
            rect(img, 23, 4, 7, 2, S20)
            px(img, 22, 3, T8)
            
            # Neck flame — intense
            px(img, 15, 5, T8)
            px(img, 14, 4, T8)
            px(img, 16, 4, T8)
            px(img, 13, 5, T8)
            px(img, 17, 5, T8)
            px(img, 15, 3, T8)
            
            # Speed lines
            px(img, 2, 18, PS29)
            px(img, 1, 20, PS29)
            px(img, 3, 22, PS29)
            px(img, 2, 15, PS29)
            
        elif f == 3:
            # DISMOUNT SECOND PHASE — head reattached, berserk mode
            # Legs
            rect(img, 10, 27, 4, 3, S20)
            rect(img, 19, 27, 4, 3, S20)
            rect(img, 10, 22, 4, 6, S20)
            rect(img, 19, 22, 4, 6, S20)
            
            # Body — damaged armor
            rect(img, 8, 11, 16, 12, S20)
            rect(img, 9, 12, 14, 10, S19)
            
            # Armor damage cracks
            px(img, 11, 14, T8)
            px(img, 13, 16, T8)
            px(img, 20, 13, T8)
            px(img, 18, 17, T8)
            
            # Chest — pulsating
            circle(img, 16, 16, 3, R14)
            circle(img, 16, 16, 2, T8)
            
            rect(img, 9, 21, 14, 2, WD17)
            
            # Cape — full, larger
            rect(img, 4, 10, 5, 17, R15)
            rect(img, 23, 10, 5, 17, R15)
            rect(img, 3, 12, 2, 13, BD24)
            rect(img, 27, 12, 2, 13, BD24)
            
            # Shoulder pads — bigger
            rect(img, 4, 8, 6, 5, S20)
            rect(img, 23, 8, 6, 5, S20)
            rect(img, 5, 9, 5, 4, G18)
            rect(img, 24, 9, 5, 4, G18)
            
            # HEAD IS BACK — on the neck
            rect(img, 13, 2, 7, 8, W9)
            rect(img, 14, 3, 5, 6, G11)
            
            # Eyes — blazing red (enraged)
            px(img, 15, 5, R14)
            px(img, 18, 5, R14)
            px(img, 15, 5, W10)
            px(img, 18, 5, W10)
            
            # Mouth — screaming
            rect(img, 15, 8, 3, 2, DP)
            px(img, 15, 8, W10)
            px(img, 17, 8, W10)
            
            # Wild hair
            rect(img, 12, 0, 9, 4, D2)
            px(img, 11, 1, D2)
            px(img, 10, 2, D2)
            px(img, 21, 1, D2)
            px(img, 22, 2, D2)
            
            # Crown/coronet
            rect(img, 14, -1, 5, 3, G18)
            px(img, 13, 0, G18)
            px(img, 20, 0, G18)
            
            # Arms — both holding axe
            rect(img, 5, 11, 3, 11, S20)
            rect(img, 24, 11, 3, 11, S20)
            
            # Giant axe — two handed overhead
            rect(img, 14, -2, 2, 14, WD17)
            rect(img, 11, -3, 7, 3, S19)
            rect(img, 10, -4, 9, 2, S20)
            # Axe on fire
            px(img, 9, -4, R14)
            px(img, 10, -5, R14)
            px(img, 18, -4, R14)
            px(img, 19, -5, R14)
            px(img, 14, 0, T8)
            px(img, 15, 0, T8)
            
            # Aura of power
            for ax in range(-1, 33):
                for ay in range(-1, 33):
                    dist = math.sqrt((ax - 16)**2 + (ay - 16)**2)
                    if 14 < dist <= 16:
                        if 0 <= ax < SIZE and 0 <= ay < SIZE:
                            if img.getpixel((ax, ay)) == 0:
                                px(img, ax, ay, PS29)
            px(img, 4, 6, T8)
            px(img, 28, 6, T8)
            px(img, 6, 4, T8)
            px(img, 26, 4, T8)
        
        img = add_outlines(img)
        frames.append(img)
    
    return frames

# ═══════════════════════════════════════════════════════════════
# CREATURE REGISTRY
# ═══════════════════════════════════════════════════════════════

CREATURES = {
    "wandering_armor": {
        "name": "Wandering Armor",
        "frames": 4,
        "anim_names": ["idle_f0", "idle_f1", "idle_f2", "idle_f3"],
        "generator": make_wandering_armor,
    },
    "spectral_slime": {
        "name": "Spectral Slime",
        "frames": 4,
        "anim_names": ["idle_f0", "chase_f1", "dissipate_f2", "reform_f3"],
        "generator": make_spectral_slime,
    },
    "poltergeist_chest": {
        "name": "Poltergeist Chest",
        "frames": 3,
        "anim_names": ["trap_f0", "reveal_f1", "attack_f2"],
        "generator": make_poltergeist_chest,
    },
    "wraith_archer": {
        "name": "Wraith Archer",
        "frames": 3,
        "anim_names": ["float_f0", "shoot_f1", "phase_f2"],
        "generator": make_wraith_archer,
    },
    "cursed_statue": {
        "name": "Cursed Statue",
        "frames": 3,
        "anim_names": ["still_f0", "awakening_f1", "active_f2"],
        "generator": make_cursed_statue,
    },
    "shadow_stalker": {
        "name": "Shadow Stalker",
        "frames": 3,
        "anim_names": ["creep_f0", "pounce_f1", "retreat_f2"],
        "generator": make_shadow_stalker,
    },
    "banshee_priestess": {
        "name": "Banshee Priestess",
        "frames": 3,
        "anim_names": ["weep_f0", "scream_f1", "summon_f2"],
        "generator": make_banshee_priestess,
    },
    "ghost_rat_swarm": {
        "name": "Ghost Rat Swarm",
        "frames": 3,
        "anim_names": ["scatter_f0", "merge_f1", "swarm_f2"],
        "generator": make_ghost_rat_swarm,
    },
    "haunted_chandelier": {
        "name": "Haunted Chandelier",
        "frames": 3,
        "anim_names": ["swing_f0", "drop_fire_f1", "crash_f2"],
        "generator": make_haunted_chandelier,
    },
    "dullahan_knight": {
        "name": "Dullahan Knight",
        "frames": 4,
        "anim_names": ["idle_f0", "swing_f1", "charge_f2", "dismount_f3"],
        "generator": make_dullahan_knight,
    },
}

# ═══════════════════════════════════════════════════════════════
# MAIN GENERATION
# ═══════════════════════════════════════════════════════════════

def generate_all(output_dir="C:\\Users\\khair\\Kai-Asset-Forge\\forge-output\\haunted_denizens"):
    """Generate all haunted creature sprites."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    
    print("=" * 60)
    print("🔥 HAUNTED DUNGEON DENIZENS — Pixel Art Forge 🔥")
    print("=" * 60)
    print(f"Output: {out}")
    print()
    
    total_frames = 0
    
    for creature_key, creature_def in CREATURES.items():
        creature_dir = out / creature_key
        creature_dir.mkdir(parents=True, exist_ok=True)
        
        name = creature_def["name"]
        print(f"  Forging: {name}...", end=" ", flush=True)
        
        frames = creature_def["generator"]()
        frame_count = len(frames)
        
        # Save individual frames
        anim_names = creature_def["anim_names"]
        for i, (frame_img, anim_name) in enumerate(zip(frames, anim_names)):
            frame_path = creature_dir / f"{creature_key}_{anim_name}.png"
            frame_img.save(frame_path, "PNG")
        
        print(f"{frame_count} frames forged!")
        total_frames += frame_count
    
    print()
    print("=" * 60)
    print(f"✅ TOTAL: {len(CREATURES)} creatures, {total_frames} frames")
    print(f"📁 Output: {out}")
    print("=" * 60)
    
    return str(out)

def list_creatures():
    """List all available creatures."""
    print("\n🔥 HAUNTED DUNGEON DENIZENS — Forge Catalog 🔥")
    print("=" * 60)
    for key, defn in CREATURES.items():
        print(f"  {key:25s} | {defn['name']:20s} | {defn['frames']} frames")
    print("=" * 60)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Haunted Dungeon Denizens Pixel Art Forge")
    parser.add_argument("--output", default=None, help="Output directory")
    parser.add_argument("--list", action="store_true", help="List creatures")
    args = parser.parse_args()
    
    if args.list:
        list_creatures()
    else:
        output = args.output or "C:\\Users\\khair\\Kai-Asset-Forge\\forge-output\\haunted_denizens"
        result = generate_all(output)
        print(f"\nDone! Check {result}")
