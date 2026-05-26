import { NextResponse } from "next/server"
import { readdir, stat } from "fs/promises"
import { join } from "path"

const CATEGORY_KEYWORDS: Record<string, string> = {
  creative: "Creative",
  furniture: "Furniture",
  props: "Props",
  ui: "UI",
  weapons: "Weapons",
  angel: "Angel",
  knight: "Knight",
  amulet: "Amulet",
  anvil: "Anvil",
  apple: "Apple",
  armor: "Armor",
  arrow: "Arrow",
  axe: "Axe",
  bag: "Bag",
  banner: "Banner",
  barrel: "Barrel",
  barrel2: "Barrel",
  bed: "Bed",
  book: "Book",
  boot: "Boot",
  bottle: "Bottle",
  bow: "Bow",
  box: "Box",
  bread: "Bread",
  broom: "Broom",
  bucket: "Bucket",
  bush: "Bush",
  candle: "Candle",
  carpet: "Carpet",
  carrot: "Carrot",
  chair: "Chair",
  chest: "Chest",
  chicken: "Chicken",
  coin: "Coin",
  cow: "Cow",
  crate: "Crate",
  crossbow: "Crossbow",
  crown: "Crown",
  crystal: "Crystal",
  dagger: "Dagger",
  door: "Door",
  dragon: "Dragon",
  duck: "Duck",
  egg: "Egg",
  fence: "Fence",
  fish: "Fish",
  flag: "Flag",
  flower: "Flower",
  gem: "Gem",
  ghost: "Ghost",
  goblet: "Goblet",
  golem: "Golem",
  grass: "Grass",
  hammer: "Hammer",
  hat: "Hat",
  heart: "Heart",
  helmet: "Helmet",
  herb: "Herb",
  horse: "Horse",
  house: "House",
  key: "Key",
  lamp: "Lamp",
  lantern: "Lantern",
  log: "Log",
  map: "Map",
  monster: "Monster",
  mushroom: "Mushroom",
  orb: "Orb",
  pickaxe: "Pickaxe",
  pillar: "Pillar",
  plant: "Plant",
  plate: "Plate",
  potion: "Potion",
  ring: "Ring",
  rock: "Rock",
  rod: "Rod",
  scroll: "Scroll",
  shield: "Shield",
  shirt: "Shirt",
  shoes: "Shoes",
  skull: "Skull",
  slime: "Slime",
  spear: "Spear",
  staff: "Staff",
  statue: "Statue",
  stone: "Stone",
  sword: "Sword",
  table: "Table",
  tomb: "Tomb",
  torch: "Torch",
  tree: "Tree",
  wand: "Wand",
  water: "Water",
  well: "Well",
  wheat: "Wheat",
  window: "Window",
  zombie: "Zombie",
  crab: "Crab",
  summer: "Summer",
  beach: "Beach",
  sunny: "Sunny",
  tropical: "Tropical",
  pineapple: "Pineapple",
  watermelon: "Watermelon",
}

function guessCategory(filename: string): string {
  const base = filename.replace(/\.png$/i, "").toLowerCase()
  
  // Preview files
  if (base.startsWith("_")) {
    const cat = base.replace(/^_/, "").replace(/_preview$/, "")
    return CATEGORY_KEYWORDS[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  // Check known keywords
  for (const [kw, label] of Object.entries(CATEGORY_KEYWORDS)) {
    if (base.includes(kw)) return label
  }

  // Sprite sheet frames
  if (/\w+_f\d+$/.test(base) || base.endsWith("_spritesheet")) {
    const parts = base.split("_")
    const name = parts[0]
    return CATEGORY_KEYWORDS[name] ?? name.charAt(0).toUpperCase() + name.slice(1)
  }

  // UUID-based files
  if (/^[0-9a-f]{8}-/.test(base)) return "Forge"

  return "General"
}

function formatName(filename: string): string {
  let base = filename.replace(/\.png$/i, "")
  if (base.startsWith("_")) {
    base = base.replace(/^_/, "")
  }
  return base
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\sF\d+$/i, "") // strip frame numbers
    .replace(/\sSpritesheet$/i, "")
}

function isNoun(filename: string): boolean {
  const base = filename.replace(/\.png$/i, "").toLowerCase()
  // Skip UUID files (no real name)
  if (/^[0-9a-f]{8}-/.test(base)) return false
  return true
}

export async function GET() {
  const dir = join(process.cwd(), "public", "generated-assets")
  let files: string[] = []
  try {
    files = await readdir(dir)
  } catch {
    return NextResponse.json({ assets: [], error: "Directory not found" })
  }

  const assets = await Promise.all(
    files
      .filter((f) => f.endsWith(".png") && isNoun(f))
      .map(async (f) => {
        const s = await stat(join(dir, f)).catch(() => ({ size: 0 }))
        return {
          id: f.replace(".png", ""),
          name: formatName(f),
          filename: f,
          category: guessCategory(f),
          size: s.size,
          path: "/generated-assets/" + f,
        }
      })
  )

  // Sort: named items first, then by category
  assets.sort((a, b) => {
    if (a.category === "Forge" && b.category !== "Forge") return 1
    if (b.category === "Forge" && a.category !== "Forge") return -1
    return a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  })

  return NextResponse.json({ assets })
}
