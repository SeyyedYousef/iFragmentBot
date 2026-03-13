/**
 * Number Flex Card Service
 * Generates premium 1080x1080 Flex Card image for +888 Anonymous Numbers
 */

import { getBrowser } from '../../../Shared/UI/Components/card-generator.component.js';

export async function generateNumberFlexCard(numberData) {
    console.log('📱 Generating Number Flex Card...');

    const browser = await getBrowser();
    let page = null;

    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

        // Color theme based on verdict
        const verdict = String(numberData.verdict || 'STANDARD').toUpperCase();
        const theme =
            verdict === 'GRAIL' ? { primary: '#FFD700', accent: '#FF6A00' } :
                verdict === 'PREMIUM' ? { primary: '#AA00FF', accent: '#00E5FF' } :
                    verdict === 'LUCKY' ? { primary: '#00FF88', accent: '#00BFFF' } :
                        { primary: '#0088cc', accent: '#00ff88' };

        const primaryColor = theme.primary;
        const accentColor = theme.accent;

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1080px; height: 1080px;
            background: #050505;
            font-family: 'Inter', sans-serif;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }
        .glow {
            position: absolute;
            border-radius: 50%;
            filter: blur(150px);
            opacity: 0.2;
        }
        .glow-1 { width: 900px; height: 900px; background: ${primaryColor}; top: -400px; left: -200px; }
        .glow-2 { width: 700px; height: 700px; background: ${accentColor}; bottom: -250px; right: -150px; }
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
        .glass-card {
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(40px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 48px;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 50px;
        }
        .collection-tag {
            font-family: 'Unbounded', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: ${accentColor};
            letter-spacing: 2px;
            margin-bottom: 20px;
        }
        .number-display {
            font-family: 'JetBrains Mono', monospace;
            font-size: 72px;
            font-weight: 600;
            letter-spacing: 8px;
            color: white;
            text-shadow: 0 0 60px rgba(0,136,204,0.5);
            margin: 30px 0;
        }
        .price-group {
            text-align: center;
            margin-top: 40px;
        }
        .price-label {
            font-size: 18px;
            color: rgba(255,255,255,0.6);
            margin-bottom: 8px;
        }
        .price-val {
            font-family: 'Unbounded', sans-serif;
            font-size: 52px;
            font-weight: 900;
            color: ${primaryColor};
        }
        .meta-row {
            display: flex;
            gap: 18px;
            margin-top: 28px;
            flex-wrap: wrap;
            justify-content: center;
        }
        .chip {
            padding: 10px 14px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.03);
            font-size: 14px;
            color: rgba(255,255,255,0.85);
        }
        .chip strong { color: white; }
        .verdict-text {
            font-size: 22px;
            color: rgba(255,255,255,0.9);
            margin-top: 24px;
            font-weight: 600;
        }
        .footer-brand {
            margin-top: auto;
            padding-top: 30px;
            font-size: 16px;
            color: rgba(255,255,255,0.4);
        }
    </style>
</head>
<body>
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <div class="container">
        <div class="glass-card">
            <div class="collection-tag">+888 ANONYMOUS NUMBERS</div>
            <div class="number-display">${numberData.formattedNumber || numberData.number || '+888'}</div>
            <div class="price-group">
                <div class="price-label">Estimated Value</div>
                <div class="price-val">💎 ${numberData.price || '0'} TON</div>
            </div>
            <div class="meta-row">
                ${numberData.status ? `<div class="chip">Status: <strong>${numberData.status}</strong></div>` : ``}
                ${numberData.floor ? `<div class="chip">Floor: <strong>${numberData.floor} TON</strong></div>` : ``}
                ${numberData.vsFloor ? `<div class="chip">vs Floor: <strong>${numberData.vsFloor}</strong></div>` : ``}
                ${numberData.pattern ? `<div class="chip">Pattern: <strong>${numberData.pattern}</strong></div>` : ``}
                ${numberData.confidence ? `<div class="chip">Confidence: <strong>${numberData.confidence}</strong></div>` : ``}
            </div>
            <div class="verdict-text">${numberData.verdict || 'STANDARD'}</div>
            <div class="footer-brand">@iFragmentBot</div>
        </div>
    </div>
</body>
</html>`;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 500));

        const buffer = await page.screenshot({ type: 'png' });
        if (!buffer || buffer.length === 0) throw new Error('Screenshot buffer empty');
        console.log(`✅ Number Flex Card generated, ${buffer.length} bytes`);
        return buffer;
    } catch (error) {
        console.error('Number Flex Card error:', error);
        throw error;
    } finally {
        if (page) await page.close();
    }
}
