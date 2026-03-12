/**
 * Daily Scheduler Service
 * Automatically posts Market Pulse at 9 AM Afghanistan Time (UTC+4:30)
 */

import { generateMarketPulse } from '../../Admin/Application/daily-report.service.js';

let botInstance = null;
let schedulerInterval = null;
let lastPostDate = null;

// Afghanistan Time is UTC+4:30
const AFGHANISTAN_UTC_OFFSET_MINUTES = 4 * 60 + 30; // 270 minutes
const TARGET_HOUR = 9; // 9 AM Afghanistan time
const TARGET_MINUTE = 0;

// Channel to post to
const CHANNEL_ID = '@FragmentsCommunity';

/**
 * Convert current time to Afghanistan time
 */
function getAfghanistanTime() {
    const now = new Date();
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const afghanMinutes = utcMinutes + AFGHANISTAN_UTC_OFFSET_MINUTES;

    // Handle day overflow
    const adjustedMinutes = afghanMinutes >= 1440 ? afghanMinutes - 1440 :
        afghanMinutes < 0 ? afghanMinutes + 1440 : afghanMinutes;

    return {
        hours: Math.floor(adjustedMinutes / 60),
        minutes: adjustedMinutes % 60,
        date: now.toISOString().split('T')[0]
    };
}

/**
 * Check if we should post now
 */
function shouldPostNow() {
    const afgTime = getAfghanistanTime();

    // Check if it's 9 AM (within first 5 minutes of the hour)
    const isTargetTime = afgTime.hours === TARGET_HOUR && afgTime.minutes < 5;

    // Check if we already posted today
    const alreadyPostedToday = lastPostDate === afgTime.date;

    return isTargetTime && !alreadyPostedToday;
}

/**
 * Post the daily market pulse report
 */
async function postDailyReport() {
    if (!botInstance) {
        console.error('❌ Daily Scheduler: Bot instance not set');
        return;
    }

    console.log('📊 Daily Scheduler: Generating Market Pulse Report...');

    try {
        const result = await generateMarketPulse();

        let reportText = result;
        let imageBuffer = null;

        if (typeof result === 'object' && result.report) {
            reportText = result.report;
            imageBuffer = result.imageBuffer;
        }

        // Post to channel
        if (imageBuffer && imageBuffer.length > 0) {
            console.log(`📤 Daily Scheduler: Sending photo report to ${CHANNEL_ID} (${imageBuffer.length} bytes)...`);
            await botInstance.telegram.sendPhoto(CHANNEL_ID,
                { source: imageBuffer, filename: 'market_pulse.png' },
                {
                    caption: reportText,
                    parse_mode: 'Markdown'
                }
            );
        } else {
            console.log(`📨 Daily Scheduler: Sending text-only report to ${CHANNEL_ID} (Image buffer empty or missing)`);
            await botInstance.telegram.sendMessage(CHANNEL_ID, reportText, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        }

        // Mark as posted today
        const afgTime = getAfghanistanTime();
        lastPostDate = afgTime.date;

        console.log('✅ Daily Scheduler: Market Pulse posted to channel!');

    } catch (error) {
        console.error('❌ Daily Scheduler: Failed to post report:', error.message);
    }
}

/**
 * Set the bot instance
 */
export function setBot(bot) {
    botInstance = bot;
}

/**
 * Start the daily scheduler
 */
export function startScheduler() {
    if (schedulerInterval) {
        console.log('⚠️ Daily Scheduler already running');
        return;
    }

    const afgTime = getAfghanistanTime();
    console.log(`⏰ Daily Scheduler started (target: ${TARGET_HOUR}:00 AFG, now: ${afgTime.hours}:${String(afgTime.minutes).padStart(2, '0')})`);

    // Check every minute
    schedulerInterval = setInterval(async () => {
        if (shouldPostNow()) {
            await postDailyReport();
        }
    }, 60 * 1000);

    // Also check immediately on start
    if (shouldPostNow()) {
        postDailyReport();
    }
}

/**
 * Stop the daily scheduler
 */
export function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('🛑 Daily Scheduler stopped');
    }
}

/**
 * Force post now (for testing/admin)
 */
export async function forcePostNow() {
    return await postDailyReport();
}

/**
 * Get scheduler status
 */
export function getStatus() {
    const afgTime = getAfghanistanTime();
    return {
        running: !!schedulerInterval,
        currentAfghanTime: `${afgTime.hours}:${String(afgTime.minutes).padStart(2, '0')}`,
        targetTime: `${TARGET_HOUR}:${String(TARGET_MINUTE).padStart(2, '0')}`,
        lastPostDate,
        nextPostDate: lastPostDate === afgTime.date ? 'Tomorrow' : 'Today at 9 AM',
        channel: CHANNEL_ID
    };
}

export default {
    setBot,
    startScheduler,
    stopScheduler,
    forcePostNow,
    getStatus
};
