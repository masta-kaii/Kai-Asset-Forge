
import os, json
from PIL import Image
from collections import Counter

BASE = r"C:\Users\khair\Kai-Asset-Forge\forge-output\haunted-dungeon-denizens"

def analyze_sprite(path):
    """Accurate quality analysis of a sprite."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    pixels = img.load()
    
    total = w * h
    opaque_pixels = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a >= 128:
                opaque_pixels.append((x, y, r, g, b))
    
    if not opaque_pixels:
        return None
    
    # Color analysis
    colors = Counter((r,g,b) for _,_,r,g,b in opaque_pixels)
    unique_colors = len(colors)
    
    # Check for dark outlines (outline-tolerant: any very dark color)
    dark_outline_pixels = sum(1 for _,_,r,g,b in opaque_pixels if r < 25 and g < 25 and b < 25)
    dark_ratio = dark_outline_pixels / len(opaque_pixels)
    
    # Better outline detection: check edge pixels (pixels adjacent to transparency)
    edge_dark = 0
    edge_total = 0
    for x, y, r, g, b in opaque_pixels:
        is_edge = False
        for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h:
                na = pixels[nx, ny][3]
                if na < 128:
                    is_edge = True
                    break
            else:
                is_edge = True
        if is_edge:
            edge_total += 1
            if r < 25 and g < 25 and b < 25:
                edge_dark += 1
    
    outline_coverage = edge_dark / max(edge_total, 1)
    
    # Contrast (brightest - darkest sum)
    if opaque_pixels:
        sums = [r+g+b for _,_,r,g,b in opaque_pixels]
        contrast = max(sums) - min(sums)
    else:
        contrast = 0
    
    # Determine if this is a standard sprite size or spritesheet
    is_16x16 = w == 16 and h == 16
    is_32x32 = w == 32 and h == 32
    is_sheet = w > 32 or h > 32 or (w > 16 and h > 16)
    
    # Readability composite: has enough contrast + reasonable color count
    readability = 0
    if contrast > 200: readability += 1
    if 3 <= unique_colors <= 10: readability += 1
    if outline_coverage > 0.3: readability += 1
    
    return {
        "dim": f"{w}x{h}",
        "colors": unique_colors,
        "dark_ratio": round(dark_ratio, 3),
        "outline_pct": round(outline_coverage * 100, 1),
        "contrast": contrast,
        "is_16x16": is_16x16,
        "is_32x32": is_32x32,
        "is_sheet": is_sheet,
        "readability": readability,
        "edge_total": edge_total,
    }

# Analyze by category
categories = {
    "characters": [d for d in ["."] for f in os.listdir(os.path.join(BASE, ".")) if f.endswith('.png') and not f.startswith('_') and not f.startswith('haunted') and not f.startswith('verify')],
    "tiles": os.listdir(os.path.join(BASE, "tiles")),
    "furniture": os.listdir(os.path.join(BASE, "furniture")),
    "props": os.listdir(os.path.join(BASE, "props")),
    "weapons": os.listdir(os.path.join(BASE, "weapons")),
    "ui": os.listdir(os.path.join(BASE, "ui")),
    "creative": os.listdir(os.path.join(BASE, "creative")),
}

# Actually let me just discover files properly
all_results = {}
for root, dirs, files in os.walk(BASE):
    for f in files:
        if not f.endswith('.png') or f.startswith('_') or f.startswith('haunted') or f.startswith('verify'):
            continue
        path = os.path.join(root, f)
        rel = os.path.relpath(path, BASE)
        try:
            result = analyze_sprite(path)
            if result:
                all_results[rel] = result
        except:
            pass

# Print by category
cat_map = {}
for path, d in all_results.items():
    cat = os.path.dirname(path) if os.path.dirname(path) else "characters"
    cat_map.setdefault(cat, []).append((path, d))

print("=" * 70)
print("  HAUNTED DUNGEON DENIZENS — REVISED INSPECTION")
print("=" * 70)

for cat in sorted(cat_map.keys()):
    items = cat_map[cat]
    print(f"\n  [{cat.upper()}] {len(items)} sprites")
    
    # Group by type
    sheets = [(p,d) for p,d in items if d["is_sheet"]]
    singles = [(p,d) for p,d in items if not d["is_sheet"]]
    
    print(f"    Spritesheets: {len(sheets)} | Single sprites: {len(singles)}")
    
    # Compute proper scores
    for label, group in [("Character frames", singles), ("Spritesheets", sheets)]:
        if not group:
            continue
        scores = []
        for path, d in group:
            s = 7.0
            if d["is_16x16"]: s += 0.3
            if d["is_32x32"]: s += 0.5
            if d["contrast"] > 400: s += 0.5
            elif d["contrast"] > 250: s += 0.3
            elif d["contrast"] < 100: s -= 0.5
            if 3 <= d["colors"] <= 10: s += 0.3
            if d["outline_pct"] > 30: s += 0.5
            elif d["outline_pct"] > 15: s += 0.2
            if d["readability"] >= 2: s += 0.3
            if d["readability"] == 0: s -= 0.5
            s = round(max(1, min(10, s)), 1)
            scores.append((path, s, d))
        
        avg = sum(s[1] for s in scores) / len(scores)
        dist = sum(1 for s in scores if s[1] >= 8)
        passed = sum(1 for s in scores if 6 <= s[1] < 8)
        rejected = sum(1 for s in scores if s[1] < 6)
        
        print(f"    [{label}] Avg: {avg:.2f}/10")
        print(f"      Distinguished: {dist} | Passed: {passed} | Rejected: {rejected}")
        
        if scores:
            top = max(scores, key=lambda x: x[1])
            bot = min(scores, key=lambda x: x[1])
            print(f"      Best: {top[0]} ({top[1]})  Worst: {bot[0]} ({bot[1]})")

# Overall
print(f"\n{'=' * 70}")
print("  FINAL VERDICT")
print(f"{'=' * 70}")

all_scores = []
all_details = []
for items in cat_map.values():
    for path, d in items:
        s = 7.0
        if d["is_16x16"]: s += 0.3
        if d["is_32x32"]: s += 0.5
        if d["contrast"] > 400: s += 0.5
        elif d["contrast"] > 250: s += 0.3
        elif d["contrast"] < 100: s -= 0.5
        if 3 <= d["colors"] <= 10: s += 0.3
        if d["outline_pct"] > 30: s += 0.5
        elif d["outline_pct"] > 15: s += 0.2
        if d["readability"] >= 2: s += 0.3
        if d["readability"] == 0: s -= 0.5
        s = round(max(1, min(10, s)), 1)
        all_scores.append(s)
        all_details.append((path, s, d))

print(f"  Total sprites: {len(all_scores)}")
print(f"  Avg score: {sum(all_scores)/len(all_scores):.2f}/10")
print(f"  Distinguished (>=8): {sum(1 for s in all_scores if s >= 8)}")
print(f"  Standard pass (6-7.9): {sum(1 for s in all_scores if 6 <= s < 8)}")
print(f"  Rejected (<6): {sum(1 for s in all_scores if s < 6)}")

print(f"\n  APPROVED WITH DISTINCTION:")
for path, s, d in sorted(all_details, key=lambda x: -x[1]):
    if s >= 8:
        print(f"    {path}: {s}/10")

print(f"\n  STANDARD PASS:")
for path, s, d in sorted(all_details, key=lambda x: -x[1]):
    if 6 <= s < 8:
        print(f"    {path}: {s}/10 (colors={d['colors']}, outline={d['outline_pct']}%)")

print(f"\n  REJECTED:")
for path, s, d in sorted(all_details, key=lambda x: x[1]):
    if s < 6:
        print(f"    {path}: {s}/10 (colors={d['colors']}, outline={d['outline_pct']}%)")
