"""Klawf V7 — HAND-CRAFTED 32x32 pixel grid, every pixel intentional. Scaled to 64x64."""
S=32  # Build at 32x32, render at 64x64
# Palette indices: 0=BK 1=DK 2=DP 3=DG 4=BR 5=EB 6=L6 7=SK 8=DR 9=OG
# 10=YL 11=GN 12=BL 13=P13 14=PK 15=PE 16=ST 17=SG 18=LS 19=VD
# 20=GH 21=GG 22=WD 23=W2 24=SH
# -1=transparent

_=-1; B=0; K=19; D=8; O=9; Y=10; G=11; W=7; P=14; C=15; N=3; L=18; V=5; H=20; A=17; S=24; E=4; M=6

KL = [
#   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
  [_, _, _, _, _, _, _, _, _, _, O, O, O, O, O, O, O, O, O, O, O, _, _, _, _, _, _, _, _, _, _, _], #0
  [_, _, _, _, _, _, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, _, _, _, _, _, _, _, _, _], #1
  [_, _, _, _, O, O, O, O, O, O, O, O, D, D, O, O, O, O, O, O, O, O, O, O, _, _, _, _, _, _, _, _], #2
  [_, _, _, O, O, O, O, O, D, D, O, O, O, O, O, O, D, D, O, O, O, O, O, O, O, _, _, _, _, _, _, _], #3
  [_, _, W, W, O, O, O, O, O, O, D, O, O, Y, O, O, D, O, O, O, O, O, O, O, O, _, _, _, _, _, _, _], #4
  [_, W, W, B, O, O, O, K, O, O, O, O, O, O, O, O, O, O, K, O, O, O, O, B, W, W, _, _, _, _, _, _], #5
  [_, W, B, B, O, O, D, V, D, O, O, O, O, O, O, O, O, D, V, D, O, O, O, B, B, W, _, _, _, _, _, _], #6
  [O, O, O, O, O, O, O, O, O, O, D, O, O, O, O, O, O, D, O, O, O, O, O, O, O, O, O, _, _, _, _, _], #7
  [O, O, O, D, D, O, O, O, O, O, O, O, H, H, H, O, O, O, O, O, O, O, O, D, D, O, O, O, _, _, _, _], #8
  [O, D, O, V, V, D, O, O, O, O, O, O, O, O, O, O, O, O, O, O, O, D, V, V, D, O, D, O, _, _, _, _], #9
  [O, O, O, O, D, V, D, O, O, O, O, D, D, D, D, D, O, O, O, O, D, V, D, O, O, O, O, O, _, _, _, _], #10
  [_, O, O, O, O, O, O, O, O, O, O, D, C, C, C, D, O, O, O, O, O, O, O, O, O, O, O, _, _, _, _, _], #11
  [_, _, O, D, D, O, O, O, O, O, D, C, C, C, C, C, D, O, O, O, O, O, O, D, D, O, _, _, _, _, _, _], #12
  [_, _, _, O, O, O, V, V, V, D, D, C, B, B, B, C, D, D, V, V, V, O, O, O, O, _, _, _, _, _, _, _], #13
  [_, _, _, O, O, V, V, V, V, D, C, B, B, B, B, B, C, D, V, V, V, V, O, O, _, _, _, _, _, _, _, _], #14
  [_, _, P, P, O, O, V, V, D, D, C, B, B, B, B, B, C, D, D, V, V, O, O, P, P, _, _, _, _, _, _, _], #15
  [_, _, P, P, W, O, O, O, D, D, C, B, B, B, B, B, C, D, D, O, O, O, W, P, P, _, _, _, _, _, _, _], #16
  [_, _, _, _, _, O, O, O, O, D, C, B, B, B, B, B, C, D, O, O, O, O, _, _, _, _, _, _, _, _, _, _], #17
  [_, _, _, _, _, O, D, O, O, O, D, C, C, C, C, C, D, O, O, O, D, O, _, _, _, _, _, _, _, _, _, _], #18
  [_, _, _, _, _, N, O, N, O, O, O, O, D, D, D, D, O, O, O, O, N, O, N, _, _, _, _, _, _, _, _, _], #19
  [_, _, _, _, N, O, V, O, N, O, O, O, D, V, V, D, O, O, O, N, O, V, O, N, _, _, _, _, _, _, _, _], #20
  [_, _, _, _, N, V, O, V, N, V, O, O, O, V, V, O, O, O, V, N, V, O, V, N, _, _, _, _, _, _, _, _], #21
  [_, _, _, _, N, O, N, O, N, V, O, V, O, O, O, O, V, O, V, N, O, N, O, N, _, _, _, _, _, _, _, _], #22
  [_, _, _, _, _, N, V, N, N, O, N, V, V, O, O, V, V, N, O, N, N, V, N, _, _, _, _, _, _, _, _, _], #23
  [_, _, _, _, _, _, N, O, V, O, N, O, N, V, V, N, O, N, O, V, O, N, _, _, _, _, _, _, _, _, _, _], #24
  [_, _, _, _, _, _, _, N, O, N, V, N, O, N, N, O, N, V, N, O, N, _, _, _, _, _, _, _, _, _, _, _], #25
  [_, _, _, _, _, _, _, _, N, N, O, N, N, O, O, N, N, O, N, N, _, _, _, _, _, _, _, _, _, _, _, _], #26
  [_, _, _, _, _, _, _, _, _, N, N, N, O, N, N, O, N, N, N, _, _, _, _, _, _, _, _, _, _, _, _, _], #27
  [_, _, _, _, _, _, _, _, _, _, _, N, N, N, N, N, N, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], #28
  [_, _, _, _, _, _, _, _, _, _, _, _, G, G, G, G, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], #29
  [_, _, _, _, _, _, _, _, _, _, _, G, G, G, G, G, G, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], #30
  [_, _, _, _, _, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], #31
]

# Generate directly as 64x64 via PIL with NEAREST scaling
from PIL import Image
import numpy as np

# Convert grid to RGBA pixels
PAL = {
    -1:(0,0,0,0), 0:(0,0,0,255), 1:(29,43,83,255), 2:(126,37,83,255),
    3:(0,135,81,255), 4:(120,70,30,255), 5:(70,60,50,255), 6:(150,130,110,255),
    7:(240,230,220,255), 8:(180,50,50,255), 9:(220,140,50,255), 10:(240,220,50,255),
    11:(50,180,50,255), 14:(220,120,160,255), 15:(240,200,160,255),
    17:(100,90,80,255), 18:(170,160,150,255), 19:(40,30,20,255),
    20:(200,180,50,255), 21:(100,180,80,255), 23:(180,140,100,255), 24:(30,30,30,255)
}

arr = np.zeros((S,S,4), dtype=np.uint8)
for y in range(S):
    for x in range(S):
        arr[y,x] = PAL.get(KL[y][x], (0,0,0,0))

img32 = Image.fromarray(arr, 'RGBA')
img64 = img32.resize((64,64), Image.NEAREST)

out = r'C:\Users\khair\Kai-Asset-Forge\forge-output\aseprite\k_custom\klawf_front_0.png'
img64.save(out)
import os
print(f'OK: {out} ({os.path.getsize(out)} bytes)')
