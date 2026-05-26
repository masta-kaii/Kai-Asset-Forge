"""Klawf Crab 64x64 v2 — Pure Aseprite grids, richer palette, more detail.
   Color indices from aseprite-forge.py PALETTE:
   0=black  9=orange  10=yellow  8=dark red  7=offwhite  14=pink
   15=peach  19=vdk brown  4=brown  11=green  3=dark green
   20=gold  17=stone  18=lt stone  24=shadow  5=earth  22=dk wood
"""
import numpy as np

S = 64
T = -1  # transparent

def make_base(colors):
    """64x64 grid, all transparent"""
    return np.full((S, S), T, dtype=int)

def oval(grid, cx, cy, rx, ry, color):
    """Draw filled oval using ellipse equation"""
    for y in range(max(0, cy-ry), min(S, cy+ry+1)):
        for x in range(max(0, cx-rx), min(S, cx+rx+1)):
            dx, dy = (x-cx)/rx, (y-cy)/ry
            if dx*dx + dy*dy <= 1.0:
                if grid[y, x] == T:
                    grid[y, x] = color

def rect(grid, x, y, w, h, color):
    grid[y:y+h, x:x+w] = color

def line_h(grid, x1, x2, y, color, thickness=1):
    for t in range(thickness):
        grid[y+t, x1:x2] = color

def line_v(grid, x, y1, y2, color, thickness=1):
    for t in range(thickness):
        grid[y1:y2, x+t] = color

def arc_fill(grid, cx, cy, rx, ry, color, start_deg=0, end_deg=360):
    """Fill pixels within arc radius"""
    for y in range(max(0,cy-ry), min(S,cy+ry+1)):
        for x in range(max(0,cx-rx), min(S,cx+rx+1)):
            dx, dy = (x-cx)/rx, (y-cy)/ry
            r2 = dx*dx + dy*dy
            if r2 <= 1.0:
                angle = np.degrees(np.arctan2(-dy, dx)) % 360
                if start_deg <= angle <= end_deg or (start_deg > end_deg and (angle >= start_deg or angle <= end_deg)):
                    if grid[y, x] == T or grid[y, x] == color:
                        grid[y, x] = color


# ═══════════════════════════════════════
#  FRONT VIEW (frames 0,1,2)
# ═══════════════════════════════════════

def front_v2(frame):
    g = make_base(0)
    bob = frame * 2  # idle bob offset
    
    # ── Shadow base ──
    oval(g, S//2, S-4+frame, 20, 5, 24)
    
    # ── Back legs (6 total, 3 per side) ──
    leg_colors = [(22,19),(4,19),(22,19)]  # (main, dark) for each leg
    for side, sx in [(-1, 12), (1, S-18)]:
        for i in range(3):
            lx = sx + side*i*4 + (frame*2 if side>0 else -frame*2)
            ly = 36 + i*9
            # Leg segment 1
            rect(g, lx, ly, 5, 6, leg_colors[i][0])
            # Leg joint
            oval(g, lx+2, ly+6, 3, 2, leg_colors[i][1])
            # Leg tip
            rect(g, lx+side, ly+6, 4, 4, leg_colors[i][1])
    
    # ── Shell body ──
    # Main shell (dark base)
    oval(g, S//2, 24+frame, 26, 22, 19)
    # Shell (orange)
    oval(g, S//2, 22-frame, 24, 20, 8)  # dark orange shadow layer
    oval(g, S//2, 20-frame, 22, 18, 9)  # main orange
    # Shell highlight
    oval(g, S//2, 18-frame, 20, 14, 10) # yellow highlight
    oval(g, S//2, 16-frame, 16, 8, 20)  # gold top highlight
    
    # Shell segment lines (horizontal ridges)
    for sy, shade in [(26, 19), (30, 8), (34, 8), (38, 19)]:
        y = sy - frame
        line_h(g, 12, S-12, y, shade, 2)
        if shade == 19:
            line_h(g, 14, S-14, y+2, 4, 1)  # highlight below dark line
    
    # Shell vertical center line
    line_v(g, S//2-2, 14-frame, 46-frame, 19, 3)
    line_v(g, S//2, 16-frame, 44-frame, 10, 1)  # highlight
    
    # Shell rocky texture spots
    for tx, ty in [(18,28), (44,26), (22,32), (40,30), (30,36)]:
        oval(g, tx, ty-frame, 3, 2, 17)  # stone texture
        oval(g, tx+1, ty-1-frame, 2, 1, 18)  # highlight
    
    # ── Belly ──
    oval(g, S//2, 30-frame, 14, 10, 15)  # peach beige
    oval(g, S//2, 28-frame, 12, 8, 7)    # off-white highlight
    oval(g, S//2, 32-frame, 10, 6, 6)    # light brown shadow
    
    # ── Mouth ──
    my = 30 - frame
    line_h(g, 18, S-18, my, 0, 5)  # mouth line
    line_h(g, 20, S-20, my+3, 0, 4)  # mouth bottom
    # Mouth inside
    line_h(g, 22, S-22, my+1, 19, 2)
    # Teeth dots
    for tx in [22, 28, 34, 40]:
        oval(g, tx, my, 2, 2, 7)
        oval(g, tx, my, 1, 1, 0)
    
    # ── Eyes on stalks ──
    for ex in [18, 46]:
        # Stalk
        rect(g, ex+2, 6-frame, 3, 8, 9)   # orange stalk
        rect(g, ex+3, 5-frame, 1, 4, 10)   # highlight
        # Eye bulb
        oval(g, ex+2, 4-frame-bob, 8, 7, 7)   # white
        oval(g, ex+2, 3-frame-bob, 9, 7, 0)   # outline (drawn behind)
        # Pupil
        px = ex+4 + (1 if frame==0 else 0)
        oval(g, px+frame, 3-frame-bob, 4, 4, 0)  # black pupil
        oval(g, px+1, 2-frame-bob, 2, 2, 7)      # catchlight
    
    # ── Pink cheeks ──
    oval(g, 10, 28-frame, 7, 5, 14)
    oval(g, S-10, 28-frame, 7, 5, 14)
    # Cheek highlight
    oval(g, 9, 27-frame, 3, 2, 7)
    oval(g, S-11, 27-frame, 3, 2, 7)
    
    # ── Claws with pincers ──
    for cx, dr in [(8, -1), (S-16, 1)]:  # left, right
        # Claw base/arm
        rect(g, cx+(4 if dr>0 else 0), 16-frame, 8, 7, 8)   # dark red base
        rect(g, cx+(5 if dr>0 else 1), 16-frame, 5, 7, 9)   # orange top
        
        # Pincer upper
        pb = cx + (dr*2)
        arc_fill(g, pb, 12-frame, 10, 8, 9, 300, 60)  # orange pincer
        arc_fill(g, pb+dr, 10-frame, 8, 6, 8, 310, 50) # dark inner
        
        # Pincer lower
        arc_fill(g, pb-dr*2, 18-frame, 8, 6, 9, 90, 240)
        arc_fill(g, pb-dr, 17-frame, 6, 4, 8, 100, 230)
        
        # Claw joint highlight
        oval(g, cx+3, 17-frame, 4, 3, 10)
    
    # ── Front legs (larger, more visible) ──
    for side, sx in [(-1, 16), (1, S-22)]:
        for i in range(2):
            lx = sx + side*i*6 + (frame if side>0 else -frame)
            ly = 42 + i*8
            # Upper leg
            rect(g, lx, ly, 6, 5, 9)    # orange
            rect(g, lx+1, ly, 3, 2, 10)  # highlight
            # Joint
            oval(g, lx+2+side*2, ly+5, 4, 3, 8)
            # Lower leg
            rect(g, lx+side, ly+7, 5, 6, 4)
            # Foot
            oval(g, lx+side*2, ly+12, 6, 3, 19)
            rect(g, lx+side, ly+13, 5, 3, 5)  # earthy foot
    
    # ── Green leaf bits ──
    for gx, size in [(6, 6), (S-18, 6), (22, 5), (S-28, 5), (14, 4), (S-16, 4)]:
        # Dark green base
        oval(g, gx, S-10-frame//2, size+3, size-1, 3)
        # Green highlight
        oval(g, gx+1, S-11-frame//2, size, size-2, 11)
        # Light spot
        oval(g, gx+1, S-9-frame//2, 2, 2, 21)
    
    return g.tolist()

# Build all 3 front frames
KLAWF_V2 = {}
for f in [0, 1, 2]:
    KLAWF_V2[f"klawf_front_{f}"] = (64, 64, front_v2(f))

print(f"Generated {len(KLAWF_V2)} grid(s)")
