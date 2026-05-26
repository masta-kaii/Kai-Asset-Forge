#!/usr/bin/env python3
"""
aseprite-forge.py — Generates game-ready pixel art via Aseprite CLI.

Creates proper Aseprite-native sprites with indexed color, animation frames,
and sprite sheet export. Matches 0x72 Dungeon Tileset quality standard.

Usage:
    python aseprite-forge.py --character dwarf --all-frames
    python aseprite-forge.py --all
    python aseprite-forge.py --list
"""

import sys, os, json, time, subprocess, argparse, math
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, Tuple, List, Dict

# ═══════════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════════

ASEPRITE = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Aseprite\Aseprite.exe")
SCRIPTS_DIR = Path(__file__).resolve().parent / "scripts" / "aseprite"
OUTPUT_BASE = Path(__file__).resolve().parent / "forge-output" / "aseprite"

# ═══════════════════════════════════════════════════════════════
#  COLOR PALETTE  (dungeon-themed, earthy tones)
# ═══════════════════════════════════════════════════════════════

PALETTE = [
    (0,0,0),          # 0  — outline/black
    (29,43,83),       # 1  — dark blue
    (126,37,83),      # 2  — dark purple
    (0,135,81),       # 3  — dark green
    (120,70,30),      # 4  — brown
    (70,60,50),       # 5  — dark earthy brown
    (150,130,110),    # 6  — light brown / leather
    (240,230,220),    # 7  — off-white / skin light
    (180,50,50),      # 8  — dark red
    (220,140,50),     # 9  — orange / gold
    (240,220,50),     # 10 — yellow
    (50,180,50),      # 11 — green
    (60,150,200),     # 12 — blue
    (130,110,150),    # 13 — purple
    (220,120,160),    # 14 — pink
    (240,200,160),    # 15 — peach / skin
    (50,50,60),       # 16 — dark stone
    (100,90,80),      # 17 — stone gray
    (170,160,150),    # 18 — light stone
    (40,30,20),       # 19 — very dark brown
    (200,180,50),     # 20 — gold highlight
    (100,180,80),     # 21 — grass green
    (80,40,0),        # 22 — dark wood
    (180,140,100),    # 23 — wood
    (30,30,30),       # 24 — dark shadow
]

# ═══════════════════════════════════════════════════════════════
#  CHARACTER DEFINITIONS
# ═══════════════════════════════════════════════════════════════

@dataclass 
class CharDef:
    name: str
    width: int
    height: int
    colors: Dict[str, int]  # color_name -> palette_index
    parts: List[dict]  # list of {type, x, y, w, h, color}
    
    def part(self, part_type, x, y, w, h, color_name):
        return {"type": part_type, "x": x, "y": y, "w": w, "h": h, "color": self.colors.get(color_name, 0)}

# Color name constants
O="outline"; S="skin"; H="hair"; B="beard"; T="shirt"; P="pants"
BT="boots"; HL="helmet"; BL="belt"; BK="buckle"; E="eyes"; N="nose"
AM="armor"; MT="metal"; RB="robe"; HT="hat"; WG="wings"; HA="halo"
PK="pumpkin"; ST="stem"; WD="wood"; SC="shield"; SW="sword"
SH="shadow"; HI="highlight"; CL="cloth"; FL="flesh"; BN="bone"

def make_dwarf(name="dwarf", gender="m"):
    c = {"outline":0, "skin":15, "hair":1, "beard":5, "shirt":9, "pants":1,
         "boots":22, "helmet":5, "belt":22, "buckle":20, "eyes":7, "nose":15,
         "shadow":24, "metal":17, "highlight":18, "mouth":0}
    return CharDef(name, 16, 28, c, [
        # Legs (rounded)
        {"type":"rect","x":5,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":9,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":4,"y":24,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":9,"y":24,"w":3,"h":3,"color":"boots"},
        # Torso (rounded top)
        {"type":"circle","x":8,"y":14,"r":5,"color":"shirt"},
        {"type":"rect","x":4,"y":12,"w":8,"h":6,"color":"shirt"},
        # Belt
        {"type":"rect","x":4,"y":17,"w":8,"h":2,"color":"belt"},
        {"type":"rect","x":7,"y":17,"w":2,"h":2,"color":"buckle"},
        # Arms with rounded shoulders
        {"type":"circle","x":3,"y":13,"r":2,"color":"shirt"},
        {"type":"circle","x":13,"y":13,"r":2,"color":"shirt"},
        {"type":"rect","x":2,"y":13,"w":2,"h":7,"color":"shirt"},
        {"type":"rect","x":12,"y":13,"w":2,"h":7,"color":"shirt"},
        {"type":"rect","x":2,"y":18,"w":2,"h":2,"color":"skin"},
        {"type":"rect","x":12,"y":18,"w":2,"h":2,"color":"skin"},
        # Head (circle!)
        {"type":"circle","x":8,"y":4,"r":4,"color":"skin"},
        # Helmet (rounded top)
        {"type":"circle","x":8,"y":2,"r":5,"color":"helmet"},
        {"type":"rect","x":4,"y":3,"w":8,"h":2,"color":"helmet"},
        # Bushy eyebrows
        {"type":"hline","x":4,"y":3,"len":3,"color":"beard"},
        {"type":"hline","x":9,"y":3,"len":3,"color":"beard"},
        # Eyes (expressive — two-pixel with highlight)
        {"type":"pix","x":5,"y":4,"pix":[(0,0,"eyes")]},
        {"type":"pix","x":10,"y":4,"pix":[(0,0,"eyes")]},
        {"type":"pix","x":5,"y":4,"pix":[(-1,0,"outline")]},
        {"type":"pix","x":10,"y":4,"pix":[(-1,0,"outline")]},
        # Nose (big dwarf nose!)
        {"type":"circle","x":8,"y":6,"r":2,"color":"nose"},
        # Beard (flowing, curved bottom)
        {"type":"rect","x":5,"y":7,"w":6,"h":3,"color":"beard"},
        {"type":"circle","x":6,"y":9,"r":2,"color":"beard"},
        {"type":"circle","x":10,"y":9,"r":2,"color":"beard"},
        {"type":"rect","x":6,"y":9,"w":4,"h":3,"color":"beard"},
        # Mouth hidden in beard
        {"type":"hline","x":6,"y":7,"len":3,"color":"mouth"},
        # Helmet horns
        {"type":"pix","x":4,"y":0,"pix":[(0,-1,"helmet")]},
        {"type":"pix","x":12,"y":0,"pix":[(0,-1,"helmet")]},
        # Shadow under helmet
        {"type":"rect","x":5,"y":5,"w":6,"h":1,"color":"shadow"},
    ])

def make_elf(name="elf", gender="m"):
    c = {"outline":0, "skin":15, "hair":9, "shirt":12, "pants":3, "boots":22,
         "belt":22, "buckle":20, "eyes":7, "nose":15, "ears":15, "metal":17,
         "shadow":24}
    return CharDef(name, 16, 28, c, [
        {"type":"rect","x":5,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":9,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":4,"y":24,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":9,"y":24,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":4,"y":10,"w":8,"h":9,"color":"shirt"},
        {"type":"rect","x":4,"y":16,"w":8,"h":2,"color":"belt"},
        {"type":"rect","x":7,"y":16,"w":2,"h":2,"color":"buckle"},
        {"type":"rect","x":2,"y":10,"w":2,"h":8,"color":"shirt"},
        {"type":"rect","x":12,"y":10,"w":2,"h":8,"color":"shirt"},
        {"type":"rect","x":2,"y":16,"w":2,"h":3,"color":"skin"},
        {"type":"rect","x":12,"y":16,"w":2,"h":3,"color":"skin"},
        {"type":"rect","x":4,"y":1,"w":8,"h":8,"color":"skin"},
        # Hair (long flowing)
        {"type":"rect","x":3,"y":0,"w":10,"h":4,"color":"hair"},
        {"type":"rect","x":4,"y":1,"w":2,"h":6,"color":"hair"},
        {"type":"rect","x":10,"y":1,"w":2,"h":6,"color":"hair"},
        # Pointed ears
        {"type":"pix","x":3,"y":3,"pix":[(-1,0,"ears"),(-1,1,"ears")]},
        {"type":"pix","x":12,"y":3,"pix":[(1,0,"ears"),(1,1,"ears")]},
        {"type":"pix","x":5,"y":4,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":4,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":5,"y":4,"pix":[(0,0,"outline")]},
        {"type":"pix","x":10,"y":4,"pix":[(0,0,"outline")]},
        {"type":"pix","x":7,"y":6,"pix":[(0,0,"nose")]},
    ])

def make_wizard(name="wizard", gender="m"):
    c = {"outline":0, "skin":15, "hair":7, "beard":7, "robe":13, "hat":13,
         "belt":22, "buckle":20, "eyes":7, "nose":15, "boots":22, "shadow":24}
    return CharDef(name, 16, 28, c, [
        {"type":"rect","x":5,"y":20,"w":2,"h":4,"color":"robe"},
        {"type":"rect","x":9,"y":20,"w":2,"h":4,"color":"robe"},
        {"type":"rect","x":4,"y":23,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":9,"y":23,"w":3,"h":3,"color":"boots"},
        # Robe (wide)
        {"type":"rect","x":3,"y":10,"w":10,"h":11,"color":"robe"},
        {"type":"rect","x":4,"y":17,"w":8,"h":2,"color":"hat"},  # belt region
        {"type":"rect","x":2,"y":10,"w":2,"h":8,"color":"robe"},
        {"type":"rect","x":12,"y":10,"w":2,"h":8,"color":"robe"},
        {"type":"rect","x":4,"y":1,"w":8,"h":8,"color":"skin"},
        # Pointed hat
        {"type":"rect","x":3,"y":-2,"w":10,"h":4,"color":"hat"},
        {"type":"pix","x":4,"y":-3,"pix":[(2,-1,"hat"),(3,-2,"hat")]},
        {"type":"rect","x":3,"y":0,"w":10,"h":3,"color":"hat"},
        {"type":"pix","x":5,"y":4,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":4,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":5,"y":4,"pix":[(0,0,"outline")]},
        {"type":"pix","x":10,"y":4,"pix":[(0,0,"outline")]},
        {"type":"pix","x":7,"y":6,"pix":[(0,0,"nose")]},
        # Long beard
        {"type":"rect","x":5,"y":9,"w":6,"h":8,"color":"beard"},
    ])

def make_orc(name="orc"):
    c = {"outline":0, "skin":21, "hair":5, "shirt":8, "pants":22, "boots":22,
         "belt":22, "buckle":20, "eyes":8, "nose":21, "teeth":7, "shadow":24,
         "metal":17}
    return CharDef(name, 16, 28, c, [
        {"type":"rect","x":5,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":9,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":4,"y":24,"w":4,"h":3,"color":"boots"},
        {"type":"rect","x":8,"y":24,"w":4,"h":3,"color":"boots"},
        # Big torso
        {"type":"rect","x":3,"y":10,"w":10,"h":9,"color":"shirt"},
        {"type":"rect","x":3,"y":17,"w":10,"h":2,"color":"belt"},
        {"type":"rect","x":7,"y":17,"w":2,"h":2,"color":"buckle"},
        # Thick arms
        {"type":"rect","x":1,"y":10,"w":3,"h":8,"color":"shirt"},
        {"type":"rect","x":12,"y":10,"w":3,"h":8,"color":"shirt"},
        {"type":"rect","x":1,"y":16,"w":3,"h":3,"color":"skin"},
        {"type":"rect","x":12,"y":16,"w":3,"h":3,"color":"skin"},
        # Big head
        {"type":"rect","x":3,"y":0,"w":10,"h":9,"color":"skin"},
        # Mohawk
        {"type":"rect","x":5,"y":-2,"w":6,"h":3,"color":"hair"},
        {"type":"pix","x":6,"y":-3,"pix":[(2,0,"hair")]},
        # Eyes (red/angry)
        {"type":"pix","x":5,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":5,"y":3,"pix":[(1,0,"outline")]},
        {"type":"pix","x":9,"y":3,"pix":[(1,0,"outline")]},
        {"type":"pix","x":7,"y":5,"pix":[(0,0,"nose"),(1,0,"nose")]},
        # Tusks
        {"type":"pix","x":5,"y":8,"pix":[(0,0,"teeth"),(1,0,"teeth")]},
        {"type":"pix","x":10,"y":8,"pix":[(0,0,"teeth"),(-1,0,"teeth")]},
    ])

def make_knight(name="knight"):
    c = {"outline":0, "skin":15, "armor":17, "helmet":16, "metal":18, 
         "pants":16, "boots":19, "cloth":8, "eyes":7, "shadow":24, "shield":8}
    return CharDef(name, 16, 28, c, [
        {"type":"rect","x":5,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":9,"y":19,"w":2,"h":5,"color":"pants"},
        {"type":"rect","x":4,"y":23,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":9,"y":23,"w":3,"h":3,"color":"boots"},
        # Full armor
        {"type":"rect","x":3,"y":10,"w":10,"h":10,"color":"armor"},
        {"type":"rect","x":4,"y":16,"w":8,"h":2,"color":"metal"},  # belt
        {"type":"rect","x":7,"y":16,"w":2,"h":2,"color":"shadow"},
        # Shoulder pads
        {"type":"rect","x":2,"y":9,"w":3,"h":3,"color":"metal"},
        {"type":"rect","x":11,"y":9,"w":3,"h":3,"color":"metal"},
        {"type":"rect","x":2,"y":12,"w":2,"h":6,"color":"armor"},
        {"type":"rect","x":12,"y":12,"w":2,"h":6,"color":"armor"},
        # Helmet (full)
        {"type":"rect","x":3,"y":0,"w":10,"h":9,"color":"helmet"},
        {"type":"rect","x":4,"y":3,"w":8,"h":2,"color":"metal"},  # visor
        # Plume
        {"type":"pix","x":7,"y":-1,"pix":[(0,-2,"cloth"),(0,-1,"cloth"),(-1,-1,"cloth"),(1,-1,"cloth")]},
        # Eyes through visor
        {"type":"pix","x":6,"y":4,"pix":[(0,0,"eyes")]},
        {"type":"pix","x":9,"y":4,"pix":[(0,0,"eyes")]},
    ])

def make_angel(name="angel"):
    c = {"outline":0, "skin":15, "hair":10, "robe":7, "wings":14, "halo":10,
         "eyes":7, "shadow":24}
    return CharDef(name, 16, 22, c, [
        # Wings
        {"type":"pix","x":0,"y":4,"pix":[(0,0,"wings"),(1,0,"wings"),(2,0,"wings"),
                    (0,1,"wings"),(1,1,"wings"),(2,1,"wings"),
                    (0,2,"wings"),(1,2,"wings")]},
        {"type":"pix","x":13,"y":4,"pix":[(0,0,"wings"),(1,0,"wings"),(2,0,"wings"),
                    (1,1,"wings"),(2,1,"wings"),(3,1,"wings"),
                    (1,2,"wings"),(2,2,"wings")]},
        # Body
        {"type":"rect","x":4,"y":9,"w":8,"h":9,"color":"robe"},
        {"type":"rect","x":2,"y":9,"w":2,"h":7,"color":"robe"},
        {"type":"rect","x":12,"y":9,"w":2,"h":7,"color":"robe"},
        # Head
        {"type":"rect","x":4,"y":1,"w":8,"h":7,"color":"skin"},
        {"type":"rect","x":3,"y":0,"w":10,"h":3,"color":"hair"},
        # Halo
        {"type":"pix","x":4,"y":-1,"pix":[(1,-1,"halo"),(2,-1,"halo"),
                    (0,0,"halo"),(5,0,"halo"),(1,1,"halo"),(2,1,"halo")]},
        {"type":"pix","x":5,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":5,"y":3,"pix":[(0,0,"outline")]},
        {"type":"pix","x":10,"y":3,"pix":[(0,0,"outline")]},
    ])

def make_pumpkin(name="pumpkin"):
    c = {"outline":0, "skin":15, "shirt":22, "pants":22, "boots":19,
         "belt":5, "buckle":20, "pumpkin":9, "stem":3, "eyes":10,
         "shadow":24}
    return CharDef(name, 16, 22, c, [
        {"type":"rect","x":5,"y":14,"w":2,"h":4,"color":"pants"},
        {"type":"rect","x":9,"y":14,"w":2,"h":4,"color":"pants"},
        {"type":"rect","x":4,"y":18,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":9,"y":18,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":4,"y":8,"w":8,"h":7,"color":"shirt"},
        {"type":"rect","x":4,"y":13,"w":8,"h":2,"color":"belt"},
        {"type":"rect","x":7,"y":13,"w":2,"h":2,"color":"buckle"},
        {"type":"rect","x":2,"y":8,"w":2,"h":6,"color":"shirt"},
        {"type":"rect","x":12,"y":8,"w":2,"h":6,"color":"shirt"},
        # Pumpkin head
        {"type":"rect","x":3,"y":-2,"w":10,"h":9,"color":"pumpkin"},
        {"type":"rect","x":6,"y":-4,"w":4,"h":3,"color":"stem"},
        # Jack-o-lantern face
        {"type":"pix","x":5,"y":2,"pix":[(0,0,"eyes"),(1,0,"eyes"),(0,1,"eyes")]},
        {"type":"pix","x":9,"y":2,"pix":[(0,0,"eyes"),(1,0,"eyes"),(0,1,"eyes")]},
        {"type":"pix","x":5,"y":5,"pix":[(1,0,"eyes"),(2,0,"eyes"),(3,0,"eyes"),(0,1,"eyes"),(4,1,"eyes")]},
    ])

def make_skeleton(name="skelet"):
    c = {"outline":0, "bone":7, "eyes":8, "shadow":24}
    return CharDef(name, 16, 16, c, [
        # Leg bones
        {"type":"rect","x":5,"y":11,"w":2,"h":5,"color":"bone"},
        {"type":"rect","x":9,"y":11,"w":2,"h":5,"color":"bone"},
        {"type":"rect","x":4,"y":14,"w":3,"h":2,"color":"bone"},
        {"type":"rect","x":9,"y":14,"w":3,"h":2,"color":"bone"},
        # Ribcage
        {"type":"rect","x":4,"y":7,"w":8,"h":5,"color":"bone"},
        {"type":"pix","x":5,"y":8,"pix":[(0,0,"shadow"),(2,0,"shadow"),(4,0,"shadow")]},
        {"type":"pix","x":5,"y":10,"pix":[(0,0,"shadow"),(2,0,"shadow"),(4,0,"shadow")]},
        # Arm bones
        {"type":"rect","x":2,"y":8,"w":2,"h":5,"color":"bone"},
        {"type":"rect","x":12,"y":8,"w":2,"h":5,"color":"bone"},
        {"type":"rect","x":2,"y":11,"w":2,"h":2,"color":"bone"},
        {"type":"rect","x":12,"y":11,"w":2,"h":2,"color":"bone"},
        # Skull
        {"type":"rect","x":4,"y":0,"w":8,"h":7,"color":"bone"},
        # Eye sockets
        {"type":"pix","x":5,"y":2,"pix":[(0,0,"outline"),(1,0,"outline"),(0,1,"outline"),(1,1,"outline")]},
        {"type":"pix","x":9,"y":2,"pix":[(0,0,"outline"),(1,0,"outline"),(0,1,"outline"),(1,1,"outline")]},
        {"type":"pix","x":6,"y":1,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":1,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        # Teeth
        {"type":"rect","x":6,"y":5,"w":4,"h":2,"color":"bone"},
        {"type":"pix","x":6,"y":5,"pix":[(0,0,"outline"),(2,0,"outline"),(0,1,"outline"),(2,1,"outline")]},
    ])

def make_goblin(name="goblin"):
    c = {"outline":0, "skin":11, "shirt":22, "pants":22, "boots":19,
         "belt":5, "eyes":8, "nose":11, "ears":11, "shadow":24}
    return CharDef(name, 16, 16, c, [
        {"type":"rect","x":5,"y":10,"w":2,"h":4,"color":"pants"},
        {"type":"rect","x":9,"y":10,"w":2,"h":4,"color":"pants"},
        {"type":"rect","x":4,"y":14,"w":3,"h":2,"color":"boots"},
        {"type":"rect","x":9,"y":14,"w":3,"h":2,"color":"boots"},
        {"type":"rect","x":4,"y":6,"w":8,"h":5,"color":"shirt"},
        {"type":"rect","x":4,"y":10,"w":8,"h":1,"color":"belt"},
        {"type":"rect","x":2,"y":6,"w":2,"h":5,"color":"shirt"},
        {"type":"rect","x":12,"y":6,"w":2,"h":5,"color":"shirt"},
        {"type":"rect","x":2,"y":10,"w":2,"h":2,"color":"skin"},
        {"type":"rect","x":12,"y":10,"w":2,"h":2,"color":"skin"},
        {"type":"rect","x":4,"y":0,"w":8,"h":6,"color":"skin"},
        # Pointy ears
        {"type":"pix","x":3,"y":1,"pix":[(-1,-1,"ears"),(-1,0,"ears")]},
        {"type":"pix","x":12,"y":1,"pix":[(1,-1,"ears"),(1,0,"ears")]},
        # Eyes
        {"type":"pix","x":5,"y":2,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":2,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":5,"y":2,"pix":[(0,0,"outline")]},
        {"type":"pix","x":10,"y":2,"pix":[(0,0,"outline")]},
    ])

def make_imp(name="imp"):
    c = {"outline":0, "skin":8, "horns":2, "wings":1, "eyes":10, "shadow":24, "tail":8}
    return CharDef(name, 16, 16, c, [
        # Wings
        {"type":"pix","x":0,"y":3,"pix":[(0,0,"wings"),(1,0,"wings"),(0,1,"wings"),(1,1,"wings")]},
        {"type":"pix","x":13,"y":3,"pix":[(1,0,"wings"),(2,0,"wings"),(1,1,"wings"),(2,1,"wings")]},
        # Tail
        {"type":"pix","x":8,"y":14,"pix":[(2,0,"tail"),(1,1,"tail"),(0,2,"tail")]},
        # Legs
        {"type":"rect","x":5,"y":9,"w":2,"h":5,"color":"skin"},
        {"type":"rect","x":9,"y":9,"w":2,"h":5,"color":"skin"},
        {"type":"rect","x":4,"y":14,"w":3,"h":1,"color":"shadow"},
        {"type":"rect","x":9,"y":14,"w":3,"h":1,"color":"shadow"},
        # Body
        {"type":"rect","x":4,"y":5,"w":8,"h":5,"color":"skin"},
        {"type":"rect","x":2,"y":5,"w":2,"h":5,"color":"skin"},
        {"type":"rect","x":12,"y":5,"w":2,"h":5,"color":"skin"},
        # Head
        {"type":"rect","x":4,"y":0,"w":8,"h":5,"color":"skin"},
        # Horns
        {"type":"pix","x":5,"y":-1,"pix":[(-1,-1,"horns"),(-1,-2,"horns")]},
        {"type":"pix","x":10,"y":-1,"pix":[(1,-1,"horns"),(1,-2,"horns")]},
        # Eyes
        {"type":"pix","x":5,"y":2,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":2,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
    ])

def make_demon(name="big_demon"):
    c = {"outline":0, "skin":8, "horns":2, "wings":1, "eyes":10, "shadow":24,
         "muscle":14, "claws":7}
    return CharDef(name, 32, 36, c, [
        # Wings (big)
        {"type":"rect","x":0,"y":6,"w":6,"h":16,"color":"wings"},
        {"type":"rect","x":26,"y":6,"w":6,"h":16,"color":"wings"},
        # Legs
        {"type":"rect","x":8,"y":22,"w":4,"h":10,"color":"skin"},
        {"type":"rect","x":20,"y":22,"w":4,"h":10,"color":"skin"},
        {"type":"rect","x":7,"y":32,"w":5,"h":4,"color":"shadow"},
        {"type":"rect","x":20,"y":32,"w":5,"h":4,"color":"shadow"},
        # Body (muscular)
        {"type":"rect","x":6,"y":10,"w":20,"h":14,"color":"skin"},
        {"type":"pix","x":8,"y":11,"pix":[(0,0,"muscle"),(2,0,"muscle"),(4,0,"muscle")]},
        {"type":"pix","x":8,"y":13,"pix":[(0,0,"muscle"),(2,0,"muscle"),(4,0,"muscle")]},
        # Arms (thick)
        {"type":"rect","x":0,"y":10,"w":6,"h":14,"color":"skin"},
        {"type":"rect","x":26,"y":10,"w":6,"h":14,"color":"skin"},
        {"type":"rect","x":0,"y":22,"w":6,"h":3,"color":"claws"},
        {"type":"rect","x":26,"y":22,"w":6,"h":3,"color":"claws"},
        # Head (big)
        {"type":"rect","x":10,"y":0,"w":12,"h":11,"color":"skin"},
        # Horns (big)
        {"type":"rect","x":12,"y":-3,"w":3,"h":4,"color":"horns"},
        {"type":"rect","x":17,"y":-3,"w":3,"h":4,"color":"horns"},
        # Eyes (angry red)
        {"type":"pix","x":13,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes"),(2,0,"eyes")]},
        {"type":"pix","x":18,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes"),(2,0,"eyes")]},
        # Teeth/mouth
        {"type":"rect","x":13,"y":7,"w":6,"h":3,"color":"claws"},
        {"type":"pix","x":14,"y":8,"pix":[(0,0,"outline"),(2,0,"outline"),(4,0,"outline")]},
    ])

def make_ogre(name="ogre"):
    c = {"outline":0, "skin":21, "shirt":22, "pants":19, "boots":5,
         "belt":22, "eyes":8, "nose":21, "shadow":24, "club":23}
    return CharDef(name, 32, 36, c, [
        # Legs (thick)
        {"type":"rect","x":8,"y":22,"w":5,"h":10,"color":"pants"},
        {"type":"rect","x":19,"y":22,"w":5,"h":10,"color":"pants"},
        {"type":"rect","x":7,"y":32,"w":6,"h":4,"color":"boots"},
        {"type":"rect","x":19,"y":32,"w":6,"h":4,"color":"boots"},
        # Body (huge)
        {"type":"rect","x":5,"y":10,"w":22,"h":14,"color":"shirt"},
        {"type":"rect","x":5,"y":17,"w":22,"h":2,"color":"belt"},
        # Arms (thick + club)
        {"type":"rect","x":0,"y":10,"w":5,"h":14,"color":"shirt"},
        {"type":"rect","x":27,"y":10,"w":5,"h":14,"color":"shirt"},
        {"type":"rect","x":0,"y":22,"w":5,"h":3,"color":"skin"},
        # Club in right hand
        {"type":"rect","x":28,"y":22,"w":4,"h":10,"color":"club"},
        {"type":"pix","x":28,"y":20,"pix":[(3,-1,"club"),(2,-2,"club")]},
        # Head (big + ugly)
        {"type":"rect","x":8,"y":-4,"w":16,"h":14,"color":"skin"},
        # Eyes (small + spaced)
        {"type":"pix","x":10,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":18,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":10,"y":4,"pix":[(0,0,"outline")]},
        {"type":"pix","x":19,"y":4,"pix":[(0,0,"outline")]},
        # Nose
        {"type":"rect","x":14,"y":5,"w":4,"h":3,"color":"nose"},
        # Mouth
        {"type":"pix","x":13,"y":9,"pix":[(0,0,"outline"),(1,0,"outline"),(2,0,"outline"),
                                              (-1,1,"outline"),(3,1,"outline")]},
        # Teeth
        {"type":"pix","x":14,"y":10,"pix":[(0,0,"skin"),(1,0,"skin")]},
    ])

def make_zombie(name="big_zombie"):
    c = {"outline":0, "skin":11, "shirt":3, "pants":22, "boots":5,
         "eyes":8, "shadow":24, "bone":7, "teeth":7}
    return CharDef(name, 32, 36, c, [
        {"type":"rect","x":8,"y":24,"w":4,"h":8,"color":"pants"},
        {"type":"rect","x":20,"y":24,"w":4,"h":8,"color":"pants"},
        {"type":"rect","x":7,"y":32,"w":5,"h":4,"color":"boots"},
        {"type":"rect","x":20,"y":32,"w":5,"h":4,"color":"boots"},
        # Tattered shirt
        {"type":"rect","x":6,"y":12,"w":20,"h":14,"color":"shirt"},
        {"type":"pix","x":7,"y":13,"pix":[(0,0,"skin"),(3,0,"skin"),(6,0,"skin")]},
        {"type":"pix","x":7,"y":16,"pix":[(0,0,"skin"),(5,0,"skin")]},
        {"type":"pix","x":7,"y":19,"pix":[(0,0,"skin"),(2,0,"skin"),(7,0,"skin")]},
        # Arms (one hanging)
        {"type":"rect","x":1,"y":12,"w":5,"h":14,"color":"shirt"},
        {"type":"rect","x":26,"y":12,"w":5,"h":14,"color":"shirt"},
        {"type":"rect","x":1,"y":24,"w":5,"h":3,"color":"bone"},
        {"type":"rect","x":26,"y":24,"w":5,"h":3,"color":"skin"},
        # Head (rotting)
        {"type":"rect","x":10,"y":0,"w":12,"h":12,"color":"skin"},
        # One eye missing (skull showing)
        {"type":"pix","x":13,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes"),(2,0,"eyes")]},
        {"type":"pix","x":19,"y":3,"pix":[(0,0,"bone"),(1,0,"bone")]},
        {"type":"pix","x":19,"y":3,"pix":[(0,0,"outline"),(1,0,"outline")]},
        # Teeth showing
        {"type":"pix","x":14,"y":8,"pix":[(0,0,"teeth"),(1,0,"teeth"),(2,0,"teeth"),(3,0,"teeth")]},
        # Scars
        {"type":"pix","x":11,"y":5,"pix":[(0,0,"shadow"),(1,0,"shadow")]},
        {"type":"pix","x":21,"y":6,"pix":[(0,0,"shadow")]},
    ])

def make_lizard(name="lizard_m"):
    c = {"outline":0, "skin":3, "shirt":9, "pants":22, "boots":19,
         "belt":5, "eyes":10, "tail":3, "scales":11, "shadow":24}
    return CharDef(name, 16, 28, c, [
        # Tail
        {"type":"rect","x":5,"y":25,"w":2,"h":3,"color":"tail"},
        {"type":"pix","x":5,"y":27,"pix":[(1,0,"tail"),(2,0,"tail")]},
        # Legs
        {"type":"rect","x":5,"y":19,"w":2,"h":6,"color":"pants"},
        {"type":"rect","x":9,"y":19,"w":2,"h":6,"color":"pants"},
        {"type":"rect","x":4,"y":24,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":9,"y":24,"w":3,"h":3,"color":"boots"},
        # Body
        {"type":"rect","x":4,"y":10,"w":8,"h":10,"color":"shirt"},
        {"type":"rect","x":4,"y":16,"w":8,"h":2,"color":"belt"},
        {"type":"rect","x":7,"y":16,"w":2,"h":2,"color":"shadow"},
        {"type":"rect","x":2,"y":10,"w":2,"h":8,"color":"shirt"},
        {"type":"rect","x":12,"y":10,"w":2,"h":8,"color":"shirt"},
        {"type":"rect","x":2,"y":16,"w":2,"h":3,"color":"skin"},
        {"type":"rect","x":12,"y":16,"w":2,"h":3,"color":"skin"},
        # Head (lizard snout)
        {"type":"rect","x":3,"y":1,"w":10,"h":9,"color":"skin"},
        {"type":"pix","x":13,"y":3,"pix":[(0,0,"skin"),(1,0,"skin"),(0,1,"skin")]},  # snout
        # Scales
        {"type":"pix","x":4,"y":2,"pix":[(0,0,"scales"),(2,0,"scales"),(4,0,"scales")]},
        {"type":"pix","x":4,"y":4,"pix":[(0,0,"scales"),(2,0,"scales")]},
        # Eyes (slitted)
        {"type":"pix","x":5,"y":4,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":10,"y":4,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
    ])

def make_chort(name="chort"):
    c = {"outline":0, "skin":2, "robe":1, "hood":1, "eyes":8, "shadow":24,
         "horns":2, "boots":22}
    return CharDef(name, 16, 23, c, [
        {"type":"rect","x":5,"y":16,"w":2,"h":5,"color":"robe"},
        {"type":"rect","x":9,"y":16,"w":2,"h":5,"color":"robe"},
        {"type":"rect","x":4,"y":20,"w":3,"h":3,"color":"boots"},
        {"type":"rect","x":9,"y":20,"w":3,"h":3,"color":"boots"},
        # Robe
        {"type":"rect","x":3,"y":8,"w":10,"h":9,"color":"robe"},
        {"type":"rect","x":2,"y":8,"w":2,"h":7,"color":"robe"},
        {"type":"rect","x":12,"y":8,"w":2,"h":7,"color":"robe"},
        # Head with hood
        {"type":"rect","x":5,"y":0,"w":6,"h":8,"color":"skin"},
        {"type":"rect","x":3,"y":0,"w":10,"h":4,"color":"hood"},
        # Small horns
        {"type":"pix","x":5,"y":-1,"pix":[(-1,-1,"horns")]},
        {"type":"pix","x":10,"y":-1,"pix":[(1,-1,"horns")]},
        # Eyes (glowing)
        {"type":"pix","x":6,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
    ])

def make_wogol(name="wogol"):
    c = {"outline":0, "skin":21, "fur":22, "eyes":8, "shadow":24, "claws":7}
    return CharDef(name, 16, 23, c, [
        # Legs
        {"type":"rect","x":5,"y":15,"w":2,"h":6,"color":"fur"},
        {"type":"rect","x":9,"y":15,"w":2,"h":6,"color":"fur"},
        {"type":"rect","x":4,"y":21,"w":3,"h":2,"color":"claws"},
        {"type":"rect","x":9,"y":21,"w":3,"h":2,"color":"claws"},
        # Hairy body
        {"type":"rect","x":3,"y":8,"w":10,"h":8,"color":"fur"},
        {"type":"rect","x":2,"y":8,"w":2,"h":6,"color":"fur"},
        {"type":"rect","x":12,"y":8,"w":2,"h":6,"color":"fur"},
        # Head (wolf-like)
        {"type":"rect","x":3,"y":0,"w":10,"h":8,"color":"fur"},
        # Snout
        {"type":"rect","x":5,"y":6,"w":6,"h":3,"color":"skin"},
        # Ears (pointed)
        {"type":"pix","x":3,"y":1,"pix":[(-1,-2,"fur"),(-1,-1,"fur")]},
        {"type":"pix","x":12,"y":1,"pix":[(1,-2,"fur"),(1,-1,"fur")]},
        # Eyes
        {"type":"pix","x":5,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        {"type":"pix","x":9,"y":3,"pix":[(0,0,"eyes"),(1,0,"eyes")]},
        # Teeth
        {"type":"pix","x":6,"y":9,"pix":[(0,0,"claws"),(1,0,"claws")]},
        # Fur texture
        {"type":"pix","x":4,"y":9,"pix":[(0,0,"shadow"),(3,0,"shadow"),(6,0,"shadow")]},
        {"type":"pix","x":4,"y":11,"pix":[(0,0,"shadow"),(2,0,"shadow"),(5,0,"shadow")]},
    ])

ALL_CHARACTERS = {
    "dwarf": make_dwarf("dwarf"),
    "elf": make_elf("elf"),
    "wizard": make_wizard("wizard"),
    "orc": make_orc("orc"),
    "knight": make_knight("knight"),
    "angel": make_angel("angel"),
    "pumpkin": make_pumpkin("pumpkin"),
    "skeleton": make_skeleton("skelet"),
    "goblin": make_goblin("goblin"),
    "imp": make_imp("imp"),
    "demon": make_demon("big_demon"),
    "ogre": make_ogre("ogre"),
    "zombie": make_zombie("big_zombie"),
    "lizard": make_lizard("lizard_m"),
    "chort": make_chort("chort"),
    "wogol": make_wogol("wogol"),
}


# ═══════════════════════════════════════════════════════════════
#  ASEPRITE LUA SCRIPT GENERATOR
# ═══════════════════════════════════════════════════════════════

def build_lua_script(char: CharDef, anim_type: str, frame: int,
                     output_dir: Path) -> str:
    """Build an Aseprite Lua script for one sprite frame."""
    
    # Animation offsets
    offset_x, offset_y = 0, 0
    if anim_type == "idle":
        offset_y = int(abs(math.sin(frame * math.pi / 2)) * 0.8)
    elif anim_type == "walk":
        offset_y = int(abs(math.sin(frame * math.pi / 2)) * 1.5)
    elif anim_type == "hit":
        offset_x = 1
        offset_y = -1
    
    w, h = char.width, char.height
    out_file = str(output_dir / f"{char.name}_{anim_type}_f{frame}.png").replace("\\", "/")
    
    lines = []
    lines.append(f"""-- Aseprite sprite: {char.name} {anim_type} frame {frame}
local w, h = {w}, {h}
local outDir = "{str(output_dir).replace(chr(92), '/')}"
local outFile = outDir .. "/{char.name}_{anim_type}_f{frame}.png"

local sprite = Sprite(w, h, ColorMode.INDEXED)
local pal = sprite.palettes[1]
""")

    # Set palette
    for i, (r, g, b) in enumerate(PALETTE):
        lines.append(f"pal:setColor({i}, Color{{ r={r}, g={g}, b={b} }})")

    lines.append("""
local cel = app.activeCel
local img = cel.image

function ps(x, y, c)
    if x >= 0 and x < w and y >= 0 and y < h then
        img:drawPixel(x, y, c)
    end
end

function fr(x, y, pw, ph, c)
    for py = y, y+ph-1 do
        for px = x, x+pw-1 do
            ps(px, py, c)
        end
    end
end

-- Draw a filled circle centered at (cx, cy) with radius r
function circle(cx, cy, r, c)
    for dy = -r, r do
        for dx = -r, r do
            if dx*dx + dy*dy <= r*r + r then
                ps(cx+dx, cy+dy, c)
            end
        end
    end
end

-- Draw a horizontal line
function hline(x, y, len, c)
    for px = x, x+len-1 do ps(px, y, c) end
end

-- Draw a vertical line  
function vline(x, y, len, c)
    for py = y, y+len-1 do ps(x, py, c) end
end

-- Shading: darken bottom portion of a colored pixel
function shadeBottom(x, y, darkC)
    local neighbors = {{x,y+1},{x,y-1},{x-1,y},{x+1,y}}
    local sameCount = 0
    for _,n in ipairs(neighbors) do
        if n[1]>=0 and n[1]<w and n[2]>=0 and n[2]<h then
            local nc = img:getPixel(n[1], n[2])
            if nc == img:getPixel(x,y) then sameCount = sameCount + 1 end
        end
    end
    if sameCount >= 3 and y >= h/2 then ps(x, y, darkC) end
end
""")

    # Set offsets
    lines.append(f"local ox, oy = {offset_x}, {offset_y}")
    
    # Draw each part
    for part in char.parts:
        pt = part["type"]
        px = part["x"] + offset_x
        py = part["y"] + offset_y
        color_name = part.get("color", "outline")
        color_idx = char.colors.get(color_name, 0)
        
        if pt == "rect":
            lines.append(f"fr({px}, {py}, {part['w']}, {part['h']}, {color_idx})")
        elif pt == "circle":
            lines.append(f"circle({px}, {py}, {part.get('r', 3)}, {color_idx})")
        elif pt == "hline":
            lines.append(f"hline({px}, {py}, {part.get('len', 4)}, {color_idx})")
        elif pt == "vline":
            lines.append(f"vline({px}, {py}, {part.get('len', 4)}, {color_idx})")
        elif pt == "pix":
            for dx, dy, cn in part.get("pix", []):
                ci = char.colors.get(cn, 0)
                lines.append(f"ps({px+dx}, {py+dy}, {ci})")
    
    # Outline pass
    lines.append("""
-- Outline: add black where colored meets transparent
local O = 0
for y = 0, h-1 do
    for x = 0, w-1 do
        local c = img:getPixel(x, y)
        if c >= 0 and c ~= O then
            local neighbors = {{x-1,y},{x+1,y},{x,y-1},{x,y+1}}
            for _,n in ipairs(neighbors) do
                local nx, ny = n[1], n[2]
                if nx >= 0 and nx < w and ny >= 0 and ny < h then
                    local nc = img:getPixel(nx, ny)
                    if nc < 0 or nc == 0 then
                        ps(nx, ny, O)
                    end
                end
            end
        end
    end
end
""")

    # Top-down lighting pass — highlights top, shadows bottom
    lines.append("""
-- Lighting: add highlight to top pixels and shadow to bottom pixels
local HL = 7   -- highlight color (white-ish)
local SH = 24  -- shadow color index
for y = 0, h-1 do
    for x = 0, w-1 do
        local c = img:getPixel(x, y)
        if c >= 0 and c ~= 0 then
            -- Top 20% gets a subtle highlight
            if y < h * 0.2 and c ~= 0 then
                local nc = img:getPixel(x, y+1)
                if nc == c then ps(x, y, HL) end
            end
            -- Bottom 25% gets shadow
            if y > h * 0.75 then
                local nc = img:getPixel(x, y-1)
                if nc == c or (x > 0 and img:getPixel(x-1,y) == c) then 
                    ps(x, y, SH) 
                end
            end
        end
    end
end
""")

    # Dithering pass — checkerboard pattern for texture
    lines.append("""
-- Dithering: checkerboard pattern for texture on large solid areas
local SH = 24  -- shadow color index
for y = 0, h-1 do
    for x = 0, w-1 do
        local c = img:getPixel(x, y)
        if c >= 0 and c ~= O then
            -- Checkerboard: every other pixel on every other row gets shadow
            if (x + y) % 3 == 0 then
                local neighborCount = 0
                for _,n in ipairs({{x-1,y},{x+1,y},{x,y-1},{x,y+1}}) do
                    local nx, ny = n[1], n[2]
                    if nx >= 0 and nx < w and ny >= 0 and ny < h then
                        local nc = img:getPixel(nx, ny)
                        if nc == c then neighborCount = neighborCount + 1 end
                    end
                end
                -- Only dither if pixel is surrounded by same color (inside a solid area)
                if neighborCount >= 3 and c ~= 0 then
                    -- Use a darker variant (offset by 3 in palette)
                    local dc = c
                    if c == 15 then dc = 5   -- skin → shadow brown
                    elseif c == 7 then dc = 24  -- white → dark shadow
                    elseif c == 9 then dc = 4   -- orange → brown
                    elseif c == 4 then dc = 19  -- brown → dark brown
                    elseif c == 17 then dc = 16 -- stone → dark stone
                    end
                    if dc ~= c then ps(x, y, dc) end
                end
            end
        end
    end
end
""")
    
    lines.append(f"""
sprite:saveAs(outFile)
print("OK " .. outFile)
app.exit()
""")
    
    return "\n".join(lines)


def generate_character(char: CharDef, output_dir: Path) -> list[Path]:
    """Generate all animation frames for a character via Aseprite."""
    generated = []
    
    for anim_type, n_frames in [("idle", 4), ("walk", 4), ("hit", 1)]:
        for frame in range(n_frames):
            lua_script = build_lua_script(char, anim_type, frame, output_dir)
            script_path = SCRIPTS_DIR / f"_gen_{char.name}_{anim_type}_f{frame}.lua"
            script_path.write_text(lua_script)
            
            result = subprocess.run(
                [str(ASEPRITE), "--batch", "--script", str(script_path)],
                capture_output=True, text=True, timeout=30
            )
            
            out_file = output_dir / f"{char.name}_{anim_type}_f{frame}.png"
            if out_file.exists():
                generated.append(out_file)
                print(f"  ✓ {out_file.name}")
            else:
                print(f"  ✗ {char.name} {anim_type}_f{frame}: {result.stderr.strip()[:100]}")
            
            # Clean up temp script
            script_path.unlink(missing_ok=True)
    
    return generated


def create_spritesheet(char_name: str, frames: list[Path], output_dir: Path):
    """Use Aseprite CLI to compile frames into a sprite sheet."""
    sheet_path = output_dir / f"{char_name}_spritesheet.png"
    
    if not frames or len(frames) < 1:
        return
    
    # Build Aseprite command: input all frames, output spritesheet
    cmd = [str(ASEPRITE), "--batch"]
    cmd.extend(str(f) for f in frames)
    cmd.extend(["--sheet-type", "columns", "--sheet-columns", "4", "--sheet", str(sheet_path)])
    
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30,
                           cwd=str(output_dir))
    
    if sheet_path.exists():
        print(f"  📋 Sprite sheet: {sheet_path.name}")
    else:
        # Fallback: try PIL
        try:
            from PIL import Image
            sample = Image.open(frames[0]).convert("RGBA")
            w, h = sample.size
            cols = min(4, len(frames))
            rows = (len(frames) + cols - 1) // cols
            sheet = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
            for i, fpath in enumerate(frames):
                img = Image.open(fpath).convert("RGBA")
                sheet.paste(img, ((i % cols) * w, (i // cols) * h))
            sheet.save(sheet_path)
            print(f"  📋 Sprite sheet (PIL): {sheet_path.name}")
        except Exception as e:
            print(f"  ⚠️ Spritesheet compile error: {e}")


# ═══════════════════════════════════════════════════════════════
#  TILE GENERATION
# ═══════════════════════════════════════════════════════════════

def generate_tile_lua(name: str, w: int, h: int, parts: list, output_dir: Path) -> str:
    """Build Lua script for a static tile/object."""
    out_file = str(output_dir / f"{name}.png").replace("\\", "/")

    lines = [f"""-- Aseprite tile: {name}
local sprite = Sprite({w}, {h}, ColorMode.INDEXED)
local pal = sprite.palettes[1]
"""]
    for i, (r, g, b) in enumerate(PALETTE):
        lines.append(f"pal:setColor({i}, Color{{ r={r}, g={g}, b={b} }})")

    lines.append("""
local cel = app.activeCel; local img = cel.image
function ps(x,y,c) if x>=0 and x<{w} and y>=0 and y<{h} then img:drawPixel(x,y,c) end end
function fr(x,y,pw,ph,c) for py=y,y+ph-1 do for px=x,x+pw-1 do ps(px,py,c) end end end
function cl(px,py) if px>=0 and px<{w} and py>=0 and py<{h} then return img:getPixel(px,py) end return -1 end

-- Shading pass: highlight top edges, shadow bottom edges
for y=0,{h}-1 do for x=0,{w}-1 do
    local c=img:getPixel(x,y)
    if c>0 then
        local above=cl(x,y-1); local below=cl(x,y+1)
        local top_edge=(above<0 or above==0) and not (below<0 or below==0)
        local bot_edge=(below<0 or below==0) and not (above<0 or above==0)
        if top_edge then
            -- Find a lighter color from palette
            for i=c+1,c+6 do if i<=24 then img:drawPixel(x,y,i) break end end
        elseif bot_edge then
            for i=c-1,c-6,-1 do if i>=1 then img:drawPixel(x,y,i) break end end
        end
    end
end end
""".format(w=w, h=h))

    # Build color map
    color_map = {
        "O":0,"ST":16,"LT":17,"HL":18,"DK":19,"MG":21,"GR":11,"RD":8,
        "GD":20,"WD":22,"WD2":23,"SK":7,"MT":17,"SH":24,"BD":8,"BL":12,
        "YL":10,"OR":9,"GN":3,"PL":14,"WH":7,"BK":0
    }
    for part in parts:
        pt = part.get("t", "rect")
        x, y, w_, h_ = part.get("x", 0), part.get("y", 0), part.get("w", 1), part.get("h", 1)
        clr = part.get("c", "ST")
        idx = color_map.get(clr, 0) if isinstance(clr, str) else clr
        if pt == "rect":
            lines.append(f"fr({x},{y},{w_},{h_},{idx})")
        elif pt == "pix":
            pdata = part.get("p", [])
            if not pdata:
                continue
            # Support both flat [dx, dy, color] and list-of-tuples [(dx,dy,color), ...]
            if isinstance(pdata[0], (list, tuple)):
                for entry in pdata:
                    if len(entry) >= 3:
                        dx, dy, cn = entry[0], entry[1], entry[2]
                        ci = color_map.get(cn, 0) if isinstance(cn, str) else cn
                        lines.append(f"ps({x+dx},{y+dy},{ci})")
            elif len(pdata) >= 3:
                dx, dy, cn = pdata[0], pdata[1], pdata[2]
                ci = color_map.get(cn, 0) if isinstance(cn, str) else cn
                lines.append(f"ps({x+dx},{y+dy},{ci})")

    lines.append("""-- Outline
for y=0,{h}-1 do for x=0,{w}-1 do
    local c=img:getPixel(x,y)
    if c>=0 and c~=0 then
        for _,n in ipairs({{{{x-1,y}},{{x+1,y}},{{x,y-1}},{{x,y+1}}}}) do
            local nx,ny=n[1],n[2]
            if nx>=0 and nx<{w} and ny>=0 and ny<{h} then
                if img:getPixel(nx,ny)<0 or img:getPixel(nx,ny)==0 then ps(nx,ny,0) end
            end
        end
    end
end end
""".format(w=w, h=h))
    lines.append(f'sprite:saveAs("{out_file}"); print("OK {out_file}"); app.exit()')
    return "\n".join(lines)



# ═══════════════════════════════════════════════════════════════
#  FURNITURE  (dungeon & RPG interior pieces)
# ═══════════════════════════════════════════════════════════════
FURNITURE = [
# ── Tables ──
("table_small", 32, 16, [
    {"t":"rect","x":0,"y":10,"w":32,"h":6,"c":"WD"},           # tabletop
    {"t":"rect","x":0,"y":9,"w":32,"h":2,"c":"WD2"},           # top edge highlight
    {"t":"rect","x":2,"y":5,"w":3,"h":6,"c":"WD"},             # left leg
    {"t":"rect","x":27,"y":5,"w":3,"h":6,"c":"WD"},            # right leg
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":15},{"p":[0,0,"SH"],"t":"pix","x":29,"y":15},
    {"p":[0,0,"LT"],"t":"pix","x":10,"y":10},{"p":[0,0,"LT"],"t":"pix","x":18,"y":10},
]),
("table_long", 48, 16, [
    {"t":"rect","x":0,"y":10,"w":48,"h":6,"c":"WD"},
    {"t":"rect","x":0,"y":9,"w":48,"h":2,"c":"WD2"},
    {"t":"rect","x":2,"y":5,"w":3,"h":6,"c":"WD"},
    {"t":"rect","x":22,"y":5,"w":3,"h":6,"c":"WD"},            # center leg
    {"t":"rect","x":43,"y":5,"w":3,"h":6,"c":"WD"},
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":15},{"p":[0,0,"SH"],"t":"pix","x":22,"y":15},{"p":[0,0,"SH"],"t":"pix","x":44,"y":15},
    {"p":[0,0,"LT"],"t":"pix","x":8,"y":10},{"p":[0,0,"LT"],"t":"pix","x":30,"y":10},
]),
("table_round", 24, 24, [
    {"t":"rect","x":4,"y":16,"w":16,"h":4,"c":"WD"},           # oval top
    {"t":"rect","x":2,"y":18,"w":20,"h":2,"c":"WD2"},
    {"t":"rect","x":5,"y":14,"w":14,"h":4,"c":"WD"},
    {"t":"rect","x":8,"y":8,"w":4,"h":8,"c":"WD"},             # pedestal
    {"t":"rect","x":6,"y":20,"w":12,"h":2,"c":"SH"},
    {"p":[0,0,"LT"],"t":"pix","x":9,"y":16},{"p":[0,0,"LT"],"t":"pix","x":13,"y":16},
    {"p":[0,0,"SH"],"t":"pix","x":10,"y":21},
]),

# ── Chairs & Seating ──
("chair_wood", 12, 16, [
    {"t":"rect","x":2,"y":4,"w":8,"h":4,"c":"WD"},             # seat
    {"t":"rect","x":1,"y":3,"w":10,"h":2,"c":"WD2"},
    {"t":"rect","x":1,"y":0,"w":2,"h":14,"c":"WD"},            # back left
    {"t":"rect","x":9,"y":0,"w":2,"h":14,"c":"WD"},            # back right
    {"t":"rect","x":2,"y":8,"w":2,"h":8,"c":"WD"},             # front left leg
    {"t":"rect","x":8,"y":8,"w":2,"h":8,"c":"WD"},             # front right leg
    {"t":"rect","x":1,"y":4,"w":10,"h":1,"c":"SH"},            # seat shadow
    {"p":[0,0,"SH"],"t":"pix","x":3,"y":15},{"p":[0,0,"SH"],"t":"pix","x":9,"y":15},
]),
("chair_stool", 8, 10, [
    {"t":"rect","x":1,"y":2,"w":6,"h":3,"c":"WD"},
    {"t":"rect","x":1,"y":1,"w":6,"h":1,"c":"WD2"},
    {"t":"rect","x":1,"y":5,"w":2,"h":5,"c":"WD"},
    {"t":"rect","x":5,"y":5,"w":2,"h":5,"c":"WD"},
    {"t":"rect","x":1,"y":4,"w":6,"h":1,"c":"SH"},
]),
("throne", 16, 24, [
    {"t":"rect","x":2,"y":8,"w":12,"h":4,"c":"WD"},            # seat
    {"t":"rect","x":1,"y":7,"w":14,"h":2,"c":"WD2"},
    {"t":"rect","x":0,"y":0,"w":3,"h":20,"c":"WD"},            # left pillar
    {"t":"rect","x":13,"y":0,"w":3,"h":20,"c":"WD"},           # right pillar
    {"t":"rect","x":2,"y":12,"w":3,"h":12,"c":"WD"},           # left leg
    {"t":"rect","x":11,"y":12,"w":3,"h":12,"c":"WD"},          # right leg
    {"t":"rect","x":3,"y":0,"w":10,"h":4,"c":"LT"},            # top crown
    {"p":[0,0,"GD"],"t":"pix","x":7,"y":1},                     # gem on crown
    {"p":[0,0,"RD"],"t":"pix","x":6,"y":10},                    # cushion highlight
    {"p":[0,0,"SH"],"t":"pix","x":1,"y":4},{"p":[0,0,"SH"],"t":"pix","x":14,"y":4},
    {"p":[0,0,"DK"],"t":"pix","x":1,"y":23},{"p":[0,0,"DK"],"t":"pix","x":14,"y":23},
]),
("bench", 32, 12, [
    {"t":"rect","x":1,"y":4,"w":30,"h":4,"c":"WD"},
    {"t":"rect","x":1,"y":3,"w":30,"h":1,"c":"WD2"},
    {"t":"rect","x":2,"y":7,"w":3,"h":5,"c":"WD"},             # left leg
    {"t":"rect","x":14,"y":7,"w":4,"h":5,"c":"WD"},            # center leg
    {"t":"rect","x":27,"y":7,"w":3,"h":5,"c":"WD"},            # right leg
    {"p":[0,0,"SH"],"t":"pix","x":1,"y":8},{"p":[0,0,"SH"],"t":"pix","x":15,"y":8},{"p":[0,0,"SH"],"t":"pix","x":28,"y":8},
]),

# ── Beds ──
("bed_single", 32, 24, [
    {"t":"rect","x":0,"y":18,"w":32,"h":6,"c":"WD"},           # base frame
    {"t":"rect","x":1,"y":6,"w":30,"h":13,"c":"LT"},           # mattress
    {"t":"rect","x":1,"y":14,"w":30,"h":5,"c":"ST"},           # sheet
    {"t":"rect","x":0,"y":0,"w":4,"h":14,"c":"WD"},            # headboard
    {"t":"rect","x":28,"y":0,"w":4,"h":8,"c":"WD"},            # footboard
    {"t":"rect","x":2,"y":0,"w":28,"h":2,"c":"WD"},            # top rail
    {"t":"rect","x":1,"y":2,"w":2,"h":12,"c":"WD"},            # headboard post left
    {"t":"rect","x":29,"y":2,"w":2,"h":6,"c":"WD"},            # footboard post right
    {"t":"rect","x":0,"y":23,"w":32,"h":1,"c":"SH"},
    {"p":[0,0,"WH"],"t":"pix","x":14,"y":10},{"p":[0,0,"WH"],"t":"pix","x":16,"y":10},  # pillow
    {"p":[0,0,"SH"],"t":"pix","x":3,"y":2},{"p":[0,0,"SH"],"t":"pix","x":29,"y":2},
]),

# ── Storage ──
("bookshelf", 24, 32, [
    {"t":"rect","x":0,"y":0,"w":24,"h":32,"c":"WD"},           # frame
    {"t":"rect","x":1,"y":1,"w":22,"h":30,"c":"WD2"},          # interior
    {"t":"rect","x":1,"y":9,"w":22,"h":2,"c":"WD"},            # shelf 1
    {"t":"rect","x":1,"y":18,"w":22,"h":2,"c":"WD"},           # shelf 2
    {"t":"rect","x":1,"y":27,"w":22,"h":2,"c":"WD"},           # shelf 3
    # Books row 1
    {"t":"rect","x":3,"y":2,"w":3,"h":7,"c":"RD"},{"t":"rect","x":7,"y":3,"w":3,"h":6,"c":"BL"},
    {"t":"rect","x":11,"y":2,"w":2,"h":7,"c":"GN"},{"t":"rect","x":14,"y":4,"w":3,"h":5,"c":"OR"},
    {"t":"rect","x":18,"y":2,"w":4,"h":7,"c":"PL"},
    # Books row 2
    {"t":"rect","x":3,"y":11,"w":4,"h":7,"c":"BL"},{"t":"rect","x":8,"y":12,"w":3,"h":6,"c":"RD"},
    {"t":"rect","x":12,"y":11,"w":2,"h":7,"c":"GN"},{"t":"rect","x":16,"y":13,"w":5,"h":5,"c":"OR"},
    # Books row 3
    {"t":"rect","x":3,"y":20,"w":3,"h":7,"c":"PL"},{"t":"rect","x":7,"y":21,"w":4,"h":6,"c":"BL"},
    {"t":"rect","x":12,"y":20,"w":3,"h":7,"c":"RD"},{"t":"rect","x":16,"y":22,"w":2,"h":5,"c":"GN"},
    {"t":"rect","x":19,"y":20,"w":3,"h":7,"c":"OR"},
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":15},{"p":[0,0,"SH"],"t":"pix","x":0,"y":24},
]),
("cabinet", 16, 24, [
    {"t":"rect","x":0,"y":0,"w":16,"h":24,"c":"WD"},
    {"t":"rect","x":1,"y":1,"w":14,"h":11,"c":"WD2"},           # upper doors
    {"t":"rect","x":1,"y":14,"w":14,"h":9,"c":"WD2"},           # lower doors
    {"t":"rect","x":2,"y":2,"w":5,"h":9,"c":"WD"},              # upper left door
    {"t":"rect","x":9,"y":2,"w":5,"h":9,"c":"WD"},              # upper right door
    {"t":"rect","x":2,"y":15,"w":5,"h":7,"c":"WD"},             # lower left door
    {"t":"rect","x":9,"y":15,"w":5,"h":7,"c":"WD"},             # lower right door
    {"p":[0,0,"GD"],"t":"pix","x":7,"y":6},                      # upper handle
    {"p":[0,0,"GD"],"t":"pix","x":7,"y":18},                     # lower handle
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":5},{"p":[0,0,"SH"],"t":"pix","x":1,"y":23},
]),
("chest_large", 24, 16, [
    {"t":"rect","x":2,"y":4,"w":20,"h":10,"c":"WD2"},           # body
    {"t":"rect","x":1,"y":3,"w":22,"h":3,"c":"WD"},             # lid
    {"t":"rect","x":0,"y":13,"w":24,"h":3,"c":"WD"},            # base
    {"t":"rect","x":5,"y":7,"w":14,"h":3,"c":"GD"},             # gold band
    {"p":[0,0,"GD"],"t":"pix","x":11,"y":4},                     # lid latch
    {"p":[0,0,"SH"],"t":"pix","x":1,"y":1},{"p":[0,0,"SH"],"t":"pix","x":1,"y":12},
    {"p":[0,0,"LT"],"t":"pix","x":20,"y":4},
]),

# ── Barrels & Crates ──
("barrel", 12, 16, [
    {"t":"rect","x":1,"y":0,"w":10,"h":16,"c":"WD2"},
    {"t":"rect","x":0,"y":0,"w":12,"h":2,"c":"WD"},             # top rim
    {"t":"rect","x":0,"y":14,"w":12,"h":2,"c":"WD"},            # bottom rim
    {"t":"rect","x":1,"y":2,"w":1,"h":12,"c":"WD"},             # stave 1
    {"t":"rect","x":3,"y":2,"w":1,"h":12,"c":"WD"},             # stave 2
    {"t":"rect","x":5,"y":2,"w":2,"h":12,"c":"WD"},             # stave 3
    {"t":"rect","x":8,"y":2,"w":1,"h":12,"c":"WD"},             # stave 4
    {"t":"rect","x":10,"y":2,"w":1,"h":12,"c":"WD"},            # stave 5
    {"t":"rect","x":2,"y":5,"w":8,"h":2,"c":"WD"},              # band
    {"t":"rect","x":2,"y":10,"w":8,"h":2,"c":"WD"},             # band
    {"p":[0,0,"SH"],"t":"pix","x":1,"y":1},{"p":[0,0,"SH"],"t":"pix","x":10,"y":1},
    {"p":[0,0,"SH"],"t":"pix","x":1,"y":15},{"p":[0,0,"SH"],"t":"pix","x":10,"y":15},
]),
("crate", 12, 12, [
    {"t":"rect","x":0,"y":0,"w":12,"h":12,"c":"WD2"},
    {"t":"rect","x":0,"y":0,"w":12,"h":2,"c":"WD"},
    {"t":"rect","x":0,"y":10,"w":12,"h":2,"c":"WD"},
    {"t":"rect","x":0,"y":4,"w":12,"h":1,"c":"WD"},             # plank line
    {"t":"rect","x":0,"y":7,"w":12,"h":1,"c":"WD"},
    {"p":[0,0,"DK"],"t":"pix","x":2,"y":5},{"p":[0,0,"DK"],"t":"pix","x":6,"y":5},{"p":[0,0,"DK"],"t":"pix","x":10,"y":5},
    {"p":[0,0,"DK"],"t":"pix","x":4,"y":8},{"p":[0,0,"DK"],"t":"pix","x":8,"y":8},
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":1},{"p":[0,0,"SH"],"t":"pix","x":0,"y":11},
]),
("crate_stack", 12, 20, [
    {"t":"rect","x":0,"y":10,"w":12,"h":10,"c":"WD2"},          # bottom crate
    {"t":"rect","x":0,"y":10,"w":12,"h":2,"c":"WD"},
    {"t":"rect","x":0,"y":18,"w":12,"h":2,"c":"WD"},
    {"t":"rect","x":0,"y":14,"w":12,"h":1,"c":"WD"},
    {"t":"rect","x":1,"y":0,"w":10,"h":10,"c":"WD2"},           # top crate
    {"t":"rect","x":1,"y":0,"w":10,"h":2,"c":"WD"},
    {"t":"rect","x":1,"y":8,"w":10,"h":2,"c":"WD"},
    {"t":"rect","x":1,"y":4,"w":10,"h":1,"c":"WD"},
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":19},{"p":[0,0,"SH"],"t":"pix","x":1,"y":3},
]),

# ── Lighting ──
("torch_wall", 8, 16, [
    {"t":"rect","x":2,"y":0,"w":4,"h":2,"c":"WD"},              # wall bracket top
    {"t":"rect","x":1,"y":2,"w":2,"h":8,"c":"WD"},              # bracket left
    {"t":"rect","x":5,"y":2,"w":2,"h":8,"c":"WD"},              # bracket right
    {"t":"rect","x":3,"y":10,"w":2,"h":3,"c":"WD"},             # torch handle
    {"t":"rect","x":1,"y":2,"w":6,"h":10,"c":"OR"},             # flame
    {"t":"rect","x":2,"y":1,"w":4,"h":2,"c":"YL"},              # flame top
    {"p":[0,0,"SH"],"t":"pix","x":2,"y":0},{"p":[0,0,"SH"],"t":"pix","x":5,"y":0},
]),
("candelabra", 16, 24, [
    {"t":"rect","x":6,"y":12,"w":4,"h":12,"c":"WD"},            # stand
    {"t":"rect","x":4,"y":18,"w":8,"h":2,"c":"WD"},             # base
    {"t":"rect","x":2,"y":14,"w":12,"h":2,"c":"WD"},            # ring
    # Candle arms
    {"t":"rect","x":0,"y":10,"w":4,"h":3,"c":"WD"},             # left arm
    {"t":"rect","x":12,"y":10,"w":4,"h":3,"c":"WD"},            # right arm
    {"t":"rect","x":5,"y":2,"w":2,"h":12,"c":"WD"},             # center arm
    # Candles
    {"t":"rect","x":1,"y":7,"w":2,"h":4,"c":"WH"},
    {"t":"rect","x":13,"y":7,"w":2,"h":4,"c":"WH"},
    {"t":"rect","x":6,"y":0,"w":2,"h":3,"c":"WH"},
    # Flames
    {"p":[0,0,"YL"],"t":"pix","x":2,"y":6}, {"p":[0,0,"OR"],"t":"pix","x":2,"y":5},
    {"p":[0,0,"YL"],"t":"pix","x":14,"y":6}, {"p":[0,0,"OR"],"t":"pix","x":14,"y":5},
    {"p":[0,0,"YL"],"t":"pix","x":7,"y":-1},{"p":[0,0,"OR"],"t":"pix","x":7,"y":0},
]),
("lantern", 8, 12, [
    {"t":"rect","x":2,"y":0,"w":4,"h":2,"c":"WD"},              # hook
    {"t":"rect","x":2,"y":3,"w":4,"h":6,"c":"MT"},              # glass
    {"t":"rect","x":1,"y":2,"w":6,"h":1,"c":"WD"},              # top frame
    {"t":"rect","x":1,"y":9,"w":6,"h":2,"c":"WD"},              # base
    {"t":"rect","x":3,"y":4,"w":2,"h":4,"c":"YL"},              # glow
    {"p":[0,0,"GD"],"t":"pix","x":4,"y":3},
]),

# ── Decor ──
("rug_small", 32, 8, [
    {"t":"rect","x":1,"y":1,"w":30,"h":6,"c":"RD"},             # main rug
    {"t":"rect","x":0,"y":0,"w":32,"h":1,"c":"RD"},             # top edge
    {"t":"rect","x":0,"y":7,"w":32,"h":1,"c":"RD"},             # bottom edge
    {"t":"rect","x":0,"y":3,"w":32,"h":2,"c":"OR"},             # stripe
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":1},{"p":[0,0,"SH"],"t":"pix","x":0,"y":6},
]),
("rug_round", 24, 24, [
    {"t":"rect","x":4,"y":4,"w":16,"h":16,"c":"RD"},
    {"t":"rect","x":6,"y":8,"w":12,"h":8,"c":"OR"},             # inner
    {"t":"rect","x":8,"y":10,"w":8,"h":4,"c":"GD"},             # center medallion
    {"p":[0,0,"SH"],"t":"pix","x":4,"y":5},{"p":[0,0,"SH"],"t":"pix","x":5,"y":4},
]),
("tapestry", 24, 32, [
    {"t":"rect","x":0,"y":0,"w":24,"h":32,"c":"RD"},            # cloth
    {"t":"rect","x":1,"y":1,"w":22,"h":30,"c":"PL"},            # inner
    {"t":"rect","x":3,"y":0,"w":2,"h":32,"c":"GD"},             # left border
    {"t":"rect","x":19,"y":0,"w":2,"h":32,"c":"GD"},            # right border
    {"t":"rect","x":0,"y":0,"w":3,"h":2,"c":"WD"},              # top rod left
    {"t":"rect","x":21,"y":0,"w":3,"h":2,"c":"WD"},             # top rod right
    # Design: diamond pattern
    {"p":[0,0,"GD"],"t":"pix","x":6,"y":4},{"p":[0,0,"GD"],"t":"pix","x":11,"y":3},
    {"p":[0,0,"GD"],"t":"pix","x":8,"y":10},{"p":[0,0,"GD"],"t":"pix","x":14,"y":8},
    {"p":[0,0,"GD"],"t":"pix","x":10,"y":16},{"p":[0,0,"GD"],"t":"pix","x":18,"y":14},
    {"p":[0,0,"YL"],"t":"pix","x":12,"y":6},{"p":[0,0,"YL"],"t":"pix","x":6,"y":12},
    {"p":[0,0,"YL"],"t":"pix","x":14,"y":12},
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":1},{"p":[0,0,"SH"],"t":"pix","x":0,"y":14},
]),

# ── Misc ──
("anvil", 16, 12, [
    {"t":"rect","x":2,"y":0,"w":12,"h":4,"c":"MT"},             # top
    {"t":"rect","x":4,"y":4,"w":8,"h":4,"c":"MT"},              # body
    {"t":"rect","x":0,"y":8,"w":16,"h":2,"c":"WD"},             # base
    {"t":"rect","x":3,"y":0,"w":4,"h":2,"c":"LT"},              # highlight
    {"p":[0,0,"SH"],"t":"pix","x":1,"y":9},{"p":[0,0,"SH"],"t":"pix","x":11,"y":9},
]),
("well", 16, 16, [
    {"t":"rect","x":2,"y":0,"w":12,"h":3,"c":"ST"},             # top rim
    {"t":"rect","x":1,"y":3,"w":14,"h":2,"c":"LT"},             # highlight
    {"t":"rect","x":0,"y":5,"w":16,"h":11,"c":"ST"},            # body
    {"t":"rect","x":2,"y":1,"w":3,"h":4,"c":"DK"},              # dark opening
    {"t":"rect","x":11,"y":1,"w":3,"h":4,"c":"DK"},
    {"t":"rect","x":4,"y":0,"w":8,"h":2,"c":"DK"},              # hole
    {"p":[0,0,"SH"],"t":"pix","x":0,"y":8},{"p":[0,0,"SH"],"t":"pix","x":15,"y":8},
    {"p":[0,0,"DK"],"t":"pix","x":5,"y":3},{"p":[0,0,"DK"],"t":"pix","x":9,"y":3},
]),
    ]


UI_ASSETS = [
    # ── Buttons ──
    ("button_normal", 32, 12, [
        {"t":"rect","x":0,"y":0,"w":32,"h":12,"c":"ST"},
        {"t":"rect","x":1,"y":1,"w":30,"h":10,"c":"LT"},
        {"t":"rect","x":1,"y":1,"w":30,"h":2,"c":"HL"},
        {"t":"rect","x":0,"y":11,"w":32,"h":1,"c":"SH"},
        {"p":[0,0,"DK"],"t":"pix","x":0,"y":0},{"p":[0,0,"DK"],"t":"pix","x":31,"y":0},
        {"p":[0,0,"DK"],"t":"pix","x":0,"y":11},{"p":[0,0,"DK"],"t":"pix","x":31,"y":11},
    ]),
    ("button_hover", 32, 12, [
        {"t":"rect","x":0,"y":0,"w":32,"h":12,"c":"LT"},
        {"t":"rect","x":1,"y":1,"w":30,"h":10,"c":"HL"},
        {"t":"rect","x":1,"y":1,"w":30,"h":2,"c":"WH"},
        {"t":"rect","x":0,"y":11,"w":32,"h":1,"c":"DK"},
        {"p":[0,0,"GD"],"t":"pix","x":0,"y":0},{"p":[0,0,"GD"],"t":"pix","x":31,"y":0},
    ]),
    ("button_pressed", 32, 12, [
        {"t":"rect","x":0,"y":0,"w":32,"h":12,"c":"DK"},
        {"t":"rect","x":1,"y":1,"w":30,"h":10,"c":"ST"},
        {"t":"rect","x":0,"y":0,"w":32,"h":1,"c":"SH"},
        {"t":"rect","x":1,"y":10,"w":30,"h":2,"c":"LT"},
    ]),
    # ── Panel / Frame ──
    ("panel_frame", 32, 32, [
        {"t":"rect","x":0,"y":0,"w":32,"h":32,"c":"DK"},
        {"t":"rect","x":1,"y":1,"w":30,"h":30,"c":"ST"},
        {"t":"rect","x":0,"y":0,"w":32,"h":2,"c":"LT"},
        {"t":"rect","x":0,"y":30,"w":32,"h":2,"c":"SH"},
        {"t":"rect","x":0,"y":0,"w":2,"h":32,"c":"LT"},
        {"t":"rect","x":30,"y":0,"w":2,"h":32,"c":"SH"},
        {"p":[0,0,"HL"],"t":"pix","x":1,"y":1},
        {"p":[0,0,"HL"],"t":"pix","x":30,"y":1},
    ]),
    ("window_titlebar", 32, 10, [
        {"t":"rect","x":0,"y":0,"w":32,"h":10,"c":"DK"},
        {"t":"rect","x":1,"y":1,"w":30,"h":8,"c":"ST"},
        {"t":"rect","x":0,"y":0,"w":32,"h":2,"c":"HL"},
        {"t":"rect","x":0,"y":9,"w":32,"h":1,"c":"SH"},
        {"t":"rect","x":26,"y":1,"w":5,"h":5,"c":"RD"},
        {"p":[0,0,"WH"],"t":"pix","x":28,"y":2},{"p":[0,0,"WH"],"t":"pix","x":29,"y":3},
    ]),
    # ── Icons ──
    ("icon_heart", 8, 8, [
        {"t":"rect","x":2,"y":2,"w":4,"h":4,"c":"RD"},
        {"p":[0,0,"RD"],"t":"pix","x":1,"y":3},{"p":[0,0,"RD"],"t":"pix","x":6,"y":3},
        {"p":[0,0,"RD"],"t":"pix","x":2,"y":1},{"p":[0,0,"RD"],"t":"pix","x":5,"y":1},
        {"p":[0,0,"RD"],"t":"pix","x":2,"y":6},{"p":[0,0,"RD"],"t":"pix","x":5,"y":6},
        {"p":[0,0,"RD"],"t":"pix","x":3,"y":0},{"p":[0,0,"RD"],"t":"pix","x":4,"y":0},
        {"p":[0,0,"RD"],"t":"pix","x":3,"y":7},{"p":[0,0,"RD"],"t":"pix","x":4,"y":7},
        {"t":"rect","x":3,"y":1,"w":2,"h":1,"c":"LT"},
    ]),
    ("icon_star", 8, 8, [
        {"p":[0,0,"YL"],"t":"pix","x":3,"y":1},{"p":[0,0,"YL"],"t":"pix","x":4,"y":1},
        {"t":"rect","x":2,"y":2,"w":4,"h":3,"c":"YL"},
        {"p":[0,0,"YL"],"t":"pix","x":1,"y":4},{"p":[0,0,"YL"],"t":"pix","x":6,"y":4},
        {"p":[0,0,"YL"],"t":"pix","x":2,"y":5},{"p":[0,0,"YL"],"t":"pix","x":5,"y":5},
        {"p":[0,0,"YL"],"t":"pix","x":3,"y":6},{"p":[0,0,"YL"],"t":"pix","x":4,"y":6},
        {"p":[0,0,"YL"],"t":"pix","x":3,"y":0},{"p":[0,0,"YL"],"t":"pix","x":4,"y":0},
    ]),
    ("icon_gem", 8, 8, [
        {"p":[0,0,"BL"],"t":"pix","x":3,"y":0},{"p":[0,0,"BL"],"t":"pix","x":4,"y":0},
        {"p":[0,0,"BL"],"t":"pix","x":2,"y":1},{"p":[0,0,"WH"],"t":"pix","x":3,"y":1},{"p":[0,0,"BL"],"t":"pix","x":5,"y":1},
        {"p":[0,0,"BL"],"t":"pix","x":1,"y":2},{"p":[0,0,"WH"],"t":"pix","x":2,"y":2},{"p":[0,0,"BL"],"t":"pix","x":5,"y":2},
        {"p":[0,0,"BL"],"t":"pix","x":2,"y":3},{"p":[0,0,"WH"],"t":"pix","x":3,"y":3},{"p":[0,0,"BL"],"t":"pix","x":5,"y":3},
        {"p":[0,0,"BL"],"t":"pix","x":3,"y":4},{"p":[0,0,"WH"],"t":"pix","x":4,"y":4},
        {"p":[0,0,"BL"],"t":"pix","x":3,"y":5},{"p":[0,0,"BL"],"t":"pix","x":4,"y":5},
        {"p":[0,0,"BL"],"t":"pix","x":3,"y":6},{"p":[0,0,"BL"],"t":"pix","x":4,"y":6},
    ]),
    ("icon_coin", 8, 8, [
        {"t":"rect","x":2,"y":2,"w":4,"h":4,"c":"YL"},
        {"p":[0,0,"GD"],"t":"pix","x":3,"y":3},{"p":[0,0,"GD"],"t":"pix","x":4,"y":3},
        {"p":[0,0,"OR"],"t":"pix","x":2,"y":2},{"p":[0,0,"OR"],"t":"pix","x":5,"y":5},
    ]),
    ("icon_scroll", 8, 8, [
        {"t":"rect","x":1,"y":1,"w":6,"h":6,"c":"WH"},
        {"t":"rect","x":0,"y":0,"w":6,"h":1,"c":"WD"},
        {"t":"rect","x":0,"y":7,"w":6,"h":1,"c":"WD"},
        {"p":[0,0,"SH"],"t":"pix","x":2,"y":3},{"p":[1,0,"SH"],"t":"pix","x":2,"y":3},
        {"p":[0,0,"SH"],"t":"pix","x":1,"y":5},{"p":[1,0,"SH"],"t":"pix","x":1,"y":5},
    ]),
    # ── Cursors ──
    ("cursor_pointer", 16, 16, [
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":0},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":1},{"p":[0,0,"BK"],"t":"pix","x":1,"y":1},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":2},{"p":[0,0,"BK"],"t":"pix","x":1,"y":2},{"p":[0,0,"WH"],"t":"pix","x":2,"y":2},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":3},{"p":[0,0,"BK"],"t":"pix","x":1,"y":3},{"p":[0,0,"BK"],"t":"pix","x":2,"y":3},{"p":[0,0,"WH"],"t":"pix","x":3,"y":3},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":4},{"p":[0,0,"BK"],"t":"pix","x":1,"y":4},{"p":[0,0,"BK"],"t":"pix","x":2,"y":4},{"p":[0,0,"BK"],"t":"pix","x":3,"y":4},{"p":[0,0,"WH"],"t":"pix","x":4,"y":4},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":5},{"p":[0,0,"BK"],"t":"pix","x":1,"y":5},{"p":[0,0,"BK"],"t":"pix","x":2,"y":5},{"p":[0,0,"BK"],"t":"pix","x":3,"y":5},{"p":[0,0,"BK"],"t":"pix","x":4,"y":5},{"p":[0,0,"WH"],"t":"pix","x":5,"y":5},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":6},{"p":[0,0,"BK"],"t":"pix","x":1,"y":6},{"p":[0,0,"BK"],"t":"pix","x":2,"y":6},{"p":[0,0,"BK"],"t":"pix","x":3,"y":6},{"p":[0,0,"BK"],"t":"pix","x":4,"y":6},{"p":[0,0,"BK"],"t":"pix","x":5,"y":6},{"p":[0,0,"WH"],"t":"pix","x":6,"y":6},
        {"p":[0,0,"WH"],"t":"pix","x":1,"y":7},{"p":[0,0,"BK"],"t":"pix","x":2,"y":7},{"p":[0,0,"BK"],"t":"pix","x":3,"y":7},{"p":[0,0,"BK"],"t":"pix","x":4,"y":7},{"p":[0,0,"BK"],"t":"pix","x":5,"y":7},{"p":[0,0,"BK"],"t":"pix","x":6,"y":7},{"p":[0,0,"WH"],"t":"pix","x":7,"y":7},
        {"p":[0,0,"WH"],"t":"pix","x":2,"y":8},{"p":[0,0,"BK"],"t":"pix","x":3,"y":8},{"p":[0,0,"BK"],"t":"pix","x":4,"y":8},{"p":[0,0,"BK"],"t":"pix","x":5,"y":8},{"p":[0,0,"BK"],"t":"pix","x":6,"y":8},{"p":[0,0,"BK"],"t":"pix","x":7,"y":8},{"p":[0,0,"WH"],"t":"pix","x":8,"y":8},
        {"p":[0,0,"WH"],"t":"pix","x":3,"y":9},{"p":[0,0,"BK"],"t":"pix","x":4,"y":9},{"p":[0,0,"BK"],"t":"pix","x":5,"y":9},{"p":[0,0,"BK"],"t":"pix","x":6,"y":9},{"p":[0,0,"BK"],"t":"pix","x":7,"y":9},{"p":[0,0,"WH"],"t":"pix","x":8,"y":9},
        {"p":[0,0,"WH"],"t":"pix","x":4,"y":10},{"p":[0,0,"BK"],"t":"pix","x":5,"y":10},{"p":[0,0,"BK"],"t":"pix","x":6,"y":10},{"p":[0,0,"BK"],"t":"pix","x":7,"y":10},{"p":[0,0,"WH"],"t":"pix","x":8,"y":10},
        {"p":[0,0,"WH"],"t":"pix","x":5,"y":11},{"p":[0,0,"BK"],"t":"pix","x":6,"y":11},{"p":[0,0,"BK"],"t":"pix","x":7,"y":11},{"p":[0,0,"WH"],"t":"pix","x":8,"y":11},
        {"p":[0,0,"BK"],"t":"pix","x":6,"y":12},{"p":[0,0,"BK"],"t":"pix","x":7,"y":12},{"p":[0,0,"BK"],"t":"pix","x":8,"y":12},
        {"p":[0,0,"BK"],"t":"pix","x":7,"y":13},{"p":[0,0,"BK"],"t":"pix","x":8,"y":13},
        {"p":[0,0,"BK"],"t":"pix","x":8,"y":14},
    ]),
    # ── Progress / Bars ──
    ("progress_bar_bg", 48, 8, [
        {"t":"rect","x":0,"y":0,"w":48,"h":8,"c":"DK"},
        {"t":"rect","x":1,"y":1,"w":46,"h":6,"c":"BK"},
        {"p":[0,0,"ST"],"t":"pix","x":0,"y":0},{"p":[0,0,"ST"],"t":"pix","x":47,"y":0},
    ]),
    ("progress_bar_fill", 48, 8, [
        {"t":"rect","x":0,"y":0,"w":48,"h":8,"c":"DK"},
        {"t":"rect","x":1,"y":1,"w":36,"h":6,"c":"GN"},
        {"t":"rect","x":1,"y":1,"w":36,"h":2,"c":"GR"},
        {"t":"rect","x":37,"y":1,"w":10,"h":6,"c":"BK"},
        {"p":[0,0,"ST"],"t":"pix","x":0,"y":0},{"p":[0,0,"ST"],"t":"pix","x":47,"y":0},
    ]),
    # ── Checkbox / Toggle ──
    ("checkbox_off", 10, 10, [
        {"t":"rect","x":0,"y":0,"w":10,"h":10,"c":"BK"},
        {"t":"rect","x":1,"y":1,"w":8,"h":8,"c":"DK"},
        {"p":[0,0,"LT"],"t":"pix","x":1,"y":1},
        {"p":[0,0,"ST"],"t":"pix","x":0,"y":0},{"p":[0,0,"ST"],"t":"pix","x":9,"y":0},
        {"p":[0,0,"ST"],"t":"pix","x":0,"y":9},{"p":[0,0,"ST"],"t":"pix","x":9,"y":9},
    ]),
    ("checkbox_on", 10, 10, [
        {"t":"rect","x":0,"y":0,"w":10,"h":10,"c":"BK"},
        {"t":"rect","x":1,"y":1,"w":8,"h":8,"c":"DK"},
        {"p":[0,0,"GR"],"t":"pix","x":2,"y":4},{"p":[0,0,"GR"],"t":"pix","x":3,"y":5},
        {"p":[0,0,"GR"],"t":"pix","x":4,"y":3},{"p":[0,0,"GR"],"t":"pix","x":5,"y":2},{"p":[0,0,"GR"],"t":"pix","x":6,"y":1},
        {"p":[0,0,"WH"],"t":"pix","x":2,"y":5},{"p":[0,0,"WH"],"t":"pix","x":4,"y":4},
        {"p":[0,0,"ST"],"t":"pix","x":0,"y":0},{"p":[0,0,"ST"],"t":"pix","x":9,"y":0},
        {"p":[0,0,"ST"],"t":"pix","x":0,"y":9},{"p":[0,0,"ST"],"t":"pix","x":9,"y":9},
    ]),
]

WEAPON_ASSETS = [
    # ── Weapons ──
    ("axe_battle", 16, 16, [
        {"t":"rect","x":0,"y":4,"w":8,"h":4,"c":"MT"},
        {"t":"rect","x":3,"y":1,"w":6,"h":3,"c":"MT"},
        {"t":"rect","x":4,"y":8,"w":2,"h":8,"c":"WD"},
        {"p":[0,0,"LT"],"t":"pix","x":4,"y":4},{"p":[0,0,"LT"],"t":"pix","x":5,"y":2},
        {"p":[0,0,"SH"],"t":"pix","x":1,"y":7},
    ]),
    ("bow", 16, 12, [
        {"t":"rect","x":6,"y":0,"w":2,"h":12,"c":"WD"},
        {"p":[0,0,"WD2"],"t":"pix","x":0,"y":1},{"p":[0,0,"WD2"],"t":"pix","x":1,"y":0},
        {"p":[0,0,"WD2"],"t":"pix","x":0,"y":10},{"p":[0,0,"WD2"],"t":"pix","x":1,"y":11},
        {"p":[0,0,"WD2"],"t":"pix","x":2,"y":1},{"p":[0,0,"WD2"],"t":"pix","x":3,"y":2},
        {"p":[0,0,"WD2"],"t":"pix","x":2,"y":9},{"p":[0,0,"WD2"],"t":"pix","x":3,"y":8},
        {"p":[0,0,"WD2"],"t":"pix","x":4,"y":3},{"p":[0,0,"WD2"],"t":"pix","x":4,"y":7},
        {"p":[0,0,"WH"],"t":"pix","x":6,"y":3},{"p":[0,0,"WH"],"t":"pix","x":6,"y":8},
        {"p":[0,0,"WH"],"t":"pix","x":5,"y":4},{"p":[0,0,"WH"],"t":"pix","x":5,"y":7},
    ]),
    ("arrow_item", 4, 12, [
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":0},{"p":[0,0,"MT"],"t":"pix","x":2,"y":0},
        {"p":[0,0,"MT"],"t":"pix","x":2,"y":1},
        {"t":"rect","x":1,"y":2,"w":2,"h":7,"c":"WD"},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":9},{"p":[0,0,"WH"],"t":"pix","x":1,"y":9},{"p":[0,0,"WH"],"t":"pix","x":2,"y":9},
        {"p":[0,0,"WH"],"t":"pix","x":3,"y":9},
    ]),
    ("staff_wizard", 4, 28, [
        {"t":"rect","x":1,"y":0,"w":2,"h":24,"c":"WD"},
        {"p":[0,0,"BL"],"t":"pix","x":0,"y":0},{"p":[0,0,"BL"],"t":"pix","x":3,"y":0},
        {"p":[0,0,"WH"],"t":"pix","x":1,"y":0},
        {"p":[0,0,"GD"],"t":"pix","x":1,"y":12},{"p":[0,0,"GD"],"t":"pix","x":2,"y":13},
        {"p":[0,0,"LT"],"t":"pix","x":1,"y":1},
    ]),
    ("mace", 8, 16, [
        {"t":"rect","x":1,"y":0,"w":6,"h":4,"c":"MT"},
        {"p":[0,0,"GD"],"t":"pix","x":3,"y":1},{"p":[0,0,"GD"],"t":"pix","x":4,"y":1},
        {"t":"rect","x":0,"y":1,"w":8,"h":2,"c":"MT"},
        {"t":"rect","x":3,"y":4,"w":2,"h":12,"c":"WD"},
        {"p":[0,0,"SH"],"t":"pix","x":3,"y":8},
    ]),
    ("dagger", 4, 12, [
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":0},{"p":[0,0,"MT"],"t":"pix","x":2,"y":0},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":1},{"p":[0,0,"MT"],"t":"pix","x":2,"y":1},
        {"p":[0,0,"MT"],"t":"pix","x":2,"y":2},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":3},{"p":[0,0,"MT"],"t":"pix","x":2,"y":3},
        {"p":[0,0,"WD"],"t":"pix","x":1,"y":4},{"p":[0,0,"WD"],"t":"pix","x":2,"y":4},
        {"p":[0,0,"WD"],"t":"pix","x":1,"y":6},
        {"p":[0,0,"GD"],"t":"pix","x":1,"y":5},
        {"p":[0,0,"WD"],"t":"pix","x":0,"y":7},{"p":[0,0,"WD"],"t":"pix","x":1,"y":7},{"p":[0,0,"WD"],"t":"pix","x":2,"y":7},{"p":[0,0,"WD"],"t":"pix","x":3,"y":7},
    ]),
    ("spear", 4, 28, [
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":0},{"p":[0,0,"MT"],"t":"pix","x":2,"y":0},
        {"p":[0,0,"MT"],"t":"pix","x":2,"y":1},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":2},{"p":[0,0,"MT"],"t":"pix","x":2,"y":2},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":3},
        {"t":"rect","x":1,"y":4,"w":2,"h":18,"c":"WD"},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":22},{"p":[0,0,"MT"],"t":"pix","x":2,"y":22},
        {"p":[0,0,"LT"],"t":"pix","x":1,"y":4},
    ]),
    ("wand", 4, 12, [
        {"p":[0,0,"BL"],"t":"pix","x":1,"y":0},{"p":[0,0,"BL"],"t":"pix","x":2,"y":0},
        {"p":[0,0,"BL"],"t":"pix","x":1,"y":1},{"p":[0,0,"BL"],"t":"pix","x":2,"y":1},
        {"t":"rect","x":1,"y":2,"w":2,"h":8,"c":"WD"},
        {"p":[0,0,"PL"],"t":"pix","x":2,"y":0},
        {"p":[0,0,"YL"],"t":"pix","x":1,"y":10},{"p":[0,0,"YL"],"t":"pix","x":2,"y":10},
    ]),
    # ── Armor ──
    ("helmet_iron", 12, 12, [
        {"t":"rect","x":1,"y":0,"w":10,"h":8,"c":"MT"},
        {"t":"rect","x":2,"y":1,"w":8,"h":2,"c":"LT"},
        {"t":"rect","x":0,"y":3,"w":12,"h":2,"c":"MT"},
        {"t":"rect","x":3,"y":5,"w":2,"h":3,"c":"DK"},
        {"t":"rect","x":7,"y":5,"w":2,"h":3,"c":"DK"},
        {"p":[0,0,"SH"],"t":"pix","x":0,"y":0},{"p":[0,0,"SH"],"t":"pix","x":11,"y":0},
    ]),
    ("boots_armor", 12, 8, [
        {"t":"rect","x":0,"y":0,"w":5,"h":5,"c":"MT"},
        {"t":"rect","x":7,"y":0,"w":5,"h":5,"c":"MT"},
        {"t":"rect","x":0,"y":5,"w":12,"h":3,"c":"DK"},
        {"p":[0,0,"LT"],"t":"pix","x":1,"y":1},{"p":[0,0,"LT"],"t":"pix","x":8,"y":1},
        {"p":[0,0,"SH"],"t":"pix","x":0,"y":3},{"p":[0,0,"SH"],"t":"pix","x":7,"y":3},
    ]),
    ("gauntlets", 8, 8, [
        {"t":"rect","x":0,"y":2,"w":3,"h":5,"c":"MT"},
        {"t":"rect","x":5,"y":2,"w":3,"h":5,"c":"MT"},
        {"t":"rect","x":0,"y":1,"w":8,"h":2,"c":"MT"},
        {"p":[0,0,"LT"],"t":"pix","x":1,"y":2},{"p":[0,0,"LT"],"t":"pix","x":6,"y":2},
    ]),
    ("ring", 8, 8, [
        {"p":[0,0,"GD"],"t":"pix","x":2,"y":1},{"p":[0,0,"BK"],"t":"pix","x":3,"y":1},{"p":[0,0,"GD"],"t":"pix","x":4,"y":1},
        {"p":[0,0,"GD"],"t":"pix","x":1,"y":2},{"p":[0,0,"BK"],"t":"pix","x":4,"y":2},{"p":[0,0,"GD"],"t":"pix","x":5,"y":2},
        {"p":[0,0,"GD"],"t":"pix","x":1,"y":3},{"p":[0,0,"RD"],"t":"pix","x":2,"y":3},{"p":[0,0,"RD"],"t":"pix","x":3,"y":3},{"p":[0,0,"GD"],"t":"pix","x":5,"y":3},
        {"p":[0,0,"GD"],"t":"pix","x":1,"y":4},{"p":[0,0,"BK"],"t":"pix","x":4,"y":4},{"p":[0,0,"GD"],"t":"pix","x":5,"y":4},
        {"p":[0,0,"GD"],"t":"pix","x":2,"y":5},{"p":[0,0,"BK"],"t":"pix","x":3,"y":5},{"p":[0,0,"GD"],"t":"pix","x":4,"y":5},
    ]),
    ("amulet", 8, 12, [
        {"p":[0,0,"GD"],"t":"pix","x":3,"y":0},{"p":[0,0,"GD"],"t":"pix","x":4,"y":0},
        {"p":[0,0,"GD"],"t":"pix","x":1,"y":1},{"p":[0,0,"GD"],"t":"pix","x":6,"y":1},
        {"p":[0,0,"GD"],"t":"pix","x":2,"y":2},{"p":[0,0,"GD"],"t":"pix","x":5,"y":2},
        {"t":"rect","x":2,"y":3,"w":4,"h":4,"c":"GD"},
        {"p":[0,0,"RD"],"t":"pix","x":3,"y":4},{"p":[0,0,"RD"],"t":"pix","x":4,"y":4},
        {"p":[0,0,"GD"],"t":"pix","x":2,"y":7},{"p":[0,0,"GD"],"t":"pix","x":5,"y":7},
        {"p":[0,0,"YL"],"t":"pix","x":4,"y":7},{"p":[0,0,"YL"],"t":"pix","x":3,"y":8},
        {"p":[0,0,"YL"],"t":"pix","x":4,"y":9},{"p":[0,0,"YL"],"t":"pix","x":3,"y":10},
        {"p":[0,0,"YL"],"t":"pix","x":4,"y":11},
    ]),
    ("crown", 12, 8, [
        {"t":"rect","x":1,"y":2,"w":10,"h":3,"c":"GD"},
        {"p":[0,0,"GD"],"t":"pix","x":2,"y":0},{"p":[0,0,"GD"],"t":"pix","x":3,"y":0},
        {"p":[0,0,"GD"],"t":"pix","x":5,"y":0},{"p":[0,0,"GD"],"t":"pix","x":6,"y":0},
        {"p":[0,0,"GD"],"t":"pix","x":8,"y":0},{"p":[0,0,"GD"],"t":"pix","x":9,"y":0},
        {"p":[0,0,"GD"],"t":"pix","x":2,"y":1},{"p":[0,0,"GD"],"t":"pix","x":5,"y":1},{"p":[0,0,"GD"],"t":"pix","x":8,"y":1},
        {"p":[0,0,"RD"],"t":"pix","x":3,"y":2},{"p":[0,0,"BL"],"t":"pix","x":6,"y":2},{"p":[0,0,"RD"],"t":"pix","x":9,"y":2},
        {"p":[0,0,"GD"],"t":"pix","x":0,"y":4},{"p":[0,0,"GD"],"t":"pix","x":11,"y":4},
    ]),
]

PROP_ASSETS = [
    # ── Stairs & Vertical ──
    ("stairs_down", 16, 16, [
        {"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"ST"},
        {"t":"rect","x":0,"y":0,"w":16,"h":2,"c":"LT"},
        {"t":"rect","x":2,"y":4,"w":12,"h":2,"c":"DK"},
        {"t":"rect","x":4,"y":8,"w":8,"h":2,"c":"DK"},
        {"t":"rect","x":6,"y":12,"w":4,"h":2,"c":"DK"},
        {"p":[0,0,"SH"],"t":"pix","x":2,"y":4},{"p":[0,0,"SH"],"t":"pix","x":3,"y":8},{"p":[0,0,"SH"],"t":"pix","x":5,"y":12},
    ]),
    ("stairs_up", 16, 16, [
        {"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"ST"},
        {"t":"rect","x":6,"y":2,"w":4,"h":2,"c":"LT"},
        {"t":"rect","x":4,"y":6,"w":8,"h":2,"c":"LT"},
        {"t":"rect","x":2,"y":10,"w":12,"h":2,"c":"LT"},
        {"t":"rect","x":0,"y":14,"w":16,"h":2,"c":"LT"},
        {"p":[0,0,"DK"],"t":"pix","x":0,"y":0},{"p":[0,0,"DK"],"t":"pix","x":15,"y":0},
    ]),
    ("ladder", 8, 32, [
        {"t":"rect","x":1,"y":0,"w":2,"h":32,"c":"WD"},
        {"t":"rect","x":5,"y":0,"w":2,"h":32,"c":"WD"},
        {"t":"rect","x":1,"y":4,"w":6,"h":1,"c":"WD2"},
        {"t":"rect","x":1,"y":10,"w":6,"h":1,"c":"WD2"},
        {"t":"rect","x":1,"y":16,"w":6,"h":1,"c":"WD2"},
        {"t":"rect","x":1,"y":22,"w":6,"h":1,"c":"WD2"},
        {"t":"rect","x":1,"y":28,"w":6,"h":1,"c":"WD2"},
    ]),
    # ── Traps & Mechanisms ──
    ("lever_off", 8, 8, [
        {"t":"rect","x":2,"y":2,"w":4,"h":4,"c":"MT"},
        {"t":"rect","x":3,"y":0,"w":2,"h":4,"c":"WD"},
        {"p":[0,0,"GD"],"t":"pix","x":3,"y":0},
        {"p":[0,0,"SH"],"t":"pix","x":2,"y":3},{"p":[0,0,"SH"],"t":"pix","x":5,"y":3},
    ]),
    ("lever_on", 8, 8, [
        {"t":"rect","x":2,"y":2,"w":4,"h":4,"c":"MT"},
        {"t":"rect","x":4,"y":4,"w":2,"h":4,"c":"WD"},
        {"p":[0,0,"RD"],"t":"pix","x":4,"y":6},
        {"p":[0,0,"SH"],"t":"pix","x":2,"y":3},{"p":[0,0,"SH"],"t":"pix","x":5,"y":3},
    ]),
    ("pressure_plate", 16, 8, [
        {"t":"rect","x":0,"y":4,"w":16,"h":4,"c":"DK"},
        {"t":"rect","x":1,"y":0,"w":14,"h":4,"c":"ST"},
        {"t":"rect","x":1,"y":0,"w":14,"h":1,"c":"LT"},
        {"p":[0,0,"SH"],"t":"pix","x":0,"y":7},
    ]),
    ("spike_trap", 16, 8, [
        {"t":"rect","x":0,"y":6,"w":16,"h":2,"c":"DK"},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":5},{"p":[0,0,"MT"],"t":"pix","x":2,"y":3},{"p":[0,0,"MT"],"t":"pix","x":2,"y":4},
        {"p":[0,0,"MT"],"t":"pix","x":5,"y":0},{"p":[0,0,"MT"],"t":"pix","x":5,"y":1},{"p":[0,0,"MT"],"t":"pix","x":5,"y":2},{"p":[0,0,"MT"],"t":"pix","x":5,"y":3},
        {"p":[0,0,"MT"],"t":"pix","x":6,"y":4},{"p":[0,0,"MT"],"t":"pix","x":6,"y":5},
        {"p":[0,0,"MT"],"t":"pix","x":9,"y":0},{"p":[0,0,"MT"],"t":"pix","x":9,"y":1},{"p":[0,0,"MT"],"t":"pix","x":9,"y":2},
        {"p":[0,0,"MT"],"t":"pix","x":10,"y":3},{"p":[0,0,"MT"],"t":"pix","x":10,"y":4},
        {"p":[0,0,"MT"],"t":"pix","x":13,"y":0},{"p":[0,0,"MT"],"t":"pix","x":14,"y":1},{"p":[0,0,"MT"],"t":"pix","x":14,"y":2},
        {"p":[0,0,"MT"],"t":"pix","x":13,"y":3},{"p":[0,0,"MT"],"t":"pix","x":14,"y":4},{"p":[0,0,"MT"],"t":"pix","x":15,"y":5},
    ]),
    # ── Portal ──
    ("portal", 16, 16, [
        {"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"SH"},
        {"t":"rect","x":2,"y":2,"w":12,"h":12,"c":"BL"},
        {"t":"rect","x":4,"y":4,"w":8,"h":8,"c":"PL"},
        {"t":"rect","x":6,"y":6,"w":4,"h":4,"c":"WH"},
        {"p":[0,0,"BL"],"t":"pix","x":1,"y":1},{"p":[0,0,"BL"],"t":"pix","x":14,"y":1},
        {"p":[0,0,"PL"],"t":"pix","x":3,"y":3},{"p":[0,0,"PL"],"t":"pix","x":12,"y":3},
    ]),
    ("crystal", 8, 12, [
        {"p":[0,0,"BL"],"t":"pix","x":3,"y":0},{"p":[0,0,"BL"],"t":"pix","x":4,"y":0},
        {"p":[0,0,"BL"],"t":"pix","x":2,"y":1},{"p":[0,0,"WH"],"t":"pix","x":3,"y":1},{"p":[0,0,"BL"],"t":"pix","x":5,"y":1},
        {"p":[0,0,"BL"],"t":"pix","x":1,"y":2},{"p":[0,0,"WH"],"t":"pix","x":2,"y":2},{"p":[0,0,"BL"],"t":"pix","x":5,"y":2},{"p":[0,0,"BL"],"t":"pix","x":6,"y":2},
        {"p":[0,0,"BL"],"t":"pix","x":2,"y":3},{"p":[0,0,"WH"],"t":"pix","x":3,"y":3},{"p":[0,0,"BL"],"t":"pix","x":5,"y":3},
        {"p":[0,0,"BL"],"t":"pix","x":3,"y":4},{"p":[0,0,"WH"],"t":"pix","x":4,"y":4},
        {"p":[0,0,"BL"],"t":"pix","x":4,"y":5},
        {"p":[0,0,"BL"],"t":"pix","x":3,"y":6},{"p":[0,0,"BL"],"t":"pix","x":4,"y":6},
        {"p":[0,0,"ST"],"t":"pix","x":3,"y":7},{"p":[0,0,"ST"],"t":"pix","x":4,"y":7},
    ]),
    # ── Undead / Grim ──
    ("gravestone", 12, 16, [
        {"t":"rect","x":2,"y":2,"w":8,"h":8,"c":"LT"},
        {"t":"rect","x":1,"y":0,"w":10,"h":3,"c":"ST"},
        {"t":"rect","x":4,"y":10,"w":4,"h":2,"c":"ST"},
        {"t":"rect","x":3,"y":12,"w":6,"h":4,"c":"DK"},
        {"p":[0,0,"SH"],"t":"pix","x":1,"y":2},{"p":[0,0,"SH"],"t":"pix","x":2,"y":4},
    ]),
    ("bones_pile", 12, 8, [
        {"p":[0,0,"SK"],"t":"pix","x":2,"y":0},{"p":[0,0,"SK"],"t":"pix","x":5,"y":1},{"p":[0,0,"SK"],"t":"pix","x":9,"y":0},
        {"p":[0,0,"SK"],"t":"pix","x":0,"y":3},{"p":[0,0,"SK"],"t":"pix","x":1,"y":3},{"p":[0,0,"SK"],"t":"pix","x":2,"y":4},
        {"p":[0,0,"SK"],"t":"pix","x":5,"y":3},{"p":[0,0,"SK"],"t":"pix","x":6,"y":4},
        {"p":[0,0,"SK"],"t":"pix","x":9,"y":2},{"p":[0,0,"SK"],"t":"pix","x":10,"y":3},
        {"p":[0,0,"SK"],"t":"pix","x":3,"y":5},{"p":[0,0,"SK"],"t":"pix","x":7,"y":5},
        {"p":[0,0,"SK"],"t":"pix","x":4,"y":7},{"p":[0,0,"SK"],"t":"pix","x":8,"y":6},
        {"p":[0,0,"SH"],"t":"pix","x":0,"y":4},{"p":[0,0,"SH"],"t":"pix","x":12,"y":3},
    ]),
    # ── Environment ──
    ("cobweb", 16, 16, [
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":0},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":2},{"p":[0,0,"WH"],"t":"pix","x":2,"y":0},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":4},{"p":[0,0,"WH"],"t":"pix","x":2,"y":2},{"p":[0,0,"WH"],"t":"pix","x":4,"y":0},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":6},{"p":[0,0,"WH"],"t":"pix","x":2,"y":4},{"p":[0,0,"WH"],"t":"pix","x":4,"y":2},{"p":[0,0,"WH"],"t":"pix","x":6,"y":0},
        {"p":[0,0,"WH"],"t":"pix","x":0,"y":8},{"p":[0,0,"WH"],"t":"pix","x":2,"y":6},{"p":[0,0,"WH"],"t":"pix","x":4,"y":4},{"p":[0,0,"WH"],"t":"pix","x":6,"y":2},{"p":[0,0,"WH"],"t":"pix","x":8,"y":0},
        {"p":[0,0,"WH"],"t":"pix","x":2,"y":8},{"p":[0,0,"WH"],"t":"pix","x":4,"y":6},{"p":[0,0,"WH"],"t":"pix","x":6,"y":4},{"p":[0,0,"WH"],"t":"pix","x":8,"y":2},
        {"p":[0,0,"WH"],"t":"pix","x":4,"y":8},{"p":[0,0,"WH"],"t":"pix","x":6,"y":6},{"p":[0,0,"WH"],"t":"pix","x":8,"y":4},
        {"p":[0,0,"WH"],"t":"pix","x":6,"y":8},{"p":[0,0,"WH"],"t":"pix","x":8,"y":6},
        {"p":[0,0,"WH"],"t":"pix","x":8,"y":8},
    ]),
    ("mushroom", 8, 8, [
        {"t":"rect","x":2,"y":5,"w":4,"h":3,"c":"ST"},
        {"t":"rect","x":0,"y":2,"w":8,"h":3,"c":"RD"},
        {"t":"rect","x":1,"y":4,"w":6,"h":1,"c":"PL"},
        {"p":[0,0,"WH"],"t":"pix","x":3,"y":2},{"p":[0,0,"WH"],"t":"pix","x":5,"y":2},
    ]),
    ("sign_post", 8, 16, [
        {"t":"rect","x":3,"y":0,"w":2,"h":16,"c":"WD"},
        {"t":"rect","x":0,"y":2,"w":8,"h":6,"c":"WD2"},
        {"t":"rect","x":1,"y":3,"w":6,"h":4,"c":"ST"},
        {"p":[0,0,"SH"],"t":"pix","x":0,"y":3},{"p":[0,0,"SH"],"t":"pix","x":1,"y":7},
        {"p":[0,0,"DK"],"t":"pix","x":2,"y":4},{"p":[0,0,"DK"],"t":"pix","x":3,"y":5},
    ]),
    ("chain", 4, 16, [
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":0},{"p":[0,0,"MT"],"t":"pix","x":2,"y":0},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":1},{"p":[0,0,"MT"],"t":"pix","x":3,"y":1},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":2},{"p":[0,0,"MT"],"t":"pix","x":2,"y":2},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":3},{"p":[0,0,"MT"],"t":"pix","x":3,"y":3},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":4},{"p":[0,0,"MT"],"t":"pix","x":2,"y":4},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":5},{"p":[0,0,"MT"],"t":"pix","x":3,"y":5},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":6},{"p":[0,0,"MT"],"t":"pix","x":2,"y":6},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":7},{"p":[0,0,"MT"],"t":"pix","x":3,"y":7},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":8},{"p":[0,0,"MT"],"t":"pix","x":2,"y":8},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":9},{"p":[0,0,"MT"],"t":"pix","x":3,"y":9},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":10},{"p":[0,0,"MT"],"t":"pix","x":2,"y":10},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":11},{"p":[0,0,"MT"],"t":"pix","x":3,"y":11},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":12},{"p":[0,0,"MT"],"t":"pix","x":2,"y":12},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":13},{"p":[0,0,"MT"],"t":"pix","x":3,"y":13},
        {"p":[0,0,"MT"],"t":"pix","x":1,"y":14},{"p":[0,0,"MT"],"t":"pix","x":2,"y":14},
        {"p":[0,0,"MT"],"t":"pix","x":0,"y":15},{"p":[0,0,"MT"],"t":"pix","x":3,"y":15},
    ]),
    ("bars", 16, 16, [
        {"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"BK"},
        {"t":"rect","x":0,"y":0,"w":16,"h":2,"c":"MT"},
        {"t":"rect","x":0,"y":14,"w":16,"h":2,"c":"MT"},
        {"t":"rect","x":2,"y":0,"w":2,"h":16,"c":"MT"},
        {"t":"rect","x":7,"y":0,"w":2,"h":16,"c":"MT"},
        {"t":"rect","x":12,"y":0,"w":2,"h":16,"c":"MT"},
        {"p":[0,0,"SH"],"t":"pix","x":4,"y":1},{"p":[0,0,"SH"],"t":"pix","x":9,"y":1},
    ]),
    ("chest_mimic", 16, 16, [
        {"t":"rect","x":2,"y":4,"w":12,"h":8,"c":"WD2"},
        {"t":"rect","x":1,"y":2,"w":14,"h":3,"c":"WD"},
        {"t":"rect","x":6,"y":6,"w":4,"h":3,"c":"BK"},
        {"p":[0,0,"WH"],"t":"pix","x":3,"y":3},{"p":[0,0,"WH"],"t":"pix","x":6,"y":2},
        {"p":[0,0,"WH"],"t":"pix","x":4,"y":3},{"p":[0,0,"WH"],"t":"pix","x":8,"y":2},
        {"p":[0,0,"WH"],"t":"pix","x":5,"y":3},{"p":[0,0,"WH"],"t":"pix","x":11,"y":3},
        {"p":[0,0,"RD"],"t":"pix","x":4,"y":7},{"p":[0,0,"RD"],"t":"pix","x":11,"y":7},
        {"p":[0,0,"SH"],"t":"pix","x":1,"y":13},
    ]),
]


# ═══════════════════════════════════════════════════════════════
# ═══════════════════════════════════════════════════════════════
#  CUTE ANIMALS PACK — pixel-grid hand-crafted animals
# ═══════════════════════════════════════════════════════════════
ANIMALS = {
    "cow": (16, 16, [
        [-1,-1,-1,-1,-1,-1, 7, 7, 7, 7,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1,-1,-1],
        [-1,-1, 7, 7, 7, 7, 7,18,18, 7, 7, 7, 7, 7,-1,-1],
        [-1, 7, 7, 7, 0, 0, 7, 7, 7, 7, 0, 0, 7, 7, 7,-1],
        [-1, 7, 7, 0, 0, 7, 7, 7, 7, 7, 7, 0, 0, 7, 7,-1],
        [ 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7,19,19, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7,18, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,18, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [-1, 7, 7, 7,-1, 7, 7, 7, 7, 7, 7,-1, 7, 7, 7,-1],
        [-1, 7, 7, 7,-1, 0, 7, 7, 7, 7, 0,-1, 7, 7, 7,-1],
        [-1,-1, 0, 0,-1,-1, 0, 0, 0, 0,-1,-1, 0, 0,-1,-1],
        [-1,-1,-1,-1,-1,24,24,24,24,24,24,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),
    "pig": (16, 16, [
        [-1,-1,-1,-1, 8, 8, 8, 8, 8, 8, 8, 8,-1,-1,-1,-1],
        [-1,-1,-1, 8,18,18, 8, 8, 8, 8,18,18, 8,-1,-1,-1],
        [-1,-1, 8,18, 8, 8, 8, 8, 8, 8, 8, 8,18, 8,-1,-1],
        [-1, 8,18, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,18, 8,-1],
        [-1, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,-1],
        [ 8,18, 8, 8, 8, 8, 8,19,19, 8, 8, 8, 8, 8,18, 8],
        [ 8,18, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,18, 8],
        [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
        [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
        [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
        [-1, 8, 8, 8,-1, 8, 8, 8, 8, 8, 8,-1, 8, 8, 8,-1],
        [-1, 8, 8, 8,-1, 0, 8, 8, 8, 8, 0,-1, 8, 8, 8,-1],
        [-1,-1, 0, 0,-1,-1, 0, 0, 0, 0,-1,-1, 0, 0,-1,-1],
        [-1,-1,-1,-1,-1,24,24,24,24,24,24,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),
    "sheep": (16, 16, [
        [-1,-1,-1,-1, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1,-1,-1],
        [-1,-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1],
        [-1, 7, 7, 7, 7, 7,17,17,17,17, 7, 7, 7, 7, 7,-1],
        [ 7, 7, 7, 7, 7,17, 7, 7, 7, 7,17, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7,17, 7,19,19, 7,17, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7,17, 7, 7, 7, 7,17, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1],
        [-1,-1, 7, 7, 7, 7, 0, 7, 7, 0, 7, 7, 7, 7,-1,-1],
        [-1,-1, 7, 7, 7, 7, 0, 0, 0, 0, 7, 7, 7, 7,-1,-1],
        [-1,-1,-1,-1,-1,-1, 0, 0, 0, 0,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,24,24,24,24,24,24,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),
    "chicken": (12, 12, [
        [-1,-1,-1,-1,-1, 8, 8, 8,-1,-1,-1,-1],
        [-1,-1,-1, 9, 9, 9, 9, 9, 9, 9,-1,-1],
        [-1,-1, 9, 9, 9, 9,10,10, 9, 9, 9,-1],
        [-1, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9,-1],
        [-1, 9, 9, 9,19, 9, 9, 9,19, 9, 9,-1],
        [ 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
        [ 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
        [ 9, 9, 9, 9, 9,19,19, 9, 9, 9, 9, 9],
        [-1, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9,-1],
        [-1, 9, 9,-1,-1, 0, 9, 0,-1,-1, 9,-1],
        [-1,-1, 0,-1,-1,-1, 0, 0,-1,-1, 0,-1],
        [-1,-1,-1,-1,-1,24,24,24,-1,-1,-1,-1],
    ]),
    "duck": (12, 12, [
        [-1,-1,-1,-1, 7, 7, 7, 7,-1,-1,-1,-1],
        [-1,-1, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1],
        [-1, 7, 7, 7,19, 7, 7, 7,19, 7, 7,-1],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7,19,19, 7, 7, 7, 7, 7],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1],
        [-1,-1, 7, 7, 7, 9, 9, 7, 7, 7,-1,-1],
        [-1,-1, 9, 9,-1, 0, 7, 0,-1, 9, 9,-1],
        [-1,-1,-1,-1,-1, 0, 0, 0,-1,-1,-1,-1],
        [-1,-1,-1,-1,24,24,24,24,24,-1,-1,-1],
    ]),
    "rabbit": (12, 14, [
        [-1,-1,-1, 7, 7,-1,-1,-1,-1, 7, 7,-1],
        [-1,-1, 7, 7, 7,-1,-1,-1,-1, 7, 7, 7],
        [-1,-1, 7, 7, 7,-1,-1,-1,-1, 7, 7, 7],
        [-1,-1, 7,17, 7,-1,-1,-1,-1, 7,17, 7],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7,19,19, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [-1, 7, 7, 7, 7, 0, 7, 7, 0, 7, 7, 7],
        [-1,-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [-1,-1,-1,-1,24,24,24,24,24,24,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),
}


#  FARMING PACK — crops, fences, tools, buildings
# ═══════════════════════════════════════════════════════════════
FARMING = [
    # Crops
    ("wheat", 16, 16, [
        {"t":"pix","x":7,"y":4,"p":[(0,0,"YL"),(1,0,"YL")]},
        {"t":"pix","x":6,"y":5,"p":[(0,0,"YL"),(1,0,"YL"),(2,0,"YL"),(3,0,"YL")]},
        {"t":"pix","x":6,"y":6,"p":[(0,0,"GN"),(1,0,"GN"),(2,0,"GN"),(3,0,"GN")]},
        {"t":"rect","x":7,"y":7,"w":2,"h":7,"c":"GN"},      # stalk
        {"t":"pix","x":7,"y":14,"p":[(0,0,"BR"),(1,0,"BR")]},# dirt
        {"t":"pix","x":6,"y":15,"p":[(0,0,"SH")]},           # shadow
    ]),
    ("corn", 16, 16, [
        {"t":"rect","x":7,"y":2,"w":2,"h":11,"c":"GN"},     # stalk
        {"t":"pix","x":5,"y":2,"p":[(0,0,"GN"),(1,0,"GN")]}, # leaf left
        {"t":"pix","x":10,"y":4,"p":[(0,0,"GN"),(1,0,"GN")]},# leaf right
        {"t":"pix","x":6,"y":1,"p":[(0,0,"YL"),(1,0,"YL"),(2,0,"YL")]},  # tassel
        {"t":"pix","x":6,"y":6,"p":[(0,0,"YL"),(1,0,"YL"),(2,0,"YL")]},  # corn ear
        {"t":"pix","x":7,"y":6,"p":[(0,0,"OR"),(1,0,"OR")]},# corn color
        {"t":"pix","x":7,"y":13,"p":[(0,0,"BR"),(1,0,"BR")]},# dirt
        {"t":"pix","x":6,"y":15,"p":[(0,0,"SH")]},           # shadow
    ]),
    ("carrot", 16, 16, [
        {"t":"pix","x":7,"y":4,"p":[(0,0,"GN"),(1,0,"GN")]}, # leaves
        {"t":"pix","x":6,"y":3,"p":[(0,0,"GN"),(1,0,"GN")]},
        {"t":"pix","x":8,"y":3,"p":[(0,0,"GN"),(1,0,"GN")]},
        {"t":"pix","x":7,"y":6,"p":[(0,0,"OR"),(1,0,"OR")]},  # carrot top
        {"t":"rect","x":6,"y":7,"w":3,"h":6,"c":"OR"},       # carrot body
        {"t":"pix","x":7,"y":11,"p":[(0,0,"RD"),(1,0,"RD")]},# tip
        {"t":"pix","x":7,"y":13,"p":[(0,0,"BR")]},           # dirt
        {"t":"pix","x":7,"y":14,"p":[(0,0,"BR")]},
    ]),
    ("tomato", 12, 14, [
        {"t":"rect","x":2,"y":2,"w":8,"h":6,"c":"RD"},       # fruit
        {"t":"pix","x":3,"y":3,"p":[(0,0,"OR"),(1,0,"OR")]}, # highlight
        {"t":"pix","x":5,"y":1,"p":[(0,0,"GN"),(1,0,"GN")]},  # stem
        {"t":"pix","x":6,"y":1,"p":[(0,0,"GN")]},
        {"t":"pix","x":5,"y":0,"p":[(0,0,"GN"),(1,0,"GN")]},  # leaf
        {"t":"rect","x":5,"y":8,"w":2,"h":4,"c":"GN"},       # vine
        {"t":"pix","x":0,"y":12,"p":[(0,0,"SH")]},            # shadow
    ]),
    # Fences
    ("fence_wood", 16, 16, [
        {"t":"rect","x":2,"y":2,"w":2,"h":12,"c":"WD"},      # left post
        {"t":"rect","x":12,"y":2,"w":2,"h":12,"c":"WD"},     # right post
        {"t":"rect","x":4,"y":4,"w":8,"h":2,"c":"WD2"},      # top rail
        {"t":"rect","x":4,"y":9,"w":8,"h":2,"c":"WD2"},      # bottom rail
        {"t":"pix","x":1,"y":1,"p":[(0,0,"WD")]},             # post top
        {"t":"pix","x":12,"y":1,"p":[(0,0,"WD")]},
        {"t":"pix","x":2,"y":14,"p":[(0,0,"SH")]},            # shadow
    ]),
    ("fence_stone", 16, 16, [
        {"t":"rect","x":1,"y":4,"w":3,"h":3,"c":"ST"},       # stone 1
        {"t":"rect","x":5,"y":2,"w":3,"h":3,"c":"MT"},       # stone 2
        {"t":"rect","x":9,"y":5,"w":3,"h":3,"c":"ST"},       # stone 3
        {"t":"rect","x":2,"y":8,"w":3,"h":3,"c":"MT"},       # stone 4
        {"t":"rect","x":6,"y":7,"w":4,"h":3,"c":"ST"},       # stone 5
        {"t":"rect","x":10,"y":9,"w":3,"h":3,"c":"MT"},      # stone 6
        {"t":"rect","x":1,"y":12,"w":2,"h":3,"c":"HL"},      # highlight
        {"t":"pix","x":2,"y":14,"p":[(0,0,"SH")]},
    ]),
    ("gate_wood", 16, 16, [
        {"t":"rect","x":1,"y":1,"w":2,"h":14,"c":"WD"},      # left post
        {"t":"rect","x":13,"y":1,"w":2,"h":14,"c":"WD"},     # right post
        {"t":"rect","x":3,"y":3,"w":10,"h":2,"c":"WD2"},     # top bar
        {"t":"rect","x":4,"y":10,"w":8,"h":2,"c":"WD2"},     # bottom bar
        {"t":"pix","x":6,"y":5,"p":[(0,0,"WD"),(1,0,"WD")]},  # cross
        {"t":"pix","x":7,"y":6,"p":[(0,0,"WD")]},
        {"t":"pix","x":8,"y":6,"p":[(0,0,"WD")]},
        {"t":"pix","x":3,"y":13,"p":[(0,0,"SH")]},
    ]),
    # Tools
    ("watering_can", 12, 12, [
        {"t":"rect","x":2,"y":3,"w":8,"h":6,"c":"MT"},       # can body
        {"t":"pix","x":3,"y":4,"p":[(0,0,"HL"),(1,0,"HL")]}, # highlight
        {"t":"pix","x":9,"y":2,"p":[(0,0,"MT"),(1,0,"MT")]},  # spout
        {"t":"pix","x":10,"y":1,"p":[(0,0,"MT")]},
        {"t":"pix","x":5,"y":1,"p":[(0,0,"WD"),(1,0,"WD")]},  # handle
        {"t":"pix","x":1,"y":10,"p":[(0,0,"SH")]},
    ]),
    ("hoe", 16, 8, [
        {"t":"rect","x":3,"y":2,"w":2,"h":5,"c":"WD"},       # handle
        {"t":"pix","x":3,"y":1,"p":[(0,0,"WD2")]},            # handle top
        {"t":"rect","x":1,"y":5,"w":6,"h":2,"c":"MT"},        # blade
        {"t":"pix","x":2,"y":5,"p":[(0,0,"HL")]},             # blade edge
        {"t":"pix","x":7,"y":6,"p":[(0,0,"MT")]},             # blade tip
        {"t":"pix","x":0,"y":6,"p":[(0,0,"SH")]},
    ]),
    ("hay_bale", 14, 12, [
        {"t":"rect","x":2,"y":2,"w":10,"h":8,"c":"YL"},      # bale body
        {"t":"pix","x":3,"y":3,"p":[(0,0,"OR"),(1,0,"OR")]},  # texture
        {"t":"pix","x":8,"y":5,"p":[(0,0,"OR"),(1,0,"OR")]},
        {"t":"pix","x":4,"y":8,"p":[(0,0,"OR"),(1,0,"OR")]},
        {"t":"pix","x":1,"y":2,"p":[(0,0,"BR"),(0,1,"BR")]},  # shadow edge
        {"t":"pix","x":13,"y":3,"p":[(0,0,"BR")]},
        {"t":"pix","x":1,"y":11,"p":[(0,0,"SH")]},
    ]),
    ("barn_small", 16, 16, [
        {"t":"rect","x":2,"y":4,"w":12,"h":10,"c":"RD"},     # barn body
        {"t":"rect","x":1,"y":1,"w":14,"h":4,"c":"DB"},       # roof
        {"t":"pix","x":0,"y":4,"p":[(0,0,"DB")]},             # roof edge
        {"t":"pix","x":15,"y":4,"p":[(0,0,"DB")]},
        {"t":"rect","x":6,"y":8,"w":4,"h":6,"c":"DB"},        # door
        {"t":"pix","x":7,"y":11,"p":[(0,0,"GD"),(1,0,"GD")]}, # door handle
        {"t":"pix","x":3,"y":6,"p":[(0,0,"HL"),(1,0,"HL")]},  # window left
        {"t":"pix","x":11,"y":6,"p":[(0,0,"HL"),(1,0,"HL")]}, # window right
        {"t":"pix","x":2,"y":15,"p":[(0,0,"SH")]},            # shadow
    ]),
]



def generate_tiles(output_dir: Path):
    """Generate all dungeon tiles via Aseprite."""
    output_dir.mkdir(parents=True, exist_ok=True)
    tiles_dir = output_dir / "tiles"
    tiles_dir.mkdir(exist_ok=True)

    # Floor tiles (16×16)
    floors = [
        ("floor_1", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"ST"},
                     {"p":[1,1,"DK"],"t":"pix","x":3},{"p":[8,3,"LT"],"t":"pix","x":11},{"p":[5,10,"SH"],"t":"pix","x":2},
                     {"p":[0,0,"O"],"t":"pix","x":14},{"p":[0,0,"O"],"t":"pix","x":7,"y":14}]),
        ("floor_2", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"ST"},
                     {"p":[0,0,"DK"],"t":"pix","x":2,"y":2},{"p":[2,0,"DK"],"t":"pix","x":6,"y":5},{"p":[0,0,"LT"],"t":"pix","x":9,"y":3},
                     {"p":[0,0,"SH"],"t":"pix","x":4,"y":11},{"p":[0,0,"SH"],"t":"pix","x":13,"y":8}]),
        ("floor_3", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"LT"},
                     {"p":[0,0,"ST"],"t":"pix","x":2,"y":0},{"p":[0,0,"ST"],"t":"pix","x":5,"y":2},{"p":[2,0,"DK"],"t":"pix","x":10,"y":7},
                     {"p":[0,0,"SH"],"t":"pix","x":0,"y":10},{"p":[0,0,"SH"],"t":"pix","x":7,"y":14}]),
        ("floor_4", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"ST"},
                     {"p":[0,0,"DK"],"t":"pix","x":3},{"p":[0,0,"LT"],"t":"pix","x":6,"y":1},
                     {"p":[0,0,"SH"],"t":"pix","x":1,"y":7},{"p":[2,0,"SH"],"t":"pix","x":8,"y":5}]),
        ("floor_5_cracked", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"LT"},
                     {"p":[0,0,"DK"],"t":"pix","x":0,"y":2},{"p":[1,0,"DK"],"t":"pix","x":4,"y":8},
                     {"p":[2,0,"BK"],"t":"pix","x":3,"y":6},{"p":[3,0,"BK"],"t":"pix","x":10,"y":9},
                     {"p":[0,0,"SH"],"t":"pix","x":12,"y":2},{"p":[0,0,"SH"],"t":"pix","x":14,"y":12}]),
        ("floor_6_mossy", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"ST"},
                     {"p":[0,0,"MG"],"t":"pix","x":1},{"p":[1,0,"MG"],"t":"pix","x":3},
                     {"p":[0,0,"GR"],"t":"pix","x":11,"y":1},{"p":[0,0,"GR"],"t":"pix","x":0,"y":8},
                     {"p":[0,0,"GR"],"t":"pix","x":13,"y":13},{"p":[0,0,"MG"],"t":"pix","x":5,"y":14}]),
        ("floor_7", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"ST"},
                     {"p":[0,0,"LT"],"t":"pix","x":4,"y":4},{"p":[0,0,"DK"],"t":"pix","x":11,"y":3}]),
        ("floor_8", [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"LT"},
                     {"p":[0,0,"ST"],"t":"pix","x":7,"y":7},{"p":[0,0,"DK"],"t":"pix","x":2,"y":12}]),
    ]

    # Wall tiles (16×16 & 16×32)
    walls = [
        ("wall_mid", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"p":[0,0,"ST"],"t":"pix","x":0,"y":2},{"p":[3,0,"ST"],"t":"pix","x":5,"y":4},
                     {"p":[0,0,"ST"],"t":"pix","x":8,"y":9},{"p":[0,0,"ST"],"t":"pix","x":2,"y":13},
                     {"p":[0,0,"LT"],"t":"pix","x":12,"y":2},{"p":[0,0,"LT"],"t":"pix","x":11,"y":7}]),
        ("wall_top", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":1,"y":0,"w":14,"h":3,"c":"ST"},
                     {"p":[0,0,"LT"],"t":"pix","x":2,"y":4},{"p":[0,0,"LT"],"t":"pix","x":5,"y":6},
                     {"p":[0,0,"ST"],"t":"pix","x":9,"y":5},{"p":[0,0,"ST"],"t":"pix","x":1,"y":10}]),
        ("wall_left", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":0,"y":0,"w":4,"h":16,"c":"ST"},
                     {"p":[0,0,"LT"],"t":"pix","x":5,"y":2},{"p":[0,0,"LT"],"t":"pix","x":6,"y":8}]),
        ("wall_right", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":12,"y":0,"w":4,"h":16,"c":"ST"},
                     {"p":[0,0,"LT"],"t":"pix","x":8,"y":3},{"p":[0,0,"LT"],"t":"pix","x":9,"y":11}]),
        ("wall_corner_tl", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":0,"y":0,"w":4,"h":16,"c":"ST"},
                     {"t":"rect","x":0,"y":0,"w":16,"h":3,"c":"ST"}]),
        ("wall_corner_tr", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":12,"y":0,"w":4,"h":16,"c":"ST"},
                     {"t":"rect","x":0,"y":0,"w":16,"h":3,"c":"ST"}]),
        ("wall_corner_bl", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":0,"y":0,"w":4,"h":16,"c":"ST"},
                     {"t":"rect","x":0,"y":13,"w":16,"h":3,"c":"SH"}]),
        ("wall_corner_br", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":12,"y":0,"w":4,"h":16,"c":"ST"},
                     {"t":"rect","x":0,"y":13,"w":16,"h":3,"c":"SH"}]),
        ("wall_hole", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"p":[0,0,"ST"],"t":"pix","x":2,"y":2},{"p":[3,0,"ST"],"t":"pix","x":6,"y":4},
                     {"p":[0,0,"BK"],"t":"pix","x":5,"y":6},{"p":[3,0,"BK"],"t":"pix","x":4,"y":8},
                     {"p":[0,0,"ST"],"t":"pix","x":2,"y":12},{"p":[0,0,"LT"],"t":"pix","x":11,"y":3}]),
        ("wall_brick", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"p":[0,0,"ST"],"t":"pix","x":0,"y":4},{"p":[7,0,"ST"],"t":"pix","x":0,"y":8},
                     {"p":[7,0,"ST"],"t":"pix","x":1,"y":12},
                     {"p":[0,0,"LT"],"t":"pix","x":3,"y":1},{"p":[0,0,"LT"],"t":"pix","x":11,"y":1}]),
        ("wall_banner", 16, 16, [{"t":"rect","x":0,"y":0,"w":16,"h":16,"c":"DK"},
                     {"t":"rect","x":3,"y":0,"w":10,"h":14,"c":"RD"},
                     {"t":"rect","x":2,"y":0,"w":2,"h":14,"c":"SH"},
                     {"p":[0,0,"GD"],"t":"pix","x":6,"y":3},{"p":[0,0,"GD"],"t":"pix","x":6,"y":6},{"p":[0,0,"GD"],"t":"pix","x":6,"y":9}]),
    ]

    # Objects / Items
    objects = [
        ("chest_closed", 16, 16, [{"t":"rect","x":3,"y":4,"w":10,"h":8,"c":"WD2"},
                     {"t":"rect","x":2,"y":3,"w":12,"h":3,"c":"WD"},
                     {"t":"rect","x":6,"y":6,"w":4,"h":3,"c":"GD"},
                     {"p":[0,0,"SH"],"t":"pix","x":4,"y":10},{"p":[0,0,"SH"],"t":"pix","x":8,"y":10}]),
        ("chest_open", 16, 16, [{"t":"rect","x":3,"y":6,"w":10,"h":6,"c":"WD2"},
                     {"t":"rect","x":2,"y":1,"w":12,"h":3,"c":"WD"},  # lid open
                     {"p":[0,0,"BK"],"t":"pix","x":3,"y":5},{"p":[5,0,"BK"],"t":"pix","x":3,"y":5},
                     {"p":[0,0,"GD"],"t":"pix","x":7,"y":7}]),
        ("column", 8, 32, [{"t":"rect","x":1,"y":0,"w":6,"h":32,"c":"ST"},
                     {"t":"rect","x":0,"y":0,"w":8,"h":3,"c":"LT"},
                     {"t":"rect","x":0,"y":29,"w":8,"h":3,"c":"SH"},
                     {"p":[0,0,"DK"],"t":"pix","x":2,"y":8},{"p":[0,0,"DK"],"t":"pix","x":2,"y":16},{"p":[0,0,"DK"],"t":"pix","x":2,"y":24}]),
        ("doors_closed", 16, 32, [{"t":"rect","x":0,"y":0,"w":16,"h":32,"c":"WD"},
                     {"t":"rect","x":3,"y":2,"w":10,"h":28,"c":"WD2"},
                     {"p":[0,0,"GD"],"t":"pix","x":6,"y":14},{"p":[0,0,"GD"],"t":"pix","x":8,"y":14},
                     {"p":[0,0,"SH"],"t":"pix","x":1,"y":1},{"p":[8,0,"SH"],"t":"pix","x":1,"y":1}]),
        ("coin_anim", 8, 8, [{"t":"rect","x":2,"y":1,"w":4,"h":6,"c":"GD"},
                     {"p":[0,0,"YL"],"t":"pix","x":3,"y":2},{"p":[0,0,"YL"],"t":"pix","x":4,"y":3},{"p":[0,0,"YL"],"t":"pix","x":2,"y":5}]),
        ("potion_red", 8, 8, [{"t":"rect","x":2,"y":0,"w":4,"h":4,"c":"RD"},
                     {"t":"rect","x":3,"y":4,"w":2,"h":2,"c":"ST"},
                     {"t":"rect","x":2,"y":6,"w":4,"h":2,"c":"ST"}]),
        ("potion_green", 8, 8, [{"t":"rect","x":2,"y":0,"w":4,"h":4,"c":"GN"},
                     {"t":"rect","x":3,"y":4,"w":2,"h":2,"c":"ST"},
                     {"t":"rect","x":2,"y":6,"w":4,"h":2,"c":"ST"}]),
        ("potion_blue", 8, 8, [{"t":"rect","x":2,"y":0,"w":4,"h":4,"c":"BL"},
                     {"t":"rect","x":3,"y":4,"w":2,"h":2,"c":"ST"},
                     {"t":"rect","x":2,"y":6,"w":4,"h":2,"c":"ST"}]),
        ("key", 8, 8, [{"p":[2,0,"GD"],"t":"pix","x":2,"y":0},{"p":[3,0,"GD"],"t":"pix","x":1,"y":2},
                     {"p":[0,0,"BK"],"t":"pix","x":5,"y":2},{"p":[0,0,"BK"],"t":"pix","x":3,"y":5}]),
        ("sword_basic", 8, 16, [{"t":"rect","x":3,"y":0,"w":2,"h":12,"c":"MT"},
                     {"t":"rect","x":1,"y":12,"w":6,"h":2,"c":"WD"},
                     {"t":"rect","x":2,"y":14,"w":4,"h":2,"c":"WD"}]),
        ("shield_basic", 8, 12, [{"t":"rect","x":1,"y":1,"w":6,"h":10,"c":"WD"},
                     {"t":"rect","x":2,"y":2,"w":4,"h":8,"c":"MT"},
                     {"p":[0,0,"GD"],"t":"pix","x":3,"y":4},{"p":[0,0,"GD"],"t":"pix","x":4,"y":6}]),
    ]

    print("🧱 Generating tiles...")

    print("🧱 Generating tiles...")
    for tile_def in floors + walls:
        name = tile_def[0]
        parts = tile_def[-1]
        tw = 16
        th = 16
        if len(tile_def) == 4:
            tw, th = tile_def[1], tile_def[2]
            parts = tile_def[3]
        script = generate_tile_lua(name, tw, th, parts, tiles_dir)
        script_path = SCRIPTS_DIR / f"_gen_tile_{name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = tiles_dir / f"{name}.png"
        if out.exists():
            print(f"  ✓ {name}.png")

    print("📦 Generating objects...")
    for obj_name, obj_w, obj_h, parts in objects:
        script = generate_tile_lua(obj_name, obj_w, obj_h, parts, tiles_dir)
        script_path = SCRIPTS_DIR / f"_gen_obj_{obj_name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = tiles_dir / f"{obj_name}.png"
        if out.exists():
            print(f"  ✓ {obj_name}.png")

    print(f"✅ Tiles done! Output: {tiles_dir}")


def generate_furniture(output_dir: Path):
    """Generate all furniture sprites via Aseprite."""
    furniture_dir = output_dir / "furniture"
    furniture_dir.mkdir(parents=True, exist_ok=True)

    print("🪑 Generating furniture...")
    for furn_name, furn_w, furn_h, parts in FURNITURE:
        script = generate_tile_lua(furn_name, furn_w, furn_h, parts, furniture_dir)
        script_path = SCRIPTS_DIR / f"_gen_furn_{furn_name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = furniture_dir / f"{furn_name}.png"
        if out.exists():
            print(f"  ✓ {furn_name}.png ({furn_w}×{furn_h})")
        else:
            err = result.stderr.strip()[:120]
            print(f"  ✗ {furn_name}: {err}")

    print(f"✅ Furniture done! Output: {furniture_dir}")


def generate_ui(output_dir: Path):
    """Generate UI element sprites via Aseprite."""
    ui_dir = output_dir / "ui"
    ui_dir.mkdir(parents=True, exist_ok=True)
    print("🖱️ Generating UI elements...")
    for ui_name, ui_w, ui_h, parts in UI_ASSETS:
        script = generate_tile_lua(ui_name, ui_w, ui_h, parts, ui_dir)
        script_path = SCRIPTS_DIR / f"_gen_ui_{ui_name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = ui_dir / f"{ui_name}.png"
        if out.exists():
            print(f"  ✓ {ui_name}.png ({ui_w}×{ui_h})")
        else:
            print(f"  ✗ {ui_name}: {result.stderr.strip()[:80]}")
    print(f"✅ UI done! Output: {ui_dir}")


def generate_weapons(output_dir: Path):
    """Generate weapon/armor sprites via Aseprite."""
    wpn_dir = output_dir / "weapons"
    wpn_dir.mkdir(parents=True, exist_ok=True)
    print("⚔️ Generating weapons & armor...")
    for wpn_name, wpn_w, wpn_h, parts in WEAPON_ASSETS:
        script = generate_tile_lua(wpn_name, wpn_w, wpn_h, parts, wpn_dir)
        script_path = SCRIPTS_DIR / f"_gen_wpn_{wpn_name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = wpn_dir / f"{wpn_name}.png"
        if out.exists():
            print(f"  ✓ {wpn_name}.png ({wpn_w}×{wpn_h})")
        else:
            print(f"  ✗ {wpn_name}: {result.stderr.strip()[:80]}")
    print(f"✅ Weapons done! Output: {wpn_dir}")


def generate_props(output_dir: Path):
    """Generate dungeon prop sprites via Aseprite."""
    prop_dir = output_dir / "props"
    prop_dir.mkdir(parents=True, exist_ok=True)
    print("🏚️ Generating dungeon props...")
    for prop_name, prop_w, prop_h, parts in PROP_ASSETS:
        script = generate_tile_lua(prop_name, prop_w, prop_h, parts, prop_dir)
        script_path = SCRIPTS_DIR / f"_gen_prop_{prop_name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = prop_dir / f"{prop_name}.png"
        if out.exists():
            print(f"  ✓ {prop_name}.png ({prop_w}×{prop_h})")
        else:
            print(f"  ✗ {prop_name}: {result.stderr.strip()[:80]}")
    print(f"✅ Props done! Output: {prop_dir}")


# ═══════════════════════════════════════════════════════════════
#  CREATIVE PIXEL-ART TEMPLATES (hand-crafted, pixel-level control)
# ═══════════════════════════════════════════════════════════════
# Each asset is defined as a 2D grid of palette color indices.
# -1 = transparent.  0=outline/black.  See PALETTE for all indices.
# These are ARTISAN sprites — every pixel placed with intention.

CREATIVE_ASSETS = {
    # ── Magic Crystal (glowing blue gem with white sparkle) ──
    "crystal_magic": (16, 16, [
        [-1,-1,-1,-1,-1,-1,-1, 1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 1,12, 1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1, 1,12,12,12, 1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1, 1,12,12, 7,12,12, 0,-1,-1,-1,-1,-1],
        [-1,-1,-1, 1,12,12, 7, 7, 7,12,12, 1,-1,-1,-1,-1],
        [-1,-1,-1, 0,12, 7, 7, 7, 7, 7,12, 0,-1,-1,-1,-1],
        [-1,-1, 1,12,12, 7, 7, 7, 7, 7,12,12, 1,-1,-1,-1],
        [-1, 1,12,12, 7, 7, 7, 7, 7, 7, 7,12,12, 1,-1,-1],
        [-1, 1,12, 7, 7, 7, 7, 7, 7, 7, 7, 7,12, 1,-1,-1],
        [-1,-1, 1,12, 7, 7, 7, 7, 7, 7, 7,12, 1,-1,-1,-1],
        [-1,-1, 0,12,12, 7, 7, 7, 7, 7,12,12, 0,-1,-1,-1],
        [-1,-1, 1,12,12,12, 7, 7, 7,12,12,12, 1,-1,-1,-1],
        [-1,-1,-1, 0,12,12,12, 7,12,12,12, 0,-1,-1,-1,-1],
        [-1,-1,-1,-1, 1,12,12,12,12,12, 1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1, 0, 1, 0, 1, 0,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),

    # ── Golden Chalice (ornate gold cup with ruby gems) ──
    "chalice_golden": (16, 16, [
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,20,20,20,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,20,10, 9,10,20,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,20,10, 9,20, 9,10,20,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,20, 9,20, 8,20, 9,20,-1,-1,-1,-1,-1],
        [-1,-1,-1, 0, 9,20, 8, 8, 8,20, 9, 0,-1,-1,-1,-1],
        [-1,-1,-1, 9,20, 8, 8, 8, 8, 8,20, 9,-1,-1,-1,-1],
        [-1,-1, 0,20, 8, 8, 8, 8, 8, 8, 8,20, 0,-1,-1,-1],
        [-1,-1, 0,20, 8, 8, 8, 8, 8, 8, 8,20, 0,-1,-1,-1],
        [-1,-1, 0,20, 8, 8, 8, 8, 8, 8, 8,20, 0,-1,-1,-1],
        [-1,-1,-1, 0,20, 8, 8, 8, 8, 8,20, 0,-1,-1,-1,-1],
        [-1,-1,-1,-1, 0,20, 9, 9, 9,20, 0,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,20, 9, 9,20, 9, 9,20,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,20,20, 0,20,20,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 0,20, 0,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1, 0,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),

    # ── Treasure Pile (gold coins with ruby) ──
    "treasure_pile": (16, 16, [
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,10, 9,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,10, 9,10, 9,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,10, 9,10, 9,10,20,-1, 8,-1,-1,-1],
        [-1,-1,-1,-1,10, 9,20, 9,10,20, 9,20, 8, 8,-1,-1],
        [-1,-1,-1,10, 9,20,10,20, 9,20,10, 9, 8, 8, 8,-1],
        [-1,-1,10, 9,20,10, 9,20,10, 9,20,10,20, 8, 8,-1],
        [-1,10, 9,20,10, 9,20,10, 9,20,10, 9,20,10, 8,-1],
        [-1, 9,20,10,20, 8, 8, 8,20,10,20, 9,20,10, 9,-1],
        [-1,20,10, 9, 8, 8, 8, 8,10,20, 9,20,10, 9,20,-1],
        [-1,-1,20,10, 8, 8, 8, 9,20,10,20, 9,20,10,-1,-1],
        [-1,-1,-1, 0,20, 8, 9,20,10, 9,20,10,20, 0,-1,-1],
        [-1,-1,-1,-1, 0,20,10, 9,20,10,20, 9, 0,-1,-1,-1],
        [-1,-1,-1,-1,-1, 0,20,10, 9,20,10, 0,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 0, 0, 0, 0, 0,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1, 0,-1, 0,-1,-1,-1,-1,-1,-1],
    ]),

    # ── Flame Sword (blade with fire particles) ──
    "sword_flame": (16, 16, [
        [-1,-1,-1,-1,-1,-1,-1, 8,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 8,10, 8,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1, 8,10, 9,10, 8,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1, 8,10, 9,10, 9,10, 8,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1, 8,10, 9,10, 8,-1,17,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 8,10, 8,-1,17,17,17,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1, 8,-1,17,17,18,17,17,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,17,18,18,18,17,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,17,17,18,18,17,17,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,17,18,17,17,18,17,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,17,17,17, 0,17,17,17,-1,-1],
        [-1,-1,-1,-1,-1,-1,22,22,17, 0,-1, 0,17,22,-1,-1],
        [-1,-1,-1,-1,-1,-1,22,23,22,22,20,-1,22,22,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,22,23,22,22, 9,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,22,23,22,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,22,-1,-1,-1,-1,-1,-1],
    ]),

    # ── Dragon Egg (purple scaled egg with inner glow) ──
    "egg_dragon": (16, 16, [
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 2,13,13, 2,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1, 2,13,14,14,13, 2,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1, 2,13,14,14,14,14,13, 2,-1,-1,-1,-1],
        [-1,-1,-1, 2,13,14,14,14,14,14,14,13, 2,-1,-1,-1],
        [-1,-1,-1, 2,14,14,14, 7, 7,14,14,14, 2,-1,-1,-1],
        [-1,-1, 2,13,14,14, 7, 7, 7, 7,14,14,13, 2,-1,-1],
        [-1,-1, 2,14,14, 7, 7, 7, 7, 7, 7,14,14, 2,-1,-1],
        [-1,-1, 2,14,14, 7, 7, 7, 7, 7, 7,14,14, 2,-1,-1],
        [-1,-1, 2,14,14,14, 7, 7, 7, 7,14,14,14, 2,-1,-1],
        [-1,-1,-1, 2,14,14,14,14,14,14,14,14, 2,-1,-1,-1],
        [-1,-1,-1, 2,13,14,14,14,14,14,14,13, 2,-1,-1,-1],
        [-1,-1,-1,-1, 2,13,14,14,14,14,13, 2,-1,-1,-1,-1],
        [-1,-1,-1,-1, 0, 2,13,14,14,13, 2, 0,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 2, 2, 2, 2,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1, 0,-1, 0,-1,-1,-1,-1,-1,-1],
    ]),

    # ── Mystic Orb (floating blue orb with electrical energy) ──
    "orb_mystic": (12, 12, [
        [-1,-1,-1,-1, 1,12,12, 1,-1,-1,-1,-1],
        [-1,-1,-1, 1,12,12,12,12, 1,-1,-1,-1],
        [-1,-1, 1,12,12, 7, 7,12,12, 1,-1,-1],
        [-1, 1,12,12, 7, 7, 7, 7,12,12, 1,-1],
        [-1, 1,12, 7, 7, 7, 7, 7, 7,12, 1,-1],
        [ 1,12,12, 7, 7, 7, 7, 7, 7,12,12, 1],
        [ 1,12, 7, 7, 7, 7, 7, 7, 7, 7,12, 1],
        [-1, 1,12, 7, 7, 7, 7, 7, 7,12, 1,-1],
        [-1, 0,12,12, 7, 7, 7, 7,12,12, 0,-1],
        [-1,-1, 1,12,12,12,12,12,12, 1,-1,-1],
        [-1,-1,10, 1, 1, 1, 1, 1, 1,10,-1,-1],
        [-1,-1,-1,10,10,10,-1,10,10,10,-1,-1],
    ]),

    # ── Crown Jewel (ornate gold crown with gems) ──
    "crown_jewel": (16, 12, [
        [-1,-1,-1, 9,20, 9,-1, 9,20, 9,-1, 9,20, 9,-1,-1,-1],
        [-1,-1,20, 9,20, 9,20, 9,20, 9,20, 9,20, 9,20,-1,-1],
        [-1, 9,20, 9,20, 9,20, 9,20, 9,20, 9,20, 9,20, 9,-1],
        [-1,10, 9,20,10,20,10,20,10,20,10,20,10,20, 9,10,-1],
        [-1,-1,10,20, 8,10, 8,10, 8,10, 8,10, 8,20,10,-1,-1],
        [-1,-1,-1,10,20, 8,10, 8,10, 8,10, 8,20,10,-1,-1,-1],
        [-1,-1,-1,-1,10,20, 9,10, 9,10, 9,20,10,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,10,20, 9,20, 9,20,10,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1, 0,10,20,10,20,10, 0,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1, 0,22, 0,22, 0,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1, 0,-1, 0,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),

    # ── Ancient Tome (leather book with golden runes) ──
    "tome_ancient": (12, 16, [
        [-1,-1,-1,22,22,22,22,22,22,-1,-1,-1],
        [-1,-1,22, 8, 8, 8, 8, 8, 8,22,-1,-1],
        [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
        [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
        [22, 8, 8, 8,20, 8, 8,20, 8, 8, 8,22],
        [22, 8, 8, 8, 8,20,20, 8, 8, 8, 8,22],
        [22, 8, 8,20, 8, 8, 8, 8,20, 8, 8,22],
        [22, 8, 8, 8, 8, 8,20, 8, 8, 8, 8,22],
        [22, 8, 8, 8,20, 8, 8,20, 8, 8, 8,22],
        [22, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,22],
        [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
        [-1,22, 8, 8, 8, 8, 8, 8, 8, 8,22,-1],
        [-1, 0,22,20,20,20,20,20,20,22, 0,-1],
        [-1,-1, 0,22,20,20,20,20,22, 0,-1,-1],
        [-1,-1,-1, 0,22,20,20,22, 0,-1,-1,-1],
        [-1,-1,-1,-1, 0,22,22, 0,-1,-1,-1,-1],
    ]),

    # ── Rainbow Potion (swirling colorful liquid) ──
    "potion_rainbow": (8, 12, [
        [-1,-1, 0, 0,-1,-1,-1,-1],
        [-1, 0,17,17, 0,-1,-1,-1],
        [ 0,17,17,17,17, 0,-1,-1],
        [ 0,17,14,12,11,17, 0,-1],
        [ 0,17,14,12,11,10, 0,-1],
        [ 0,17,12,11,10, 9, 0,-1],
        [ 0,17,11,10, 9, 8, 0,-1],
        [ 0,17,10, 9, 8,14, 0,-1],
        [ 0,17, 9,14,12,17, 0,-1],
        [ 0,17,17,17,17, 0,-1,-1],
        [ 0,17,17,17,17, 0,-1,-1],
        [-1, 0, 0, 0, 0, 0,-1,-1],
    ]),

    # ── Phoenix Feather (red-orange glowing feather) ──
    "feather_phoenix": (8, 16, [
        [-1,-1,-1,-1,-1,-1, 8,-1],
        [-1,-1,-1,-1,-1, 8,10, 8],
        [-1,-1,-1,-1, 8,10, 9,10],
        [-1,-1,-1, 8,10, 9,10, 9],
        [-1,-1, 8,10, 9,10, 9,10],
        [-1, 8,10, 9,10, 9,10, 9],
        [ 8,10, 9,10, 9,10, 9,10],
        [10, 9,10, 9,10, 9,10, 9],
        [ 9,10, 9,10, 9,10, 9,10],
        [10, 9,10, 9,10, 9,10, 9],
        [ 9,10, 9,10, 9,10,10, 0],
        [10, 9,10, 9,10,10, 0,-1],
        [ 9,10, 9,10,10, 0,-1,-1],
        [10, 9,10, 9, 0,-1,-1,-1],
        [ 9,10, 9, 0,-1,-1,-1,-1],
        [-1, 0, 0,-1,-1,-1,-1,-1],
    ]),

    # ── Skull Relic (ancient skull with cracks and glow) ──
    "skull_relic": (16, 16, [
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1,-1,-1],
        [-1,-1,-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1,-1],
        [-1,-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1],
        [-1, 7, 7, 7, 0, 7, 7, 7, 7, 7, 0, 7, 7, 7,-1,-1],
        [-1, 7, 7, 0, 0, 0, 7, 7, 7, 0, 0, 0, 7, 7,-1,-1],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,-1,-1],
        [-1, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7,-1,-1],
        [-1, 7, 7, 7, 7, 7, 7, 7, 7, 6, 7, 7, 7, 7,-1,-1],
        [-1,-1, 7, 7, 7, 7, 6, 7, 6, 7, 7, 7, 7,-1,-1,-1],
        [-1,-1, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,-1,-1,-1],
        [-1,-1, 0, 7, 6, 7, 7, 7, 7, 6, 7, 7, 0,-1,-1,-1],
        [-1,-1,-1, 7, 7, 7, 7, 0, 6, 7, 7, 7,-1,-1,-1,-1],
        [-1,-1,-1, 0, 7, 7, 0, 7, 7, 0, 7, 0,-1,-1,-1,-1],
        [-1,-1,-1,-1,10,10, 0,10,10, 0,10,10,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,10,10,10,10,10,10,-1,-1,-1,-1,-1],
    ]),

    # ── Star Charm (5-pointed star with golden glow) ──
    "star_charm": (12, 12, [
        [-1,-1,-1,-1,-1,10,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,10,20,10,-1,-1,-1,-1,-1],
        [-1,-1,-1,10,20,10,20,10,-1,-1,-1,-1],
        [-1,-1,10,20,10,20,10,20,10,-1,-1,-1],
        [-1,10,20,10,20,10,20,10,20,10,-1,-1],
        [10,20,10,20,10,20,10,20,10,20,10,-1],
        [-1,10,20,10,20,10,20,10,20,10,-1,-1],
        [-1,-1,10,20,10,20,10,20,10,-1,-1,-1],
        [-1,-1, 0,10,20,10,20,10, 0,-1,-1,-1],
        [-1,-1,-1, 0,10,20,10, 0,-1,-1,-1,-1],
        [-1,-1,-1,-1, 0,10, 0,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1, 0,-1,-1,-1,-1,-1,-1],
    ]),
}


def generate_pixel_art(name: str, w: int, h: int, pixel_grid: list, output_dir: Path) -> str:
    """Build Aseprite Lua script for a hand-crafted pixel grid sprite."""
    
    out_file = str(output_dir / f"{name}.png").replace("\\", "/")
    
    lines = [f"""-- Aseprite creative pixel art: {name}
local sprite = Sprite({w}, {h}, ColorMode.INDEXED)
local pal = sprite.palettes[1]
"""]
    for i, (r, g, b) in enumerate(PALETTE):
        lines.append(f"pal:setColor({i}, Color{{ r={r}, g={g}, b={b} }})")
    
    lines.append(f"""
local cel = app.activeCel; local img = cel.image
function ps(x,y,c) if x>=0 and x<{w} and y>=0 and y<{h} then img:drawPixel(x,y,c) end end""")
    
    # Write pixel grid
    for y, row in enumerate(pixel_grid):
        for x, color_idx in enumerate(row):
            if color_idx >= 0:
                lines.append(f"ps({x},{y},{color_idx})")
    
    lines.append(f'sprite:saveAs("{out_file}"); print("OK {out_file}"); app.exit()')
    return "\n".join(lines)




def generate_animals(output_dir: Path):
    """Generate cute farming animals via Aseprite pixel grids."""
    animals_dir = output_dir / "animals"
    animals_dir.mkdir(parents=True, exist_ok=True)

    print("🐄 Generating CUTE ANIMALS (pixel-grid hand-crafted)...")
    for name, (w, h, pixel_grid) in ANIMALS.items():
        script = generate_pixel_art(name, w, h, pixel_grid, animals_dir)
        script_path = SCRIPTS_DIR / f"_gen_animal_{name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = animals_dir / f"{name}.png"
        if out.exists():
            print(f"  🐾 {name}.png ({w}×{h})")
        else:
            err = result.stderr.strip()[:100]
            print(f"  ✗ {name}: {err}")

    print(f"✅ Animals done! Output: {animals_dir}")


def generate_farming(output_dir: Path):
    """Generate farming assets via Aseprite."""
    farming_dir = output_dir / "farming"
    farming_dir.mkdir(parents=True, exist_ok=True)

    print("🌾 Generating FARMING assets...")
    for name, w, h, parts in FARMING:
        script = generate_tile_lua(name, w, h, parts, farming_dir)
        script_path = SCRIPTS_DIR / f"_gen_farm_{name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = farming_dir / f"{name}.png"
        if out.exists():
            print(f"  🌱 {name}.png ({w}×{h})")
        else:
            err = result.stderr.strip()[:100]
            print(f"  ✗ {name}: {err}")

    print(f"✅ Farming done! Output: {farming_dir}")


# =============================================================
#  K CUSTOM SPRITES
# =============================================================
K_CUSTOM = {
    # -- Klawf Crab 64x64 -- full detail, shape-drawn --
    "klawf_crab_64": (64, 64, [
        [-1]*64,  # row 0
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 0
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 1
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 2
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,7,7,7,7,7,7,0,0,-1,-1,-1,-1,0,0,7,7,7,7,7,7,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 3
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 4
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 5
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 6
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,0,0,7,0,0,0,7,7,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 7
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 8
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,0,0,0,0,0,0,0,0,0,0,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 9
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,10,10,9,9,8,8,8,8,8,8,8,8,8,9,10,10,9,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 10
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 11
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,-1,-1,-1,-1,9,-1,-1,-1,-1,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 12
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,-1,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,-1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 13
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 14
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 15
        [8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 16
        [-1,8,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,8],  # row 17
        [-1,-1,-1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,-1,-1],  # row 18
        [-1,-1,-1,-1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,-1,-1,-1],  # row 19
        [9,9,9,-1,-1,8,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,10,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,8,-1,-1,9,9],  # row 20
        [9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9],  # row 21
        [9,9,9,9,9,9,8,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,10,10,10,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,8,9,9,9,9,9],  # row 22
        [9,9,9,9,9,9,8,-1,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,8,10,10,10,19,19,7,7,19,7,7,19,7,7,19,19,19,8,8,8,8,8,8,8,8,8,8,8,8,8,8,-1,-1,-1,-1,-1,8,9,9,9,9,9],  # row 23
        [10,9,9,9,9,9,8,-1,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,10,10,10,10,19,0,7,7,0,7,7,0,7,7,0,0,19,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,-1,-1,-1,-1,8,9,9,9,9,9],  # row 24
        [10,10,9,9,9,9,8,-1,-1,-1,-1,8,9,9,9,9,9,14,14,14,14,14,9,10,10,10,19,0,7,7,0,7,7,0,7,7,0,0,19,9,9,9,9,14,14,14,14,14,9,9,9,9,9,8,-1,-1,-1,-1,8,9,9,9,9,10],  # row 25
        [10,10,10,9,9,9,8,-1,-1,-1,-1,8,9,9,9,9,9,14,14,14,14,14,9,10,10,10,19,0,0,0,0,0,0,0,0,0,0,0,19,9,9,9,9,14,14,14,14,14,9,9,9,9,9,8,-1,-1,-1,-1,8,9,9,9,10,10],  # row 26
        [10,10,9,9,9,8,-1,-1,-1,-1,-1,8,9,9,9,9,9,14,14,14,14,14,9,9,9,10,19,0,0,0,0,0,0,0,0,0,0,0,19,9,9,9,9,14,14,14,14,14,9,9,9,9,9,8,-1,-1,-1,-1,-1,8,9,9,9,10],  # row 27
        [10,9,9,-1,-1,8,-1,-1,-1,-1,8,8,8,8,8,8,8,14,14,14,14,14,8,8,8,8,19,19,19,19,19,19,19,19,19,19,19,19,19,8,8,8,8,14,14,14,14,14,8,8,8,8,8,8,8,-1,-1,-1,-1,8,-1,-1,9,9],  # row 28
        [-1,-1,-1,-1,8,-1,-1,-1,-1,-1,8,8,8,8,8,8,8,14,14,14,14,14,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,14,14,14,14,14,8,8,8,8,8,8,9,9,9,9,9,9,8,9,9,9],  # row 29
        [-1,-1,-1,8,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,9,9],  # row 30
        [8,8,8,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,8],  # row 31
        [8,8,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8],  # row 32
        [-1,8,-1,-1,-1,-1,-1,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,9,9,8],  # row 33
        [9,9,8,-1,-1,-1,-1,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,9,8,9],  # row 34
        [9,9,8,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,9],  # row 35
        [9,9,8,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,8,9],  # row 36
        [9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,8,9],  # row 37
        [9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,-1,-1,-1,-1,-1,-1,-1,-1,8,9],  # row 38
        [-1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,8],  # row 39
        [-1,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,-1,-1,-1,8],  # row 40
        [8,-1,-1,8,8,8,8,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 41
        [-1,-1,-1,8,8,8,8,-1,-1,-1,-1,-1,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,-1,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 42
        [-1,-1,-1,8,8,8,8,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 43
        [-1,-1,-1,8,8,8,8,-1,-1,-1,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,15,8,8,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 44
        [-1,-1,-1,8,8,8,8,-1,-1,-1,8,8,8,8,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,8,8,8,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 45
        [-1,-1,-1,8,8,8,8,-1,-1,-1,8,8,8,8,15,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,15,8,8,8,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 46
        [-1,-1,-1,8,8,8,8,-1,-1,-1,8,8,8,8,-1,15,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,15,8,8,8,8,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 47
        [-1,-1,-1,8,8,8,8,-1,-1,-1,8,8,8,8,-1,-1,15,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,15,-1,8,8,8,8,-1,-1,-1,-1,-1,8,8,8,8,-1],  # row 48
        [-1,-1,-1,8,4,4,4,4,-1,-1,8,8,8,8,-1,-1,-1,15,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,15,-1,-1,8,8,8,8,-1,-1,-1,-1,-1,8,4,4,4,4],  # row 49
        [-1,-1,-1,-1,4,4,4,4,-1,-1,8,8,8,8,-1,-1,11,11,8,8,8,9,11,11,9,9,9,9,11,11,9,9,9,9,11,11,9,9,9,9,11,11,9,9,8,8,11,11,-1,-1,8,8,8,8,-1,-1,-1,-1,-1,-1,4,4,4,4],  # row 50
        [-1,-1,-1,-1,4,4,4,4,-1,-1,8,4,4,4,4,-1,11,11,8,8,15,8,11,11,9,15,9,9,11,11,9,9,9,9,11,11,9,9,9,15,11,11,15,8,15,-1,11,11,-1,-1,8,4,4,4,4,-1,-1,-1,-1,-1,4,4,4,4],  # row 51
        [-1,-1,-1,-1,4,4,4,4,-1,-1,-1,4,4,4,4,3,11,11,3,8,8,3,11,11,3,9,9,3,11,11,3,15,9,3,11,11,3,9,9,3,11,11,3,8,8,3,11,11,3,-1,-1,4,4,4,4,-1,-1,-1,-1,-1,4,4,4,4],  # row 52
        [-1,-1,-1,-1,4,4,4,4,-1,-1,-1,4,4,4,4,3,3,3,3,4,4,3,3,3,3,8,8,3,3,3,3,9,9,3,3,3,3,8,8,3,3,3,3,4,4,3,3,3,3,24,24,4,4,4,4,-1,-1,-1,-1,-1,4,4,4,4],  # row 53
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,4,4,4,3,3,3,3,4,4,3,3,3,3,24,24,3,3,3,3,8,8,3,3,3,3,24,24,3,3,3,3,4,4,3,3,3,3,24,24,4,4,4,4,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 54
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,4,4,4,4,3,3,3,3,4,4,3,3,3,3,24,24,3,3,3,3,24,24,3,3,3,3,24,24,3,3,3,3,4,4,3,3,3,3,24,24,4,4,4,4,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 55
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,24,24,24,24,3,3,3,3,4,4,3,3,3,3,24,24,3,3,3,3,24,24,3,3,3,3,24,24,3,3,3,3,4,4,3,3,3,3,24,24,24,24,24,24,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 56
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,24,24,24,24,24,24,4,4,4,4,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,4,4,4,4,24,24,24,24,24,24,24,24,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 57
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 58
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 59
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 60
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,24,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 61
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,24,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 62
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],  # row 63
    ]),
    # -- Klawf Crab 16x16 -- simplified version --

    "klawf_crab": (16, 16, [
        [-1,-1, 7, 7, 7, 7, 0, 9, 9, 0, 7, 7, 7, 7,-1,-1],
        [-1, 7, 7, 7, 7, 7, 0, 9, 9, 0, 7, 7, 7, 7, 7,-1],
        [ 7, 7, 7, 7, 7, 0, 9, 9, 9, 9, 0, 7, 7, 7, 7, 7],
        [ 7, 7, 7, 7, 0, 9, 9, 9, 9, 9, 9, 0, 7, 7, 7, 7],
        [ 7, 7, 0, 0, 9, 9, 9, 9, 9, 9, 9, 9, 0, 0, 7, 7],
        [ 9, 9, 9, 9, 9, 9,10, 9, 9,10, 9, 9, 9, 9, 9, 9],
        [ 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
        [ 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9],
        [ 9,19, 9, 9, 9, 9,15,15,15,15, 9, 9, 9, 9,19, 9],
        [ 9, 9, 9, 9, 9,15,15,15,15,15,15, 9, 9, 9, 9, 9],
        [14,14, 3, 9, 9, 9, 0, 0, 0, 0, 9, 9, 9, 3,14,14],
        [-1,-1, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9,-1,-1],
        [-1,-1, 3, 3, 9, 9, 3, 9, 9, 3, 9, 9, 3, 3,-1,-1],
        [-1,-1,-1,-1, 3, 9, 3, 9, 9, 3, 9, 3,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,24,24,24,24,24,24,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),
    "fwog": (16, 16, [
        [-1,-1,-1,-1,-1,11,11,11,11,11,11,-1,-1,-1,-1,-1],
        [-1,-1,-1,11,11,11,11,11,11,11,11,11,11,-1,-1,-1],
        [-1,-1,11,11,11,11,11,11,11,11,11,11,11,11,-1,-1],
        [-1,11,11,11,11,11,11,11,11,11,11,11,11,11,11,-1],
        [-1,11,11, 7, 7,11,11,11,11,11,11, 7, 7,11,11,-1],
        [11,11, 7, 0, 0, 7,11,11,11,11, 7, 0, 0, 7,11,11],
        [11,11, 7, 7, 7, 7,11,11,11,11, 7, 7, 7, 7,11,11],
        [11,11,11,11,11,11,11,11,11,11,11,11,11,11,11,11],
        [11,11,11,11,11,11,11, 3, 3,11,11,11,11,11,11,11],
        [11,11,11,11,11, 3, 3,11,11, 3, 3,11,11,11,11,11],
        [-1,11,11,11,11,11, 3,14,14, 3,11,11,11,11,11,-1],
        [-1,11,11,11,11,11,11,11,11,11,11,11,11,11,11,-1],
        [-1,-1,11,11,11,11,11,11,11,11,11,11,11,11,-1,-1],
        [-1,-1,11,11,11,-1,11,11,11,11,-1,11,11,11,-1,-1],
        [-1,-1,-1,-1,-1,-1,24,24,24,24,-1,-1,-1,-1,-1,-1],
        [-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],
    ]),
}


def generate_k_custom(output_dir: Path):
    custom_dir = output_dir / 'k_custom'
    custom_dir.mkdir(parents=True, exist_ok=True)
    print('Generating K CUSTOM pixel art...')
    for name, (w, h, pixel_grid) in K_CUSTOM.items():
        script = generate_pixel_art(name, w, h, pixel_grid, custom_dir)
        script_path = SCRIPTS_DIR / f'_gen_custom_{name}.lua'
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), '--batch', '--script', str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = custom_dir / f'{name}.png'
        if out.exists():
            print(f'  {name}.png ({w}x{h})')
        else:
            err = result.stderr.strip()[:100]
            print(f'  FAIL {name}: {err}')
    print(f'K Custom done! Output: {custom_dir}')



def generate_creative(output_dir: Path):
    """Generate all creative/hand-crafted pixel art assets via Aseprite."""
    creative_dir = output_dir / "creative"
    creative_dir.mkdir(parents=True, exist_ok=True)
    
    print("🎨 Generating CREATIVE pixel art...")
    for name, (w, h, pixel_grid) in CREATIVE_ASSETS.items():
        script = generate_pixel_art(name, w, h, pixel_grid, creative_dir)
        script_path = SCRIPTS_DIR / f"_gen_creative_{name}.lua"
        script_path.write_text(script)
        result = subprocess.run(
            [str(ASEPRITE), "--batch", "--script", str(script_path)],
            capture_output=True, text=True, timeout=15
        )
        script_path.unlink(missing_ok=True)
        out = creative_dir / f"{name}.png"
        if out.exists():
            print(f"  ✨ {name}.png ({w}×{h})")
        else:
            err = result.stderr.strip()[:100]
            print(f"  ✗ {name}: {err}")
    
    print(f"✅ Creative art done! Output: {creative_dir}")


# ═══════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Aseprite Forge - game-ready pixel art generator")
    parser.add_argument("--character", default=None, help="Character(s) to generate (comma-separated)")
    parser.add_argument("--all", action="store_true", help="Generate ALL characters")
    parser.add_argument("--list", action="store_true", help="List available characters")
    parser.add_argument("--output", default=None, help="Output directory")
    parser.add_argument("--single", action="store_true", help="Just one idle frame as test")
    parser.add_argument("--tiles", action="store_true", help="Generate dungeon tiles/objects")
    parser.add_argument("--furniture", action="store_true", help="Generate dungeon furniture (tables, chairs, beds, etc.)")
    parser.add_argument("--ui", action="store_true", help="Generate UI elements (buttons, icons, cursors, panels)")
    parser.add_argument("--weapons", action="store_true", help="Generate weapons & armor (axes, bows, staffs, helms, rings)")
    parser.add_argument("--props", action="store_true", help="Generate dungeon props (stairs, traps, portals, gravestones)")
    parser.add_argument("--all-assets", action="store_true", help="Generate ALL non-character assets (tiles+furniture+ui+weapons+props)")
    parser.add_argument("--animals", action="store_true", help="Generate cute farming animals (cows, pigs, sheep, chickens)")
    parser.add_argument("--farming", action="store_true", help="Generate farming assets (crops, fences, tools, barn)")
    parser.add_argument("--custom", action="store_true", help="Generate K's custom sprites from reference art (Klawf crab, Fwog, etc.)")
    parser.add_argument("--creative", action="store_true", help="Generate hand-crafted creative pixel art (crystals, chalices, treasures, etc.)")
    
    args = parser.parse_args()
    
    if args.list:
        print("Available characters:")
        for name, c in ALL_CHARACTERS.items():
            print(f"  {name:15s} ({c.width}x{c.height})")
        print("\nOptions: --character NAME, --all, --tiles, --list")
        return 0
    
    output_dir = Path(args.output) if args.output else OUTPUT_BASE
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not ASEPRITE.exists():
        print(f"❌ Aseprite not found at {ASEPRITE}")
        return 1
    
    # TILE GENERATION
    if args.tiles:
        generate_tiles(output_dir)
        return 0
    
    # FURNITURE GENERATION
    if args.furniture:
        generate_furniture(output_dir)
        return 0
    
    # UI GENERATION
    if args.ui:
        generate_ui(output_dir)
        return 0
    
    # WEAPONS GENERATION
    if args.weapons:
        generate_weapons(output_dir)
        return 0
    
    # PROPS GENERATION
    if args.props:
        generate_props(output_dir)
        return 0
    
    # ALL ASSETS
    if args.all_assets:
        generate_tiles(output_dir)
        generate_furniture(output_dir)
        generate_ui(output_dir)
        generate_weapons(output_dir)
        generate_props(output_dir)
        generate_animals(output_dir)
        generate_farming(output_dir)
        return 0
    
    # ANIMALS GENERATION
    if args.animals:
        generate_animals(output_dir)
        return 0

    # FARMING GENERATION
    if args.farming:
        generate_farming(output_dir)
        return 0

    # K CUSTOM PIXEL ART
    if args.custom:
        generate_k_custom(output_dir)
        return 0

    # CREATIVE PIXEL ART
    if args.creative:
        generate_creative(output_dir)
        return 0
    
    # Determine characters
    chars_to_gen = []
    if args.all:
        chars_to_gen = list(ALL_CHARACTERS.values())
    elif args.character:
        for name in args.character.split(","):
            name = name.strip()
            if name in ALL_CHARACTERS:
                chars_to_gen.append(ALL_CHARACTERS[name])
            else:
                print(f"Unknown character: {name}")
    else:
        print("Use --character NAME or --all or --list")
        return 1
    
    output_dir = Path(args.output) if args.output else OUTPUT_BASE
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not ASEPRITE.exists():
        print(f"❌ Aseprite not found at {ASEPRITE}")
        return 1
    
    print(f"\n{'═' * 55}")
    print(f"🔨 ASEPRITE FORGE — {len(chars_to_gen)} character(s)")
    print(f"{'═' * 55}\n")
    
    for char in chars_to_gen:
        print(f"🎨 {char.name} ({char.width}x{char.height})")
        frames = generate_character(char, output_dir)
        if frames:
            create_spritesheet(char.name, frames, output_dir)
        print()
    
    print(f"✅ Done! Output: {output_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
