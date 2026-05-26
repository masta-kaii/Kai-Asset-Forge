"""
forge-haunted.py — Generates the Haunted Dungeon Denizens Pack
Swaps the palette in aseprite-forge.py to spooky/ghostly colors,
generates all characters and assets, then restores the original.
"""

import sys
import os
import shutil
from pathlib import Path

FORGE_SCRIPT = Path(r"C:\Users\khair\Kai-Asset-Forge\aseprite-forge.py")
OUTPUT_BASE = Path(r"C:\Users\khair\Kai-Asset-Forge\forge-output")
PACK_NAME = "haunted-dungeon-denizens"
PACK_DIR = OUTPUT_BASE / PACK_NAME

# ── Haunted / Spooky Palette ──
# Same indices, ghostly colors for dungeon denizens
HAUNTED_PALETTE = """PALETTE = [
    (0,0,0),          # 0  — outline (black, keep)
    (8,10,30),        # 1  — midnight blue
    (45,8,35),        # 2  — shadow purple
    (3,30,15),        # 3  — murky green
    (55,20,8),        # 4  — withered brown
    (30,20,18),       # 5  — crypt shadow
    (90,70,60),       # 6  — tomb leather
    (160,180,200),    # 7  — ghostly pale
    (130,8,8),        # 8  — blood red
    (190,70,25),      # 9  — hellfire orange
    (190,165,15),     # 10 — sickly yellow
    (15,85,35),       # 11 — poison green
    (25,70,150),      # 12 — spectral blue
    (80,50,100),      # 13 — dark magic purple
    (150,50,90),      # 14 — necrotic pink
    (160,140,125),    # 15 — undead flesh
    (25,20,30),       # 16 — crypt stone
    (60,50,48),       # 17 — tomb gray
    (110,100,90),     # 18 — bone
    (20,12,8),        # 19 — ancient rotted wood
    (150,130,25),     # 20 — haunted gold
    (35,115,45),      # 21 — swamp green
    (42,15,0),        # 22 — rotted wood
    (120,85,55),      # 23 — aged wood
    (15,10,18),       # 24 — void shadow
]"""

# Original dungeon palette (for restoration)
ORIGINAL_PALETTE = """PALETTE = [
    (0,0,0),          # 0  — outline/black
    (29,43,83),       # 1  — dark blue
    (126,37,83),      # 2  — dark purple
    (0,135,81),       # 3  — dark green
    (120,70,30),      # 4  — brown
    (70,60,50),       # 5  — dark earthy brown
    (150,130,110),    # 6  — light brown / leather
    (240,230,220),    # 7  — off-white / skin light
    (180,50,50),      # 8  — dark red
    (220,140,50),     # 9  — orange / gold
    (240,220,50),     # 10 — yellow
    (50,180,50),      # 11 — green
    (60,150,200),     # 12 — blue
    (130,110,150),    # 13 — purple
    (220,120,160),    # 14 — pink
    (240,200,160),    # 15 — peach / skin
    (50,50,60),       # 16 — dark stone
    (100,90,80),      # 17 — stone gray
    (170,160,150),    # 18 — light stone
    (40,30,20),       # 19 — very dark brown
    (200,180,50),     # 20 — gold highlight
    (100,180,80),     # 21 — grass green
    (80,40,0),        # 22 — dark wood
    (180,140,100),    # 23 — wood
    (30,30,30),       # 24 — dark shadow
]"""


def apply_palette(palette_text: str):
    """Replace PALETTE = [...] in aseprite-forge.py."""
    content = FORGE_SCRIPT.read_text(encoding="utf-8")
    # Find the PALETTE = [...  ...] block
    start = content.find("PALETTE = [")
    # Find the closing ] that ends the palette
    # Look for ']' after some newlines
    end = content.find("\n]", start)
    if end == -1:
        print("✗ Could not find PALETTE ending bracket!")
        return False
    end += 2  # include the \n]
    
    new_content = content[:start] + palette_text + content[end:]
    FORGE_SCRIPT.write_text(new_content, encoding="utf-8")
    print(f"✓ Palette swapped ({'HAUNTED' if 'ghostly pale' in palette_text else 'ORIGINAL'})")
    return True


def run_ascli(cmd_parts, label):
    """Run a command in the forge directory."""
    import subprocess
    cmd = ["python", str(FORGE_SCRIPT)]
    cmd.extend(cmd_parts)
    print(f"\n{'═' * 55}")
    print(f"  {label}")
    print(f"{'═' * 55}")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=300,
        cwd=str(FORGE_SCRIPT.parent)
    )
    if result.stdout:
        # Print last 20 lines
        lines = result.stdout.strip().split("\n")
        for line in lines[-20:]:
            print(f"  {line}")
    if result.stderr:
        err_lines = result.stderr.strip().split("\n")
        for line in err_lines[-10:]:
            print(f"  ⚠ {line}")
    print(f"  → exit code: {result.returncode}")
    return result.returncode == 0


def copy_output_to_pack():
    """Copy generated output to themed directory."""
    aseprite_dir = OUTPUT_BASE / "aseprite"
    if not aseprite_dir.exists():
        print(f"✗ No aseprite output found at {aseprite_dir}")
        return
    
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    
    # Copy character PNGs (root level)
    chars_copied = 0
    for f in sorted(aseprite_dir.glob("*.png")):
        if f.is_file() and f.stat().st_size > 0:
            shutil.copy2(f, PACK_DIR / f.name)
            chars_copied += 1
    print(f"✓ Copied {chars_copied} character PNGs to pack")
    
    # Copy subdirectories (tiles, furniture, props, etc.)
    for subdir in ["tiles", "furniture", "props", "weapons", "ui", "creative"]:
        src = aseprite_dir / subdir
        if src.exists():
            dst = PACK_DIR / subdir
            dst.mkdir(exist_ok=True)
            items = 0
            for f in src.glob("*.png"):
                shutil.copy2(f, dst / f.name)
                items += 1
            print(f"✓ Copied {items} items from {subdir}/")
    
    print(f"✓ All assets copied to {PACK_DIR}")
    return True


def write_metadata():
    """Write pack metadata JSON."""
    import json
    metadata = {
        "pack_name": "Haunted Dungeon Denizens",
        "theme": "Haunted / Spooky / Ghostly",
        "description": "Complete dungeon denizens pack with haunted spectral palette. Perfect for spooky game jams, horror RPGs, and Pixel Forge Jam ($4,500+ prizes).",
        "palette": "Haunted Spectral (25 colors)",
        "generated": True,
        "characters_generated": 16,
        "categories": ["characters", "tiles", "furniture", "props", "weapons", "ui", "creative"]
    }
    meta_path = PACK_DIR / "haunted_dungeon_denizens_metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"✓ Metadata written to {meta_path}")


def main():
    print(f"\n{'╔' * 55}")
    print(f"  HAUNTED DUNGEON DENIZENS FORGE")
    print(f"{'╗' * 55}\n")
    print(f"  Swapping palette to haunt the forge...")
    
    # 1. Apply haunted palette
    if not apply_palette(HAUNTED_PALETTE):
        return 1
    
    # 2. Generate ALL characters with haunted palette
    try:
        run_ascli(["--all"], "Forging 16 haunted characters...")
    except Exception as e:
        print(f"✗ Character generation failed: {e}")
    
    # 3. Generate tiles
    try:
        run_ascli(["--tiles"], "Forging haunted dungeon tiles...")
    except Exception as e:
        print(f"✗ Tile generation failed: {e}")
    
    # 4. Generate all assets
    try:
        run_ascli(["--all-assets"], "Forging haunted assets (furniture, props, weapons, UI)...")
    except Exception as e:
        print(f"✗ Asset generation failed: {e}")
    
    # 5. Generate creative pieces
    try:
        run_ascli(["--creative"], "Forging haunted creative pixel art...")
    except Exception as e:
        print(f"✗ Creative generation failed: {e}")
    
    # 6. Copy output to pack directory
    print(f"\n{'═' * 55}")
    print("  Packaging the Haunted Denizens Pack...")
    print(f"{'═' * 55}")
    copy_output_to_pack()
    write_metadata()
    
    # 7. Restore original palette
    if not apply_palette(ORIGINAL_PALETTE):
        print("⚠ Could not restore original palette! Check aseprite-forge.py manually.")
        return 1
    
    print(f"\n{'╚' * 55}")
    print(f"  HAUNTED DUNGEON DENIZENS — FORGED!")
    print(f"{'╝' * 55}")
    print(f"\n  Output: {PACK_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
