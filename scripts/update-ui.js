const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../app/workstation/kairosoft-theme.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace dungeon styles with office styles
css = css.replace(/\.kairosoft-window \{[\s\S]*?\}/, `.kairosoft-window {
  border: 4px solid #4a90e2 !important;
  border-radius: 4px !important;
  box-shadow: 2px 2px 0 0 #2a5a92, inset 0 0 0 1px #a4c8f0 !important;
  background: #f0f4f8 !important;
  color: #333 !important;
  max-width: 440px !important;
}`);

css = css.replace(/\.kairosoft-window \.window-title \{[\s\S]*?\}/, `.kairosoft-window .window-title {
  background: #4a90e2 !important;
  color: #fff !important;
  padding: 6px 12px !important;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
  font-size: 14px !important;
  font-weight: bold !important;
  text-shadow: 1px 1px 0 #2a5a92 !important;
  letter-spacing: 0.5px !important;
}`);

css = css.replace(/\.kairosoft-window \.window-body \{[\s\S]*?\}/, `.kairosoft-window .window-body {
  padding: 12px !important;
  background: #fff !important;
  border-top: 2px solid #2a5a92 !important;
}`);

css = css.replace(/\.kairosoft-agent-card \{[\s\S]*?\}/, `.kairosoft-agent-card {
  background: #fff;
  border: 2px solid #ccc;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 10px;
  color: #333;
}`);

css += `
/* Office Floor */
.office-floor {
  background-color: #e0e0e0;
  background-image: 
    linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%, #d4d4d4),
    linear-gradient(45deg, #d4d4d4 25%, transparent 25%, transparent 75%, #d4d4d4 75%, #d4d4d4);
  background-size: 32px 32px;
  background-position: 0 0, 16px 16px;
}
.office-wall {
  background: #f5f5f5;
  border-bottom: 4px solid #b0b0b0;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
`;

fs.writeFileSync(cssPath, css);

const pagePath = path.join(__dirname, '../app/workstation/page.tsx');
let page = fs.readFileSync(pagePath, 'utf8');

// Stop the dummy scheduler by clearing out the scheduler useEffect body
page = page.replace(/schedulerRef\.current = setInterval\(\(\) => \{[\s\S]*?\}, PIPELINE_TICK_MS\)/, `
    // Poll the Hermes API for real status
    schedulerRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/agents/status');
        const data = await res.json();
        
        if (data.success) {
          setForgeRunning(data.isBusy);
          
          // Update agents based on real data
          if (data.isBusy) {
            setCurrentPipelineStep(1); // Show forging
            setAgents(prev => {
              const next = { ...prev };
              if (next['forge']) {
                next['forge'] = {
                  ...next['forge'],
                  status: 'working',
                  message: 'Forging asset...',
                  pulse: true
                };
              }
              return next;
            });
          } else {
            setCurrentPipelineStep(0); // Show idle
            setAgents(prev => {
              const next = { ...prev };
              if (next['forge'] && next['forge'].status === 'working') {
                next['forge'] = {
                  ...next['forge'],
                  status: 'done',
                  message: 'Pipeline complete!',
                  pulse: false
                };
              }
              return next;
            });
          }
          
          if (data.results && data.results.length > 0) {
            // Update latest generated assets
            const latest = data.results[data.results.length - 1];
            if (latest.assets) {
              setRecentAssets(latest.assets);
            }
          }
        }
      } catch (err) {
        console.error('Failed to poll status', err);
      }
    }, 5000)
`);

fs.writeFileSync(pagePath, page);

console.log("Updated UI and Page successfully.");
