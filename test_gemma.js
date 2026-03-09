import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function testGemma() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY is not set in .env");
        return;
    }

    const model = 'gemma-3-27b-it';
    console.log(`🔌 Connecting to ${model}...`);

    const baseUrl = 'https://generativelanguage.googleapis.com';
    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: "Hello, reply with exactly the word SUCCESS." }]
        }],
        generationConfig: {
            temperature: 0.3
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ API Error ${response.status}: ${errText}`);
            return;
        }

        const data = await response.json();
        console.log("✅ Response JSON: ", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("❌ Fetch Exception:", e);
    }
}

testGemma();
