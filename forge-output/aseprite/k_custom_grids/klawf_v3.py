"""Klawf V3 FULL — all 4 directions x 3 frames = 12 sprites"""
import numpy as np

S=64
BK=0; DG=3; BR=4; EB=5; OW=7; DR=8; OG=9
YL=10; GN=11; PK=14; PE=15; SG=17; LS=18; VD=19; GH=20; GG=21; DW=22; WD=23; SH=24

def empty(): return np.full((S,S), -1, dtype=int)
def fr(g,x,y,w,h,c):
    x0=max(0,x); y0=max(0,y)
    x1=min(S,x+w); y1=min(S,y+h)
    g[y0:y1,x0:x1]=c
def fc(g,cx,cy,r,c):
    for dy in range(-r,r+1):
        for dx in range(-r,r+1):
            if dx*dx+dy*dy<=r*r:
                px,py=cx+dx,cy+dy
                if 0<=px<S and 0<=py<S and g[py,px]==-1: g[py,px]=c
def fa(g,cx,cy,rx,ry,c,a1,a2):
    for dy in range(-ry,ry+1):
        for dx in range(-rx,rx+1):
            if (dx*dx)/(max(1,rx*rx))+(dy*dy)/(max(1,ry*ry))<=1.0:
                ang=(360+np.degrees(np.arctan2(-dy,dx)))%360
                ok=(a1<=ang<=a2) if a1<=a2 else (ang>=a1 or ang<=a2)
                if ok:
                    px,py=cx+dx,cy+dy
                    if 0<=px<S and 0<=py<S and g[py,px]==-1: g[py,px]=c
def lh(g,y,x1,x2,c,t=1):
    for ti in range(t): fr(g,x1,y+ti,x2-x1,1,c)

def front(frame):
    g=empty(); b=frame
    # Shadow
    fr(g,18,S-6,S-36,6,SH)
    # Back legs
    for si,sx in [(-1,14),(1,S-20)]:
        for i,(ly,lc1,lc2) in enumerate([(42,DW,EB),(48,DW,EB),(54,BR,EB)]):
            lx=sx+si*i*3
            fr(g,lx,ly,5,8,lc1); fr(g,lx+1,ly,3,2,WD if lc1==DW else OW)
            fr(g,lx+si*2,ly+7,7,6,lc2)
    # Shell
    fc(g,S//2,26,20,OG); fc(g,S//2,24,19,OG); fc(g,S//2,22,18,OG)
    fc(g,S//2,28,17,DR); fc(g,S//2,18,16,YL); fc(g,S//2,16,10,GH)
    for sy in [26,31,36,41]:
        lh(g,sy-b,14,S-14,VD,2); lh(g,sy+2-b,16,S-16,YL,1)
    fr(g,S//2-1,14-b,3,32,VD); fr(g,S//2+1,14-b,1,28,YL)
    for tx,ty in [(18,24),(44,26),(22,30),(40,32),(30,38),(48,24)]:
        fr(g,tx,ty,3,2,SG); fr(g,tx+1,ty-1,1,1,LS)
    # Belly
    fr(g,20,30-b,S-40,12,PE); fr(g,22,32-b,S-44,8,OW); fr(g,24,34-b,S-48,4,PE)
    # Mouth
    lh(g,33-b,22,S-22,BK,3); fr(g,24,34-b,S-48,2,VD)
    # Eyes
    for ex in [18,42]:
        fr(g,ex+2,10-b,3,8,OG); fr(g,ex+3,11-b,1,4,YL); fr(g,ex+1,12-b,1,4,DR)
        fc(g,ex+3,8-b,4,OW); fc(g,ex+3,7-b,5,BK); fc(g,ex+3,8-b,4,OW)
        px=ex+4+(1 if frame==0 else 0)
        fc(g,px,8-b,2,BK); fr(g,px-1,7-b,2,1,OW)
    # Cheeks
    for cx in [12,S-12]:
        fc(g,cx,30-b,4,PK); fc(g,cx-1,29-b,2,OW)
    # Claws
    for cx,dr in [(10,-1),(S-16,1)]:
        aw=cx+8 if dr<0 else cx+2
        fr(g,aw,18,10,6,DR); fr(g,aw+1,18,8,4,OG)
        pt=aw+12 if dr<0 else aw-6
        fa(g,pt,14,8,6,OG,300,60); fa(g,pt+dr,12,6,4,DR,310,50)
        fa(g,pt+dr*2,22,8,6,OG,100,240); fa(g,pt+dr*3,21,6,4,DR,110,230)
    # Front legs
    for si,sx in [(-1,16),(1,S-22)]:
        fo=frame if si>0 else -frame
        for i in range(2):
            lx=sx+si*i*4+fo; ly=48+i*6
            fr(g,lx,ly,6,5,OG); fr(g,lx+1,ly,3,1,YL)
            fr(g,lx+si,ly+5,6,6,DR); fr(g,lx+si-1,ly+11,8,4,VD)
    # Leaves
    for gx,sz in [(8,5),(S-14,5),(22,4),(S-26,4),(14,3),(S-18,3)]:
        fr(g,gx,S-10,sz,8,DG); fr(g,gx+1,S-9,sz-2,4,GN); fr(g,gx+1,S-8,2,2,GG)
    return g.tolist()

def side(frame, right=True):
    g=empty(); b=frame; dr=1 if right else -1
    fr(g,16,S-4,S-32,4,SH)
    # Back legs
    for i in range(4):
        lx=14+i*2 if right else S-22-i*2
        fr(g,lx,32+i*9,4,6,EB)
        fr(g,lx+dr*2,37+i*9,8,5,BR)
    # Shell profile
    if right:
        fc(g,28,24,18,OG); fc(g,26,22,16,YL); fc(g,25,20,12,GH)
        fc(g,30,26,14,DR)
    else:
        fc(g,36,24,18,OG); fc(g,34,22,16,YL); fc(g,35,20,12,GH)
        fc(g,38,26,14,DR)
    for sy in [22,28,34,40]:
        lh(g,sy,12 if right else 20,46 if right else 52,VD,1)
        lh(g,sy+1,14 if right else 22,44 if right else 50,YL,1)
    # Eye stalk
    ex=40 if right else 18
    fr(g,ex,6-b,4,8,OG); fr(g,ex+1,8-b,2,4,YL)
    fc(g,ex+2,4-b,4,OW); fc(g,ex+2,3-b,5,BK); fc(g,ex+2,4-b,4,OW)
    fc(g,ex+3+frame,4-b,2,BK); fr(g,ex+2-frame,3-b,2,1,OW)
    # Cheek
    cx=44 if right else 16
    fc(g,cx,26-b,3,PK); fc(g,cx-1,25-b,1,OW)
    # Claw (facing front/side)
    caw=46 if right else S-52
    fr(g,caw,16,12,5,DR); fr(g,caw+2,17,8,3,OG)
    ptx=caw+14 if dr>0 else caw-8
    fa(g,ptx,14,6,5,OG,280,80)
    fa(g,ptx+dr*2,22,6,5,OG,80,280)
    # Mouth
    lh(g,30-b,12 if right else 20,40 if right else 50,BK,3)
    # Front leg
    flx=42 if right else 12
    fr(g,flx,44+b,6,14,OG); fr(g,flx+1,45+b,4,2,YL)
    fr(g,flx+dr,52+b,8,8,DR)
    # Leaves
    for gx in [8,S-18,18,S-28,28,S-38]:
        fr(g,gx,S-8,4,6,DG); fr(g,gx+1,S-7,2,3,GN)
    return g.tolist()

def back(frame):
    g=empty(); b=frame
    fr(g,18,S-6,S-36,6,SH)
    # Back legs silhouette
    for si,sx in [(-1,16),(1,S-22)]:
        for i in range(3):
            lx=sx+si*i*3; ly=40+i*7
            fr(g,lx,ly,4,10,EB)
    # Shell back view
    fc(g,S//2,24,20,OG); fc(g,S//2,22,18,YL); fc(g,S//2,20,14,GH)
    for sy in [26,32,38]:
        lh(g,sy-b,16,S-16,VD,2); lh(g,sy+2-b,18,S-18,YL,1)
    fr(g,S//2-1,12-b,3,34,VD); fr(g,S//2+1,14-b,1,30,YL)
    # Shell texture ridges
    for i in range(4):
        sy=18+i*8
        for tx in [14,30,48]:
            fr(g,tx,sy-b,6,2,SG)
    # Eye stalks from behind
    for ex in [20,40]:
        fr(g,ex,8-b,3,6,OG)
    # Leg bumps
    for lx in [14,22,36,44,52]:
        fc(g,lx,42+b,3,EB)
    # Leaves
    for gx in [8,S-18,20,S-30,30,S-42]:
        fr(g,gx,S-10,5,8,DG); fr(g,gx+1,S-9,3,5,GN)
    # Shell pattern
    for tx,ty in [(20,22),(32,20),(44,22),(28,28),(36,26)]:
        fr(g,tx,ty-b,4,3,SG); fr(g,tx+1,ty-1-b,2,1,LS)
    return g.tolist()

# Build all 12
KLAWF_V3 = {}
for f in [0,1,2]:
    KLAWF_V3[f"klawf_front_{f}"] = (64,64,front(f))
for f in [0,1,2]:
    KLAWF_V3[f"klawf_right_{f}"] = (64,64,side(f,True))
for f in [0,1,2]:
    KLAWF_V3[f"klawf_left_{f}"] = (64,64,side(f,False))
for f in [0,1,2]:
    KLAWF_V3[f"klawf_back_{f}"] = (64,64,back(f))

print(f"Generated {len(KLAWF_V3)} grids")
