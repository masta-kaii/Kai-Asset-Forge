"""Klawf Crab 64x64 Sprite Sheet - 4 directions x 3 frames"""
from PIL import Image, ImageDraw
import os

S = 64
O  = (0,0,0,255)        # outline
OR = (220,120,40,255)    # orange
OL = (250,160,80,255)    # orange light
OD = (180,80,20,255)     # orange dark
BG = (240,210,170,255)   # beige
BD = (210,180,140,255)   # beige dark
WH = (255,255,255,255)   # white
PU = (20,20,20,255)      # pupil
PK = (240,140,160,255)   # pink
GR = (60,150,50,255)     # green
GD = (30,100,30,255)     # green dark
MO = (80,40,20,255)      # mouth
LG = (160,100,40,255)    # leg
LD = (120,70,20,255)     # leg dark
SH = (10,10,10,128)      # shadow
CO = (200,90,30,255)     # claw outer
CI = (240,140,60,255)    # claw inner

def oval(d, x, y, w, h, color, outline=None):
    d.ellipse([x, y, x+w, y+h], fill=color, outline=outline)

def rect(d, x, y, w, h, color, outline=None):
    d.rectangle([x, y, x+w, y+h], fill=color, outline=outline)

def line(d, x1, y1, x2, y2, color, width=1):
    d.line([(x1,y1), (x2,y2)], fill=color, width=width)

def rrect(d, x, y, w, h, r, color, outline=None):
    d.rounded_rectangle([x, y, x+w, y+h], radius=r, fill=color, outline=outline)

def front(frame):
    img = Image.new("RGBA", (S,S), (0,0,0,0))
    d = ImageDraw.Draw(img)
    b = frame * 3
    ls = frame * 2

    oval(d, 10, S-8, S-20, 8, SH)
    
    # Back legs
    for side, sx in [(-1,8),(1,S-24)]:
        for i in range(3):
            r = rect(d, sx+side*i*2+(ls if side>0 else -ls), 35+i*6, 6, 4, LD)
            if not r: rect(d, sx+side*i*2+2, 33+i*6, 4, 4, LG)

    # Shell
    rrect(d, 10, 12, S-20, S-28, 12, OR, O)
    rrect(d, 14, 16, S-28, 14, 8, OL)
    for sy in [26,34,42]: d.line([(16,sy),(S-16,sy)], fill=OD, width=1)
    rrect(d, 12, 38, S-24, S-56, 6, OD)

    # Belly
    oval(d, 18, 24, S-36, 20, BG)
    oval(d, 22, 26, S-44, 16, BD)

    # Mouth
    my = 28 + b//2
    rect(d, 18, my, S-36, 6, MO)
    rect(d, 22, my+2, S-44, 2, (40,20,10,255))

    # Eyes
    for ex in [16,40]:
        rect(d, ex+2, 8, 4, 8, OD)
        oval(d, ex-2, 2-b, 12, 10, WH, O)
        px = ex+3 + (1 if frame==1 else 0)
        oval(d, px, 4-b, 5, 4, PU)

    # Cheeks
    oval(d, 10, 30+b//2, 8, 6, PK)
    oval(d, S-18, 30+b//2, 8, 6, PK)

    # Claws
    for cx, dr in [(6,-1),(S-22,1)]:
        rect(d, cx+4 if dr>0 else cx, 18, 10, 6, CO)
        pb = cx+2 if dr>0 else cx-2
        co = frame % 2
        d.arc([pb-8, 10, pb+8, 24], 0, 180, fill=CO)
        rect(d, pb-4+co*2, 14, 8, 3, CI)

    # Front legs  
    for side, sx in [(-1,12),(1,S-28)]:
        for i in range(2):
            rect(d, sx+i*3+(ls*2 if side>0 else -ls*2), 44+i*7, 5, 3, LG)

    # Green bits
    for gx in [6, S-20, 20, S-34]:
        oval(d, gx, S-14, 12, 10, GD)
        oval(d, gx+2, S-12, 8, 6, GR)

    return img

def side(frame, right=True):
    img = Image.new("RGBA", (S,S), (0,0,0,0))
    d = ImageDraw.Draw(img)
    b = frame
    dr = 1 if right else -1
    
    oval(d, 8, S-6, S-16, 6, SH)

    for i in range(4):
        lx = 12+i*2 if right else S-20-i*2
        ly = 28+i*10
        d.line([(lx,ly),(lx+dr*14,ly+4)], fill=LD, width=4)
        d.line([(lx,ly+1),(lx+dr*12,ly+3)], fill=LG, width=3)

    if right:
        oval(d, 10, 10, 38, 40, OR)
        oval(d, 12, 12, 34, 36, OL)
        rect(d, 30, 4, 6, 10, OD)
        oval(d, 26, 0-b, 14, 10, WH, O)
        oval(d, 32, 2-b, 6, 4, PU)
        oval(d, 4, 14, 16, 12, CO)
        oval(d, 0, 16, 10, 8, CI)
        rect(d, 30, 28, 8, 4, MO)
        oval(d, 34, 24, 6, 4, PK)
        oval(d, 10, S-12, 10, 8, GR)
    else:
        oval(d, 16, 10, 38, 40, OR)
        oval(d, 18, 12, 34, 36, OL)
        rect(d, 28, 4, 6, 10, OD)
        oval(d, 24, 0-b, 14, 10, WH, O)
        oval(d, 26, 2-b, 6, 4, PU)
        oval(d, 44, 14, 16, 12, CO)
        oval(d, 54, 16, 10, 8, CI)
        rect(d, 26, 28, 8, 4, MO)
        oval(d, 24, 24, 6, 4, PK)
        oval(d, 44, S-12, 10, 8, GR)

    for sy in [20,30,40]:
        d.line([(16,sy),(46,sy)], fill=OD, width=1)
    
    return img

def back(frame):
    img = Image.new("RGBA", (S,S), (0,0,0,0))
    d = ImageDraw.Draw(img)
    ls = frame

    oval(d, 10, S-8, S-20, 8, SH)

    for side, sx in [(-1,10),(1,S-26)]:
        for i in range(3):
            rect(d, sx+side*i*2+(ls if side>0 else -ls), 32+i*7, 5, 3, LD)

    rrect(d, 8, 10, S-16, S-24, 14, OR, O)
    rrect(d, 16, 14, S-32, 20, 10, OL)

    d.line([(S//2,14),(S//2,42)], fill=OD, width=2)
    d.line([(16,22),(S-16,22)], fill=OD, width=1)
    d.line([(20,34),(S-20,34)], fill=OD, width=1)

    for i in range(3):
        sy = 16 + i*10
        d.arc([12,sy,S-12,sy+16], -30, 210, fill=OD, width=2)

    for gx in [8, S-22, 24, S-38]:
        oval(d, gx, S-12, 12, 8, GD)
        oval(d, gx+2, S-10, 8, 5, GR)

    for sx in [10, S-18]:
        oval(d, sx, 30, 8, 6, OD)

    return img

# ── Generate sprite sheet ──
dirs = [("front", front), ("left", lambda f: side(f, False)),
        ("right", lambda f: side(f, True)), ("back", back)]
frames = [0, 1, 2]

sheet = Image.new("RGBA", (S*3, S*4), (0,0,0,0))
for ri, (dn, dfn) in enumerate(dirs):
    for fi, f in enumerate(frames):
        sprite = dfn(f)
        sheet.paste(sprite, (fi*S, ri*S))

out = "C:/Users/khair/AppData/Local/hermes/image_cache/klawf_spritesheet.png"
sheet.save(out)

indir = "C:/Users/khair/Kai-Asset-Forge/forge-output/aseprite/k_custom"
os.makedirs(indir, exist_ok=True)
for dn, dfn in dirs:
    for f in frames:
        dfn(f).save(f"{indir}/klawf_{dn}_{f}.png")

print(f"Done! {out}")
