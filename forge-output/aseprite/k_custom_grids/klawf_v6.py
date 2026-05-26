"""Klawf V6 — ASEPRITE RENDER. Bolder shapes, filled silhouette, through forge pipeline."""
import numpy as np
S=64
BK=0; DK=1; DP=2; DG=3; BR=4; EB=5; L6=6; SK=7; DR=8; OG=9
YL=10; GN=11; BL=12; P13=13; PK=14; PE=15; ST=16; SG=17; LS=18; VD=19
GH=20; GG=21; WD=22; W2=23; SH=24

def empty(): return np.full((S,S),-1,dtype=int)
def clip(x): return max(0,min(S-1,int(x)))

def r(g,x,y,w,h,c):
    x1,y1=clip(x),clip(y); x2,y2=clip(x+w)+1,clip(y+h)+1
    if x2>x1 and y2>y1: g[y1:y2,x1:x2]=c

def c(g,cx,cy,rad,c):
    rr=rad*rad
    for dy in range(-rad,rad+1):
        py=cy+dy
        if 0<=py<S:
            dx=int((rr-dy*dy)**0.5)
            x1,x2=clip(cx-dx),clip(cx+dx)+1
            if x2>x1: g[py,x1:x2]=c

def o(g,cx,cy,rx,ry,c):
    for dy in range(-ry,ry+1):
        py=cy+dy
        if 0<=py<S:
            xx=int(rx*(1-(dy*dy)/(ry*ry+0.01))**0.5)
            x1,x2=clip(cx-xx),clip(cx+xx)+1
            if x2>x1: g[py,x1:x2]=c

def draw_front(f=0):
    g=empty()
    b=f*2  # animation bob
    
    # SHADOW
    o(g,32,58,18,4,SH)
    
    # BACK LEGS — 3 pairs behind body
    for si in [-1,1]:
        sx=18 if si<0 else 46
        for i in range(3):
            lx=sx+si*i*3; ly=42+i*5
            r(g,lx,ly,6,4,VD); r(g,lx+2,ly,2,2,EB)
            r(g,lx-2,ly+4,8,6,EB); r(g,lx-1,ly+5,5,3,VD)
    
    # SHELL SILHOUETTE (darkest)
    o(g,32,24,20,26,VD)
    # Shell layers
    o(g,32,22,18,24,EB)
    o(g,32,20,16,21,DR)
    o(g,32,19,14,18,OG)
    o(g,32,17,11,14,YL)
    o(g,32,15,7,8,GH)
    
    # Shell segments
    for sy in [27,32,37,42]:
        for t in range(2): r(g,14,sy+t,S-28,1,VD)
    r(g,16,28,S-32,1,LS)
    r(g,16,33,S-32,1,LS)
    r(g,16,38,S-32,1,LS)
    
    # Shell bumps
    for tx,ty in [(22,21),(42,23),(26,28),(38,27),(30,34),(34,20)]:
        r(g,tx,ty,4,3,SG); r(g,tx+1,ty-1,2,1,LS)
    
    # SHELL HIGHLIGHTS
    r(g,28,16,8,2,GH); r(g,38,19,4,2,GH)
    for hx in [24,36,46]: r(g,hx,22,2,1,YL)
    
    # BELLY
    o(g,32,34,10,8,PE)
    o(g,32,33,8,5,SK)
    o(g,32,36,4,3,PE)
    
    # MOUTH
    r(g,22,38,S-44,3,BK)
    r(g,24,39,S-48,1,EB)
    
    # EYE STALKS
    for ex in [18,42]:
        r(g,ex+2,11,4,10,EB)
        r(g,ex+3,13,2,5,YL)
    
    # EYES
    for ex in [16,40]:
        c(g,ex+6,8,6,BK)     # black ring
        c(g,ex+6,9,5,SK)     # white
    c(g,25,10,2,BK)          # pupils
    c(g,49,10,2,BK)
    r(g,23,9,2,1,SK)         # catchlights
    r(g,47,9,2,1,SK)
    
    # CHEEKS
    for cx in [13,51]:
        c(g,cx,30,4,PK)
        r(g,cx-1,28,2,2,SK)  # highlight
    
    # FRONT LEGS
    for si,sx in [(-1,20),(1,44)]:
        lx=sx+si*3; bo=b if si<0 else -b
        r(g,lx+bo,44,8,5,OG); r(g,lx+bo+2,45,4,1,YL)
        r(g,lx+si+bo,48,8,5,DR); r(g,lx+si+bo+2,49,4,1,LS)
        r(g,lx+si*2-2+bo,53,10,5,EB); r(g,lx+si*2-1+bo,54,6,1,VD)
    
    # CLAWS — BIG AND PROMINENT
    for cx,dr in [(2,-1),(S-8,1)]:
        arm=cx+10 if dr<0 else cx-4
        # Arm shaft
        r(g,arm,15,14,9,DR); r(g,arm+2,16,10,4,OG); r(g,arm+4,17,5,2,YL)
        # Upper pincer
        pt=arm+16 if dr<0 else arm-10
        c(g,pt,8,10,OG)
        c(g,pt+dr*3,6,8,DR)
        o(g,pt+dr*5,10,6,4,OG)
        r(g,pt+dr*5-3,14,8,3,YL)
        # Lower pincer
        if dr<0:
            c(g,pt+8,14,7,DR); c(g,pt+6,13,6,OG)
            r(g,pt+10,17,4,3,YL)
        else:
            c(g,pt-8,14,7,DR); c(g,pt-6,13,6,OG)
            r(g,pt-14,17,4,3,YL)
        # Claw tips
        r(g,pt+dr*3-2,20,5,3,EB) if dr<0 else r(g,pt+dr*3-3,20,5,3,EB)
    
    # GREEN LEAVES
    for gx,sz in [(4,5),(S-10,6),(18,4),(S-22,5),(10,3),(S-14,4)]:
        r(g,gx,S-12,sz,10,DG); r(g,gx+1,S-14,sz-2,5,GN); r(g,gx,58,sz,2,GG)
    
    return g.tolist()

KLAWF_V6 = {}
for f in [0,1,2]:
    KLAWF_V6[f"klawf_front_{f}"] = (S,S,draw_front(f))

print(f"V6 grids: {len(KLAWF_V6)}")
