#!/usr/bin/env python3
"""Render remaining sprites as ASCII art."""

from PIL import Image
import os

base = r'C:\Users\khair\Kai-Asset-Forge\forge-output\zoo-animals-pack'

sprites = ['giraffe', 'zebra', 'monkey', 'bear', 'hippo', 'crocodile', 'rhino', 
           'penguin', 'tropical_bird', 'zoo_fence', 'zoo_rocks', 'zoo_sign', 
           'entrance_gate', 'safari_jeep', 'compass', 'zoo_map', 'feeding_area',
           'tile_grass', 'tile_dirt', 'tile_trail']

for name in sprites:
    path = os.path.join(base, name, f'{name}_32px.png')
    img = Image.open(path).convert('RGBA')
    pixels = list(img.getdata())
    w, h = img.size
    
    print(f"─── {name} ───")
    for y in range(0, h, 2):
        row = ''
        for x in range(0, w, 2):
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
                row += ' '
            else:
                r_avg = r_sum // count
                g_avg = g_sum // count
                b_avg = b_sum // count
                lum = 0.299 * r_avg + 0.587 * g_avg + 0.114 * b_avg
                
                if r_avg < 30 and g_avg < 30 and b_avg < 30:
                    ch = '█'
                elif lum > 200:
                    ch = '░'
                elif lum > 150:
                    ch = '▒'
                elif lum > 100:
                    ch = '▓'
                else:
                    ch = '█'
                row += ch
        print(row)
    print()
