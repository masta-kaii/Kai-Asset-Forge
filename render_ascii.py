#!/usr/bin/env python3
"""Render sprites as ASCII art to evaluate readability."""

from PIL import Image
import os

base = r'C:\Users\khair\Kai-Asset-Forge\forge-output\zoo-animals-pack'

sprites = ['lion', 'tiger', 'elephant', 'flamingo', 'peacock', 'snake', 
           'binoculars', 'safari_tent', 'water_pool', 'zoo_tree']

for name in sprites:
    path = os.path.join(base, name, f'{name}_32px.png')
    img = Image.open(path).convert('RGBA')
    pixels = list(img.getdata())
    w, h = img.size
    
    print(f"─── {name} ───")
    for y in range(0, h, 2):  # Every 2 rows for square aspect
        row1 = ''
        row2 = ''
        for x in range(0, w, 2):  # Every 2 cols
            # Average 2x2 block
            r_sum, g_sum, b_sum, a_sum = 0, 0, 0, 0
            count = 0
            for dy in range(2):
                for dx in range(2):
                    px_x, px_y = x+dx, y+dy
                    if px_x < w and px_y < h:
                        r,g,b,a = pixels[px_y*w + px_x]
                        if a > 0:
                            r_sum += r; g_sum += g; b_sum += b; a_sum += a
                            count += 1
            if count == 0:
                row1 += ' '
                row2 += ' '
                continue
            
            r_avg = r_sum // count
            g_avg = g_sum // count
            b_avg = b_sum // count
            
            # Map to ASCII density
            lum = 0.299 * r_avg + 0.587 * g_avg + 0.114 * b_avg
            
            if r_avg < 30 and g_avg < 30 and b_avg < 30:
                ch = '■'  # Black/outline
            elif lum > 200:
                ch = '░'  # Light
            elif lum > 150:
                ch = '▒'  # Medium-light
            elif lum > 100:
                ch = '▓'  # Medium-dark
            else:
                ch = '█'  # Dark
            
            row1 += ch
            row2 += ch
        
        print(row1)
    print()
