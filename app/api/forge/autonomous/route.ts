// @ts-nocheck
/**
 * AUTONOMOUS PIPELINE + POPO'S QC ENGINE v3.0
 * Scout → Forge → QC (pixel-level) → Pack → List
 * No Hermes required. All stages run on Vercel.
 */
import { NextResponse } from "next/server";
import { generateWithSkills, TEMPLATES } from "@/lib/skill-sprite-gen";
import { generatePage } from "@/lib/skill-page-gen";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATS_PATH = "/tmp/agent-stats.json";
const OUTPUT_DIR = "/tmp/forge-output";
const PIPELINE_LOG = "/tmp/pipeline-log.json";

// ═══════════════════════ 0x72 FORGE PALETTE ═══════════════════════
const FORGE_PALETTE: Record<number, [number,number,number]> = {
  0:[0,0,0],1:[34,32,52],2:[69,40,60],3:[102,57,49],4:[143,86,59],
  5:[89,67,57],6:[162,112,88],7:[217,160,102],8:[172,50,50],
  9:[217,87,99],10:[251,242,54],11:[153,229,80],12:[106,190,48],
  13:[55,148,110],14:[75,105,47],15:[82,75,36],16:[50,60,57],
  17:[63,63,116],18:[91,110,225],19:[70,66,94],20:[244,180,27],
  21:[223,113,38],22:[132,126,135],23:[105,106,106],24:[38,43,68],
};
const WARM_BODY = new Set([20,21,8,10]);
const COOL_BODY = new Set([17,18,19,11,12,13]);

// ═══════════════════════ STAGE 1: SCOUT ═══════════════════════
function scoutStage(theme: string, stats: any) {
  const themes = ["dark fantasy","sci-fi","pixel dungeon","medieval","cyberpunk","magical forest","steampunk","underwater","desert ruins","haunted castle"];
  const picked = theme || themes[Math.floor(Math.random()*themes.length)];
  const palettes = ["warm ramps","cool tones","high contrast","pastel","neon"];
  const brief = {
    theme: picked, palette: palettes[Math.floor(Math.random()*palettes.length)],
    spriteCount: 2+Math.floor(Math.random()*3),
    targetSize: ["16×16","32×32","64×64"][Math.floor(Math.random()*3)],
    style: "pixel art — 0x72 Dungeon Tileset quality standard",
    deadline: new Date(Date.now()+36e5).toISOString(),
  };
  const log = loadLog();
  log.scout = { theme: picked, brief, ts: new Date().toISOString() };
  saveLog(log);
  return { stage:"SCOUT", status:"complete", brief };
}

// ═══════════════════════ STAGE 2: FORGE ═══════════════════════
function forgeStage(brief: any, stats: any) {
  const a = stats.artist||stats.artist_default;
  const w = stats.webgen||stats.webgen_default;
  const pSkills = { pixelart:a?.skills?.pixelart?.level||1, color:a?.skills?.color?.level||1, composition:a?.skills?.composition?.level||1, speed:a?.skills?.speed?.level||1 };
  const wSkills = { frontend:w?.skills?.frontend?.level||1, design:w?.skills?.design?.level||1, responsive:w?.skills?.responsive?.level||1, perf:w?.skills?.perf?.level||1 };
  const sprites: any[] = [];
  const tmpls = TEMPLATES.filter((t:any)=>t.difficulty<=pSkills.pixelart+Math.floor(pSkills.color/2));
  for (let i=0;i<Math.min(brief.spriteCount,tmpls.length);i++) {
    const t = tmpls[i]||tmpls[0];
    const s = generateWithSkills(pSkills,t.name);
    sprites.push({ name:t.name, qualityTier:s.qualityTier, colorsUsed:s.colorsUsed, size:`${s.width}×${s.height}` });
  }
  const page = generatePage(wSkills,"landing");
  ensureDir(OUTPUT_DIR);
  const bid = Date.now().toString(36);
  const bd = path.join(OUTPUT_DIR,bid);
  ensureDir(bd);
  fs.writeFileSync(path.join(bd,"assets.json"),JSON.stringify({ brief, sprites:sprites.map((s:any)=>({name:s.name,qualityTier:s.qualityTier,colorsUsed:s.colorsUsed,size:s.size})), pageTier:page.tier, pageFeatures:page.features },null,2));
  fs.writeFileSync(path.join(bd,"page.html"),page.html);
  const log = loadLog();
  log.forge = { bid, count:sprites.length, top:sprites[0]?.qualityTier||"Basic", pageTier:page.tier, ts:new Date().toISOString() };
  saveLog(log);
  return { stage:"FORGE", status:"complete", batchId:bid, spritesGenerated:sprites.length, topQuality:sprites[0]?.qualityTier||"Basic", pageTier:page.tier, pageFeatures:page.features.length };
}

// ═══════════════════════ QC ENGINE v3.0 ═══════════════════════
interface PixelGrid { w:number; h:number; data:number[][]; }

function parsePixels(sprite:any): PixelGrid|null {
  if (!sprite.pixels||!Array.isArray(sprite.pixels)) return null;
  const w = sprite.width||(sprite.size?parseInt(sprite.size.split("×")[0]):16);
  const h = sprite.height||(sprite.size?parseInt(sprite.size.split("×")[1]):16);
  const data: number[][] = [];
  if (sprite.pixels.length===w*h) {
    for (let y=0;y<h;y++) data.push(sprite.pixels.slice(y*w,(y+1)*w).map((px:any)=>typeof px==='number'?px:(px.index??px.color??-1)));
  } else if (Array.isArray(sprite.pixels[0])) {
    for (let y=0;y<h;y++) data.push(sprite.pixels[y]||[]);
  }
  return {w,h,data};
}

function qcOutline(g:PixelGrid):{score:number;issues:string[]} {
  const issues:string[]=[]; let penalty=0; const {w,h,data}=g;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (data[y][x]<0) continue;
    const nbrs=[[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
    const hasTransp=nbrs.some(([nx,ny])=>nx<0||nx>=w||ny<0||ny>=h||data[ny][nx]<0);
    if (!hasTransp) continue;
    const hasBlack=nbrs.some(([nx,ny])=>!(nx<0||nx>=w||ny<0||ny>=h)&&data[ny][nx]===0);
    if (!hasBlack) { penalty++; if (penalty<=3) issues.push(`Missing outline at (${x},${y})`); }
  }
  const maxP=w*h*0.3;
  return {score:Math.max(0,20-Math.floor((penalty/maxP)*20)),issues};
}

function qcPalette(g:PixelGrid):{score:number;issues:string[];colorsFound:Set<number>;nonForge:number} {
  const issues:string[]=[]; const colors=new Set<number>(); let nf=0; let pinkBad=false;
  const {w,h,data}=g; const counts:Record<number,number>={}; let total=0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const c=data[y][x]; if (c<0) continue; total++;
    if (c===-2||!(c in FORGE_PALETTE)) { nf++; continue; }
    colors.add(c); counts[c]=(counts[c]||0)+1;
  }
  const sorted=Object.entries(counts).filter(([c])=>parseInt(c)!==0).sort((a,b)=>b[1]-a[1]);
  const dom=sorted[0]?parseInt(sorted[0][0]):-1;
  if (WARM_BODY.has(dom)&&colors.has(9)) { pinkBad=true; issues.push("🔴 AUTO-FAIL: PINK (9) on warm body — use BROWN (4)"); }
  let score=25; if (pinkBad) score=0;
  if (nf>total*0.05) score-=10;
  return {score:Math.max(0,score),issues,colorsFound:colors,nonForge:nf};
}

function qcSilhouette(g:PixelGrid):{score:number;issues:string[]} {
  const issues:string[]=[]; const {w,h,data}=g;
  const vis=Array.from({length:h},()=>new Array(w).fill(false)); let regions=0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    if (data[y][x]<0||vis[y][x]) continue; regions++;
    const stack=[[x,y]];
    while(stack.length){const[cx,cy]=stack.pop()!;if(cx<0||cx>=w||cy<0||cy>=h||vis[cy][cx]||data[cy][cx]<0)continue;vis[cy][cx]=true;stack.push([cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]);}
  }
  let score=20;
  if (regions===1) { score-=8; issues.push("Single blob silhouette"); }
  else if (regions>10) { score-=5; issues.push("Scattered pixels"); }
  else if (regions<3) { score-=3; issues.push("Only 2 regions — limbs should be distinct"); }
  return {score:Math.max(0,score),issues};
}

function qcShading(g:PixelGrid):{score:number;issues:string[]} {
  const issues:string[]=[]; const {w,h,data}=g;
  const cx=Math.floor(w/2),cy=Math.floor(h/2);
  let cb=0,cc=0,eb=0,ec=0;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
    const c=data[y][x]; if (c<0||c===0) continue;
    const rgb=FORGE_PALETTE[c]||[128,128,128]; const br=rgb[0]+rgb[1]+rgb[2];
    if (Math.sqrt((x-cx)**2+(y-cy)**2)<Math.min(w,h)*0.25) { cb+=br; cc++; }
    if (x<=1||x>=w-2||y<=1||y>=h-2) { eb+=br; ec++; }
  }
  if (cc>5&&ec>5&&cb/cc>eb/ec*1.15) { issues.push("🔴 AUTO-FAIL: Pillow shading"); return {score:0,issues}; }
  return {score:15,issues};
}

function validateSprite(sprite:any):any {
  const g=parsePixels(sprite);
  if (!g) {
    const tiers:Record<string,number>={Basic:40,Standard:65,Quality:80,Masterwork:95};
    const s=(tiers[sprite.qualityTier]||50)+(sprite.colorsUsed>=6?20:sprite.colorsUsed>=4?15:10);
    return {name:sprite.name,score:Math.min(s,100),pass:s>=55,autoFails:[],issues:["No pixel data — metadata-only QC"]};
  }
  const o=qcOutline(g), p=qcPalette(g), si=qcSilhouette(g), sh=qcShading(g);
  const total=o.score+p.score+si.score+sh.score+20;
  const af:string[]=[];
  if (p.score===0&&p.issues.some((i:string)=>i.includes("AUTO-FAIL"))) af.push("PINK_SHADOW");
  if (sh.score===0&&sh.issues.some((i:string)=>i.includes("AUTO-FAIL"))) af.push("PILLOW_SHADING");
  const allIssues=[...o.issues,...p.issues,...si.issues,...sh.issues];
  return {name:sprite.name,score:total,pass:af.length===0&&total>=55,autoFails:af,issues:allIssues.slice(0,8)};
}

// ═══════════════════════ STAGE 3: QC ═══════════════════════
function qcStage(batchId:string,stats:any) {
  const bd=path.join(OUTPUT_DIR,batchId);
  const af=path.join(bd,"assets.json");
  if (!fs.existsSync(af)) return {stage:"QC",status:"error",error:"No assets found"};
  const assets=JSON.parse(fs.readFileSync(af,"utf-8"));
  const results:any[]=[]; let total=0,pCount=0;
  for (const s of assets.sprites) { const r=validateSprite(s); results.push(r); total+=r.score; if(r.pass)pCount++; }
  const pTiers:Record<string,number>={Basic:30,Standard:55,Professional:75,Enterprise:95};
  const pScore=pTiers[assets.pageTier]||50; const pPass=pScore>=50;
  results.push({name:"landing-page",score:pScore,pass:pPass,autoFails:[],issues:[]});
  if(pPass)pCount++;
  // Check auto-fails (MUST come before overallPass computation)
  let hasAF=false; const allAF:string[]=[];
  for (const r of results) { if(r.autoFails?.length>0){hasAF=true;allAF.push(`${r.name}:${r.autoFails.join(",")}`);} }
  const avgScore=assets.sprites.length>0?Math.round(total/assets.sprites.length):pScore;
  const overallPass=hasAF?false:pCount>=Math.ceil(results.length*0.6);
  const report={results,avgScore,overallPass,autoFails:allAF,ts:new Date().toISOString(),validator:"Popo's QC Engine v3.0"};
  fs.writeFileSync(path.join(bd,"qc-report.json"),JSON.stringify(report,null,2));
  return {stage:"QC",status:overallPass?"APPROVED":"NEEDS WORK",checks:results.length,passed:pCount,avgScore,autoFails:allAF,
    details:results.map((r:any)=>`${r.name}:${r.pass?'✓':'✕'} ${r.score}/100${r.autoFails?.length?' [AF:'+r.autoFails.join(',')+']':''}`),
    feedback:results.flatMap((r:any)=>r.issues||[]).slice(0,10)};
}

// ═══════════════════════ STAGE 4: PACK ═══════════════════════
function packStage(batchId:string,stats:any) {
  const bd=path.join(OUTPUT_DIR,batchId);
  const af=path.join(bd,"assets.json");
  if(!fs.existsSync(af)) return {stage:"PACK",status:"error",error:"No assets"};
  const a=JSON.parse(fs.readFileSync(af,"utf-8"));
  const m={batchId,theme:a.brief?.theme||"unknown",generated:new Date().toISOString(),contents:{sprites:a.sprites||[],page:{tier:a.pageTier,features:a.pageFeatures||[]}},files:[] as string[]};
  for(const f of fs.readdirSync(bd)) m.files.push(f);
  fs.writeFileSync(path.join(bd,"manifest.json"),JSON.stringify(m,null,2));
  return {stage:"PACK",status:"complete",batchId, files:m.files.length, manifest:m};
}

// ═══════════════════════ STAGE 5: LIST ═══════════════════════
function listStage(batchId:string,stats:any) {
  const bd=path.join(OUTPUT_DIR,batchId);
  const mf=path.join(bd,"manifest.json");
  if(!fs.existsSync(mf)) return {stage:"LIST",status:"error",error:"No manifest"};
  const m=JSON.parse(fs.readFileSync(mf,"utf-8"));
  const l={id:batchId,title:`${m.theme} — Pixel Art Pack`,description:`Autonomously generated ${m.theme} themed asset pack. ${m.contents.sprites.length} sprites + landing page.`,price:Math.floor(m.contents.sprites.length*2.99),currency:"USD",tags:[m.theme,"pixel-art","game-assets","autonomous"],contents:m.contents,generated:m.generated};
  fs.writeFileSync(path.join(bd,"listing.json"),JSON.stringify(l,null,2));
  return {stage:"LIST",status:"complete",listing:l};
}

// ═══════════════════════ HELPERS ═══════════════════════
function ensureDir(d:string){if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});}
function loadLog():any{try{if(fs.existsSync(PIPELINE_LOG))return JSON.parse(fs.readFileSync(PIPELINE_LOG,"utf-8"));}catch{}return{};}
function saveLog(l:any){ensureDir("/tmp");fs.writeFileSync(PIPELINE_LOG,JSON.stringify(l,null,2));}
function loadStats():any{try{if(fs.existsSync(STATS_PATH))return JSON.parse(fs.readFileSync(STATS_PATH,"utf-8"));}catch{}return{};}

// ═══════════════════════ MAIN ═══════════════════════
export async function POST(request:Request) {
  try {
    const {theme}=await request.json().catch(()=>({}));
    const stats=loadStats();
    const scout=scoutStage(theme,stats);
    const forge=forgeStage(scout.brief,stats);
    const qc=qcStage(forge.batchId,stats);
    const pack=packStage(forge.batchId,stats);
    const list=listStage(forge.batchId,stats);
    // XP
    if(stats.artist){stats.artist.totalXP=(stats.artist.totalXP||0)+25;stats.artist.xp=(stats.artist.xp||0)+25;}
    if(stats.webgen){stats.webgen.totalXP=(stats.webgen.totalXP||0)+20;stats.webgen.xp=(stats.webgen.xp||0)+20;}
    if(stats.popo){stats.popo.totalXP=(stats.popo.totalXP||0)+30;stats.popo.xp=(stats.popo.xp||0)+30;}
    try{fs.writeFileSync(STATS_PATH,JSON.stringify(stats,null,2));}catch{}
    return NextResponse.json({
      success:true,autonomous:true,batchId:forge.batchId,theme:scout.brief.theme,
      pipeline:[scout,forge,qc,pack,list],
      summary:{sprites:forge.spritesGenerated,topQuality:forge.topQuality,pageTier:forge.pageTier,qcPassed:qc.passed,qcTotal:qc.checks,qcStatus:qc.status,price:list.listing?.price||0},
      output:`/api/forge/autonomous?batch=${forge.batchId}`,
    });
  } catch(e:any) {
    return NextResponse.json({success:false,error:e.message},{status:500});
  }
}

export async function GET(request:Request) {
  const url=new URL(request.url);
  const bid=url.searchParams.get("batch");
  if(bid){const mf=path.join(OUTPUT_DIR,bid,"manifest.json");if(fs.existsSync(mf))return NextResponse.json(JSON.parse(fs.readFileSync(mf,"utf-8")));return NextResponse.json({error:"Batch not found"},{status:404});}
  return NextResponse.json({pipeline:loadLog()});
}
