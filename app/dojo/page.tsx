"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Skill = { name: string; level: number; icon: string; desc: string };
type HistoryEntry = { action: string; xp: number; ts: string };
type Agent = {
  id: string; name: string; role: string;
  level: number; xp: number; xpToNext: number; totalXP: number;
  color: string; bgA: string; motto: string;
  skills: Record<string, Skill>; trainingHistory: HistoryEntry[];
};

const SKILL_COLORS: Record<number, string> = {
  1:"#475569",2:"#64748b",3:"#94a3b8",4:"#60a5fa",5:"#c084fc",6:"#f5a623",7:"#f87171",8:"#4ade80",9:"#f5a623",10:"#ffd700",
};

// ── Training Modes per Agent ──
const ARTIST_MODES = [
  { id:"study", label:"📖 STUDY", desc:"Analyze reference sprite — extract palette, outline, shading", xp:15 },
  { id:"practice", label:"✏️ PRACTICE", desc:"Recreate reference sprite, QC compares against original", xp:25 },
  { id:"challenge", label:"🎯 CHALLENGE", desc:"Generate original in reference style, 5-gate QC", xp:40 },
  { id:"library", label:"📚 LIBRARY", desc:"Browse reference sprites with metadata", xp:5 },
];

const WEBGEN_MODES = [
  { id:"study", label:"📖 STUDY", desc:"Analyze design system — layout, color, typography", xp:15 },
  { id:"practice", label:"✏️ PRACTICE", desc:"Rebuild component from design reference", xp:25 },
  { id:"challenge", label:"🎯 CHALLENGE", desc:"Generate landing page in reference style", xp:40 },
  { id:"responsive", label:"📱 RESPONSIVE", desc:"Mobile + tablet + desktop variants, QC breakpoints", xp:30 },
];

// ── Pixel Art Reference Library ──
const PIXEL_REFS = [
  { id:"bob_idle", name:"Bob — Idle", path:"Bob_idle_16x16.png", size:"16×16", category:"Character", frames:4 },
  { id:"bob_run", name:"Bob — Run", path:"Bob_run_16x16.png", size:"16×16", category:"Character", frames:6 },
  { id:"amelia_idle", name:"Amelia — Idle", path:"Amelia_idle_16x16.png", size:"16×16", category:"Character", frames:4 },
  { id:"alex_sit", name:"Alex — Sit", path:"Alex_sit_16x16.png", size:"16×16", category:"Character", frames:3 },
  { id:"interiors_16", name:"Interiors Tileset", path:"Interiors_free_16x16.png", size:"16×16", category:"Tileset", frames:1 },
  { id:"room_builder_16", name:"Room Builder", path:"Room_Builder_free_16x16.png", size:"16×16", category:"Tileset", frames:1 },
  { id:"td_grass", name:"Top-Down Grass", path:"TX Tileset Grass.png", size:"16×16", category:"Ground", frames:1 },
  { id:"td_stone", name:"Top-Down Stone", path:"TX Tileset Stone Ground.png", size:"16×16", category:"Ground", frames:1 },
  { id:"td_props", name:"Top-Down Props", path:"TX Props.png", size:"16×16", category:"Props", frames:1 },
  { id:"td_player", name:"Top-Down Player", path:"TX Player.png", size:"16×16", category:"Character", frames:3 },
];

// ── Web Design Reference Library ──
const WEB_REFS = [
  { id:"stripe", name:"Stripe", style:"SaaS / Payments", colors:"#635BFF + white", features:"Clean hero, bento grid, gradient CTAs" },
  { id:"linear", name:"Linear", style:"Project Management", colors:"#5E6AD2 + dark", features:"Dark mode, minimal nav, command palette" },
  { id:"vercel", name:"Vercel", style:"DevTools / Platform", colors:"#000 + #fff + accent", features:"Geometric patterns, code blocks, scroll animations" },
  { id:"shopify", name:"Shopify", style:"E-commerce", colors:"#95BF47 + dark green", features:"Product grids, trust badges, mega footer" },
  { id:"notion", name:"Notion", style:"Productivity", colors:"#000 + white + emoji", features:"Minimalist, icon-heavy, clean typography" },
  { id:"raycast", name:"Raycast", style:"Developer Tools", colors:"#FF6363 + dark", features:"Command palette hero, terminal aesthetic" },
];

const XP_LEVELS = [0,100,250,500,1000,2000,4000,8000,16000,32000];

function xpForLevel(lv:number){ return XP_LEVELS[Math.min(lv-1, XP_LEVELS.length-1)]; }

export default function DojoPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Record<string,Agent>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string|null>(null);
  const [training, setTraining] = useState(false);
  const [trainMsg, setTrainMsg] = useState("");
  const [trainFlash, setTrainFlash] = useState<string|null>(null);

  // ── Training form state ──
  const [activeTab, setActiveTab] = useState<"artist"|"webgen">("artist");
  const [selMode, setSelMode] = useState("study");
  const [selRef, setSelRef] = useState(PIXEL_REFS[0].id);
  const [trainPrompt, setTrainPrompt] = useState("");
  const [trainResult, setTrainResult] = useState<any>(null);

  useEffect(()=>{
    try{
      const raw=localStorage.getItem("kaf_auth");
      if(!raw){router.replace("/login");return;}
      const d=JSON.parse(raw);
      if(!d.user||!d.ts||Date.now()-d.ts>7*24*60*60*1000){localStorage.removeItem("kaf_auth");router.replace("/login");return;}
    }catch{localStorage.removeItem("kaf_auth");router.replace("/login");return;}
    fetchAgents();
    const iv=setInterval(fetchAgents,10000);
    return ()=>clearInterval(iv);
  },[]);

  const fetchAgents=useCallback(()=>{
    fetch("/api/dojo/agents").then(r=>r.json()).then(d=>{setAgents(d.agents||{});setLoading(false);}).catch(()=>setLoading(false));
  },[]);

  const doTraining=useCallback(async()=>{
    setTraining(true); setTrainMsg(""); setTrainResult(null);
    const agentId=activeTab;
    const ref=activeTab==="artist"?PIXEL_REFS.find(r=>r.id===selRef):WEB_REFS.find(r=>r.id===selRef);
    const mode=activeTab==="artist"?ARTIST_MODES.find(m=>m.id===selMode):WEBGEN_MODES.find(m=>m.id===selMode);
    if(!ref||!mode)return;

    setTrainFlash(agentId);

    try{
      const res=await fetch("/api/dojo/train",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({agentId,mode:selMode,reference:ref,prompt:trainPrompt||undefined}),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Training failed");

      setAgents(prev=>({...prev,[agentId]:data.agent}));
      setTrainResult(data.result||data);

      if(data.leveledUp) setTrainMsg(`⚡ LEVEL UP! ${data.agent.name} reached Level ${data.agent.level}! +${data.xp}XP`);
      else if(data.improvedSkills?.length) setTrainMsg(`📈 ${data.agent.name}: +${data.xp}XP · ${data.improvedSkills.join(", ")} improved!`);
      else setTrainMsg(`✓ ${data.agent.name}: +${data.xp}XP`);

      setTimeout(()=>{setTrainFlash(null);setTrainMsg("");},3000);
    }catch(e:any){
      setTrainMsg(`> ERR: ${e.message||"Training failed"}`);
    }
    setTraining(false);
  },[activeTab,selMode,selRef,trainPrompt]);

  const user=(()=>{try{return JSON.parse(localStorage.getItem("kaf_auth")||"{}").user||"OPERATOR";}catch{return"OPERATOR";}})();
  const agentList=Object.values(agents);
  const activeModes=activeTab==="artist"?ARTIST_MODES:WEBGEN_MODES;
  const activeRefs=activeTab==="artist"?PIXEL_REFS:WEB_REFS;

  if(loading) return <div style={{minHeight:"100vh",background:"#0d0f14",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'VT323',monospace",color:"#f5a623",fontSize:22,letterSpacing:2}}>LOADING DOJO...<span style={{animation:"blink 1s step-end infinite",marginLeft:2}}>▌</span></div>;

  return (
    <div style={{minHeight:"100vh",background:"#0d0f14",fontFamily:"'VT323',monospace",color:"#e2e8f0"}}>
      {/* Scanlines */}
      <div style={{position:"fixed",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)",pointerEvents:"none",zIndex:100}}/>

      {/* Header */}
      <header style={{background:"rgba(13,15,20,0.98)",borderBottom:"2px solid #f5a62333",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <span onClick={()=>router.push("/factory")} style={{fontSize:26,color:"#f5a623",letterSpacing:3,cursor:"pointer",textShadow:"0 0 15px rgba(245,166,35,0.4)"}}>🏯 AGENT DOJO</span>
          <span style={{color:"#64748b",fontSize:14,letterSpacing:2}}>── TRAINING GROUND ──</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:20}}>
          <span style={{color:"#4ade80",fontSize:14,letterSpacing:1}}>▸ {user}</span>
          <span onClick={()=>router.push("/factory")} style={{fontSize:15,color:"#475569",cursor:"pointer",letterSpacing:2}}>⚙ FACTORY</span>
          <span onClick={()=>{localStorage.removeItem("kaf_auth");router.push("/login");}} style={{fontSize:14,color:"#475569",cursor:"pointer",letterSpacing:1}}>LOGOUT</span>
        </div>
      </header>

      {/* Stats banner */}
      <div style={{padding:"16px 24px",background:"rgba(245,166,35,0.04)",borderBottom:"1px solid #1e293b",display:"flex",gap:24,flexWrap:"wrap",fontSize:15,letterSpacing:1}}>
        <span style={{color:"#64748b"}}>AGENTS: <span style={{color:"#f5a623"}}>{agentList.length}</span></span>
        <span style={{color:"#64748b"}}>COMBINED LV: <span style={{color:"#c084fc"}}>{agentList.reduce((s,a)=>s+a.level,0)}</span></span>
        <span style={{color:"#64748b"}}>TOTAL XP: <span style={{color:"#4ade80"}}>{agentList.reduce((s,a)=>s+a.totalXP,0).toLocaleString()}</span></span>
      </div>

      {/* Training notification */}
      {trainMsg && (
        <div style={{padding:"12px 24px",background:"#12161e",borderBottom:"1px solid #4ade80",color:"#4ade80",fontSize:16,letterSpacing:1,animation:"slideDown 0.3s ease-out"}}>{trainMsg}</div>
      )}

      {/* ── MAIN: Two columns (Agents + Training Panel) ── */}
      <div style={{display:"flex",gap:0,minHeight:"calc(100vh - 140px)"}}>
        {/* Left: Agent cards */}
        <div style={{flex:1,padding:24,overflow:"auto",maxHeight:"calc(100vh - 140px)"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(360px, 1fr))",gap:16}}>
            {agentList.map(agent=>{
              const xpPct=Math.min(100,(agent.xp/agent.xpToNext)*100);
              const isSel=selected===agent.id;
              const isFlash=trainFlash===agent.id;
              return (
                <div key={agent.id} style={{background:agent.bgA,border:isSel?`2px solid ${agent.color}`:`1px solid ${agent.color}22`,transition:"all 0.2s",overflow:"hidden",...(isFlash?{animation:"xpFlash 0.5s ease-out",boxShadow:`0 0 30px ${agent.color}44`}:{})}}>
                  <div style={{padding:"14px 18px",borderBottom:`1px solid ${agent.color}22`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setSelected(isSel?null:agent.id)}>
                    <div>
                      <div style={{fontSize:20,color:agent.color,letterSpacing:2,textShadow:`0 0 10px ${agent.color}33`}}>{agent.name}</div>
                      <div style={{fontSize:12,color:"#64748b",letterSpacing:1,marginTop:2}}>{agent.role}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:28,color:agent.color,fontWeight:400,lineHeight:1,textShadow:`0 0 15px ${agent.color}55`}}>Lv.{agent.level}</div>
                      <div style={{fontSize:10,color:"#475569",letterSpacing:1}}>{agent.totalXP.toLocaleString()} XP</div>
                    </div>
                  </div>
                  <div style={{padding:"10px 18px",borderBottom:`1px solid ${agent.color}11`}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11,color:"#64748b",letterSpacing:1}}><span>XP</span><span>{agent.xp}/{agent.xpToNext}</span></div>
                    <div style={{height:6,background:"#0a0d12",border:`1px solid ${agent.color}22`,overflow:"hidden"}}><div style={{height:"100%",width:`${xpPct}%`,background:`linear-gradient(90deg,${agent.color}88,${agent.color})`,transition:"width 0.5s ease-out",boxShadow:`0 0 8px ${agent.color}55`}}/></div>
                  </div>
                  <div style={{padding:"8px 18px",fontSize:12,color:"#475569",fontStyle:"italic",borderBottom:`1px solid ${agent.color}11`}}>&ldquo;{agent.motto}&rdquo;</div>
                  <div style={{padding:"10px 18px"}}>
                    <div style={{fontSize:10,color:"#475569",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Skills</div>
                    {Object.values(agent.skills).map(s=>(
                      <div key={s.name} style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <span style={{fontSize:12}}>{s.icon}</span>
                        <span style={{fontSize:12,color:"#cbd5e1",flex:1}}>{s.name}</span>
                        <div style={{display:"flex",gap:1}}>
                          {Array.from({length:Math.min(s.level,10)}).map((_,i)=>(<div key={i} style={{width:6,height:6,background:SKILL_COLORS[Math.min(i+1,10)],boxShadow:i>=s.level-1?`0 0 4px ${SKILL_COLORS[Math.min(i+1,10)]}`:"none"}}/>))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {isSel && agent.trainingHistory?.length>0 && (
                    <div style={{borderTop:`1px solid ${agent.color}22`,padding:"10px 18px",maxHeight:150,overflow:"auto"}}>
                      <div style={{fontSize:10,color:"#475569",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Training Log</div>
                      {agent.trainingHistory.slice(0,8).map((e,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,padding:"2px 0",borderBottom:"1px solid #1e293b"}}><span style={{color:"#94a3b8"}}>{e.action}</span><span style={{color:"#4ade80"}}>+{e.xp}XP</span></div>))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Training Panel */}
        <div style={{width:420,background:"#12151d",borderLeft:"1px solid #1e293b",padding:20,overflow:"auto",maxHeight:"calc(100vh - 140px)",flexShrink:0}}>
          <h2 style={{fontSize:20,color:"#f5a623",letterSpacing:2,marginBottom:16,textShadow:"0 0 10px rgba(245,166,35,0.3)"}}>⚔ TRAINING PANEL</h2>

          {/* Agent tabs */}
          <div style={{display:"flex",gap:4,marginBottom:16}}>
            {["artist","webgen"].map(id=>{
              const a=agents[id]; const isActive=activeTab===id;
              return (
                <button key={id} onClick={()=>{setActiveTab(id as any);setSelMode("study");setSelRef((id==="artist"?PIXEL_REFS:WEB_REFS)[0].id);setTrainResult(null);}}
                  style={{
                    flex:1,padding:"10px 8px",
                    background:isActive?((a?.color||"#475569")+"15"):"transparent",
                    border:"1px solid "+(isActive?(a?.color||"#475569"):"#475569")+"55",
                    color:isActive?(a?.color||"#475569"):"#475569",
                    fontFamily:"inherit",fontSize:14,cursor:"pointer",letterSpacing:1,transition:"all 0.15s"
                  }}>
                  {id==="artist"?"🖼 PIXEL STUDIO":"🌐 WEB GEN"}
                </button>
              );
            })}
          </div>

          {/* Mode selector */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"#475569",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Training Mode</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {activeModes.map(m=>(
                <button key={m.id} onClick={()=>{setSelMode(m.id);setTrainResult(null);}}
                  style={{textAlign:"left",padding:"10px 12px",background:selMode===m.id?`${activeTab==="artist"?"#60a5fa":"#22d3ee"}10`:"transparent",border:`1px solid ${selMode===m.id?(activeTab==="artist"?"#60a5fa":"#22d3ee")+"55":"#1e293b"}`,color:selMode===m.id?(activeTab==="artist"?"#60a5fa":"#22d3ee"):"#94a3b8",fontFamily:"inherit",fontSize:13,cursor:"pointer",letterSpacing:0.5,transition:"all 0.15s"}}>
                  <div style={{fontWeight:"bold",marginBottom:2}}>{m.label} <span style={{fontSize:11,color:"#475569"}}>+{m.xp}XP</span></div>
                  <div style={{fontSize:11,color:"#64748b",lineHeight:1.4}}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reference picker */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:"#475569",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>
              {activeTab==="artist"?"Reference Sprite":"Design Reference"}
            </div>
            <select value={selRef} onChange={e=>setSelRef(e.target.value)}
              style={{width:"100%",background:"#0a0d12",border:"1px solid #252938",color:"#e2e8f0",padding:"8px 10px",fontFamily:"inherit",fontSize:13,outline:"none"}}>
              {activeRefs.map(r=>(
                <option key={r.id} value={r.id}>{r.name} {activeTab==="artist"&&(r as any).size?`(${(r as any).size})`:""} {activeTab==="webgen"&&(r as any).style?`— ${(r as any).style}`:""}</option>
              ))}
            </select>
          </div>

          {/* Custom prompt (challenge mode) */}
          {selMode==="challenge" && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,color:"#475569",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Challenge Prompt</div>
              <textarea value={trainPrompt} onChange={e=>setTrainPrompt(e.target.value)}
                placeholder={activeTab==="artist"?"e.g. a goblin warrior in Bob's style":"e.g. a restaurant landing page in Stripe's style"}
                rows={3} style={{width:"100%",background:"#0a0d12",border:"1px solid #252938",color:"#e2e8f0",padding:"8px 10px",fontFamily:"inherit",fontSize:13,outline:"none",resize:"vertical"}}/>
            </div>
          )}

          {/* Train button */}
          <button onClick={doTraining} disabled={training}
            style={{width:"100%",padding:"12px",background:training?"#1e293b":`${activeTab==="artist"?"#60a5fa":"#22d3ee"}15`,color:training?"#475569":activeTab==="artist"?"#60a5fa":"#22d3ee",border:`1px solid ${activeTab==="artist"?"#60a5fa":"#22d3ee"}33`,fontFamily:"inherit",fontSize:16,letterSpacing:2,cursor:training?"not-allowed":"pointer",textTransform:"uppercase",marginBottom:16}}>
            {training?"TRAINING...":`▸ TRAIN ${activeTab==="artist"?"PIXEL STUDIO":"WEB GENERATOR"}`}
          </button>

          {/* Training Result */}
          {trainResult && (
            <div style={{background:"#0a0d12",border:"1px solid #252938",padding:14,fontSize:12,lineHeight:1.6}}>
              <div style={{color:"#4ade80",fontSize:14,letterSpacing:1,marginBottom:8}}>
                {trainResult.approved!==undefined?(trainResult.approved?"✓ PASS":"⚠ NEEDS WORK"):"✓ COMPLETE"}
                {trainResult.score!==undefined&&<span> · {trainResult.score}/100</span>}
              </div>
              {trainResult.insights && (
                <div style={{marginBottom:8}}>
                  <div style={{color:"#f5a623",fontSize:11,letterSpacing:1,marginBottom:4}}>📖 INSIGHTS</div>
                  <div style={{color:"#94a3b8",whiteSpace:"pre-wrap"}}>{trainResult.insights}</div>
                </div>
              )}
              {trainResult.checks && (
                <div style={{marginBottom:8}}>
                  {Object.entries(trainResult.checks).map(([k,v]:any)=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:"1px solid #1e293b"}}>
                      <span style={{color:"#64748b"}}>{k}</span>
                      <span style={{color:v?.pass?"#4ade80":"#f87171"}}>{v?.pass?"✓":"✕"} {v?.note}</span>
                    </div>
                  ))}
                </div>
              )}
              {trainResult.feedback && <div style={{color:"#c084fc",borderTop:"1px solid #1e293b",paddingTop:8}}>{trainResult.feedback}</div>}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
        @keyframes xpFlash{0%{transform:scale(1);}50%{transform:scale(1.02);}100%{transform:scale(1);}}
        @keyframes slideDown{from{transform:translateY(-10px);opacity:0;}to{transform:translateY(0);opacity:1;}}
      `}</style>
    </div>
  );
}
