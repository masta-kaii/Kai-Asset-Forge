#!/usr/bin/env python3
"""Insert UI, weapon, and prop asset lists into aseprite-forge.py"""

path = 'C:/Users/khair/Kai-Asset-Forge/aseprite-forge.py'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Read the 3 asset blobs from the script file below
# They're stored as comments in this file

marker = 'FURNITURE = [\n'

# Actually, let's insert AFTER the FURNITURE list ends
# Find the end of FURNITURE list (line with just ']')
lines = content.split('\n')
furniture_end = None
in_furniture = False
for i, line in enumerate(lines):
    if line.strip() == 'FURNITURE = [':
        in_furniture = True
    if in_furniture and line.strip() == ']':
        # Check it's the FURNITURE closing
        if i + 1 < len(lines) and 'def generate_tiles' in lines[i+1]:
            furniture_end = i
            break

if furniture_end is None:
    # Try looser match
    for i, line in enumerate(lines):
        if line.strip() == 'FURNITURE = [':
            in_furniture = True
        if in_furniture and line.strip() == ']':
            furniture_end = i
            break

print(f"FURNITURE ends at line {furniture_end + 1}: {lines[furniture_end].strip()}")
print(f"Next line: {lines[furniture_end + 1].strip() if furniture_end + 1 < len(lines) else 'EOF'}")

# Insert new asset lists after FURNITURE closing bracket
# We'll replace ']\n\ndef generate_tiles' with ']\n\n<assets>\n\ndef generate_tiles'
old = lines[furniture_end] + '\n\n' + lines[furniture_end + 1] if furniture_end + 1 < len(lines) and 'def generate_tiles' in lines[furniture_end + 1] else None

if old is None:
    old = ']\n\ndef generate_tiles(output_dir: Path):'

# Read asset blobs from separate file
with open('C:/Users/khair/Kai-Asset-Forge/scripts/asset_blobs.py', 'r', encoding='utf-8') as f:
    assets_blob = f.read()

new = ']\n\n' + assets_blob + '\ndef generate_tiles(output_dir: Path):'

content = content.replace(old, new, 1)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Done! New size: {len(content)} chars')
