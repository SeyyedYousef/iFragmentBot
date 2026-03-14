/**
 * Number Flex Card Service
 * Generates premium 1080x1080 Flex Card image for +888 Anonymous Numbers
 */

import { getBrowser } from "../../../Shared/UI/Components/card-generator.component.js";

export async function generateNumberFlexCard(numberData) {
	console.log("📱 Generating Number Flex Card...");

	const browser = await getBrowser();
	let page = null;

	try {
		page = await browser.newPage();
		await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

		// Color theme based on verdict
		const verdict = String(numberData.verdict || "STANDARD").toUpperCase();
		const theme =
			verdict === "GRAIL"
				? { primary: "#FFD700", accent: "#FF6A00" }
				: verdict === "PREMIUM"
					? { primary: "#AA00FF", accent: "#00E5FF" }
					: verdict === "LUCKY"
						? { primary: "#00FF88", accent: "#00BFFF" }
						: { primary: "#0088cc", accent: "#00ff88" };

		const primaryColor = theme.primary;
		const accentColor = theme.accent;

		const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=JetBrains+Mono:wght@400;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1080px; height: 1080px;
            background: radial-gradient(circle at 50% 0%, #34b3ff 0%, #006aff 100%);
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }
        
        /* Background mini clouds */
        .bg-cloud {
            position: absolute;
            background: rgba(255,255,255,0.15);
            border-radius: 999px;
            filter: blur(8px);
            z-index: 0;
        }
        .b1 { width: 400px; height: 120px; top: 100px; left: -100px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .b2 { width: 500px; height: 180px; top: 250px; right: -150px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .b3 { width: 350px; height: 100px; bottom: 120px; left: 50px; opacity: 0.5; }

        /* The Giant Cloud Container */
        .cloud-container {
            position: relative;
            width: 960px;
            height: 750px;
            filter: drop-shadow(0 35px 55px rgba(0,0,80,0.3));
            z-index: 10;
            display: flex;
            justify-content: center;
        }

        /* Solid Cloud Shapes */
        .cloud-part {
            position: absolute;
            background: #ffffff;
            z-index: 1;
        }
        .cloud-base {
            width: 940px;
            height: 480px;
            border-radius: 240px;
            bottom: 0px;
            left: 10px;
            box-shadow: inset 0 -15px 30px rgba(0, 50, 150, 0.05);
        }
        .cloud-bubble-1 {
            width: 480px; 
            height: 480px;
            border-radius: 50%;
            bottom: 220px; 
            left: 100px;
        }
        .cloud-bubble-2 {
            width: 620px; 
            height: 620px;
            border-radius: 50%;
            bottom: 130px; 
            right: 40px;
        }

        /* Content inside the cloud */
        .content {
            position: absolute;
            bottom: 40px;
            left: 0;
            width: 100%;
            z-index: 10;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            text-align: center;
            height: 100%;
        }

        .collection-tag {
            font-family: 'Unbounded', sans-serif;
            font-size: 26px;
            font-weight: 900;
            color: #0088cc;
            letter-spacing: 4px;
            margin-bottom: 20px;
            margin-top: -80px; /* Shift up inside bubble 2 visually */
            background: rgba(0, 136, 204, 0.1);
            padding: 10px 30px;
            border-radius: 999px;
            text-transform: uppercase;
        }
        
        .number-display {
            font-family: 'JetBrains Mono', monospace;
            font-size: 85px;
            font-weight: 800;
            letter-spacing: 4px;
            color: #121e2a;
            margin: 0px 0 25px 0;
            text-shadow: 2px 2px 0px rgba(0,0,0,0.03);
        }
        
        .price-group {
            text-align: center;
            margin-top: 10px;
            background: #f4f9ff;
            padding: 30px 80px;
            border-radius: 50px;
            border: 3px solid #e1f0fc;
            box-shadow: 0 10px 20px rgba(0,0,0,0.03);
        }
        .price-label {
            font-size: 18px;
            font-weight: 800;
            color: #798da3;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .price-val {
            font-family: 'Unbounded', sans-serif;
            font-size: 72px;
            font-weight: 900;
            color: ${primaryColor};
        }
        
        .meta-row {
            display: flex;
            gap: 15px;
            margin-top: 35px;
            flex-wrap: wrap;
            justify-content: center;
            width: 80%;
        }
        .chip {
            padding: 14px 28px;
            border-radius: 999px;
            background: #ffffff;
            border: 2px solid #e5eef7;
            font-size: 18px;
            font-weight: 700;
            color: #55687b;
            box-shadow: 0 5px 15px rgba(0,0,0,0.04);
        }
        .chip strong { 
            color: ${primaryColor}; 
            font-weight: 800; 
        }
        
        /* The floating verdict badge */
        .verdict-badge {
            position: absolute;
            top: 250px;
            right: 40px;
            background: linear-gradient(135deg, ${primaryColor}, ${accentColor});
            color: white;
            padding: 15px 40px;
            border-radius: 999px;
            font-family: 'Unbounded', sans-serif;
            font-size: 26px;
            font-weight: 900;
            letter-spacing: 3px;
            transform: rotate(10deg);
            box-shadow: 0 15px 30px rgba(0,0,0,0.15);
            text-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 20;
        }
        
        .footer-brand {
            position: absolute;
            bottom: -60px;
            font-family: 'Unbounded', sans-serif;
            font-size: 26px;
            font-weight: 700;
            color: rgba(255,255,255,0.95);
            letter-spacing: 2px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="bg-cloud b1"></div>
    <div class="bg-cloud b2"></div>
    <div class="bg-cloud b3"></div>

    <div class="cloud-container">
        <!-- The Cloud Shape -->
        <div class="cloud-part cloud-base"></div>
        <div class="cloud-part cloud-bubble-1"></div>
        <div class="cloud-part cloud-bubble-2"></div>

        <!-- The Floating Badge -->
        <div class="verdict-badge">${numberData.verdict || "STANDARD"}</div>

        <!-- Content -->
        <div class="content">
            <div class="collection-tag">ANONYMOUS NUMBER</div>
            <div class="number-display">${numberData.formattedNumber || numberData.number || "+888"}</div>
            
            <div class="price-group">
                <div class="price-label">Estimated Value</div>
                <div class="price-val">💎 ${numberData.price ? Number(numberData.price).toLocaleString() : "0"} TON</div>
            </div>
            
            <div class="meta-row">
                ${numberData.status ? `<div class="chip">Status: <strong>${numberData.status.replace(/_/g, " ").toUpperCase()}</strong></div>` : ""}
                ${numberData.floor ? `<div class="chip">Floor: <strong>${Number(numberData.floor).toLocaleString()} TON</strong></div>` : ""}
                ${numberData.vsFloor !== undefined ? `<div class="chip">Market: <strong>${Number(numberData.vsFloor) >= 0 ? "+" : ""}${Number(numberData.vsFloor).toFixed(0)}%</strong></div>` : ""}
                ${numberData.momentum?.change24h ? `<div class="chip">24h: <strong style="color: ${numberData.momentum.change24h >= 0 ? "#00b894" : "#d63031"}">${numberData.momentum.change24h >= 0 ? "📈 +" : "📉 "}${numberData.momentum.change24h.toFixed(1)}%</strong></div>` : ""}
                ${numberData.pattern ? `<div class="chip">Type: <strong>${numberData.pattern}</strong></div>` : ""}
                ${numberData.owner ? `<div class="chip">Owner: <strong>${numberData.owner.substring(0, 6)}...${numberData.owner.slice(-4)}</strong></div>` : ""}
            </div>
        </div>

        <div class="footer-brand">@iFragmentBot</div>
    </div>
</body>
</html>`;

		await page.setContent(htmlContent, {
			waitUntil: "networkidle0",
			timeout: 15000,
		});
		await new Promise((r) => setTimeout(r, 500));

		const buffer = await page.screenshot({ type: "png" });
		if (!buffer || buffer.length === 0)
			throw new Error("Screenshot buffer empty");
		console.log(`✅ Number Flex Card generated, ${buffer.length} bytes`);
		return buffer;
	} catch (error) {
		console.error("Number Flex Card error:", error);
		throw error;
	} finally {
		if (page) await page.close();
	}
}
