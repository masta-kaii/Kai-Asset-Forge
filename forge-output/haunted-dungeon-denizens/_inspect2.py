
import os, json
from PIL import Image
from collections import Counter

BASE = r"C:\Users\khair\Kai-Asset-Forge\forge-output\haunted-dungeon-denizens"

def check_outline(img):
    """Check if sprite has 1px black outlines around the character."""
    w, h = img.size
    pixels = img.load()
    outline_pixels = 0
    edge_pixels = 0
    
    # Check all non-transparent edge-adjacent pixels
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y] if len(pixels[x, y]) == 4 else (*pixels[x, y], 255)
            if a < 128:
                continue
            # Check if this pixel has a transparent neighbor (it's on the edge)
            has_transparent_neighbor = False
            for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                nx, ny = x+dx, y+dy
                if 0 <= nx < w and 0 <= ny < h:
                    na = pixels[nx, ny][3] if len(pixels[nx, ny]) == 4 else 255
                    if na < 128:
                        has_transparent_neighbor = True
                        break
                else:
                    has_transparent_neighbor = True
            
            if has_transparent_neighbor:
                edge_pixels += 1
                # Check if this edge pixel is dark (outline)
                if r < 30 and g < 30 and b < 30:
                    outline_pixels += 1
    
    if edge_pixels == 0:
        return 0.0, 0, "no_alpha"
    
    ratio = outline_pixels / edge_pixels
    return ratio, edge_pixels, "ok"

def check_banding(img):
    """Check for color banding - unnatural stepped transitions."""
    w, h = img.size
    pixels = img.load()
    
    banding_score = 0
    total_checked = 0
    
    # Check horizontal bands (same row, adjacent pixels that form steps)
    for y in range(h):
        row_colors = []
        for x in range(w):
            px = pixels[x, y]
            a = px[3] if len(px) == 4 else 255
            if a >= 128:
                row_colors.append((px[0], px[1], px[2]))
            else:
                row_colors.append(None)
        
        # Look for unnatural color progressions (banding)
        for i in range(1, len(row_colors)-1):
            c0, c1, c2 = row_colors[i-1], row_colors[i], row_colors[i+1]
            if c0 is None or c1 is None or c2 is None:
                continue
            # If three adjacent pixels are very similar (forming a band)
            d01 = sum(abs(c0[j]-c1[j]) for j in range(3))
            d12 = sum(abs(c1[j]-c2[j]) for j in range(3))
            if d01 < 5 and d12 < 5:
                banding_score += 1
            total_checked += 1
    
    # Normalize by sprite size
    return banding_score / max(total_checked, 1)

def analyze_sprite(path):
    """Full quality analysis of a sprite."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    pixels = list(img.getdata())
    
    # Basic stats
    total_pixels = len(pixels)
    opaque = [p for p in pixels if p[3] >= 128]
    alpha_ratio = (total_pixels - len(opaque)) / total_pixels
    
    if not opaque:
        return None
    
    # Color analysis
    colors = Counter((p[0], p[1], p[2]) for p in opaque)
    unique_colors = len(colors)
    
    # Check for pure black (#000000) usage
    black_pixels = colors.get((0, 0, 0), 0)
    dark_pixels = sum(count for (r,g,b), count in colors.items() if r < 30 and g < 30 and b < 30)
    dark_ratio = dark_pixels / len(opaque)
    
    # Outline analysis
    outline_ratio, edge_count, outline_status = check_outline(img)
    
    # Banding analysis
    banding = check_banding(img)
    
    # Check dimensions (standard 16x16 or 32x32)
    is_standard_size = (w == 16 and h == 16) or (w == 32 and h == 32)
    
    # Readability proxy: check if the sprite has reasonable contrast
    # (difference between darkest and lightest non-alpha pixels)
    if opaque:
        min_val = min(sum(p[:3]) for p in opaque)
        max_val = max(sum(p[:3]) for p in opaque)
        contrast = max_val - min_val
    else:
        contrast = 0
    
    return {
        "dimensions": f"{w}x{h}",
        "unique_colors": unique_colors,
        "black_pixels": black_pixels,
        "dark_pixels": dark_pixels,
        "dark_ratio": round(dark_ratio, 3),
        "outline_ratio": round(outline_ratio, 3),
        "edge_pixels": edge_count,
        "outline_status": outline_status,
        "banding_score": round(banding, 4),
        "contrast": contrast,
        "alpha_ratio": round(alpha_ratio, 3),
        "is_standard_size": is_standard_size,
    }

# Collect all PNGs
all_results = {}

for root, dirs, files in os.walk(BASE):
    for f in files:
        if f.endswith('.png') and not f.startswith('_'):
            path = os.path.join(root, f)
            rel = os.path.relpath(path, BASE)
            try:
                result = analyze_sprite(path)
                if result:
                    all_results[rel] = result
            except Exception as e:
                print(f"ERR {rel}: {e}")

# Group by category
categories = {}
for path, data in all_results.items():
    cat = os.path.dirname(path) if os.path.dirname(path) else "characters"
    if cat not in categories:
        categories[cat] = []
    categories[cat].append((path, data))

# Print detailed per-category analysis
print("=" * 80)
print("HAUNTED DUNGEON DENIZENS — QUALITY INSPECTION REPORT")
print("=" * 80)

for cat in sorted(categories.keys()):
    items = categories[cat]
    print(f"\n{'─' * 60}")
    print(f"  {cat.upper()} ({len(items)} sprites)")
    print(f"{'─' * 60}")
    
    avg_colors = sum(d["unique_colors"] for _, d in items) / len(items)
    avg_banding = sum(d["banding_score"] for _, d in items) / len(items)
    avg_outline = sum(d["outline_ratio"] for _, d in items) / len(items)
    avg_dark = sum(d["dark_ratio"] for _, d in items) / len(items)
    std_sizes = sum(1 for _, d in items if d["is_standard_size"])
    
    print(f"  Avg colors:   {avg_colors:.1f}")
    print(f"  Avg banding:  {avg_banding:.4f} (lower=better)")
    print(f"  Avg outline:  {avg_outline:.1%} of edge pixels")
    print(f"  Avg dark:     {avg_dark:.1%} of sprite")
    print(f"  Std sizes:    {std_sizes}/{len(items)}")
    
    # Score computation
    # Score 1-10 based on multiple factors
    scores = []
    for path, d in items:
        score = 7.0  # baseline
        
        # + for standard size
        if d["is_standard_size"]:
            score += 0.3
        
        # + for good contrast (readability)
        if d["contrast"] > 400:
            score += 0.5
        elif d["contrast"] > 250:
            score += 0.2
        elif d["contrast"] < 100:
            score -= 1.0
        
        # + for reasonable color count (3-10 is good for pixel art)
        if 3 <= d["unique_colors"] <= 10:
            score += 0.3
        elif d["unique_colors"] > 15:
            score -= 0.5
        
        # - for banding
        score -= d["banding_score"] * 10
        
        # + for outline coverage
        if d["outline_ratio"] > 0.6:
            score += 0.5
        elif d["outline_ratio"] < 0.3 and d["outline_status"] != "no_alpha":
            score -= 0.3
        
        # Clamp
        score = max(1, min(10, score))
        scores.append(score)
    
    avg_score = sum(scores) / len(scores)
    max_score = max(scores)
    min_score = min(scores)
    print(f"  AVG SCORE:    {avg_score:.2f}/10")
    print(f"  Range:        {min_score:.1f} – {max_score:.1f}")
    
    # Top and bottom performers
    sorted_items = sorted(zip([p for p,_ in items], scores), key=lambda x: -x[1])
    print(f"  Top:    {sorted_items[0][0]} ({sorted_items[0][1]:.1f})")
    print(f"  Bottom: {sorted_items[-1][0]} ({sorted_items[-1][1]:.1f})")
    
    # Distribution
    distinctions = sum(1 for s in scores if s >= 8)
    passed = sum(1 for s in scores if 6 <= s < 8)
    rejected = sum(1 for s in scores if s < 6)
    print(f"  Approved with distinction: {distinctions}")
    print(f"  Standard pass:            {passed}")
    print(f"  Rejected:                 {rejected}")

# Overall
print(f"\n{'=' * 60}")
print("  OVERALL SUMMARY")
print(f"{'=' * 60}")
all_scores = []
for cat in categories.values():
    for path, d in cat:
        score = 7.0
        if d["is_standard_size"]: score += 0.3
        if d["contrast"] > 400: score += 0.5
        elif d["contrast"] > 250: score += 0.2
        elif d["contrast"] < 100: score -= 1.0
        if 3 <= d["unique_colors"] <= 10: score += 0.3
        elif d["unique_colors"] > 15: score -= 0.5
        score -= d["banding_score"] * 10
        if d["outline_ratio"] > 0.6: score += 0.5
        elif d["outline_ratio"] < 0.3 and d["outline_status"] != "no_alpha": score -= 0.3
        score = max(1, min(10, score))
        all_scores.append(score)

print(f"  Total sprites:     {len(all_scores)}")
print(f"  Overall avg score: {sum(all_scores)/len(all_scores):.2f}/10")
print(f"  Approved (≥6):     {sum(1 for s in all_scores if s >= 6)}")
print(f"  With distinction (≥8): {sum(1 for s in all_scores if s >= 8)}")
print(f"  Rejected (<6):     {sum(1 for s in all_scores if s < 6)}")

# List any rejected sprites
print(f"\n{'─' * 60}")
print("  REJECTED SPRITES (score < 6)")
print(f"{'─' * 60}")
for cat in categories.values():
    for path, d in cat:
        score = 7.0
        if d["is_standard_size"]: score += 0.3
        if d["contrast"] > 400: score += 0.5
        elif d["contrast"] > 250: score += 0.2
        elif d["contrast"] < 100: score -= 1.0
        if 3 <= d["unique_colors"] <= 10: score += 0.3
        elif d["unique_colors"] > 15: score -= 0.5
        score -= d["banding_score"] * 10
        if d["outline_ratio"] > 0.6: score += 0.5
        elif d["outline_ratio"] < 0.3 and d["outline_status"] != "no_alpha": score -= 0.3
        score = max(1, min(10, score))
        if score < 6:
            print(f"  {path}: {score:.1f}/10 (colors={d['unique_colors']}, outline={d['outline_ratio']:.1%}, banding={d['banding_score']:.4f})")
