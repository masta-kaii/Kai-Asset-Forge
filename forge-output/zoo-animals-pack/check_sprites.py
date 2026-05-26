from PIL import Image
import os

base = r'C:\Users\khair\Kai-Asset-Forge\forge-output\zoo-animals-pack'
d = os.listdir(base)
imgs = []
for entry in sorted(d):
    p = os.path.join(base, entry)
    fp = os.path.join(p, f'{entry}_32px.png') if os.path.isdir(p) else None
    if fp and os.path.exists(fp):
        img = Image.open(fp)
        imgs.append((entry, img.size, img.mode))

for name, sz, mode in imgs:
    print(f'{name}: {sz} {mode}')
print(f'Total: {len(imgs)}')
