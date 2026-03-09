/**
 * Comparison Card Component
 * Generates a 1080x1080 HTML comparison card for username vs username.
 * Extracted from bot.entry.js to reduce monolith size.
 */

import { getPage } from './card-generator.component.js';

/**
 * Generate a comparison card image between two usernames.
 * @param {object} data - Card data with username1/2, value1/2, rarity1/2, etc.
 * @returns {Buffer} PNG image buffer
 */
export async function generateComparisonCard(data) {
    const winner = data.value1 >= data.value2 ? 1 : 2;

    // Format numbers for display
    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toLocaleString();
    };

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Inter:wght@400;600&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                width: 1080px;
                height: 1080px;
                font-family: 'Inter', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
                background: linear-gradient(135deg, #050505 0%, #1a1a2e 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                overflow: hidden;
                position: relative;
            }
            
            .glow {
                position: absolute;
                border-radius: 50%;
                filter: blur(150px);
                opacity: 0.15;
            }
            .glow-1 { width: 800px; height: 800px; background: #00d4ff; top: -300px; left: -300px; }
            .glow-2 { width: 700px; height: 700px; background: #9d00ff; bottom: -200px; right: -200px; }
            
            .container {
                z-index: 10;
                width: 100%;
                height: 100%;
                padding: 60px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
            }
            
            .header {
                text-align: center;
                margin-top: 20px;
            }
            
            .header h1 {
                font-family: 'Unbounded', sans-serif;
                font-size: 36px;
                font-weight: 800;
                color: rgba(255,255,255,0.8);
                letter-spacing: 2px;
                text-transform: uppercase;
            }
            
            .battle-arena {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                flex: 1;
                gap: 40px;
                position: relative;
            }
            
            .fighter-card {
                flex: 1;
                height: 750px;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.05);
                backdrop-filter: blur(20px);
                border-radius: 40px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
                transition: transform 0.3s;
            }
            
            .fighter-card.winner {
                border: 2px solid rgba(255, 215, 0, 0.4);
                background: radial-gradient(circle at center, rgba(255, 215, 0, 0.05) 0%, rgba(255,255,255,0.03) 100%);
                box-shadow: 0 0 60px rgba(255, 215, 0, 0.1);
            }
            
            .crown {
                font-size: 48px;
                margin-bottom: 20px;
                filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.6));
            }
            
            .username {
                font-family: 'Unbounded', sans-serif;
                font-size: 42px;
                font-weight: 900;
                margin-bottom: 40px;
                text-align: center;
                line-height: 1.1;
                word-break: break-all;
                padding: 0 20px;
            }
            
            .username.u1 { color: #00d4ff; text-shadow: 0 0 30px rgba(0, 212, 255, 0.3); }
            .username.u2 { color: #00ff88; text-shadow: 0 0 30px rgba(0, 255, 136, 0.3); }
            
            .stats {
                width: 100%;
                padding: 0 30px;
                text-align: center;
            }
            
            .stat-val {
                font-size: 32px;
                font-weight: 700;
                color: white;
                margin-bottom: 5px;
            }
            
            .stat-lbl {
                font-size: 14px;
                color: rgba(255,255,255,0.4);
                text-transform: uppercase;
                letter-spacing: 2px;
                margin-bottom: 20px;
            }
            
            .vs-badge {
                position: absolute;
                width: 100px;
                height: 100px;
                background: #fff;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Unbounded', sans-serif;
                font-size: 32px;
                font-weight: 900;
                color: black;
                z-index: 20;
                box-shadow: 0 0 50px rgba(255,255,255,0.3);
            }
            
            .footer {
                margin-bottom: 20px;
                font-family: 'Unbounded', sans-serif;
                font-size: 20px;
                color: rgba(255, 255, 255, 0.3);
                letter-spacing: 3px;
                font-weight: 700;
            }
        </style>
    </head>
    <body>
        <div class="glow glow-1"></div>
        <div class="glow glow-2"></div>
        
        <div class="container">
            <div class="header">
                <h1>Face Off</h1>
            </div>
            
            <div class="battle-arena">
                <div class="fighter-card ${winner === 1 ? 'winner' : ''}">
                    ${winner === 1 ? '<div class="crown">👑</div>' : '<div style="height: 68px"></div>'}
                    <div class="username u1">@${data.username1}</div>
                    
                    <div class="stats">
                        <div class="stat-val">~${formatNumber(data.value1)}</div>
                        <div class="stat-lbl">TON Value</div>
                        
                        <div class="stat-val">${data.rarity1.tier}</div>
                        <div class="stat-lbl">Rarity</div>
                    </div>
                </div>
                
                <div class="vs-badge">VS</div>
                
                <div class="fighter-card ${winner === 2 ? 'winner' : ''}">
                    ${winner === 2 ? '<div class="crown">👑</div>' : '<div style="height: 68px"></div>'}
                    <div class="username u2">@${data.username2}</div>
                    
                    <div class="stats">
                        <div class="stat-val">~${formatNumber(data.value2)}</div>
                        <div class="stat-lbl">TON Value</div>
                        
                        <div class="stat-val">${data.rarity2.tier}</div>
                        <div class="stat-lbl">Rarity</div>
                    </div>
                </div>
            </div>
            
            <div class="footer">@iFragmentBot</div>
        </div>
    </body>
    </html>
    `;

    const page = await getPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.setViewport({ width: 1080, height: 1080 });

    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 500));

    const imageBuffer = await page.screenshot({ type: 'png' });
    await page.close();
    return imageBuffer;
}

export default { generateComparisonCard };
