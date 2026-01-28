
import { getBrowser } from './cardGenerator.js';

/**
 * Generates a premium "Profile Card" image for the /me command.
 * @param {Object} data - The user and gift data.
 * @returns {Promise<Buffer>} - The generated image buffer.
 */
export async function generateProfileCard(data) {
    console.log('👑 Generating Premium Profile Card...');
    const browser = await getBrowser();
    let page = null;

    try {
        page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 }); // 1.91:1 ratio good for telegram

        // Calculate some values for the card
        const totalValue = data.totalValueUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        const joinDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); // Mock or real if available

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;900&family=Inter:wght@400;600&family=Playfair+Display:ital,wght@1,700&display=swap" rel="stylesheet">
    <style>
        :root {
            --gold: #FFD700;
            --gold-gradient: linear-gradient(135deg, #FFD700 0%, #FDB931 50%, #FFD700 100%);
            --dark-bg: #0a0a0a;
            --card-bg: rgba(255, 255, 255, 0.03);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            width: 1200px;
            height: 630px;
            background: var(--dark-bg);
            font-family: 'Inter', sans-serif;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(255, 215, 0, 0.1) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(138, 43, 226, 0.1) 0%, transparent 40%);
        }

        .card {
            width: 1100px;
            height: 530px;
            background: var(--card-bg);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 40px;
            padding: 40px;
            display: flex;
            position: relative;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            overflow: hidden;
        }

        /* Gold Border Effect */
        .card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 4px;
            background: var(--gold-gradient);
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }

        .left-section {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding-right: 40px;
            z-index: 2;
        }

        .right-section {
            width: 400px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            z-index: 2;
        }

        .profile-pic {
            width: 320px;
            height: 320px;
            border-radius: 50%;
            border: 6px solid rgba(255, 215, 0, 0.3);
            box-shadow: 0 0 50px rgba(255, 215, 0, 0.2);
            object-fit: cover;
            position: relative;
        }
        
        .profile-pic-container::after {
            content: '👑';
            position: absolute;
            bottom: 20px;
            right: 40px;
            font-size: 64px;
            filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5));
        }

        .user-title {
            font-family: 'Unbounded', sans-serif;
            font-size: 16px;
            letter-spacing: 4px;
            text-transform: uppercase;
            color: var(--gold);
            margin-bottom: 10px;
            font-weight: 700;
        }

        .username {
            font-family: 'Unbounded', sans-serif;
            font-size: 56px;
            font-weight: 900;
            line-height: 1.1;
            margin-bottom: 20px;
            background: linear-gradient(to right, #fff, #bbb);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 30px;
        }

        .stat-box {
            background: rgba(255, 255, 255, 0.05);
            padding: 20px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .stat-label {
            font-size: 14px;
            color: rgba(255, 255, 255, 0.5);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }

        .stat-value {
            font-family: 'Unbounded', sans-serif;
            font-size: 28px;
            color: white;
            font-weight: 700;
        }
        
        .stat-value.gold {
            color: var(--gold);
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
        }

        .quote {
            font-family: 'Playfair Display', serif;
            font-style: italic;
            font-size: 24px;
            color: rgba(255, 255, 255, 0.7);
            margin-top: 40px;
            position: relative;
            padding-left: 20px;
            border-left: 3px solid var(--gold);
        }

        .bg-pattern {
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px);
            background-size: 40px 40px;
            opacity: 0.1;
            z-index: 1;
        }

    </style>
</head>
<body>
    <div class="card">
        <div class="bg-pattern"></div>
        
        <div class="left-section">
            <div class="user-title">Fragment Elite Member</div>
            <div class="username">@${data.username}</div>
            
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="stat-label">Total Asset Value</div>
                    <div class="stat-value gold">${totalValue}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Digital Collectibles</div>
                    <div class="stat-value">${data.giftCount} Gifts</div>
                </div>
            </div>

            <div class="quote">
                "Digital sovereignty is the new luxury."
            </div>
        </div>

        <div class="right-section profile-pic-container">
            <!-- Using a solid placeholder if no pfp, or the actual pfp url -->
             ${data.photoUrl
                ? `<img src="${data.photoUrl}" class="profile-pic" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBmaWxsPSIjMzMzIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIvPjwvc3ZnPg=='">`
                : `<div class="profile-pic" style="background: #333; display: flex; align-items: center; justify-content: center; font-size: 80px;">👤</div>`
            }
        </div>
    </div>
</body>
</html>
        `;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Screenshot
        const buffer = await page.screenshot({ type: 'png' });
        return buffer;

    } catch (error) {
        console.error('Error generating Profile Card:', error);
        throw error;
    } finally {
        if (page) await page.close();
    }
}
