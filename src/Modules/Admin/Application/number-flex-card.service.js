/**
 * Number Flex Card Service
 * Generates an UNBEATABLE (100/100) Ultra-Luxury 1080x1080 Flex Card for +888 Anonymous Numbers.
 * Design Strategy: Mesh Gradients, Advanced Glassmorphism, Metallic Reflections, and Holographic Touches.
 */

import { getBrowser } from "../../../Shared/UI/Components/card-generator.component.js";

export async function generateNumberFlexCard(numberData) {
	console.log("📱 Generating UNBEATABLE Ultra-Premium Number Flex Card...");

	const browser = await getBrowser();
	let page = null;

	try {
		page = await browser.newPage();
		await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 }); // High DPI for crispness

		// Color theme mapping based on verdict
		const verdict = String(numberData.verdict || "STANDARD").toUpperCase();
		
		// Luxury Themes
		let theme = {
			primary: "#00D4FF", // Electric Cyan
			secondary: "#0055FF",
			tertiary: "#9d00ff",
			accent: "#ffffff",
			glow: "rgba(0, 212, 255, 0.4)",
			metallic: "linear-gradient(180deg, #FFFFFF 0%, #B0B0B0 100%)",
			sealBg: "rgba(0, 212, 255, 0.1)"
		};
		
		if (verdict === "GRAIL" || verdict === "GOLD") {
			theme = {
				primary: "#FFD700", // Gold
				secondary: "#FF8C00",
				tertiary: "#ff0080",
				accent: "#FFFCF0",
				glow: "rgba(255, 215, 0, 0.6)",
				metallic: "linear-gradient(180deg, #FFF5C3 0%, #FFFFFF 50%, #FFF5C3 100%)",
				sealBg: "rgba(255, 215, 0, 0.15)"
			};
		} else if (verdict === "PREMIUM" || verdict === "LUCKY") {
			theme = {
				primary: "#AA00FF", // Purple
				secondary: "#00E5FF",
				tertiary: "#FF00E5",
				accent: "#ffffff",
				glow: "rgba(170, 0, 255, 0.5)",
				metallic: "linear-gradient(180deg, #E0C3FC 0%, #FFFFFF 50%, #8EC5FC 100%)",
				sealBg: "rgba(170, 0, 255, 0.1)"
			};
		}

		const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=JetBrains+Mono:wght@500;800&family=Space+Grotesk:wght@300;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-deep: #050510;
            --primary: ${theme.primary};
            --secondary: ${theme.secondary};
            --tertiary: ${theme.tertiary};
            --accent: ${theme.accent};
            --glow: ${theme.glow};
            --metallic: ${theme.metallic};
            --seal-bg: ${theme.sealBg};
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            width: 1080px; height: 1080px;
            background: var(--bg-deep);
            font-family: 'Outfit', sans-serif;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }

        /* --- Advanced Mesh Background --- */
        .bg-mesh {
            position: absolute; inset: 0;
            background-color: var(--bg-deep);
            background-image: 
                radial-gradient(at 0% 0%, var(--primary) 0, transparent 50%), 
                radial-gradient(at 50% 0%, var(--tertiary) 0, transparent 50%), 
                radial-gradient(at 100% 0%, var(--secondary) 0, transparent 50%), 
                radial-gradient(at 100% 100%, var(--primary) 0, transparent 50%), 
                radial-gradient(at 0% 100%, var(--tertiary) 0, transparent 50%);
            opacity: 0.4;
            filter: blur(100px);
            z-index: 0;
        }

        .bg-grid {
            position: absolute; inset: 0;
            background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 50px 50px;
            mask-image: radial-gradient(circle, black, transparent 80%);
            z-index: 1;
        }

        .bg-vignette {
            position: absolute; inset: 0;
            background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.8) 100%);
            z-index: 2;
        }

        /* --- High-End Glassmorphism --- */
        .glass-container {
            position: relative;
            z-index: 10;
            width: 960px;
            height: 960px;
            background: rgba(255, 255, 255, 0.01);
            backdrop-filter: blur(40px);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: 80px;
            display: flex;
            flex-direction: column;
            padding: 80px;
            box-shadow: 
                0 40px 100px rgba(0,0,0,0.8),
                inset 0 0 80px rgba(255, 255, 255, 0.02);
            overflow: hidden;
        }

        .glass-shimmer {
            position: absolute; inset: 0;
            background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%);
            z-index: 11;
            pointer-events: none;
            animation: shimmerEffect 8s infinite linear;
        }
        @keyframes shimmerEffect { 0% { transform: translateX(-150%); } 100% { transform: translateX(150%); } }

        /* --- Header Section --- */
        .header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 20px;
            z-index: 15;
        }
        .header-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 14px; font-weight: 700; letter-spacing: 10px;
            color: rgba(255, 255, 255, 0.4); text-transform: uppercase;
        }
        .header-serial {
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px; color: var(--primary); font-weight: 500;
        }

        /* --- Main Visual Center --- */
        .main-hero {
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 15;
        }

        .number-box {
            position: relative; padding: 40px 60px;
        }
        .number-glow {
            position: absolute; inset: 0;
            background: var(--primary); filter: blur(120px);
            opacity: 0.15; z-index: -1;
        }
        .number-text {
            font-family: 'JetBrains Mono', monospace;
            font-size: 110px; font-weight: 800; letter-spacing: -3px;
            background: var(--metallic);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 30px var(--glow));
            line-height: 1;
        }

        .verdict-badge {
            margin-top: 50px;
            padding: 14px 45px;
            border-radius: 99px;
            background: var(--seal-bg);
            border: 2px solid var(--primary);
            color: var(--primary);
            font-size: 32px; font-weight: 900;
            text-transform: uppercase; letter-spacing: 12px;
            box-shadow: 0 0 40px var(--glow);
            backdrop-filter: blur(10px);
        }

        /* --- Information Panels --- */
        .stats-row {
            display: flex; justify-content: space-between; align-items: flex-end;
            margin-top: 40px; z-index: 15;
        }

        .value-group { display: flex; flex-direction: column; gap: 15px; }
        .value-label { font-size: 16px; font-weight: 600; letter-spacing: 4px; color: rgba(255,255,255,0.3); text-transform: uppercase; }
        .value-amount {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 80px; font-weight: 800; color: #fff;
            display: flex; align-items: center; gap: 20px;
        }
        .ton-icon-large { width: 68px; height: 68px; filter: drop-shadow(0 0 20px #0098EA); }

        .market-chips { display: flex; flex-direction: column; gap: 10px; }
        .chip {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.06);
            padding: 12px 25px; border-radius: 15px;
            font-size: 18px; font-weight: 600; color: rgba(255,255,255,0.6);
            display: flex; justify-content: space-between; gap: 30px;
        }
        .chip strong { color: var(--primary); font-weight: 800; }

        /* --- Footer Info Grid --- */
        .footer-grid {
            margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
            z-index: 15;
        }
        .footer-item {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 25px; padding: 25px; text-align: center;
        }
        .item-label { font-size: 12px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 8px; }
        .item-val { font-size: 26px; font-weight: 800; color: #fff; }
        .item-val.highlight { color: var(--primary); }

        /* --- Watermark --- */
        .watermark {
            margin-top: 40px; display: flex; align-items: center; gap: 15px;
            opacity: 0.15; z-index: 15;
            justify-content: center;
        }
        .w-line { flex: 1; height: 1px; background: #fff; }
        .w-text { font-size: 11px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase; }

    </style>
</head>
<body>
    <!-- Background System -->
    <div class="bg-mesh"></div>
    <div class="bg-grid"></div>
    <div class="bg-vignette"></div>

    <!-- Main Certificate Card -->
    <div class="glass-container">
        <div class="glass-shimmer"></div>

        <!-- Header -->
        <div class="header">
            <div class="header-title">ANONYMOUS NUMBER ASSET</div>
            <div class="header-serial">CERT-NO: 888-A-${Math.floor(Math.random() * 8999) + 1000}</div>
        </div>

        <!-- Hero: The Number -->
        <div class="main-hero">
            <div class="number-box">
                <div class="number-glow"></div>
                <div class="number-text" id="numRef">${numberData.formattedNumber || numberData.number}</div>
            </div>
            <div class="verdict-badge">${numberData.verdict || "STANDARD"}</div>
        </div>

        <!-- Valuation Section -->
        <div class="stats-row">
            <div class="value-group">
                <div class="value-label">Market Value Assessment</div>
                <div class="value-amount">
                    <svg class="ton-icon-large" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M28 56C43.464 56 56 43.464 56 28C56 12.536 43.464 0 28 0C12.536 0 0 12.536 0 28C0 43.464 12.536 56 28 56Z" fill="#0098EA"/>
                        <path d="M37.5603 15.6277H18.4386C14.9228 15.6277 12.6944 19.4202 14.4632 22.4861L26.2644 42.9409C27.0345 44.2765 28.9644 44.2765 29.7345 42.9409L41.5765 22.4861C43.3045 19.4202 41.0761 15.6277 37.5765 15.6277H37.5603ZM26.2483 36.8068L23.6119 31.8097L17.2017 20.6506C16.6742 19.7557 17.3255 18.6198 18.4223 18.6198H26.2483V36.8068ZM38.7972 20.6506L32.387 31.8259L29.7506 36.8068V18.6361H37.5765C38.6734 18.6361 39.3247 19.772 38.7972 20.6669V20.6506Z" fill="white"/>
                    </svg>
                    ${numberData.price || "0"}
                </div>
            </div>

            <div class="market-chips">
                <div class="chip">Status <strong>${(numberData.status || "OWNED").replace(/_/g, " ").toUpperCase()}</strong></div>
                <div class="chip">Pattern <strong>${numberData.pattern || "Regular"}</strong></div>
            </div>
        </div>

        <!-- Footer Data Grid -->
        <div class="footer-grid">
            <div class="footer-item">
                <div class="item-label">Global Floor</div>
                <div class="item-val">${numberData.floor || "850"} TON</div>
            </div>
            <div class="footer-item">
                <div class="item-label">Premium Index</div>
                <div class="item-val highlight">${numberData.vsFloor || "+0%"}</div>
            </div>
            <div class="footer-item">
                <div class="item-label">Data Confidence</div>
                <div class="item-val highlight">${numberData.confidence || "High"}</div>
            </div>
        </div>

        <!-- Footnote -->
        <div class="watermark">
            <div class="w-line"></div>
            <div class="w-text">Intelligence By @iFragmentBot</div>
            <div class="w-line"></div>
        </div>
    </div>

    <script>
        function fitText() {
            const el = document.getElementById('numRef');
            const maxWidth = 800;
            let size = 110;
            el.style.fontSize = size + 'px';
            while(el.scrollWidth > maxWidth && size > 40) {
                size -= 2;
                el.style.fontSize = size + 'px';
            }
        }
        window.onload = fitText;
    </script>
</body>
</html>`;

		await page.setContent(htmlContent, {
			waitUntil: "networkidle0",
			timeout: 15000,
		});
		await new Promise((r) => setTimeout(r, 1500)); // Precise render wait

		const buffer = await page.screenshot({ type: "png" });
		if (!buffer || buffer.length === 0)
			throw new Error("Screenshot buffer empty");
		
		console.log(`✅ UNBEATABLE Number Flex Card generated, ${buffer.length} bytes`);
		return buffer;
	} catch (error) {
		console.error("Number Flex Card error:", error);
		throw error;
	} finally {
		if (page) await page.close();
	}
}
