"""Generate pixel art agent sprites (32x32, 3 idle frames each) for Kai-Asset-Forge"""
from PIL import Image
import os

SPRITE_DIR = r"C:\Users\khair\Kai-Asset-Forge\public\sprites\agents"
SIZE = 32
FRAMES = 3

# Agent colors (body, details, accent, outline)
AGENTS = {
    "popo": {
        "name": "Popo", "role": "CEO",
        "body": (255, 215, 0),    # Gold
        "skin": (255, 220, 180),   # Warm skin
        "accent": (180, 50, 50),   # Red accents
        "hair": (80, 60, 40),      # Brown hair
        "outline": (40, 30, 20),   # Dark outline
        "bg": (200, 180, 120),     # Light gold bg
    },
    "scout": {
        "name": "Scout", "role": "Scout",
        "body": (34, 139, 34),     # Forest green
        "skin": (255, 220, 180),
        "accent": (160, 120, 60),  # Leather brown
        "hair": (180, 140, 60),    # Blonde
        "outline": (20, 60, 20),
        "bg": (180, 220, 180),
    },
    "forge": {
        "name": "Forge", "role": "Forge",
        "body": (200, 80, 40),     # Ember orange
        "skin": (220, 180, 140),
        "accent": (100, 100, 100), # Iron grey
        "hair": (120, 60, 20),     # Rusty beard
        "outline": (60, 30, 10),
        "bg": (220, 200, 160),
    },
    "curator": {
        "name": "Curator", "role": "Curator",
        "body": (65, 105, 225),    # Royal blue
        "skin": (255, 220, 180),
        "accent": (192, 192, 192), # Silver
        "hair": (100, 80, 60),
        "outline": (20, 40, 80),
        "bg": (180, 200, 240),
    },
    "packager": {
        "name": "Packager", "role": "Packager",
        "body": (128, 0, 128),     # Purple
        "skin": (180, 220, 160),   # Greenish skin (goblin)
        "accent": (50, 200, 50),   # Acid green
        "hair": (60, 30, 10),
        "outline": (40, 0, 40),
        "bg": (220, 180, 220),
    },
    "lister": {
        "name": "Lister", "role": "Lister",
        "body": (0, 150, 150),     # Teal
        "skin": (255, 220, 180),
        "accent": (255, 215, 0),   # Gold trim
        "hair": (160, 100, 40),
        "outline": (0, 50, 50),
        "bg": (180, 230, 230),
    },
}

def draw_pixel_sprite(c, frame=0):
    """Draw a 32x32 pixel art character"""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pixels = img.load()

    body_y_offset = frame  # Slight bob animation

    def setp(x, y, color):
        if 0 <= x < SIZE and 0 <= y < SIZE:
            pixels[x, y] = color + (255,) if len(color) == 3 else color

    # === BODY (tunic/shirt) ===
    for x in range(10, 22):
        for y in range(13, 24):
            setp(x, y + body_y_offset, c["body"])

    # === HEAD ===
    for x in range(9, 23):
        for y in range(2, 12):
            setp(x, y + body_y_offset, c["skin"])

    # === HAIR ===
    if frame == 0 or frame == 2:
        for x in range(8, 24):
            for y in range(0, 8):
                setp(x, y + body_y_offset, c["hair"])
        # Top of head hair
        for x in range(10, 22):
            for y in range(0, 5):
                setp(x, y + body_y_offset, c["hair"])

    # === EYES (blink animation on frame 1) ===
    if frame == 1:  # Closed eyes (blink)
        setp(12, 8 + body_y_offset, c["outline"])
        setp(19, 8 + body_y_offset, c["outline"])
    else:
        setp(12, 8 + body_y_offset, (255, 255, 255))
        setp(13, 8 + body_y_offset, (0, 0, 0))
        setp(19, 8 + body_y_offset, (255, 255, 255))
        setp(20, 8 + body_y_offset, (0, 0, 0))

    # === LEGS ===
    leg_color = tuple(max(0, c["body"][i] - 40) for i in range(3))
    for x in range(11, 16):
        for y in range(24, 30):
            setp(x, y + body_y_offset, leg_color)
    for x in range(17, 22):
        for y in range(24, 30):
            setp(x, y + body_y_offset, leg_color)

    # === FEET / BOOTS ===
    boot = c["outline"]
    for x in range(10, 16):
        for y in range(28, 31):
            setp(x, y + body_y_offset, boot)
    for x in range(17, 23):
        for y in range(28, 31):
            setp(x, y + body_y_offset, boot)

    # === ROLE-SPECIFIC DETAILS ===
    role = c["role"]

    # === CROWN (Popo/CEO) ===
    if role == "CEO":
        gold = (255, 215, 0)
        for x in range(11, 21):
            setp(x, -2 + body_y_offset, gold)
        for x in range(12, 20):
            setp(x, -3 + body_y_offset, gold)
        setp(13, -4 + body_y_offset, gold)
        setp(19, -4 + body_y_offset, gold)
        setp(15, -1 + body_y_offset, (255, 50, 50))  # Ruby
        setp(16, -1 + body_y_offset, (255, 50, 50))

    # === HOOD (Scout) ===
    if role == "Scout":
        for x in range(7, 25):
            for y in range(0, 6):
                if img.getpixel((x, y + body_y_offset))[3] > 0:
                    setp(x, y + body_y_offset, (20, 80, 20))
        for x in range(11, 21):
            setp(x, 6 + body_y_offset, (20, 80, 20))

    # === BEARD (Forge/Dwarf) ===
    if role == "Forge":
        beard = (160, 80, 30)
        for x in range(11, 21):
            for y in range(10, 16):
                if img.getpixel((x, y + body_y_offset))[3] > 0:
                    setp(x, y + body_y_offset, beard)
        for x in range(13, 19):
            for y in range(14, 19):
                setp(x, y + body_y_offset, beard)

    # === HELMET (Curator/Knight) ===
    if role == "Curator":
        for x in range(8, 24):
            for y in range(-1, 5):
                setp(x, y + body_y_offset, (180, 180, 190))
        for x in range(8, 24):
            setp(x, 5 + body_y_offset, (60, 60, 80))
        # Visor slit
        for x in range(12, 20):
            setp(x, 7 + body_y_offset, (40, 40, 60))

    # === GOGGLES (Packager/Goblin) ===
    if role == "Packager":
        for x in range(9, 15):
            for y in range(6, 10):
                setp(x, y + body_y_offset, (100, 200, 100))
        for x in range(18, 24):
            for y in range(6, 10):
                setp(x, y + body_y_offset, (100, 200, 100))
        for x in range(12, 20):
            for y in range(7, 9):
                setp(x, y + body_y_offset, (180, 100, 50))

    # === MERCHANT HAT (Lister) ===
    if role == "Lister":
        hat = (0, 120, 120)
        for x in range(9, 23):
            for y in range(-2, 6):
                setp(x, y + body_y_offset, hat)
        for x in range(7, 25):
            setp(x, 3 + body_y_offset, hat)
        # Feather
        setp(22, -3 + body_y_offset, (255, 50, 50))
        setp(23, -4 + body_y_offset, (255, 100, 50))
        setp(23, -5 + body_y_offset, (200, 80, 30))

    # === OUTLINE ===
    outline = c["outline"]
    for y in range(SIZE):
        for x in range(SIZE):
            if pixels[x, y][3] > 0:
                # Check if adjacent pixel is empty
                for dx, dy in [(-1,0),(1,0),(0,-1),(0,1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < SIZE and 0 <= ny < SIZE:
                        if pixels[nx, ny][3] == 0:
                            setp(x, y, outline)
                            break

    return img

# Generate all sprites
for agent_id, config in AGENTS.items():
    print(f"Generating {config['name']} ({config['role']})...")
    for frame in range(FRAMES):
        img = draw_pixel_sprite(config, frame)
        path = os.path.join(SPRITE_DIR, agent_id, f"idle_f{frame}.png")
        img.save(path)
        print(f"  → Saved {path} ({os.path.getsize(path)} bytes)")

print("\n✅ All agent sprites generated!")
