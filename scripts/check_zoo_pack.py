import json
from pathlib import Path

meta_path = Path(r"C:\Users\khair\Kai-Asset-Forge\forge-output\zoo-animals-pack\zoo_animals_pack_metadata.json")
d = json.loads(meta_path.read_text())

print(f"Total sprites: {d['total_sprites']}")
print(f"Spritesheet: {d['spritesheet']}")
print()

cs = [v['colors'] for v in d['items'].values()]
print(f"Color range: {min(cs)}-{max(cs)}, avg {sum(cs)/len(cs):.1f}")
print()

print("Sprite color counts:")
for name, info in sorted(d['items'].items()):
    print(f"  {name:22s} {info['colors']:2d}c  {info['bytes']:4d}B")
