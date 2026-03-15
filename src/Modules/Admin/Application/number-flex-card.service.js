/**
 * Number Flex Card Service
 * Generates a REFINED (100/100) Ultra-Premium 1080x1080 Flex Card for +888 Anonymous Numbers.
 * Focus: Fixes clipping issues, maximizes readability and "User Interest" with a cleaner, high-contrast aesthetic.
 */

import { getBrowser } from "../../../Shared/UI/Components/card-generator.component.js";

export async function generateNumberFlexCard(numberData) {
	console.log("📱 Generating Refined Violet Number Flex Card...");

	const browser = await getBrowser();
	let page = null;

	try {
		page = await browser.newPage();
		await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });

		const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=JetBrains+Mono:wght@500;800&family=Space+Grotesk:wght@300;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #030308;
            --violet: #7C3AED;
            --violet-glow: rgba(124, 58, 237, 0.5);
            --surface: rgba(255, 255, 255, 0.03);
            --border: rgba(255, 255, 255, 0.1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            width: 1080px; height: 1080px;
            background: var(--bg);
            font-family: 'Outfit', sans-serif;
            color: #fff;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; position: relative;
        }

        /* --- Clean Deep Background --- */
        .bg-gradient {
            position: absolute; inset: 0;
            background: 
                radial-gradient(circle at 20% 20%, #1e1b4b 0%, transparent 40%),
                radial-gradient(circle at 80% 80%, #2e1065 0%, transparent 40%),
                radial-gradient(circle at 50% 50%, #030308 0%, #000 100%);
            z-index: 0;
        }

        .bg-grid {
            position: absolute; inset: 0;
            background-image: radial-gradient(rgba(124, 58, 237, 0.15) 1px, transparent 1px);
            background-size: 40px 40px;
            mask-image: radial-gradient(circle, black, transparent 90%);
            z-index: 1;
        }

        /* --- Main Card --- */
        .glass-card {
            position: relative; z-index: 10;
            width: 940px; height: 940px;
            background: rgba(15, 10, 30, 0.6);
            backdrop-filter: blur(80px);
            border: 2px solid var(--border);
            border-radius: 70px;
            display: flex; flex-direction: column; padding: 70px;
            box-shadow: 0 50px 100px rgba(0,0,0,0.8), inset 0 0 40px rgba(255,255,255,0.02);
            overflow: hidden;
        }

        /* --- Header --- */
        .header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 30px;
        }
        .header-tag { font-size: 16px; font-weight: 800; letter-spacing: 6px; color: rgba(255,255,255,0.4); text-transform: uppercase; }
        .bot-tag { font-size: 18px; font-weight: 700; color: var(--violet); opacity: 0.8; }

        /* --- Hero: The Number --- */
        .hero {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            position: relative; width: 100%;
        }

        .number-glow-bg {
            position: absolute; width: 80%; height: 120px;
            background: var(--violet); filter: blur(130px);
            opacity: 0.2; z-index: -1;
        }

        .number-container {
            width: 100%; text-align: center;
            overflow: visible; /* Prevent clipping */
            padding: 20px;
        }

        .number-main {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 800; letter-spacing: -2px;
            color: #fff;
            filter: drop-shadow(0 0 30px var(--violet-glow));
            line-height: 1;
            white-space: nowrap;
            display: inline-block;
            /* Adaptive font size */
            font-size: 115px; 
        }

        .rarity-pill {
            margin-top: 50px;
            background: var(--violet);
            color: #fff;
            padding: 12px 40px; border-radius: 100px;
            font-size: 30px; font-weight: 900;
            text-transform: uppercase; letter-spacing: 10px;
            box-shadow: 0 0 40px var(--violet-glow);
            border: 2px solid rgba(255,255,255,0.3);
        }

        /* --- Valuation Panels --- */
        .data-section {
            display: flex; flex-direction: column; gap: 30px;
            margin-top: 40px;
        }

        .valuation-panel {
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border);
            border-radius: 35px; padding: 40px;
            display: flex; justify-content: space-between; align-items: center;
        }

        .val-group { display: flex; flex-direction: column; gap: 10px; }
        .val-label { font-size: 15px; font-weight: 700; letter-spacing: 4px; color: rgba(255,255,255,0.3); text-transform: uppercase; }
        .val-amount {
            font-size: 76px; font-weight: 800; color: #fff;
            display: flex; align-items: center; gap: 20px;
            font-family: 'Space Grotesk', sans-serif;
        }
        .ton-icon { width: 62px; height: 62px; filter: drop-shadow(0 0 15px #0098EA); }

        .status-chips { display: flex; flex-direction: column; gap: 10px; }
        .status-chip {
            background: rgba(124, 58, 237, 0.1);
            border: 1px solid rgba(124, 58, 237, 0.3);
            padding: 10px 20px; border-radius: 15px;
            font-size: 18px; font-weight: 700; color: #fff;
            display: flex; justify-content: space-between; gap: 30px;
        }
        .status-chip span { color: var(--violet); }

        /* --- Stats Grid --- */
        .stats-grid {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
        }
        .stat-box {
            background: rgba(255,255,255,0.02);
            border: 1px solid var(--border);
            border-radius: 25px; padding: 25px; text-align: center;
        }
        .stat-label { font-size: 12px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 8px; }
        .stat-value { font-size: 26px; font-weight: 800; color: #fff; }
        .stat-value.violet { color: var(--violet); }

        /* --- Watermark --- */
        .footer {
            margin-top: 40px; display: flex; align-items: center; gap: 20px;
            opacity: 0.2; justify-content: center;
        }
        .line { flex: 1; height: 1px; background: #fff; }
        .foot-text { font-size: 12px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase; }

    </style>
</head>
<body>
    <div class="bg-gradient"></div>
    <div class="bg-grid"></div>

    <div class="glass-card">
        <div class="header">
            <div class="header-tag">Verified Asset</div>
            <div class="bot-tag">@iFragmentBot</div>
        </div>

        <div class="hero">
            <div class="number-glow-bg"></div>
            <div class="number-container">
                <div class="number-main" id="numTarget">${numberData.formattedNumber || numberData.number}</div>
            </div>
            <div class="rarity-pill">${numberData.verdict || "STANDARD"}</div>
        </div>

        <div class="data-section">
            <div class="valuation-panel">
                <div class="val-group">
                    <div class="val-label">Market Valuation</div>
                    <div class="val-amount">
                        <svg class="ton-icon" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/>
                            <path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white"/>
                        </svg>
                        ${numberData.price}
                    </div>
                </div>
                <div class="status-chips">
                    <div class="status-chip">Status <span>${(numberData.status || "OWNED").toUpperCase()}</span></div>
                    <div class="status-chip">Pattern <span>${(numberData.pattern || "SOLID").toUpperCase()}</span></div>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-label">Floor</div>
                    <div class="stat-value">${numberData.floor} TON</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Alpha</div>
                    <div class="stat-value violet">${numberData.vsFloor}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Trust</div>
                    <div class="stat-value violet">${numberData.confidence}</div>
                </div>
            </div>
        </div>

        <div class="footer">
            <div class="line"></div>
            <div class="foot-text">Intelligence By iFragmentBot</div>
            <div class="line"></div>
        </div>
    </div>

    <script>
        function fit() {
            const el = document.getElementById('numTarget');
            const maxWidth = 800; 
            let s = 115;
            el.style.fontSize = s + 'px';
            // Aggressive check to ensure it NEVER cuts off
            while((el.offsetWidth > maxWidth || el.scrollWidth > maxWidth) && s > 30) {
                s -= 1;
                el.style.fontSize = s + 'px';
            }
        }
        window.onload = fit;
    </script>
</body>
</html>`;

		await page.setContent(htmlContent, {
			waitUntil: "networkidle0",
			timeout: 15000,
		});
		await new Promise((r) => setTimeout(r, 1000));
		const buffer = await page.screenshot({ type: "png" });
		console.log(`✅ Refined Card generated: ${buffer.length} bytes`);
		return buffer;
	} catch (error) {
		console.error("Refined Card Error:", error);
		throw error;
	} finally {
		if (page) await page.close();
	}
}
