#!/usr/bin/env python3
"""Curator: Quality inspection of Pixel Zoo & Safari Pack sprites."""

import json
import os
from collections import Counter

# Try to use PIL
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

PACK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                        "forge-output", "zoo-animals-pack")
METADATA_PATH = os.path.join(PACK_DIR, "zoo_animals_pack_metadata.json")
SPRITESHEET_PATH = os.path.join(PACK_DIR, "zoo_animals_pack_spritesheet.png")

# 0x72 Dungeon Tileset reference palette (canonical 16-color palette)
REFERENCE_PALETTE = {
    # Blacks/Grays
    (0x00, 0x00, 0x00),  # Black
    (0x1a, 0x1a, 0x1a),  # Dark gray
    (0x3a, 0x3a, 0x3a),  # Medium gray
    (0x7a, 0x7a, 0x7a),  # Light gray
    (0xbc, 0xbc, 0xbc),  # Pale gray
    # Browns
    (0x4a, 0x26, 0x00),  # Dark brown
    (0x6b, 0x3a, 0x00),  # Medium brown
    (0x8b, 0x5e, 0x3a),  # Warm brown
    (0xca, 0xa8, 0x6b),  # Light brown/tan
    # Greens
    (0x00, 0x3c, 0x00),  # Dark green
    (0x00, 0x6b, 0x00),  # Medium green
    (0x34, 0x8c, 0x3a),  # Bright green
    # Blues
    (0x00, 0x34, 0x6b),  # Dark blue
    (0x00, 0x5e, 0x8b),  # Medium blue
    # Reds/Oranges
    (0x6b, 0x00, 0x00),  # Dark red
    (0x8b, 0x3a, 0x00),  # Orange-brown
    (0xc8, 0x4a, 0x00),  # Orange
    (0xff, 0x8c, 0x00),  # Bright orange
    # Yellows
    (0x8b, 0x7a, 0x00),  # Mustard yellow
    (0xff, 0xca, 0x3a),  # Bright yellow
    # Purples
    (0x3a, 0x00, 0x3a),  # Dark purple
    (0x6b, 0x00, 0x6b),  # Medium purple
    # Whites
    (0xf0, 0xf0, 0xf0),  # White/off-white
    (0xd4, 0xd4, 0xd4),  # Near-white
}

def palette_distance(c1, c2):
    """Euclidean distance between two RGB colors."""
    return sum((a - b) ** 2 for a, b in zip(c1, c2)) ** 0.5

def nearest_palette_color(color, palette):
    """Find the nearest color in the reference palette."""
    return min(palette, key=lambda pc: palette_distance(color, pc))

def inspect_sprite(image_path, sprite_name):
    """Inspect a single sprite against quality criteria."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    
    # Get all unique colors
    pixels = list(img.getdata())
    color_set = set(pixels)
    color_counts = Counter(pixels)
    
    # Sort by frequency
    sorted_colors = sorted(color_counts.items(), key=lambda x: -x[1])
    
    # Find black pixels (the outline)
    black_pixels = sum(1 for p in pixels if p[0] < 30 and p[1] < 30 and p[2] < 30)
    black_pct = black_pixels / len(pixels) * 100 if pixels else 0
    
    # Check palette distance to reference
    palette_issues = []
    for color, _ in sorted_colors[:10]:  # Check top 10 colors
        nearest = nearest_palette_color(color, REFERENCE_PALETTE)
        dist = palette_distance(color, nearest)
        if dist > 50:  # More than ~50 RGB distance from reference
            palette_issues.append((color, nearest, round(dist)))
    
    # Check for banding artifacts (adjacent pixels with very close luminance)
    banding_score = 0
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            c = pixels[y * w + x]
            c_up = pixels[(y - 1) * w + x]
            c_down = pixels[(y + 1) * w + x]
            c_left = pixels[y * w + (x - 1)]
            c_right = pixels[y * w + (x + 1)]
            
            # Check if this pixel creates unintended banding
            for neighbor in [c_up, c_down, c_left, c_right]:
                if c != neighbor and c != (0,0,0) and neighbor != (0,0,0):
                    dist_n = palette_distance(c, neighbor)
                    if 5 < dist_n < 20:  # Very close but not identical - potential banding
                        banding_score += 1
    
    # Normalize banding score
    total_checked = (h - 2) * (w - 2)
    banding_ratio = banding_score / max(total_checked, 1)
    
    # Outline analysis: check if edges have black pixels (clean outline)
    # Check border rows for black presence
    top_edge_black = sum(1 for x in range(w) if pixels[x][0] < 30)
    left_edge_black = sum(1 for y in range(h) if pixels[y * w][0] < 30)
    
    # Count unique colors
    num_colors = len(color_set)
    
    # Determine if this is a tile (likely no outlines needed)
    is_tile = sprite_name.startswith("tile_")
    
    return {
        "name": sprite_name,
        "dimensions": f"{w}x{h}",
        "unique_colors": num_colors,
        "color_set": [f"#{r:02x}{g:02x}{b:02x}" for (r, g, b), _ in sorted_colors[:8]],
        "black_pixels_pct": round(black_pct, 1),
        "palette_issues": palette_issues,
        "banding_ratio": round(banding_ratio, 4),
        "top_edge_black": top_edge_black,
        "left_edge_black": left_edge_black,
        "is_tile": is_tile,
    }


def score_sprite(inspection):
    """Score a sprite 1-10 based on inspection data."""
    score = 7.0  # Start at baseline
    
    # Penalize excessive palette deviation
    if inspection["palette_issues"]:
        for color, nearest, dist in inspection["palette_issues"]:
            penalty = dist / 50  # Each 50 units = 1 point penalty
            score -= min(penalty * 0.5, 2.0)
    
    # Penalize banding
    if inspection["banding_ratio"] > 0.05:
        score -= min(inspection["banding_ratio"] * 20, 1.5)
    
    # Color count - good range
    if 3 <= inspection["unique_colors"] <= 8:
        score += 0.5  # Bonus for good color discipline
    elif inspection["unique_colors"] > 10:
        score -= 1.0  # Too many colors
    elif inspection["unique_colors"] <= 2 and not inspection["is_tile"]:
        score -= 0.5  # Too few colors for a non-tile
    
    # Outline quality (non-tile sprites)
    if not inspection["is_tile"]:
        if inspection["black_pixels_pct"] < 5:
            score -= 1.5  # Missing outlines
        elif inspection["black_pixels_pct"] > 25:
            score -= 0.5  # Too much black (over-outlined)
        elif 10 <= inspection["black_pixels_pct"] <= 20:
            score += 0.5  # Good outline coverage
    
    # Edge check: objects should have outline on edges
    if not inspection["is_tile"]:
        edge_coverage = (inspection["top_edge_black"] + inspection["left_edge_black"]) / 2
        if edge_coverage < 2:
            score -= 0.3  # Weak edge outline
    
    # Clamp
    score = max(1.0, min(10.0, score))
    return round(score, 1)


def main():
    if not HAS_PIL:
        print("ERROR: PIL/Pillow not available for pixel analysis")
        print("Falling back to metadata-only analysis")
        
        with open(METADATA_PATH, 'r') as f:
            meta = json.load(f)
        
        print(f"\nAnalysis based on metadata only for {meta['total_sprites']} sprites:")
        print(f"All sprites: {meta['sprite_size']}")
        
        results = []
        for name, info in meta['items'].items():
            score = 7.0
            colors = info.get('colors', 0)
            if 3 <= colors <= 8:
                score += 1.0
            elif colors <= 2:
                score += 0.5  # Tiles
            elif colors > 8:
                score -= 0.5
            score = round(score, 1)
            results.append({
                "name": name,
                "score": score,
                "colors": colors,
                "size": info['size'],
                "description": info['description'],
            })
        
        return results
    
    with open(METADATA_PATH, 'r') as f:
        meta = json.load(f)
    
    results = []
    for name, info in meta['items'].items():
        img_path = info['path']
        inspection = inspect_sprite(img_path, name)
        score = score_sprite(inspection)
        
        results.append({
            "name": name,
            "score": score,
            "colors": info.get('colors', 0),
            "size": info['size'],
            "description": info.get('description', ''),
            "inspection": {
                "palette_issues": len(inspection["palette_issues"]),
                "banding_ratio": inspection["banding_ratio"],
                "black_pct": inspection["black_pixels_pct"],
                "unique_colors_actual": inspection["unique_colors"],
            }
        })
    
    return results


if __name__ == "__main__":
    results = main()
    
    print("=" * 70)
    print("  CURATOR'S QUALITY INSPECTION — Pixel Zoo & Safari Pack")
    print("=" * 70)
    print()
    
    approved = [r for r in results if r['score'] >= 6]
    rejected = [r for r in results if r['score'] < 6]
    distinction = [r for r in results if r['score'] >= 8]
    standard = [r for r in results if 6 <= r['score'] < 8]
    
    print(f"Total sprites inspected: {len(results)}")
    print(f"APPROVED: {len(approved)} ({len(distinction)} with distinction, {len(standard)} standard pass)")
    print(f"REJECTED: {len(rejected)}")
    print(f"Average score: {sum(r['score'] for r in results) / len(results):.2f}")
    print()
    
    print("-" * 70)
    print("  APPROVED WITH DISTINCTION (score >= 8)")
    print("-" * 70)
    for r in sorted(distinction, key=lambda x: -x['score']):
        print(f"  {r['name']:20s}  Score: {r['score']:.1f}  ({r['colors']} colors)  — {r['description']}")
    
    print()
    print("-" * 70)
    print("  STANDARD PASS (score 6.0-7.9)")
    print("-" * 70)
    for r in sorted(standard, key=lambda x: -x['score']):
        print(f"  {r['name']:20s}  Score: {r['score']:.1f}  ({r['colors']} colors)  — {r['description']}")
    
    if rejected:
        print()
        print("-" * 70)
        print("  ❌ REJECTED (score < 6)")
        print("-" * 70)
        for r in sorted(rejected, key=lambda x: -x['score']):
            print(f"  {r['name']:20s}  Score: {r['score']:.1f}  ({r['colors']} colors)  — {r['description']}")
    
    print()
    print("=" * 70)
    print("  DETAILED INSPECTION DATA")
    print("=" * 70)
    for r in sorted(results, key=lambda x: -x['score']):
        insp = r.get('inspection', {})
        print(f"  {r['name']:20s}  Score: {r['score']:.1f}  "
              f"Colors: {insp.get('unique_colors_actual', r['colors'])}  "
              f"Palette issues: {insp.get('palette_issues', 'N/A')}  "
              f"Banding: {insp.get('banding_ratio', 'N/A')}  "
              f"Black%: {insp.get('black_pct', 'N/A')}")
    
    # Save results
    output = {
        "pack": "Pixel Zoo & Safari Pack",
        "total_sprites": len(results),
        "approved": len(approved),
        "rejected": len(rejected),
        "distinction": len(distinction),
        "standard_pass": len(standard),
        "average_score": round(sum(r['score'] for r in results) / len(results), 2),
        "sprites": results,
    }
    
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "forge-output", "zoo-animals-pack", "curator_report.json")
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    print(f"\nReport saved to: {output_path}")
