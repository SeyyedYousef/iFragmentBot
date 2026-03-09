import fetch from 'node-fetch';
import { CONFIG, SYSTEM_PROMPT, IMAGE_PROMPT_TEMPLATE } from '../../../core/Config/app.config.js';

/**
 * Generate analysis text using Pollinations.ai text API
 * @param {string} username - The username to analyze
 * @returns {Promise<string>} - The generated analysis text
 */
export async function generateAnalysis(username) {
    const cleanUsername = username.replace('@', '').trim();

    const userPrompt = `Analyze this Telegram Fragment username: @${cleanUsername}
  
Generate a complete analysis following the exact format in your instructions. Be creative and inspiring.`;

    try {
        // Pollinations.ai text endpoint
        const url = `${CONFIG.POLLINATIONS_TEXT_API}/${encodeURIComponent(userPrompt)}?system=${encodeURIComponent(SYSTEM_PROMPT)}&model=openai`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'text/plain'
            }
        });

        if (!response.ok) {
            throw new Error(`Text API error: ${response.status}`);
        }

        const text = await response.text();
        return text;
    } catch (error) {
        console.error('Error generating analysis:', error);
        throw error;
    }
}

/**
 * Generate image URL using Pollinations.ai image API
 * @param {string} username - The username to display in image
 * @returns {string} - The image URL
 */
export function generateImageUrl(username) {
    const cleanUsername = username.replace('@', '').trim();
    const prompt = IMAGE_PROMPT_TEMPLATE(cleanUsername);

    // Pollinations.ai image endpoint - returns direct image URL
    const imageUrl = `${CONFIG.POLLINATIONS_IMAGE_API}/${encodeURIComponent(prompt)}?width=1024&height=768&model=flux&nologo=true`;

    return imageUrl;
}

/**
 * Pre-fetch image to ensure it's ready
 * @param {string} imageUrl - The image URL to prefetch
 * @returns {Promise<Buffer>} - The image buffer
 */
export async function fetchImage(imageUrl) {
    try {
        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`Image fetch error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error('Error fetching image:', error);
        throw error;
    }
}
