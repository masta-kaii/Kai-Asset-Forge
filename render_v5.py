import importlib.util, subprocess
from pathlib import Path

spec = importlib.util.spec_from_file_location('forge', 'aseprite-forge.py')
forge = importlib.util.module_from_spec(spec); spec.loader.exec_module(forge)

spec5 = importlib.util.spec_from_file_location('v5', 'forge-output/aseprite/k_custom_grids/klawf_v5.py')
v5 = importlib.util.module_from_spec(spec5); spec5.loader.exec_module(v5)

name = 'klawf_front_0'
w,h,grid = v5.KLAWF_V5[name]
out_dir = Path('forge-output/aseprite/k_custom')
out_dir.mkdir(parents=True, exist_ok=True)
out_file = str(out_dir / f'{name}.png').replace('\\', '/')

palette = forge.PALETTE
lines = [f'local sprite = Sprite({w}, {h}, ColorMode.INDEXED)']
lines.append('local pal = sprite.palettes[1]')
for i,(r,g,b) in enumerate(palette):
    lines.append(f'pal:setColor({i}, Color{{ r={r}, g={g}, b={b} }})')
lines.append('local cel = app.activeCel; local img = cel.image')
lines.append(f'function ps(x,y,c) if x>=0 and x<{w} and y>=0 and y<{h} then img:drawPixel(x,y,c) end end')
for y,row in enumerate(grid):
    for x,idx in enumerate(row):
        if idx >= 0:
            lines.append(f'ps({x},{y},{idx})')

lines.append(f'sprite:saveAs("{out_file}"); print("OK"); app.exit()')

script_path = forge.SCRIPTS_DIR / '_v5_no_outline.lua'
script_path.write_text('\n'.join(lines))
r = subprocess.run([str(forge.ASEPRITE), '--batch', '--script', str(script_path)], capture_output=True, text=True, timeout=15)
script_path.unlink(missing_ok=True)

png = out_dir / f'{name}.png'
if png.exists():
    print(f'OK: {png} ({png.stat().st_size} bytes)')
else:
    print(f'FAIL: {r.stderr[:200]}')
