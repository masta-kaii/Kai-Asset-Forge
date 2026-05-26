"""Klawf V5 — SILHOUETTE-FILLED. No internal gaps, outline only at boundary."""
import numpy as np
S=64
# Palette indices (same as aseprite-forge.py PALETTE)
BK=0; DK=1; DP=2; DG=3; B4=4; EB=5; L6=6; SK=7; DR=8; OG=9
YL=10; GN=11; BL=12; P13=13; PK=14; PE=15; ST=16; SG=17; LS=18; VD=19
GH=20; GG=21; WD=22; W2=23; SH=24

def empty(): return np.full((S,S),-1,dtype=int)
def clip(x): return max(0,min(S-1,int(x)))

def rect(g,x,y,w,h,c):
    x1,y1=clip(x),clip(y); x2,y2=clip(x+w-1)+1,clip(y+h-1)+1
    if x2>x1 and y2>y1: g[y1:y2,x1:x2]=c

def circle(g,cx,cy,r,c):
    rr=r*r
    for dy in range(-r,r+1):
        py=cy+dy
        if 0<=py<S:
            dx=int((rr-dy*dy)**0.5)
            x1,x2=clip(cx-dx),clip(cx+dx)+1
            if x2>x1: g[py,x1:x2]=c

def oval(g,cx,cy,rx,ry,c):
    for dy in range(-ry,ry+1):
        py=cy+dy
        if 0<=py<S:
            xx=int(rx*(1-(dy*dy)/(ry*ry))**0.5)
            x1,x2=clip(cx-xx),clip(cx+xx)+1
            if x2>x1: g[py,x1:x2]=c

def draw_klawf():
    g=empty()
    
    # ═════ STEP 1: SILHOUETTE FILL (darkest orange, covers entire crab) ═════
    # This ensures NO internal transparent gaps
    oval(g,32,24,22,26,VD)   # full body+legs silhouette
    # Leg extensions
    for sx in [8,56]:
        for ly in [44,48,52]:
            circle(g,sx,ly,5,VD)
    # Claw arms
    oval(g,18,18,14,9,VD)
    oval(g,46,18,14,9,VD)
    # Eye stalks
    for ex in [20,44]:
        rect(g,ex,10,5,12,VD)
    # Eye bulbs
    for ex in [18,42]:
        circle(g,ex+5,8,7,VD)
    # Leaf bumps
    for gx in [6,18,30,34,46,58]:
        rect(g,gx,S-10,6,8,VD)
    
    # ═════ STEP 2: BODY LAYERS (dark to light) ═════
    oval(g,32,22,20,22,EB)   # shadow shell
    oval(g,32,20,18,20,DR)   # dark shell
    oval(g,32,18,16,18,OG)   # main orange shell
    oval(g,32,16,13,14,YL)   # light shell top
    oval(g,32,14,8,8,GH)     # brightest crown
    
    # Shell segment lines
    for sy in [26,30,34,38,42]:
        rect(g,14,sy,S-28,2,VD)
        rect(g,14,sy+1,S-28,1,EB)
    
    # Shell texture dots
    for tx,ty in [(22,22),(42,22),(20,28),(44,30),(26,34),(38,32),(30,18)]:
        rect(g,tx,ty,3,2,SG); rect(g,tx+1,ty-1,1,1,LS)
    
    # ═════ STEP 3: BELLY ═════
    oval(g,32,34,10,8,PE)     # belly base
    oval(g,32,33,8,6,SK)      # lighter belly
    oval(g,32,35,5,3,PE)      # belly shadow line
    
    # ═════ STEP 4: MOUTH ═════
    rect(g,22,37,S-44,3,BK)   # mouth line
    rect(g,24,38,S-48,1,EB)   # mouth shadow
    
    # ═════ STEP 5: EYE STALKS ═════
    for ex in [20,44]:
        rect(g,ex+1,12,3,8,EB)
        rect(g,ex+2,14,1,4,YL)
    
    # ═════ STEP 6: EYES ═════
    for ex in [18,42]:
        circle(g,ex+5,7,6,BK)   # outline ring
        circle(g,ex+5,8,5,SK)   # white
    # Pupils
    circle(g,24,9,2,BK)
    circle(g,44,9,2,BK)
    rect(g,22,8,2,1,SK)  # catchlight left
    rect(g,42,8,2,1,SK)  # catchlight right
    
    # ═════ STEP 7: CHEEKS ═════
    for cx in [14,50]:
        circle(g,cx,30,4,PK)
        rect(g,cx-1,28,2,1,SK)  # highlight dot
    
    # ═════ STEP 8: FRONT LEGS ═════
    for side, sx in [(-1,18),(1,46)]:
        # Upper leg segment
        rect(g,sx+side,42,8,6,OG)
        rect(g,sx+side+1,43,6,2,YL)
        # Lower leg
        rect(g,sx+side*2,46,6,6,DR)
        rect(g,sx+side*3,48,4,3,LS)
        # Foot
        rect(g,sx+side*3-2,52,10,4,EB)
        rect(g,sx+side*3-1,53,8,1,BK)
    
    # ═════ STEP 9: CLAWS ═════
    for cx,dr in [(8,-1),(50,1)]:
        arm=cx+8 if dr<0 else cx
        # Claw arm
        rect(g,arm,16,11,8,DR)
        rect(g,arm+2,17,7,4,OG)
        rect(g,arm+3,18,4,1,YL)
        # Upper pincer
        pt=arm+12 if dr<0 else arm-6
        circle(g,pt,12,7,OG)
        circle(g,pt+dr*2,10,5,DR)
        circle(g,pt+dr*3,15,5,DR)
        rect(g,pt+dr*3,21,4,3,OG)
        rect(g,pt+dr*3+1,22,2,1,YL)
        # Lower pincer arc
        if dr<0:
            circle(g,pt+5,19,6,DR)
            circle(g,pt+4,18,5,OG)
            circle(g,pt+4,19,3,YL)
        else:
            circle(g,pt-5,19,6,DR)
            circle(g,pt-4,18,5,OG)
            circle(g,pt-4,19,3,YL)
    
    # ═════ STEP 10: GREEN LEAVES ═════
    for gx,sz in [(6,5),(S-12,5),(22,4),(S-26,4),(14,3),(S-18,3)]:
        rect(g,gx,S-10,sz,8,DG)
        rect(g,gx+1,S-12,sz-2,4,GN)
        rect(g,gx,56,sz,1,GG)
    
    # ═════ STEP 11: SHELL HIGHLIGHTS ═════
    rect(g,28,16,4,2,GH)
    rect(g,36,18,2,2,GH)
    rect(g,24,20,2,1,YL)
    rect(g,42,20,2,1,YL)
    
    return g.tolist()

KLAWF_V5 = {"klawf_front_0": (64,64,draw_klawf())}
print("V5 grid ready (silhouette-filled)")
