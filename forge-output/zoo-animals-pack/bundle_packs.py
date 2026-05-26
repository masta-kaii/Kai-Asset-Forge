"""
Pixel Zoo & Safari Pack — Full Bundling Script
Organizes 30 approved sprites into 3 themed sub-packs + 1 mega bundle
"""
from PIL import Image
import json, os, math

BASE = r'C:\Users\khair\Kai-Asset-Forge\forge-output\zoo-animals-pack'
OUT = BASE  # output in same directory
SPRITE_SIZE = 32

# ── All sprites with metadata from Curator ──
ALL_SPRITES = {
    # Animals (15)
    "bear": {"category": "Animal", "desc": "Large brown bear with round ears", "score": 7.0, "colors": 3},
    "crocodile": {"category": "Animal", "desc": "Green reptile with long snout", "score": 7.0, "colors": 4},
    "elephant": {"category": "Animal", "desc": "Gray giant with trunk and tusks", "score": 7.0, "colors": 5},
    "flamingo": {"category": "Animal", "desc": "Pink wading bird on one leg", "score": 7.0, "colors": 3},
    "giraffe": {"category": "Animal", "desc": "Tall spotted mammal with long neck", "score": 7.0, "colors": 3},
    "hippo": {"category": "Animal", "desc": "Massive gray river horse", "score": 7.0, "colors": 3},
    "lion": {"category": "Animal", "desc": "King of the jungle with golden mane", "score": 7.5, "colors": 4},
    "monkey": {"category": "Animal", "desc": "Playful brown primate with long tail", "score": 7.5, "colors": 4},
    "peacock": {"category": "Animal", "desc": "Blue bird with elaborate tail display", "score": 6.5, "colors": 7},
    "penguin": {"category": "Animal", "desc": "Black and white Antarctic bird", "score": 7.5, "colors": 4},
    "rhino": {"category": "Animal", "desc": "Armored gray mammal with horn", "score": 7.0, "colors": 3},
    "snake": {"category": "Animal", "desc": "Green coiled serpent with forked tongue", "score": 6.5, "colors": 5},
    "tiger": {"category": "Animal", "desc": "Striped orange predator", "score": 7.5, "colors": 4},
    "tropical_bird": {"category": "Animal", "desc": "Colorful exotic bird", "score": 6.0, "colors": 5},
    "zebra": {"category": "Animal", "desc": "Black and white striped equine", "score": 7.0, "colors": 3},
    # Environment (6)
    "entrance_gate": {"category": "Environment", "desc": "Zoo entrance archway", "score": 6.5, "colors": 3},
    "water_pool": {"category": "Environment", "desc": "Blue water pool ★ Distinction", "score": 8.0, "colors": 4},
    "zoo_fence": {"category": "Environment", "desc": "Wooden fence enclosure", "score": 7.0, "colors": 4},
    "zoo_rocks": {"category": "Environment", "desc": "Rock formation for habitats", "score": 6.5, "colors": 3},
    "zoo_sign": {"category": "Environment", "desc": "Directional zoo sign", "score": 6.5, "colors": 3},
    "zoo_tree": {"category": "Environment", "desc": "Large canopy tree", "score": 7.0, "colors": 3},
    # Tiles (3)
    "tile_dirt": {"category": "Tile", "desc": "Dirt ground tile", "score": 7.0, "colors": 2},
    "tile_grass": {"category": "Tile", "desc": "Grassy ground tile", "score": 7.0, "colors": 2},
    "tile_trail": {"category": "Tile", "desc": "Dirt trail tile", "score": 7.0, "colors": 2},
    # Safari Gear (5)
    "binoculars": {"category": "Safari Gear", "desc": "Viewing binoculars", "score": 6.0, "colors": 2},
    "compass": {"category": "Safari Gear", "desc": "Navigational compass", "score": 7.0, "colors": 4},
    "safari_jeep": {"category": "Safari Gear", "desc": "Green safari tour vehicle", "score": 7.0, "colors": 4},
    "safari_tent": {"category": "Safari Gear", "desc": "Canvas camping tent", "score": 6.5, "colors": 4},
    "zoo_map": {"category": "Safari Gear", "desc": "Zoo map with trails", "score": 6.5, "colors": 3},
    # Other (1)
    "feeding_area": {"category": "Environment", "desc": "Animal feeding station", "score": 6.0, "colors": 5},
}

# ── Pack definitions ──
PACKS = {
    "zoo_animals_pack": {
        "name": "Zoo Animals Pack",
        "desc": "15 pixel art zoo animals for your wildlife game — lions, tigers, bears, and more!",
        "sprites": [
            "bear", "crocodile", "elephant", "flamingo", "giraffe",
            "hippo", "lion", "monkey", "peacock", "penguin",
            "rhino", "snake", "tiger", "tropical_bird", "zebra"
        ],
        "tags": ["animals", "zoo", "wildlife", "safari", "characters", "pixel-art"],
        "variants": {"small": 5, "medium": 10, "large": 15}
    },
    "zoo_habitats_tiles": {
        "name": "Zoo Habitats & Tiles Pack",
        "desc": "10 environment props and terrain tiles for building zoo habitats and enclosures.",
        "sprites": [
            "entrance_gate", "water_pool", "zoo_fence", "zoo_rocks", "zoo_sign",
            "zoo_tree", "feeding_area", "tile_dirt", "tile_grass", "tile_trail"
        ],
        "tags": ["environment", "tiles", "terrain", "zoo", "props", "habitats"],
        "variants": {"small": 3, "medium": 6, "large": 10}
    },
    "safari_gear_pack": {
        "name": "Safari Expedition Gear Pack",
        "desc": "5 safari-themed props and equipment — jeep, tent, compass, binoculars, and zoo map.",
        "sprites": [
            "binoculars", "compass", "safari_jeep", "safari_tent", "zoo_map"
        ],
        "tags": ["props", "safari", "gear", "equipment", "vehicles", "expedition"],
        "variants": {"small": 2, "medium": 3, "large": 5}
    },
    "pixel_zoo_mega_bundle": {
        "name": "Pixel Zoo & Safari Complete Pack",
        "desc": "ALL 30 sprites from the Pixel Zoo & Safari collection! Animals, habitats, tiles, and safari gear in one huge bundle — save big!",
        "sprites": list(ALL_SPRITES.keys()),
        "tags": ["mega-bundle", "zoo", "safari", "animals", "tiles", "props", "environment", "complete-set"],
        "variants": {"small": 10, "medium": 20, "large": 30}
    }
}

def load_sprite(name):
    """Load a sprite PNG by asset name."""
    path = os.path.join(BASE, name, f"{name}_32px.png")
    if os.path.exists(path):
        return Image.open(path).convert("RGBA")
    return None

def make_sprite_sheet(sprites, filename):
    """Create a horizontal sprite sheet."""
    imgs = [load_sprite(s) for s in sprites]
    imgs = [img for img in imgs if img is not None]
    n = len(imgs)
    if n == 0:
        return None
    w = n * SPRITE_SIZE
    sheet = Image.new("RGBA", (w, SPRITE_SIZE), (0, 0, 0, 0))
    for i, img in enumerate(imgs):
        sheet.paste(img, (i * SPRITE_SIZE, 0))
    path = os.path.join(OUT, filename)
    sheet.save(path)
    return sheet, path

def make_preview(sprites, filename):
    """Create a preview composite — tiles sprites in a grid with a dark background."""
    imgs = [load_sprite(s) for s in sprites]
    imgs = [img for img in imgs if img is not None]
    n = len(imgs)

    # Determine grid layout
    cols = min(8, n)
    rows = math.ceil(n / cols)

    # Add 2px padding per cell
    cell_w = SPRITE_SIZE + 4
    cell_h = SPRITE_SIZE + 4
    pad = 8

    w = cols * cell_w + pad * 2
    h = rows * cell_h + pad * 2

    preview = Image.new("RGBA", (w, h), (40, 35, 30, 255))

    for i, img in enumerate(imgs):
        row = i // cols
        col = i % cols
        x = pad + col * cell_w + 2
        y = pad + row * cell_h + 2
        preview.paste(img, (x, y), img)

    path = os.path.join(OUT, filename)
    preview.save(path)
    return preview, path

def make_pack_json(pack_key, pack_def):
    """Generate complete metadata JSON for a pack."""
    sprites = pack_def["sprites"]
    sprite_list = []
    for s in sprites:
        meta = ALL_SPRITES.get(s, {})
        fp = os.path.join(BASE, s, f"{s}_32px.png")
        try:
            filesize = os.path.getsize(fp)
        except:
            filesize = 0
        sprite_list.append({
            "name": s,
            "description": meta.get("desc", ""),
            "category": meta.get("category", ""),
            "score": meta.get("score", 0),
            "colors": meta.get("colors", 0),
            "size": "32x32",
            "format": "PNG (RGBA)"
        })

    scores = [ALL_SPRITES[s].get("score", 0) for s in sprites]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    pack = {
        "pack_name": pack_def["name"],
        "pack_key": pack_key,
        "description": pack_def["desc"],
        "total_sprites": len(sprites),
        "sprite_size": "32x32",
        "standard": "0x72 Dungeon Tileset (adapted for theme pack)",
        "curator_verdict": "ALL APPROVED",
        "average_score": avg_score,
        "tags": pack_def["tags"],
        "categories": list(set(ALL_SPRITES[s]["category"] for s in sprites)),
        "pricing_variants": {},
        "sprites": sprite_list
    }

    # Generate pricing variants
    for var_name, var_count in pack_def["variants"].items():
        selected = sprites[:var_count] if var_count < len(sprites) else sprites
        pack["pricing_variants"][var_name] = {
            "sprite_count": min(var_count, len(sprites)),
            "description": f"Best for {var_name} projects",
            "sprites_included": selected
        }

    return pack

# ══════════════════════════════════════
#  MAIN EXECUTION
# ══════════════════════════════════════
print("=" * 60)
print(" PIXEL ZOO & SAFARI PACK — BUNDLING ENGINE")
print("=" * 60)

for pack_key, pack_def in PACKS.items():
    sprites = pack_def["sprites"]
    n = len(sprites)
    print(f"\n📦 Building: {pack_def['name']} ({n} sprites)")

    # 1. Sprite sheet
    ss_name = f"{pack_key}_spritesheet.png"
    result = make_sprite_sheet(sprites, ss_name)
    if result:
        _, ss_path = result
        print(f"   ✅ Sprite sheet: {ss_name}")

    # 2. Preview
    prev_name = f"{pack_key}_preview.png"
    result = make_preview(sprites, prev_name)
    if result:
        print(f"   ✅ Preview: {prev_name}")

    # 3. Metadata JSON
    meta = make_pack_json(pack_key, pack_def)
    meta_path = os.path.join(OUT, f"{pack_key}_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    print(f"   ✅ Metadata: {os.path.basename(meta_path)}")

print("\n" + "=" * 60)
print(" ALL PACKS BUNDLED! Spirits HIGH!")
print("=" * 60)
