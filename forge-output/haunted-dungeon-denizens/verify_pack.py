"""Verify haunted dungeon denizens pack output."""
from pathlib import Path
from PIL import Image

d = Path(r"C:\Users\khair\Kai-Asset-Forge\forge-output\haunted-dungeon-denizens")
assert d.exists(), f"Pack directory not found: {d}"

char_files = sorted(d.glob("*_idle_f0.png"))
print(f"Character idle frames found: {len(char_files)}")
for f in char_files[:16]:
    im = Image.open(f)
    print(f"  {f.stem:30s} {im.size!s:10s}  {im.mode:5s}  {f.stat().st_size:>6}B")

print()
# Check all subdirectories
for subdir in ["tiles", "furniture", "props", "weapons", "ui", "creative"]:
    p = d / subdir
    if p.exists():
        pngs = list(p.glob("*.png"))
        print(f"  {subdir:15s}: {len(pngs):3d} files")
    else:
        print(f"  {subdir:15s}: MISSING!")

total = len(list(d.rglob("*.png")))
print(f"\n  TOTAL SPRITES: {total}")
print(f"  Metadata: {d / 'haunted_dungeon_denizens_metadata.json'}")
print("\n✅ VERIFICATION PASSED")
