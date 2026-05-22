"""Kai-Asset-Forge Pixel Post-Processor v2
Transforms full-resolution SDXL outputs into clean pixel art sprites using:
- Curated retro game palette (NES + PICO-8 + custom game palette)
- Floyd-Steinberg dithering for smooth gradients
- Smart outline detection
- Quality scoring

Usage: python pixel-post-processor-v2.py <input_path> <output_path> [options]
Options:
  --palette NAME     palette: nes, pico8, custom, auto (default: auto)
  --size N           target size in pixels (default: 64)
  --no-outline       skip outline pass
  --dither           enable Floyd-Steinberg dithering
  --score            print quality score to stdout
"""

import sys, os, json
from PIL import Image

# ═══════════════════════════════════════════════════════════════════════════
# CURATED RETRO PALETTES
# ═══════════════════════════════════════════════════════════════════════════

PALETTES = {
    # NES palette (54 colors - the full NES color space)
    "nes": [
        (0x75, 0x75, 0x75), (0x27, 0x1B, 0x8F), (0x00, 0x00, 0xAB), (0x47, 0x00, 0x9F),
        (0x8F, 0x00, 0x77), (0xAB, 0x00, 0x13), (0xA7, 0x00, 0x00), (0x7C, 0x0A, 0x00),
        (0x3E, 0x2A, 0x00), (0x00, 0x47, 0x00), (0x00, 0x51, 0x00), (0x00, 0x3C, 0x13),
        (0x1F, 0x27, 0x5F), (0x00, 0x00, 0x00), (0xBC, 0xBC, 0xBC), (0x00, 0x73, 0xEF),
        (0x23, 0x3B, 0xEF), (0x83, 0x00, 0xF3), (0xBF, 0x00, 0xBF), (0xE7, 0x00, 0x5B),
        (0xDB, 0x2B, 0x00), (0xCB, 0x4F, 0x0F), (0x8B, 0x73, 0x00), (0x00, 0x97, 0x00),
        (0x00, 0xAB, 0x00), (0x00, 0x83, 0x3B), (0x00, 0x5F, 0x83), (0x00, 0x00, 0x00),
        (0xFF, 0xFF, 0xFF), (0x3F, 0xBF, 0xFF), (0x5F, 0x97, 0xFF), (0xA7, 0x8B, 0xFD),
        (0xF7, 0x7B, 0xFF), (0xFF, 0x77, 0xB7), (0xFF, 0x77, 0x63), (0xFF, 0x9B, 0x3B),
        (0xF3, 0xBF, 0x3F), (0x83, 0xD3, 0x13), (0x4F, 0xDF, 0x4F), (0x58, 0xF8, 0x98),
        (0x00, 0xEB, 0xAB), (0x00, 0x00, 0x00), None, None, None,
        None, None, None, None, None, None, None, None, None,
    ],
    # PICO-8 palette (16 colors, iconic)
    "pico8": [
        (0x00, 0x00, 0x00), (0x1D, 0x2B, 0x53), (0x7E, 0x25, 0x53), (0x00, 0x87, 0x51),
        (0xAB, 0x52, 0x36), (0x5F, 0x57, 0x4F), (0xC2, 0xC3, 0xC7), (0xFF, 0xF1, 0xE8),
        (0xFF, 0x00, 0x4D), (0xFF, 0xA3, 0x00), (0xFF, 0xEC, 0x27), (0x00, 0xE4, 0x36),
        (0x29, 0xAD, 0xFF), (0x83, 0x76, 0x9C), (0xFF, 0x77, 0xA8), (0xFF, 0xCC, 0xAA),
    ],
    # Custom game palette (best of retro + modern pixel art)
    "custom": [
        (0x00, 0x00, 0x00),  # Black
        (0xFF, 0xFF, 0xFF),  # White
        (0xE8, 0x20, 0x20),  # Red
        (0xF0, 0x90, 0x20),  # Orange
        (0xF0, 0xD0, 0x20),  # Yellow
        (0x20, 0xC0, 0x20),  # Green
        (0x20, 0x80, 0xF0),  # Blue
        (0x80, 0x40, 0xD0),  # Purple
        (0xD0, 0x60, 0xA0),  # Pink
        (0x50, 0x70, 0x80),  # Steel blue
        (0x80, 0x80, 0x80),  # Gray
        (0xC0, 0xC0, 0xC0),  # Light gray
        (0x60, 0x30, 0x10),  # Brown
        (0xD0, 0xB0, 0x80),  # Tan
        (0xA0, 0x60, 0x20),  # Rust
        (0xE0, 0xD0, 0xC0),  # Cream
        (0x40, 0x80, 0x40),  # Forest green
        (0x20, 0x40, 0x80),  # Navy
        (0x30, 0x20, 0x10),  # Dark brown
        (0xC0, 0x50, 0x30),  # Brick red
        (0x90, 0x80, 0x70),  # Warm gray
        (0x30, 0x60, 0x60),  # Dark teal
        (0x60, 0x90, 0xA0),  # Slate
        (0xF0, 0xC0, 0x80),  # Peach
        (0x80, 0x50, 0x30),  # Copper
        (0x90, 0xC0, 0x30),  # Lime
        (0x40, 0x40, 0x40),  # Dark gray
        (0xE0, 0x90, 0x60),  # Salmon
        (0x70, 0x90, 0xC0),  # Steel
        (0x20, 0x80, 0x80),  # Teal
        (0xD0, 0xB0, 0x60),  # Gold
        (0xC0, 0x80, 0x60),  # Bronze
    ],
    # Auto-detect from image
    "auto": None,
}


def find_closest_color(r, g, b, palette):
    """Find the closest color in palette using weighted RGB distance (perceptual)"""
    best_dist = float("inf")
    best_color = palette[0]
    for pr, pg, pb in palette:
        if pr is None:
            continue
        # Weighted RGB — human eyes are more sensitive to green
        dr = r - pr
        dg = g - pg
        db = b - pb
        dist = (dr * dr) * 0.3 + (dg * dg) * 0.59 + (db * db) * 0.11
        if dist < best_dist:
            best_dist = dist
            best_color = (pr, pg, pb)
    return best_color


def apply_dithering(img, palette):
    """Floyd-Steinberg dithering for smooth gradients with limited palette"""
    pixels = img.load()
    w, h = img.size

    for y in range(h):
        for x in range(w):
            r, g, b, *a = pixels[x, y]
            a = a[0] if a else 255
            if a < 128:
                continue  # Skip transparent pixels

            old_pixel = (r, g, b)
            new_pixel = find_closest_color(r, g, b, palette)
            pixels[x, y] = new_pixel + (a,)

            quant_error = tuple(old_pixel[i] - new_pixel[i] for i in range(3))

            if x + 1 < w:
                apply_error(pixels, x + 1, y, quant_error, 7 / 16, w, h)
            if y + 1 < h:
                if x > 0:
                    apply_error(pixels, x - 1, y + 1, quant_error, 3 / 16, w, h)
                apply_error(pixels, x, y + 1, quant_error, 5 / 16, w, h)
                if x + 1 < w:
                    apply_error(pixels, x + 1, y + 1, quant_error, 1 / 16, w, h)

    return img


def apply_error(pixels, x, y, error, factor, w, h):
    """Apply quantization error to neighboring pixel"""
    if 0 <= x < w and 0 <= y < h:
        r, g, b, *a = pixels[x, y]
        a = a[0] if a else 255
        if a < 128:
            return
        nr = max(0, min(255, r + int(error[0] * factor)))
        ng = max(0, min(255, g + int(error[1] * factor)))
        nb = max(0, min(255, b + int(error[2] * factor)))
        pixels[x, y] = (nr, ng, nb, a)


def smart_crop(img, padding=2):
    """Crop to non-white/non-transparent content with padding"""
    pixels = img.load()
    w, h = img.size

    min_x, min_y = w, h
    max_x, max_y = 0, 0

    for y in range(h):
        for x in range(w):
            r, g, b, *a = pixels[x, y]
            a = a[0] if a else 255
            is_white = r > 240 and g > 240 and b > 240
            if a > 128 and not is_white:
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)

    if max_x <= min_x or max_y <= min_y:
        return img  # No content found

    # Add padding
    min_x = max(0, min_x - padding)
    min_y = max(0, min_y - padding)
    max_x = min(w, max_x + padding)
    max_y = min(h, max_y + padding)

    return img.crop((min_x, min_y, max_x, max_y))


def pixel_outline(img, threshold=128, outline_color=(0, 0, 0)):
    """Add pixel-perfect outlines around non-transparent regions"""
    pixels = img.load()
    w, h = img.size
    result = img.copy()
    result_pixels = result.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > threshold:
                # Check if adjacent pixel is transparent or very different
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        nr, ng, nb, na = pixels[nx, ny]
                        if na <= threshold:
                            result_pixels[x, y] = outline_color + (255,)
                            break
                        # Also outline against very light backgrounds
                        if nr > 235 and ng > 235 and nb > 235:
                            result_pixels[x, y] = outline_color + (255,)
                            break

    return result


def score_quality(img, palette_name, num_colors):
    """Score sprite quality from 1-10"""
    pixels = img.load()
    w, h = img.size
    score = 5.0  # Start at 5

    # Factor 1: Color count (too many = bad for pixel art, too few = too simple)
    # Sweet spot: 8-32 colors for pixel art sprites
    if 4 <= num_colors <= 48:
        score += 1.5
    elif num_colors <= 2 or num_colors > 64:
        score -= 1.0
    else:
        score += 0.5

    # Factor 2: Aspect ratio (should be roughly square for sprites)
    ratio = max(w, h) / min(w, h) if min(w, h) > 0 else 1
    if ratio <= 1.2:
        score += 1.0
    elif ratio <= 1.5:
        score += 0.5
    else:
        score -= 0.5

    # Factor 3: Non-white pixel ratio (should have substantial content)
    content_pixels = 0
    total_pixels = w * h
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 128 and not (r > 240 and g > 240 and b > 240):
                content_pixels += 1

    content_ratio = content_pixels / max(total_pixels, 1)
    if 0.3 <= content_ratio <= 0.8:
        score += 1.5
    elif content_ratio > 0.1:
        score += 0.5
    else:
        score -= 0.5

    # Factor 4: Outline presence (check edge pixels)
    edge_count = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 128 and r < 50 and g < 50 and b < 50:
                # Check if near transparent pixel (is an outline)
                is_edge = False
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h:
                        na = pixels[nx, ny][3]
                        if na < 128:
                            is_edge = True
                            break
                if is_edge:
                    edge_count += 1

    if edge_count > 5:
        score += 1.0  # Has outlines (good for pixel art)
    else:
        score -= 0.5  # No outlines

    # Factor 5: Palette type bonus
    if palette_name in ("custom", "pico8"):
        score += 0.5  # Curated palette

    return max(1, min(10, round(score)))


def detect_palette(img):
    """Auto-detect the best palette for an image"""
    pixels = img.load()
    w, h = img.size
    colors = set()

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 128:
                colors.add((r // 16 * 16, g // 16 * 16, b // 16 * 16))

    num_colors = len(colors)
    if num_colors <= 16:
        return "pico8"
    elif num_colors <= 32:
        return "custom"
    else:
        return "nes"


def main():
    args = sys.argv[1:]
    if not args or "-h" in args or "--help" in args:
        print(__doc__)
        sys.exit(0)

    input_path = args[0]
    output_path = args[1] if len(args) > 1 else input_path

    # Parse options
    palette_name = "auto"
    target_size = 64
    do_outline = True
    do_dither = False
    do_score = False

    if "--palette" in args:
        idx = args.index("--palette") + 1
        if idx < len(args):
            palette_name = args[idx]
    if "--size" in args:
        idx = args.index("--size") + 1
        if idx < len(args):
            target_size = int(args[idx])
    if "--no-outline" in args:
        do_outline = False
    if "--dither" in args:
        do_dither = True
    if "--score" in args:
        do_score = True

    # Validate paths
    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        sys.exit(1)

    # Load image
    img = Image.open(input_path).convert("RGBA")
    print(f"[ppv2] Loaded {input_path} ({img.size[0]}×{img.size[1]}, {img.size[0]*img.size[1]}px)")

    # Step 1: Smart crop
    img = smart_crop(img)
    print(f"[ppv2] Cropped to {img.size[0]}×{img.size[1]}")

    # Step 2: Downscale to target size
    img = img.resize((target_size, target_size), Image.Resampling.NEAREST)
    print(f"[ppv2] Downscaled to {target_size}×{target_size}")

    # Step 3: Detect or select palette
    if palette_name == "auto":
        palette_name = detect_palette(img)
        print(f"[ppv2] Auto-detected palette: {palette_name}")

    palette = PALETTES.get(palette_name)
    if palette is None:
        print(f"Error: Unknown palette '{palette_name}'")
        print(f"Available: {', '.join(k for k in PALETTES if k != 'auto')}")
        sys.exit(1)

    # Filter out None entries
    palette = [c for c in palette if c is not None]

    print(f"[ppv2] Quantizing to {len(palette)} colors ({palette_name} palette)...")

    # Step 4: Quantize (with or without dithering)
    if do_dither:
        img = apply_dithering(img, palette)
        print(f"[ppv2] Applied Floyd-Steinberg dithering")
    else:
        # Simple nearest-color quantization
        pixels = img.load()
        for y in range(target_size):
            for x in range(target_size):
                r, g, b, a = pixels[x, y]
                if a > 128:
                    nearest = find_closest_color(r, g, b, palette)
                    pixels[x, y] = nearest + (a,)
        print(f"[ppv2] Applied nearest-color quantization")

    # Step 5: Outline pass
    if do_outline:
        img = pixel_outline(img)
        print(f"[ppv2] Added pixel outline")

    # Step 6: Count actual colors used
    used_colors = set()
    pixels = img.load()
    for y in range(target_size):
        for x in range(target_size):
            r, g, b, a = pixels[x, y]
            if a > 128:
                used_colors.add((r, g, b))

    # Save output
    img.save(output_path)
    print(f"[ppv2] Saved to {output_path}")

    # Quality score
    quality_score = score_quality(img, palette_name, len(used_colors))

    result = {
        "colors_before": -1,  # Unknown
        "colors_after": len(used_colors),
        "palette": palette_name,
        "size": target_size,
        "outline": do_outline,
        "dither": do_dither,
        "quality_score": quality_score,
    }

    print(f"\n{'='*50}")
    print(f"  QUALITY REPORT")
    print(f"{'='*50}")
    print(f"  Colors used : {len(used_colors)}")
    print(f"  Palette     : {palette_name} ({len(palette)} colors available)")
    print(f"  Size        : {target_size}×{target_size}")
    print(f"  Outline     : {'Yes' if do_outline else 'No'}")
    print(f"  Dithering   : {'Yes' if do_dither else 'No'}")
    print(f"  QUALITY     : {quality_score}/10 ⭐")
    print(f"{'='*50}")

    if do_score:
        print(json.dumps(result))

    return result


if __name__ == "__main__":
    main()
