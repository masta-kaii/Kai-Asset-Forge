#!/usr/bin/env python3
"""Generate spritesheets + index for the Haunted Dungeon Denizens pack."""
import os
from PIL import Image
from pathlib import Path

BASE = Path(r"C:\Users\khair\Kai-Asset-Forge\forge-output\haunted_denizens")
SPRITE_SIZE = 32

creatures = sorted([d.name for d in BASE.iterdir() if d.is_dir()])

# Generate index
index_lines = [
    "# Haunted Dungeon Denizens — Sprite Pack Index",
    f"# Generated: {os.path.basename(BASE)}",
    f"# {len(creatures)} creatures, 33 frames total",
    f"# Style: 0x72 Dungeon Tileset II (32×32)",
    f"# Palette: Haunted (purples, teal, ghostly whites)",
    "",
]

total_w = 0
for creature in creatures:
    creature_dir = BASE / creature
    frames = sorted([f for f in creature_dir.iterdir() if f.suffix == '.png'])
    
    # Create spritesheet (horizontal strip)
    if frames:
        sheet_w = len(frames) * SPRITE_SIZE
        sheet = Image.new("RGBA", (sheet_w, SPRITE_SIZE), (0, 0, 0, 0))
        for i, frame_path in enumerate(frames):
            frame_img = Image.open(frame_path).convert("RGBA")
            sheet.paste(frame_img, (i * SPRITE_SIZE, 0))
        
        sheet_path = BASE / f"{creature}_spritesheet.png"
        sheet.save(sheet_path)
        
        frame_names = [f.stem for f in frames]
        index_lines.append(f"\n## {creature}")
        index_lines.append(f"- Frames: {len(frames)}")
        index_lines.append(f"- Spritesheet: {creature}_spritesheet.png")
        for fn in frame_names:
            index_lines.append(f"  - {fn}.png")
        
        total_w += sheet_w

# Create a master spritesheet (all creatures stacked vertically)
all_sheets = []
for creature in creatures:
    sheet_path = BASE / f"{creature}_spritesheet.png"
    if sheet_path.exists():
        all_sheets.append(Image.open(sheet_path))

if all_sheets:
    max_w = max(s.width for s in all_sheets)
    total_h = sum(s.height for s in all_sheets)
    master = Image.new("RGBA", (max_w, total_h), (0, 0, 0, 0))
    y = 0
    for sheet in all_sheets:
        master.paste(sheet, (0, y))
        y += sheet.height
    master.save(BASE / "MASTER_SPRITESHEET.png")
    index_lines.append(f"\n---")
    index_lines.append(f"Master spritesheet: MASTER_SPRITESHEET.png ({max_w}×{total_h})")

# Write index
index_path = BASE / "PACK_INDEX.md"
with open(index_path, "w") as f:
    f.write("\n".join(index_lines) + "\n")

print(f"✅ Spritesheets created for {len(creatures)} creatures")
print(f"📁 Index: {index_path}")
print(f"📁 Master: {BASE / 'MASTER_SPRITESHEET.png' if all_sheets else 'N/A'}")
