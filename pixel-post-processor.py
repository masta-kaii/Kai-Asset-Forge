#!/usr/bin/env python3
"""
Pixel Post-Processor — turns SDXL output into CLEAN pixel art.

Takes a 640×640 SDXL generation (or any PNG), applies:
1. Smart crop to sprite bounding box
2. Retro palette quantization (NES / PICO-8 / custom)
3. Clean 1px outline reconstruction
4. Noise removal (isolated pixels)
5. Pixel-perfect downscale to target size

Usage:
    python pixel-post-processor.py input.png output.png [options]

Options:
    --palette <nes|pico8|custom>   Retro palette to use (default: custom)
    --outline                       Add clean 1px outlines (default: true)
    --denoise                       Remove isolated pixels (default: true)
    --size <N>                      Target sprite size in px (default: 64)
    --split                         Split 2×2 grid into 4 separate sprites
"""

import sys, os, json
from pathlib import Path
from typing import List, Tuple

import numpy as np
from PIL import Image


# ═══════════════════════════════════════════════════════════════
#  RETRO PALETTES
# ═══════════════════════════════════════════════════════════════

PALETTES = {
    "pico8": [
        (0, 0, 0), (29, 43, 83), (126, 37, 83), (0, 135, 81),
        (171, 82, 54), (95, 87, 79), (194, 195, 199), (255, 241, 232),
        (255, 0, 77), (255, 163, 0), (255, 236, 39), (0, 228, 54),
        (41, 173, 255), (131, 118, 156), (255, 119, 168), (255, 204, 170),
    ],
    "nes": [
        (124,124,124),(0,0,252),(0,0,188),(68,40,188),
        (148,0,132),(168,0,32),(168,16,0),(136,20,0),
        (80,48,0),(0,120,0),(0,104,0),(0,88,0),
        (0,64,88),(0,0,0),(188,188,188),(0,120,248),
        (0,88,248),(104,68,252),(216,0,204),(228,0,88),
        (248,56,0),(228,92,16),(172,124,0),(0,184,0),
        (0,168,0),(0,168,68),(0,136,136),(248,248,248),
        (60,188,252),(104,136,252),(152,120,248),(248,120,248),
        (248,88,152),(248,120,88),(252,160,68),(184,248,24),
        (88,216,84),(88,248,152),(0,232,216),(120,120,120),
        (252,252,252),(164,228,252),(184,184,248),(216,184,248),
        (248,184,248),(248,164,192),(248,184,152),(252,224,168),
        (224,248,184),(184,248,184),(184,248,216),(0,0,0),
    ],
    "custom": [  # optimized for 0x72-style pixel art
        (0, 0, 0), (255, 255, 255), (80, 60, 50), (160, 120, 80),
        (220, 180, 130), (60, 50, 40), (140, 100, 60), (200, 160, 110),
        (100, 80, 60), (180, 140, 100), (240, 210, 170), (40, 30, 20),
        (120, 90, 60), (80, 120, 80), (60, 100, 60), (40, 80, 40),
        (100, 140, 100), (120, 160, 120), (60, 80, 120), (80, 100, 140),
        (100, 120, 160), (140, 160, 200), (160, 40, 40), (200, 60, 60),
        (240, 100, 80), (180, 140, 40), (220, 180, 60), (160, 100, 140),
        (60, 60, 60), (120, 120, 120), (180, 180, 180), (100, 60, 40),
    ],
}


# ═══════════════════════════════════════════════════════════════
#  IMAGE LOADING / SAVING HELPERS
# ═══════════════════════════════════════════════════════════════

def load_image(path: str) -> Tuple[np.ndarray, Image.Image]:
    """Load image as RGBA numpy array + PIL Image."""
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    return arr, img


def save_image(arr: np.ndarray, path: str):
    """Save numpy array as PNG."""
    img = Image.fromarray(arr, mode="RGBA")
    img.save(path, "PNG")


def rgb_dist(c1: Tuple[int, ...], c2: Tuple[int, ...]) -> float:
    """Weighted RGB distance — green channel matters more for perception."""
    dr = int(c1[0]) - int(c2[0])
    dg = int(c1[1]) - int(c2[1])
    db = int(c1[2]) - int(c2[2])
    return float(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114)


# ═══════════════════════════════════════════════════════════════
#  STEP 1: SMART CROP — remove whitespace/background
# ═══════════════════════════════════════════════════════════════

def smart_crop(arr: np.ndarray, padding: int = 4) -> np.ndarray:
    """Crop to sprite bounding box, removing uniform background."""
    # Detect background color (most common edge color)
    h, w = arr.shape[:2]
    edge_pixels = []
    for y in [0, h - 1]:
        for x in range(w):
            if arr[y, x, 3] > 128:
                edge_pixels.append(tuple(arr[y, x, :3]))
    for x in [0, w - 1]:
        for y in range(h):
            if arr[y, x, 3] > 128:
                edge_pixels.append(tuple(arr[y, x, :3]))

    if not edge_pixels:
        return arr  # Cannot detect background, return as-is

    # Find most common edge color as background
    from collections import Counter
    bg_color = Counter(edge_pixels).most_common(1)[0][0]

    # Create alpha mask: pixels that differ from background
    fg_mask = np.zeros((h, w), dtype=bool)
    for y in range(h):
        for x in range(w):
            if arr[y, x, 3] < 128:
                continue  # transparent
            dist = rgb_dist(tuple(arr[y, x, :3]), bg_color)
            if dist > 300:  # significantly different from background
                fg_mask[y, x] = True

    # Find bounding box of foreground
    rows = np.any(fg_mask, axis=1)
    cols = np.any(fg_mask, axis=0)

    if not np.any(rows) or not np.any(cols):
        return arr  # No foreground detected

    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]

    # Add padding
    y_min = max(0, y_min - padding)
    y_max = min(h, y_max + padding)
    x_min = max(0, x_min - padding)
    x_max = min(w, x_max + padding)

    return arr[y_min:y_max, x_min:x_max]


# ═══════════════════════════════════════════════════════════════
#  STEP 2: RETRO PALETTE QUANTIZATION
# ═══════════════════════════════════════════════════════════════

def nearest_palette_color(r: int, g: int, b: int, palette: List[Tuple[int, ...]]) -> Tuple[int, int, int]:
    """Find the closest color in palette using weighted RGB distance."""
    best = min(palette, key=lambda c: rgb_dist((r, g, b), c))
    return best


def quantize_to_palette(arr: np.ndarray, palette_name: str = "custom") -> np.ndarray:
    """Map every pixel to nearest color in retro palette."""
    palette = PALETTES.get(palette_name, PALETTES["custom"])
    out = arr.copy()
    # Only quantize opaque/fg pixels
    for y in range(out.shape[0]):
        for x in range(out.shape[1]):
            if out[y, x, 3] < 128:
                continue  # skip transparent
            r, g, b = out[y, x, :3]
            pr, pg, pb = nearest_palette_color(r, g, b, palette)
            out[y, x, :3] = [pr, pg, pb]
    return out


# ═══════════════════════════════════════════════════════════════
#  STEP 3: CLEAN 1PX OUTLINE RECONSTRUCTION
# ═══════════════════════════════════════════════════════════════

def add_outline(arr: np.ndarray, outline_color: Tuple[int, ...] = (0, 0, 0)) -> np.ndarray:
    """
    Detect edges in the sprite and add clean 1px black outlines.
    An edge pixel is one where at least one neighbor
    has a significantly different color.
    """
    h, w = arr.shape[:2]
    out = arr.copy()

    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if out[y, x, 3] < 128:
                continue  # skip transparent/background

            c = tuple(out[y, x, :3])

            # Check 4-directional neighbors
            neighbors = [
                tuple(out[y - 1, x, :3]),
                tuple(out[y + 1, x, :3]),
                tuple(out[y, x - 1, :3]),
                tuple(out[y, x + 1, :3]),
            ]

            # Count neighbors with similar color
            similar = 0
            for nc in neighbors:
                if rgb_dist(c, nc) < 400:  # threshold for "similar"
                    similar += 1

            # If < 3 neighbors are similar (at border of color region), add outline
            if similar < 3:
                out[y, x, :3] = list(outline_color)
                out[y, x, 3] = 255

    return out


# ═══════════════════════════════════════════════════════════════
#  STEP 4: NOISE REMOVAL
# ═══════════════════════════════════════════════════════════════

def remove_noise(arr: np.ndarray, threshold: int = 1) -> np.ndarray:
    """
    Remove isolated pixels — a pixel whose all 8 neighbors
    are a different color. Replace with the most common neighbor color.
    """
    h, w = arr.shape[:2]
    out = arr.copy()

    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if out[y, x, 3] < 128:
                continue

            c = tuple(out[y, x, :3])

            # Collect all 8 neighbors
            neighbor_colors = []
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dy == 0 and dx == 0:
                        continue
                    if out[y + dy, x + dx, 3] >= 128:
                        neighbor_colors.append(tuple(out[y + dy, x + dx, :3]))

            if not neighbor_colors:
                continue

            # How many neighbors share our color?
            same_color = sum(1 for nc in neighbor_colors if nc == c)

            # If threshold or fewer neighbors share our color, replace with majority
            if same_color <= threshold:
                from collections import Counter
                majority = Counter(neighbor_colors).most_common(1)[0][0]
                out[y, x, :3] = list(majority)

    return out


# ═══════════════════════════════════════════════════════════════
#  STEP 5: PIXEL-PERFECT DOWNSCALE
# ═══════════════════════════════════════════════════════════════

def pixel_downscale(arr: np.ndarray, target_size: int) -> np.ndarray:
    """
    Downscale using nearest-neighbor interpolation.
    Ensures output is exactly target_size × target_size.
    Adds padding if sprite is not square.
    """
    h, w = arr.shape[:2]

    # Make square first (center-crop or pad)
    if h != w:
        size = max(h, w)
        square = np.zeros((size, size, 4), dtype=np.uint8)
        if arr.shape[-1] == 4:
            square[:, :, 3] = 0  # transparent
        y_off = (size - h) // 2
        x_off = (size - w) // 2
        square[y_off:y_off + h, x_off:x_off + w] = arr
        arr = square

    # Nearest-neighbor downscale
    img = Image.fromarray(arr, mode="RGBA")
    img_resized = img.resize((target_size, target_size), Image.NEAREST)
    return np.array(img_resized)


# ═══════════════════════════════════════════════════════════════
#  SPLIT 2×2 GRID
# ═══════════════════════════════════════════════════════════════

def split_grid(arr: np.ndarray) -> List[np.ndarray]:
    """Split a 2×2 grid image into 4 individual sprites."""
    h, w = arr.shape[:2]
    half_h, half_w = h // 2, w // 2
    sprites = [
        arr[0:half_h, 0:half_w],
        arr[0:half_h, half_w:w],
        arr[half_h:h, 0:half_w],
        arr[half_h:h, half_w:w],
    ]
    return sprites


# ═══════════════════════════════════════════════════════════════
#  MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════

def process(
    input_path: str,
    output_path: str,
    palette: str = "custom",
    do_outline: bool = True,
    do_denoise: bool = True,
    target_size: int = 64,
    split: bool = False,
) -> dict:
    """
    Run the full post-processing pipeline on a single sprite image.
    Returns stats about what was done.
    """
    arr, _ = load_image(input_path)
    stats = {"input_shape": arr.shape[:2]}

    # Step 0: Split if grid
    if split and arr.shape[0] == arr.shape[1] and arr.shape[0] % 2 == 0:
        sprites = split_grid(arr)
        base_name = Path(output_path).stem
        ext = Path(output_path).suffix
        dir_name = Path(output_path).parent
        results = []
        for i, sprite_arr in enumerate(sprites):
            sprite_path = str(dir_name / f"{base_name}_s{i + 1}{ext}")
            result = _process_single(
                sprite_arr, sprite_path,
                palette, do_outline, do_denoise, target_size
            )
            result["name"] = f"sprite_{i + 1}"
            results.append(result)
        stats["sprites"] = results
        stats["count"] = len(results)
        return stats
    else:
        out_arr = _process_single(arr, output_path, palette, do_outline, do_denoise, target_size)
        stats["output_shape"] = out_arr.shape[:2]
        stats["count"] = 1
        return stats


def _process_single(
    arr: np.ndarray,
    output_path: str,
    palette: str,
    do_outline: bool,
    do_denoise: bool,
    target_size: int,
) -> np.ndarray:
    """Process a single sprite through all steps."""
    # Step 1: Smart crop
    arr = smart_crop(arr, padding=6)
    print(f"  ✓ Cropped to {arr.shape[1]}×{arr.shape[0]}")

    # Step 2: Quantize to retro palette
    arr = quantize_to_palette(arr, palette)
    print(f"  ✓ Quantized to {palette} palette")

    # Step 3: Remove noise
    if do_denoise:
        arr = remove_noise(arr, threshold=1)
        print(f"  ✓ Noise removed")

    # Step 4: Add outlines (after denoise!)
    if do_outline:
        arr = add_outline(arr, (0, 0, 0))
        print(f"  ✓ Outlines added")

    # Step 5: Downscale to target size
    arr = pixel_downscale(arr, target_size)
    print(f"  ✓ Downscaled to {target_size}×{target_size}")

    # Quantize again after downscale to fix interpolation artifacts
    arr = quantize_to_palette(arr, palette)

    # Save
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    save_image(arr, output_path)
    print(f"  ✓ Saved to {output_path}")

    return arr


# ═══════════════════════════════════════════════════════════════
#  CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Pixel Post-Processor")
    parser.add_argument("input", help="Input PNG path")
    parser.add_argument("output", help="Output PNG path")
    parser.add_argument("--palette", default="custom", choices=["nes", "pico8", "custom"])
    parser.add_argument("--no-outline", action="store_true", help="Skip outline reconstruction")
    parser.add_argument("--no-denoise", action="store_true", help="Skip noise removal")
    parser.add_argument("--size", type=int, default=64, help="Target sprite size (px)")
    parser.add_argument("--split", action="store_true", help="Split 2×2 grid into 4 sprites")
    parser.add_argument("--json", action="store_true", help="Output JSON stats")

    args = parser.parse_args()

    print(f"🎨 Pixel Post-Processor")
    print(f"   Input: {args.input}")
    print(f"   Output: {args.output}")
    print(f"   Palette: {args.palette}")
    print(f"   Outline: {'No' if args.no_outline else 'Yes'}")
    print(f"   Denoise: {'No' if args.no_denoise else 'Yes'}")
    print(f"   Size: {args.size}×{args.size}")
    print(f"   Split grid: {'Yes' if args.split else 'No'}")
    print()

    result = process(
        input_path=args.input,
        output_path=args.output,
        palette=args.palette,
        do_outline=not args.no_outline,
        do_denoise=not args.no_denoise,
        target_size=args.size,
        split=args.split,
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n✅ Done! Produced {result['count']} sprite(s).")
