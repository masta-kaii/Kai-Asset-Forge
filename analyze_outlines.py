#!/usr/bin/env python3
"""Detailed pixel map analysis of suspect sprites."""

from PIL import Image
import os

base = r'C:\Users\khair\Kai-Asset-Forge\forge-output\zoo-animals-pack'

# Check the border pixels for sprites that claim "border: 0% black" 
# This may be because they don't actually touch the canvas edge
suspects = ['lion', 'tiger', 'water_pool', 'elephant', 'flamingo', 'snake', 
            'binoculars', 'zoo_map', 'safari_tent', 'feeding_area']

for name in suspects:
    path = os.path.join(base, name, f'{name}_32px.png')
    img = Image.open(path).convert('RGBA')
    pixels = list(img.getdata())
    w, h = img.size
    
    # Find bounding box of opaque pixels
    min_x, min_y = w, h
    max_x, max_y = 0, 0
    for y in range(h):
        for x in range(w):
            if pixels[y*w + x][3] > 0:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    
    sprite_w = max_x - min_x + 1
    sprite_h = max_y - min_y + 1
    
    # Check the actual bounding box edges for black outline
    top_edge = []
    for x in range(min_x, max_x + 1):
        if pixels[min_y*w + x][3] > 0:
            r,g,b,a = pixels[min_y*w + x]
            top_edge.append('#' if r < 30 else '.')
        else:
            top_edge.append(' ')
    
    bottom_edge = []
    for x in range(min_x, max_x + 1):
        if pixels[max_y*w + x][3] > 0:
            r,g,b,a = pixels[max_y*w + x]
            bottom_edge.append('#' if r < 30 else '.')
        else:
            bottom_edge.append(' ')
    
    left_edge = []
    for y in range(min_y, max_y + 1):
        if pixels[y*w + min_x][3] > 0:
            r,g,b,a = pixels[y*w + min_x]
            left_edge.append('#' if r < 30 else '.')
        else:
            left_edge.append(' ')
    
    right_edge = []
    for y in range(min_y, max_y + 1):
        if pixels[y*w + max_x][3] > 0:
            r,g,b,a = pixels[y*w + max_x]
            right_edge.append('#' if r < 30 else '.')
        else:
            right_edge.append(' ')
    
    # Count outline quality
    top_outline_pct = round(top_edge.count('#') / len(top_edge) * 100, 1) if top_edge else 0
    left_outline_pct = round(left_edge.count('#') / len(left_edge) * 100, 1) if left_edge else 0
    
    print(f"{name:15s} | Canvas pos: ({min_x},{min_y}) to ({max_x},{max_y}) | Sprite size: {sprite_w}x{sprite_h}")
    print(f"  Top edge ({sprite_w}px): {''.join(top_edge)}")
    print(f"  Top outline: {top_outline_pct}% | Left outline: {left_outline_pct}%")
    
    # Show the 5x5 center of the sprite for visual
    cx = (min_x + max_x) // 2
    cy = (min_y + max_y) // 2
    print(f"  Center 5x5 around ({cx},{cy}):")
    for dy in range(-2, 3):
        row = ''
        for dx in range(-2, 3):
            px_x, px_y = cx+dx, cy+dy
            if 0 <= px_x < w and 0 <= px_y < h:
                r,g,b,a = pixels[px_y*w + px_x]
                if a == 0:
                    row += '..'
                elif r < 30:
                    row += '##'
                else:
                    row += f'{r//32:02x}'
            else:
                row += '  '
        print(f"    {row}")
    print()
