#!/usr/bin/env python3
"""
sprite-enhancer.py — Upgrades existing pixel art sprites to higher quality.
- Upscales 2x with pixel-perfect scaling
- Adds drop shadow layer
- Enhances outlines (2px instead of 1px)
- Adds highlight overlay
- Outputs enhanced sprites to forge-output/enhanced/

Usage:
    python sprite-enhancer.py --all
    python sprite-enhancer.py --character dwarf
    python sprite-enhancer.py --input forge-output/aseprite/ --output forge-output/enhanced/
"""

import sys, os, argparse
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw

def pixel_scale(img: Image.Image, factor: int = 2) -> Image.Image:
    """Scale pixel art with nearest-neighbor (crisp edges)."""
    w, h = img.size
    return img.resize((w * factor, h * factor), Image.NEAREST)

def add_drop_shadow(img: Image.Image, offset: tuple = (2, 2), opacity: float = 0.4) -> Image.Image:
    """Add a drop shadow beneath the sprite."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    
    # Create shadow canvas (bigger to accommodate offset)
    shadow_w = w + abs(offset[0]) + 4
    shadow_h = h + abs(offset[1]) + 4
    canvas = Image.new("RGBA", (shadow_w, shadow_h), (0, 0, 0, 0))
    
    # Extract alpha as shadow silhouette
    alpha = rgba.split()[3]
    shadow = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    
    # Create shadow from alpha channel
    for y in range(h):
        for x in range(w):
            a = alpha.getpixel((x, y))
            if a > 0:
                shadow.putpixel((x, y), (0, 0, 0, int(a * opacity)))
    
    # Blur the shadow
    shadow_blur = shadow.filter(ImageFilter.GaussianBlur(radius=1))
    
    # Paste shadow then sprite on top
    canvas.paste(shadow_blur, (offset[0] + 2, offset[1] + 2), shadow_blur)
    canvas.paste(rgba, (2, 2), rgba)
    
    return canvas

def enhance_outline(img: Image.Image, strength: int = 1) -> Image.Image:
    """Thicken outlines by adding an extra outline pixel."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    alpha = rgba.split()[3]
    
    # Create enhanced outline layer
    enhanced = Image.new("RGBA", (w + strength * 2, h + strength * 2), (0, 0, 0, 0))
    outline_color = (0, 0, 0, 180)
    
    for y in range(h):
        for x in range(w):
            a = alpha.getpixel((x, y))
            pixel = rgba.getpixel((x, y))
            
            # Check if this is an outline pixel (dark, non-transparent)
            is_outline = (a > 0 and pixel[0] < 15 and pixel[1] < 15 and pixel[2] < 15)
            is_transparent_neighbor = False
            
            # Check if adjacent to transparent pixel
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        if alpha.getpixel((nx, ny)) == 0:
                            is_transparent_neighbor = True
                            break
            
            if is_outline or (a > 0 and is_transparent_neighbor):
                # Draw extra outline pixel
                ex, ey = x + strength, y + strength
                if 0 <= ex < w + strength * 2 and 0 <= ey < h + strength * 2:
                    # Darken existing outline neighbors
                    existing_a = enhanced.getpixel((ex, ey))[3]
                    if existing_a < outline_color[3]:
                        enhanced.putpixel((ex, ey), outline_color)
    
    # Composite: enhanced outline under original sprite
    result = Image.new("RGBA", enhanced.size, (0, 0, 0, 0))
    result.paste(enhanced, (0, 0))
    result.paste(rgba, (strength, strength), rgba)
    
    return result

def add_highlight_layer(img: Image.Image) -> Image.Image:
    """Add a subtle top-left highlight overlay for depth."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    alpha = rgba.split()[3]
    
    highlight = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    
    for y in range(h):
        for x in range(w):
            a = alpha.getpixel((x, y))
            if a > 100:  # Only highlight solid pixels
                # Stronger highlight near top-left
                dist_factor = max(0, 1.0 - (x / w + y / h) * 0.5)
                highlight_a = int(a * 0.12 * dist_factor)
                if highlight_a > 0:
                    highlight.putpixel((x, y), (255, 255, 255, highlight_a))
    
    # Composite highlight over original
    result = rgba.copy()
    result.paste(highlight, (0, 0), highlight)
    
    return result

def enhance_sprite(input_path: Path, output_path: Path, upscale: bool = True):
    """Full enhancement pipeline for a single sprite."""
    img = Image.open(input_path).convert("RGBA")
    original_size = img.size
    
    # Step 1: Enhance outlines
    img = enhance_outline(img, strength=1)
    
    # Step 2: Add highlight layer
    img = add_highlight_layer(img)
    
    # Step 3: Add drop shadow
    img = add_drop_shadow(img, offset=(2, 2), opacity=0.35)
    
    # Step 4: Upscale 2x
    if upscale:
        img = pixel_scale(img, factor=2)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG", optimize=True)
    
    return original_size, img.size

def main():
    parser = argparse.ArgumentParser(description="Enhance pixel art sprites")
    parser.add_argument("--all", action="store_true", help="Process all sprites in forge-output/aseprite/")
    parser.add_argument("--character", type=str, help="Enhance specific character (e.g., dwarf)")
    parser.add_argument("--input", type=str, default="forge-output/aseprite/", help="Input directory")
    parser.add_argument("--output", type=str, default="forge-output/enhanced/", help="Output directory")
    parser.add_argument("--no-upscale", action="store_true", help="Skip 2x upscale")
    args = parser.parse_args()
    
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    
    if not input_dir.exists():
        print(f"❌ Input directory not found: {input_dir}")
        sys.exit(1)
    
    # Collect files to process
    png_files = []
    if args.character:
        pattern = f"*{args.character}*.png"
        png_files = list(input_dir.rglob(pattern))
    elif args.all:
        png_files = list(input_dir.rglob("*.png"))
    else:
        print("Usage: --all or --character <name>")
        sys.exit(1)
    
    print(f"🎨 Enhancing {len(png_files)} sprites...")
    
    enhanced = 0
    size_gains = []
    
    for png in png_files:
        rel_path = png.relative_to(input_dir)
        out_path = output_dir / rel_path
        
        try:
            orig_size, new_size = enhance_sprite(png, out_path, not args.no_upscale)
            size_gains.append((orig_size, new_size))
            enhanced += 1
            
            if enhanced % 20 == 0:
                print(f"  ... {enhanced}/{len(png_files)} done")
        except Exception as e:
            print(f"  ⚠ {png.name}: {e}")
    
    # Summary
    total_orig_w = sum(s[0][0] for s in size_gains)
    total_orig_h = sum(s[0][1] for s in size_gains)
    total_new_w = sum(s[1][0] for s in size_gains)
    total_new_h = sum(s[1][1] for s in size_gains)
    
    print(f"\n✅ Enhanced {enhanced}/{len(png_files)} sprites!")
    print(f"📐 Avg size: {int(total_orig_w/len(size_gains))}×{int(total_orig_h/len(size_gains))} → {int(total_new_w/len(size_gains))}×{int(total_new_h/len(size_gains))}")
    print(f"📁 Output: {output_dir.absolute()}")

if __name__ == "__main__":
    main()
