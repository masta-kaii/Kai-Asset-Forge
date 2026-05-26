
import os, json
from PIL import Image

BASE = r"C:\Users\khair\Kai-Asset-Forge\forge-output\haunted-dungeon-denizens"

# 0x72 Dungeon Tileset reference palette (canonical colors)
# These are the core colors from the 0x72 tileset
REF_PALETTE_HEX = {
    # Blacks / dark grays
    (0x18, 0x18, 0x18),  # #181818
    (0x24, 0x24, 0x24),  # #242424
    # Dark browns / wood
    (0x3C, 0x1C, 0x10),  # #3C1C10
    (0x5C, 0x3C, 0x1C),  # #5C3C1C
    # Reds
    (0x8C, 0x20, 0x18),  # #8C2018
    (0xB4, 0x24, 0x18),  # #B42418
    # Oranges
    (0xCC, 0x58, 0x18),  # #CC5818
    (0xE8, 0x88, 0x24),  # #E88824
    # Yellows
    (0xF0, 0xC0, 0x48),  # #F0C048
    # Greens
    (0x28, 0x68, 0x28),  # #286828
    (0x40, 0x98, 0x3C),  # #40983C
    (0x60, 0xC0, 0x54),  # #60C054
    # Blues
    (0x20, 0x40, 0x70),  # #204070
    (0x30, 0x64, 0xA0),  # #3064A0
    (0x48, 0x8C, 0xD0),  # #488CD0
    (0x70, 0xC0, 0xF0),  # #70C0F0
    # Purples
    (0x44, 0x24, 0x60),  # #442460
    (0x64, 0x38, 0x88),  # #643888
    (0x84, 0x58, 0xAC),  # #8458AC
    # Grays
    (0x40, 0x40, 0x40),  # #404040
    (0x60, 0x60, 0x60),  # #606060
    (0x84, 0x84, 0x84),  # #848484
    (0xA8, 0xA8, 0xA8),  # #A8A8A8
    (0xC8, 0xC8, 0xC8),  # #C8C8C8
    (0xF0, 0xF0, 0xF0),  # #F0F0F0
    # Skin tones / flesh
    (0xE4, 0xAC, 0x78),  # #E4AC78
    (0xD0, 0x78, 0x48),  # #D07848
    # Special
    (0x00, 0x00, 0x00),  # #000000 pure black (outlines)
    (0xFC, 0xFC, 0xFC),  # #FCFCFC white
}

def hex_color(r, g, b):
    return f"#{r:02X}{g:02X}{b:02X}"

def color_distance(c1, c2):
    return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) ** 0.5

def nearest_ref_color(pixel):
    """Find the closest reference color."""
    if len(pixel) < 3:
        return None, 999
    r, g, b = pixel[0], pixel[1], pixel[2]
    best_dist = 999
    best_color = None
    for ref in REF_PALETTE_HEX:
        dist = color_distance((r,g,b), ref)
        if dist < best_dist:
            best_dist = dist
            best_color = ref
    return best_color, best_dist

def analyze_image(path):
    """Analyze a single sprite image."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    pixels = list(img.getdata())
    
    # Collect unique colors (ignoring fully transparent)
    colors_used = set()
    color_distances = []
    has_alpha = False
    alpha_pixels = 0
    non_alpha = 0
    
    for px in pixels:
        r, g, b, a = px
        if a < 128:
            alpha_pixels += 1
            continue
        non_alpha += 1
        colors_used.add((r, g, b))
    
    # Check each color against reference palette
    max_deviation = 0
    avg_deviation = 0
    dev_count = 0
    off_palette_colors = []
    
    for c in colors_used:
        nearest, dist = nearest_ref_color(c)
        if dist > max_deviation:
            max_deviation = dist
        avg_deviation += dist
        dev_count += 1
        if dist > 30:  # Significant deviation threshold
            off_palette_colors.append((hex_color(*c), round(dist, 1)))
    
    avg_dev = round(avg_deviation / max(dev_count, 1), 1)
    
    # Check for pure black outlines (#000000 or very close)
    has_black_outlines = (0,0,0) in colors_used or (18,18,18) in colors_used
    
    # Count unique colors (non-alpha)
    unique_colors = len(colors_used)
    
    return {
        "file": os.path.basename(path),
        "dimensions": f"{w}x{h}",
        "unique_colors": unique_colors,
        "off_palette_colors": off_palette_colors[:5],  # limit to top 5
        "max_deviation": round(max_deviation, 1),
        "avg_deviation": avg_dev,
        "has_alpha": any(p[3] < 255 for p in pixels),
        "has_black_outlines": has_black_outlines,
        "alpha_ratio": round(alpha_pixels / len(pixels), 3),
    }

# Discover all PNGs
results = {}
all_files = []

for root, dirs, files in os.walk(BASE):
    for f in files:
        if f.endswith('.png') and not f.startswith('_'):
            all_files.append(os.path.join(root, f))

print(f"Found {len(all_files)} PNG files to analyze")

# Analyze each
for path in all_files:
    try:
        result = analyze_image(path)
        rel_path = os.path.relpath(path, BASE)
        results[rel_path] = result
    except Exception as e:
        print(f"ERROR: {path}: {e}")

# Group by category
categories = {}
for path, data in results.items():
    cat = os.path.dirname(path) if os.path.dirname(path) else "root"
    if cat not in categories:
        categories[cat] = []
    categories[cat].append(data)

# Summary stats
print("\n=== CATEGORY SUMMARY ===")
total_off_palette = 0
for cat, items in sorted(categories.items()):
    avg_colors = sum(i["unique_colors"] for i in items) / len(items)
    avg_dev = sum(i["avg_deviation"] for i in items) / len(items)
    off_count = sum(len(i["off_palette_colors"]) for i in items)
    black_outline_count = sum(1 for i in items if i["has_black_outlines"])
    total_off_palette += off_count
    print(f"{cat or 'root'}: {len(items)} sprites")
    print(f"  Avg colors: {avg_colors:.1f}, Avg dev: {avg_dev:.1f}, Off-palette: {off_count}")
    print(f"  With black outlines: {black_outline_count}/{len(items)}")

# Items with significant palette issues
print("\n=== SPRITES WITH PALETTE ISSUES (deviation > 30) ===")
for path, data in sorted(results.items()):
    if data["off_palette_colors"]:
        print(f"  {path}: {data['off_palette_colors']}")

print(f"\n=== OVERALL ===")
print(f"Total sprites analyzed: {len(results)}")
print(f"Total off-palette incidents: {total_off_palette}")
