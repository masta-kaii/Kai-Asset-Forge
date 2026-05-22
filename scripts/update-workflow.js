const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, '../forge-workflow-v6-dual-lora.json');
let wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

wf["2"].inputs.text = "pixel art sprite of TARGET_PROMPT, 0x72 Dungeon Tileset quality, flat colors, no anti-aliasing, solid vector colors, clean game asset, single character centered on plain white background, perfect symmetry";
wf["3"].inputs.text = "smooth shading, gradients, anti-aliasing, blur, soft edges, high detail, realistic, 8k, highly detailed, intricate, noisy, ugly, deformed, bad anatomy, disfigured, extra limbs, floating objects, high contrast, oversaturated, bloom, glow, lighting effects, atmospheric, cinematic, photorealistic, modern, abstract, dithering";
wf["10"].inputs.strength_model = 0.2; // reduce LORA noise
wf["10"].inputs.strength_clip = 0.2;
wf["9"].inputs.strength_model = 0.3; 
wf["9"].inputs.strength_clip = 0.3;

fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2));
console.log('Updated workflow JSON.');
