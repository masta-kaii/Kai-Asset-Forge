"""Klawf V4 — REFERENCE QUALITY. One front sprite, hand-crafted."""
import numpy as np
S=64
BK=0; DK=1; DP=2; DG=3; BR=4; EB=5; SK=7; DR=8; OG=9
YL=10; GN=11; PK=14; PE=15; ST=16; SG=17; LS=18; VD=19; GH=20; GG=21; WD=22; WD2=23; SH=24

def empty(): return np.full((S,S),-1,dtype=int)

def _clip(x): return max(0,min(S-1,x))

def fill_rect(g,x,y,w,h,c):
    x1,y1=_clip(x), _clip(y)
    x2,y2=_clip(x+w-1)+1, _clip(y+h-1)+1
    if x2>x1 and y2>y1: g[y1:y2,x1:x2]=c

def fill_circle(g,cx,cy,r,c):
    rr=r*r
    for dy in range(-r,r+1):
        py=cy+dy
        if 0<=py<S:
            dx=int((rr-dy*dy)**0.5)
            x1,x2=_clip(cx-dx),_clip(cx+dx)+1
            if x2>x1: g[py,x1:x2]=c

def fill_oval(g,cx,cy,rx,ry,c):
    for dy in range(-ry,ry+1):
        py=cy+dy
        if 0<=py<S:
            xx=int(rx*(1-(dy*dy)/(ry*ry))**0.5)
            x1,x2=_clip(cx-xx),_clip(cx+xx)+1
            if x2>x1: g[py,x1:x2]=c

def hline(g,y,x1,x2,c,t=1):
    for ty in range(t): fill_rect(g,x1,y+ty,x2-x1,1,c)

def shade_oval(g,cx,cy,rx,ry,c_top,c_mid,c_bot):
    for dy in range(-ry,ry+1):
        py=cy+dy
        if 0<=py<S:
            xx=int(rx*(1-(dy*dy)/(ry*ry))**0.5)
            x1,x2=_clip(cx-xx),_clip(cx+xx)+1
            frac=(dy+ry)/(2*ry)
            if frac<0.3: c=c_top
            elif frac<0.7: c=c_mid
            else: c=c_bot
            if x2>x1: g[py,x1:x2]=c

def shade_circle(g,cx,cy,r,c1,c2,c3):
    rr=r*r
    r2=(r*2)//3; r3=r//3
    for dy in range(-r,r+1):
        py=cy+dy
        if 0<=py<S:
            dx=int((rr-dy*dy)**0.5)
            x1,x2=_clip(cx-dx),_clip(cx+dx)+1
            dd=dy*dy
            if dd<r3*r3: c=c1
            elif dd<r2*r2: c=c2
            else: c=c3
            if x2>x1: g[py,x1:x2]=c

def front_v4():
    g=empty()
    # ── GROUND SHADOW ──
    fill_oval(g,32,58,20,4,SH)
    
    # ── BACK LEGS (behind body, darker) ──
    for side in [-1,1]:
        base_x=18 if side<0 else 46
        for i,ly in enumerate([44,48,52]):
            lx=base_x+side*i*3
            fill_rect(g,lx,ly,5,4,EB)      # joint
            fill_rect(g,lx-1,ly+4,7,6,EB)  # lower leg
    
    # ── MAIN SHELL ──
    fill_oval(g,32,26,20,24,VD)        # dark outline area
    fill_oval(g,32,24,18,22,DR)        # shadow shell
    fill_oval(g,32,22,17,20,OG)        # main shell
    fill_oval(g,32,20,15,17,YL)        # top highlight
    fill_oval(g,32,16,10,8,GH)         # brightest top
    
    # ── SHELL SEGMENTS ──
    for sy,cy,ty in [(28,2,VD),(32,1,EB),(36,2,VD),(40,1,EB)]:
        hline(g,sy,16,S-16,cy,ty)
    
    # ── SHELL TEXTURE BUMPS ──
    for tx,ty in [(20,22),(44,24),(24,30),(40,28),(32,36),(36,18)]:
        fill_rect(g,tx,ty,4,3,SG); fill_rect(g,tx+1,ty-1,2,1,LS)
    
    # ── BELLY ──
    fill_oval(g,32,32,12,8,PE)
    fill_oval(g,32,33,8,5,SK)
    fill_oval(g,32,35,5,3,PE)
    
    # ── MOUTH ──
    fill_rect(g,24,36,S-48,3,BK)
    fill_rect(g,26,37,S-52,1,EB)
    
    # ── EYE STALKS ──
    for ex in [20,44]:
        fill_rect(g,ex+1,12,3,8,DR)
        fill_rect(g,ex+2,14,1,4,YL)
        fill_rect(g,ex,14,1,4,VD)
    
    # ── WHITE EYES ──
    for ex in [18,42]:
        fill_circle(g,ex+4,8,5,SK)
        fill_circle(g,ex+4,7,6,BK)  # outline
        fill_circle(g,ex+4,8,5,SK)  # white over outline
    
    # ── PUPILS ──
    fill_circle(g,23,9,2,BK)
    fill_circle(g,43,9,2,BK)
    fill_rect(g,22,8,2,1,SK)  # catchlight left
    fill_rect(g,42,8,2,1,SK)  # catchlight right
    
    # ── CHEEKS ──
    for cx in [14,50]:
        fill_circle(g,cx,30,4,PK)
        fill_circle(g,cx-1,29,2,SK)  # highlight dot
    
    # ── FRONT LEGS ──
    for side in [-1,1]:
        base_x=20 if side<0 else 44
        # Upper leg
        fill_rect(g,base_x,44,7,5,OG)
        fill_rect(g,base_x+1,45,5,1,YL)
        # Lower leg
        fill_rect(g,base_x+side,48,8,5,DR)
        # Foot
        fill_rect(g,base_x+side-2,53,10,4,VD)
        fill_rect(g,base_x+side-1,54,8,1,EB)
    
    # ── CLAWS ──
    for cx,dr in [(8,-1),(48,1)]:
        # Claw arm
        aw=cx+10 if dr<0 else cx
        fill_rect(g,aw,18,10,7,DR)
        fill_rect(g,aw+2,19,6,3,OG)
        fill_rect(g,aw+3,20,3,1,YL)
        # Upper pincer
        pt=aw+14 if dr<0 else aw-6
        fill_circle(g,pt,14,6,OG)
        fill_circle(g,pt+dr,12,4,DR)
        fill_circle(g,pt+dr*2,16,4,DR)
        fill_rect(g,pt+dr,22,4,3,OG)
        fill_rect(g,pt+dr+1,23,2,1,YL)
        # Lower pincer
        if dr<0:
            fill_circle(g,pt+4,21,5,DR)
            fill_circle(g,pt+3,20,4,OG)
        else:
            fill_circle(g,pt-4,21,5,DR)
            fill_circle(g,pt-3,20,4,OG)
    
    # ── GREEN LEAVES ──
    for gx,sz in [(6,5),(S-12,5),(22,4),(S-26,4),(14,3),(S-18,3)]:
        fill_rect(g,gx,S-10,sz,8,DG)
        fill_rect(g,gx+1,S-12,sz-2,4,GN)
        fill_rect(g,gx+1,S-13,2,2,GG)
    
    # ── BODY HIGHLIGHTS ──
    fill_rect(g,28,20,3,1,GH)
    fill_rect(g,36,22,2,1,GH)
    
    return g.tolist()

KLAWF_V4 = {"klawf_front_0": (64,64,front_v4())}
print("V4 front grid ready!")
