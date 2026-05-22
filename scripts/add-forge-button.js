const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '../app/workstation/page.tsx');
let page = fs.readFileSync(pagePath, 'utf8');

// Add startForge handler inside WorkstationPage
if (!page.includes("async function startForge")) {
  page = page.replace(/(const \[showForgeModal, setShowForgeModal\] = useState\(false\))/, `$1
  
  async function startForge() {
    try {
      const res = await fetch("/api/agents/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "auto" })
      });
      if (res.ok) {
        addLog("popo", "Factory started via API", "info");
      }
    } catch(e) {
      addLog("popo", "Failed to start factory", "err");
    }
  }
  `);
}

// Add the button next to the LOG button
if (!page.includes(">START<")) {
  page = page.replace(/(<button className="kairosoft-btn"[^>]*onClick=\{[^}]*setShowLogModal\(true\)[^}]*\}[^>]*>[\s\S]*?<\/button>)/, 
  `<button className="kairosoft-btn" style={{background: 'linear-gradient(180deg, #d4a03c 0%, #8b6914 100%)', borderColor: '#f5d98a', textShadow: '1px 1px 0 #5c4510'}} onClick={() => startForge()}>
              <Zap className="h-3 w-3 inline-block mr-1" />START
            </button>
            $1`);
}

fs.writeFileSync(pagePath, page);
console.log("Added START button.");
