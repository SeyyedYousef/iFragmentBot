import { getBrowser } from "../../../Shared/UI/Components/card-generator.component.js";

/**
 * Generates a premium "Flex Card" image for the given gift.
 * @param {Object} giftData - The gift data to render.
 * @returns {Promise<Buffer>} - The generated image buffer.
 */
export async function generateFlexCard(giftData) {
	console.log("🎁 Generating Gift Flex Card...");
	console.log("📦 giftData:", JSON.stringify(giftData, null, 2));

	const browser = await getBrowser();

	const backdropColors = {
		Sky: "#00BFFF",
		Sapphire: "#0F52BA",
		Midnight: "#191970", // Deep blue, maybe too dark for glow, let's use lighter
		Violet: "#8A2BE2",
		Purple: "#800080",
		Mint: "#98FF98",
		Emerald: "#50C878",
		Gold: "#FFD700",
		Amber: "#FFBF00",
		Red: "#FF0000",
		Ruby: "#E0115F",
		Black: "#FFFFFF", // White glow for black
		Onyx: "#353839", // Dark grey
		White: "#FFFFFF",
		Pink: "#FFC0CB",
		Plasma: "#FF00FF",
		Neon: "#39FF14",
	};

	// Determine color
	let primaryColor = "#0088cc";
	if (giftData.color) {
		// Try direct match
		if (backdropColors[giftData.color])
			primaryColor = backdropColors[giftData.color];
		// Try partial match
		else {
			const lower = giftData.color.toLowerCase();
			if (lower.includes("blue")) primaryColor = "#0088cc";
			else if (lower.includes("red")) primaryColor = "#ff4444";
			else if (lower.includes("green")) primaryColor = "#00ff88";
			else if (lower.includes("gold") || lower.includes("yellow"))
				primaryColor = "#ffd700";
			else if (lower.includes("purple")) primaryColor = "#aa00ff";
			else if (lower.includes("pink")) primaryColor = "#ff6bcb";
		}
	}

	let page = null;

	try {
		page = await browser.newPage();
		await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

		// Premium Story Card Template (1080x1080)
		const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Inter:wght@400;600&family=Noto+Color+Emoji&display=swap" rel="stylesheet">
    <style>
        :root {
            --neon-primary: #0088cc;
            --neon-accent: #00ff88;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            width: 1080px;
            height: 1080px;
            background: #050505;
            /* Improved font stack for emojis */
            font-family: 'Inter', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }

        /* Ambient Glows */
        .glow {
            position: absolute;
            border-radius: 50%;
            filter: blur(150px);
            opacity: 0.15;
            z-index: 1;
        }
        .glow-1 { width: 900px; height: 900px; background: var(--neon-primary); top: -400px; left: -200px; }
        .glow-2 { width: 800px; height: 800px; background: var(--neon-accent); bottom: -300px; right: -200px; }

        .container {
            z-index: 10;
            width: 100%;
            height: 100%;
            padding: 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        /* Glass Card */
        .glass-card {
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(50px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 60px;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between; /* Header Top, Content Middle, Brand Bottom */
            padding: 60px;
            box-shadow: 0 40px 100px rgba(0,0,0,0.6);
            position: relative;
            overflow: hidden;
        }

        /* 1. HEADER (Top) */
        .header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }

        .collection-tag {
            font-family: 'Unbounded', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
            font-size: 24px;
            color: rgba(255,255,255,0.6);
            letter-spacing: 2px;
            text-transform: uppercase;
        }

        .item-number {
            font-family: 'Unbounded', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
            font-size: 64px;
            font-weight: 800;
            line-height: 1;
            background: linear-gradient(135deg, #fff 0%, #aaa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        /* 2. CONTENT (Middle - Grows) */
        .content-center {
            flex-grow: 1;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 40px;
        }

        .image-stage {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .image-glow {
            position: absolute;
            width: 450px;
            height: 450px;
            background: radial-gradient(circle, var(--neon-primary) 0%, transparent 60%);
            opacity: 0.25;
            filter: blur(80px);
        }

        .details {
            width: 100%;
            display: flex;
            justify-content: space-between; /* Price Left, Verdict Right */
            align-items: flex-end;
            padding: 0 20px;
        }

        .price-group {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .label {
            font-size: 16px;
            color: rgba(255,255,255,0.4);
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 600;
        }

        .price-val {
            font-family: 'Unbounded', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
            font-size: 48px;
            font-weight: 800;
            color: white;
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .verdict-group {
            text-align: right;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 10px;
        }

        .verdict-text {
            font-family: 'Unbounded', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
            font-size: 36px;
            font-weight: 800;
            color: var(--neon-accent);
            text-shadow: 0 0 30px rgba(0, 255, 136, 0.4);
        }

        .badges {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }

        .badge {
            background: rgba(255,255,255,0.08);
            padding: 8px 18px;
            border-radius: 100px;
            font-size: 14px;
            font-weight: 600;
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.9);
            /* Force emoji font specifically here too */
            font-family: 'Inter', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif;
        }

        /* 3. FOOTER (Bottom) */
        .footer-brand {
            font-family: 'Unbounded', 'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', 'Android Emoji', sans-serif;
            font-size: 24px;
            color: rgba(255, 255, 255, 0.2);
            letter-spacing: 4px;
            text-transform: uppercase;
            font-weight: 800;
        }
        
        /* Dynamic Color Injection */
        .dynamic-text { color: ${primaryColor}; }
    </style>
</head>
<body>
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>

    <div class="container">
        <div class="glass-card">
            <!-- 1. Header -->
            <div class="header">
                <div class="collection-tag">${giftData.collectionName}</div>
                <div class="item-number">#${giftData.itemNumber}</div>
            </div>

            <!-- 2. Center Content -->
            <div class="content-center">
                <div class="image-stage">
                    <div class="image-glow" style="background: radial-gradient(circle, ${primaryColor} 0%, transparent 70%);"></div>
                    <lottie-player 
                        src="${giftData.imageUrl}" 
                        background="transparent" 
                        speed="1" 
                        style="width: 580px; height: 580px; filter: drop-shadow(0 0 60px rgba(0,0,0,0.5));"
                        loop 
                        autoplay>
                    </lottie-player>
                </div>

                <div class="details">
                    <div class="price-group">
                        <div class="label">Estimated Value</div>
                        <div class="price-val">💎 ${giftData.price}</div>
                    </div>

                    <div class="verdict-group">
                        <div class="verdict-text">${giftData.verdict}</div>
                        <div class="badges">
                            ${(giftData.badges || []).map((b) => `<div class="badge">${b}</div>`).join("")}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. Footer -->
            <div class="footer-brand">@iFragmentBot</div>
        </div>
    </div>
</body>
</html>
        `;

		await page.setContent(htmlContent, {
			waitUntil: "domcontentloaded",
			timeout: 60000,
		});

		// Wait for Lottie animation to load
		try {
			await page.waitForFunction(
				() => {
					const lottie = document.querySelector("lottie-player");
					return lottie?.shadowRoot?.querySelector("svg");
				},
				{ timeout: 15000 },
			);
			// Give extra time for animation to render first frame
			await new Promise((r) => setTimeout(r, 2000));
			console.log("✅ Gift animation loaded successfully");
		} catch (_imgErr) {
			console.warn("⚠️ Lottie animation failed to load, continuing anyway...");
		}

		console.log("📸 Taking screenshot...");
		const buffer = await page.screenshot({ type: "png" });

		// Validate buffer
		if (!buffer || buffer.length === 0) {
			throw new Error("Screenshot buffer is empty");
		}
		console.log(`✅ Screenshot taken, buffer size: ${buffer.length} bytes`);

		return buffer;
	} catch (error) {
		console.error("Error generating Flex Card:", error);
		throw error;
	} finally {
		if (page) await page.close();
	}
}
