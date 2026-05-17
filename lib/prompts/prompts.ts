import type { Prompt } from '@/lib/types'

export const DEFAULT_PROMPTS: Omit<Prompt, 'id' | 'createdAt'>[] = [
  {
    promptName: 'Tamagotchi Creature Base',
    promptText: 'A cute pixel art tamagotchi-style creature with big eyes and round body, pastel cyber fantasy colors, transparent background, game asset sprite',
    modelUsed: 'dalle-3',
    rating: 5,
    category: 'creature',
    style: 'pastel-cyber-fantasy',
  },
  {
    promptName: 'Pixel Food Icon',
    promptText: 'A small pixel art food item in retro tamagotchi style, 32x32 sprite, cute and colorful, game-ready asset',
    modelUsed: 'dalle-3',
    rating: 4,
    category: 'food',
    style: 'pixel-art',
  },
  {
    promptName: 'Fantasy Weapon Sprite',
    promptText: 'A pixel art fantasy weapon, 16-bit RPG style, pastel colors with glowing effects, transparent background, item icon',
    modelUsed: 'dalle-3',
    rating: 4,
    category: 'weapon',
    style: 'pastel-cyber-fantasy',
  },
  {
    promptName: 'UI Heart Icon',
    promptText: 'A cute pixel art heart icon for game UI, tamagotchi inspired, 16x16, pastel pink, clean edges, transparent',
    modelUsed: 'dalle-3',
    rating: 5,
    category: 'ui-icon',
    style: 'tamagotchi',
  },
  {
    promptName: 'Creature Accessory Hat',
    promptText: 'A tiny pixel art wizard hat accessory for tamagotchi creatures, cute retro style, purple stars pattern, game asset',
    modelUsed: 'dalle-3',
    rating: 4,
    category: 'accessory',
    style: 'cute-retro',
  },
]
