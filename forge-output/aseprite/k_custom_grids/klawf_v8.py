"""Klawf V8 — SIMPLE & READABLE. Huge eyes, big claws, clean shapes at 64x64."""
from PIL import Image
import os, math

S=64
img=Image.new('RGBA',(S,S),(0,0,0,0))

# Colors
BK=(0,0,0,255); SK=(240,230,220,255); OG=(220,140,50,255)
YL=(240,220,50,255); PK=(220,120,160,255); PE=(240,200,160,255)
DR=(180,50,50,255); DG=(0,135,81,255); GG=(100,180,80,255)
VD=(40,30,20,255); SH=(30,30,30,255); EB=(70,60,50,255)

pix=img.load()

def p(x,y,c):
    if 0<=x<S and 0<=y<S: pix[x,y]=c

def rect(x,y,w,h,c):
    for dy in range(h):
        for dx in range(w): p(x+dx,y+dy,c)

def circle(cx,cy,r,c):
    rr=r*r
    for dy in range(-r,r+1):
        for dx in range(-r,r+1):
            if dx*dx+dy*dy<=rr: p(cx+dx,cy+dy,c)

def oval(cx,cy,rx,ry,c):
    for dy in range(-ry,ry+1):
        for dx in range(-rx,rx+1):
            if (dx*dx)/(rx*rx+0.1)+(dy*dy)/(ry*ry+0.1)<=1:
                p(cx+dx,cy+dy,c)

# ── SHADOW ──
oval(32,58,16,4,SH)

# ── BACK LEGS (simple, behind body) ──
for si in [-1,1]:
    sx=20 if si<0 else 44
    for i in range(3):
        lx=sx+si*i*3; ly=42+i*4
        rect(lx,ly,5,4,VD); rect(lx-1,ly+3,7,5,EB)

# ── SHELL (clean layers) ──
circle(32,26,18,VD)    # outline shadow
circle(32,25,17,EB)    # dark edge
circle(32,24,15,DR)    # mid
circle(32,23,13,OG)    # main orange
circle(32,21,10,YL)    # light top

# Shell shine
oval(32,19,6,4,(220,200,100,255))

# ── SHELL SEGMENTS ──
for sy in [29,33,37,41]:
    for t in range(2): rect(17,sy+t,30,1,VD)
    rect(19,sy-1,26,1,(170,120,40,255))

# ── BELLY ──
oval(32,32,9,7,PE)
oval(32,33,6,5,SK)

# ── MOUTH ──
rect(24,37,16,3,BK)
rect(26,38,12,1,EB)

# ── EYE STALKS ──
for ex in [16,42]:
    rect(ex+2,10,4,10,EB)
    rect(ex+3,12,2,4,YL)

# ── EYES (HUGE — 10px wide each) ──
for ex in [14,40]:
    circle(ex+6,7,5,BK)     # black ring
    circle(ex+6,8,4,SK)     # white

# Pupils
circle(23,9,2,BK)
circle(49,9,2,BK)

# Catchlights
rect(21,8,3,1,SK)
rect(47,8,3,1,SK)

# ── CHEEKS ──
for cx in [10,54]:
    oval(cx,30,5,4,PK)
    rect(cx-2,28,3,2,SK)   # highlight

# ── FRONT LEGS ──
for si,sx in [(-1,20),(1,42)]:
    rect(sx+si*2,44,8,6,OG); rect(sx+si*2+2,45,4,2,YL)
    rect(sx+si*3,48,8,5,DR)
    rect(sx+si*2-2,53,10,5,EB)

# ── CLAWS (BIG — 14px wide) ──
for cx,dr in [(0,-1),(S-16,1)]:
    arm=cx+10 if dr<0 else cx-4
    # Arm
    rect(arm,14,14,10,DR); rect(arm+3,15,8,5,OG); rect(arm+5,16,4,2,YL)
    # Upper pincer
    pt=arm+18 if dr<0 else arm-10
    circle(pt,7,10,OG); circle(pt+dr*3,5,8,DR)
    oval(pt+dr*5,9,6,5,OG); rect(pt+dr*5-3,13,7,3,YL)
    # Lower pincer
    if dr<0:
        circle(pt+8,13,7,DR); circle(pt+7,12,5,OG)
        rect(pt+12,16,3,2,YL)
    else:
        circle(pt-8,13,7,DR); circle(pt-7,12,5,OG)
        rect(pt-15,16,3,2,YL)
    # Tips
    if dr<0: rect(pt-2,19,5,3,EB)
    else: rect(pt-3,19,5,3,EB)

# ── GREEN LEAVES ──
for gx in [4,54,18,40,12,46]:
    rect(gx,S-12,7,10,DG); rect(gx+1,S-13,5,6,GG); rect(gx+2,S-12,3,2,(150,220,80,255))

out=r'C:\Users\khair\Kai-Asset-Forge\forge-output\aseprite\k_custom\klawf_front_0.png'
img.save(out)
print(f'OK: {out} ({os.path.getsize(out)} bytes)')
