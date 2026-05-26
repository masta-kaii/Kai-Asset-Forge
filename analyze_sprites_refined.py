#!/usr/bin/env python3
"""Refined analysis of zoo sprites - examining outline, palette, readability."""

from PIL import Image
import os

base = r'C:\Users\khair\Kai-Asset-Forge\forge-output\zoo-animals-pack'

all_sprites = [
    'lion','tiger','elephant','giraffe','zebra','monkey','bear','hippo',
    'crocodile','rhino','flamingo','snake','peacock','penguin','tropical_bird',
    'zoo_tree','water_pool','zoo_fence','zoo_rocks','zoo_sign','entrance_gate',
    'safari_jeep','safari_tent','compass','binoculars','zoo_map',
    'tile_grass','tile_dirt','tile_trail','feeding_area'
]

for name in all_sprites:
    path = os.path.join(base, name, f'{name}_32px.png')
    if not os.path.exists(path):
        print(f"{name:20s} | FILE MISSING")
        continue
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    pixels = list(img.getdata())
    
    # Count unique opaque colors
    opaque_pixels = [p for p in pixels if p[3] > 0]
    colors = set(p[:3] for p in opaque_pixels)
    n_colors = len(colors)
    n_opaque = len(opaque_pixels)
    
    # Sort by frequency
    from collections import Counter
    color_counts = Counter(p[:3] for p in opaque_pixels)
    top_colors = color_counts.most_common(6)
    color_str = ', '.join(f'#{r:02x}{g:02x}{b:02x}({c})' for (r,g,b),c in top_colors)
    
    # Black pixels (outline color - very dark)
    black = sum(1 for r,g,b in color_counts if r < 25 and g < 25 and b < 25)
    black_pixel_count = sum(c for (r,g,b),c in color_counts.items() if r < 25 and g < 25 and b < 25)
    black_pct = round(black_pixel_count / n_opaque * 100, 1) if n_opaque else 0
    
    # Check outline: border pixels that should be black outline
    border_coords = []
    for x in range(w):
        border_coords.append((x, 0))
        border_coords.append((x, h-1))
    for y in range(1, h-1):
        border_coords.append((0, y))
        border_coords.append((w-1, y))
    
    border_pixels = [pixels[y*w+x] for x,y in border_coords]
    border_opaque = [p for p in border_pixels if p[3] > 0]
    border_black = sum(1 for r,g,b,a in border_opaque if r < 30 and g < 30 and b < 30)
    border_pct = round(border_black / len(border_opaque) * 100, 1) if border_opaque else 0
    
    # Percentage of transparent pixels (negative space)
    trans_pct = round((w*h - n_opaque) / (w*h) * 100, 1)
    
    # Non-black, non-outline colors (the actual fill colors)
    fill_colors = [(r,g,b,c) for (r,g,b),c in color_counts.items() if not (r < 30 and g < 30 and b < 30)]
    
    is_tile = name.startswith('tile_')
    
    print(f"{name:20s} | Colors: {n_colors:2d} | Black: {black_pct:5.1f}% | Border: {border_pct:4.1f}% | Trans: {trans_pct:5.1f}% | {'TILE' if is_tile else 'OBJ '}")
    print(f"  Fills: {color_str}")
    
    # Check if outlines are clean - analyze 1px inside the border
    inner_scan = []
    if not is_tile:
        for x in range(1, w-1):
            inner_scan.append(pixels[1*w+x])  # row 1
            inner_scan.append(pixels[(h-2)*w+x])  # row h-2
        for y in range(2, h-2):
            inner_scan.append(pixels[y*w+1])  # col 1
            inner_scan.append(pixels[y*w+w-2])  # col w-2
        inner_opaque = [p for p in inner_scan if p[3] > 0]
        inner_black = sum(1 for r,g,b,a in inner_opaque if r < 30 and g < 30 and b < 30)
        inner_pct = round(inner_black / len(inner_opaque) * 100, 1) if inner_opaque else 0
        print(f"  Inner outline: {inner_pct:.1f}% black (1px inside edge)")
    print()
