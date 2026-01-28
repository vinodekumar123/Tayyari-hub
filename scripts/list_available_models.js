require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
        console.error("No API Key");
        return;
    }
    console.log("Using API Key:", key.substring(0, 10) + "...");

    // Can't easily use genAI.listModels in node without full authenticated client sometimes?
    // Let's try to brute force well known ones.
    const genAI = new GoogleGenerativeAI(key);

    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-1.0-pro",
        "gemini-pro",
        "gemini-2.0-flash-exp"
    ];

    console.log("Checking Model Availability...");

    for (const m of candidates) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            await model.generateContent("test");
            console.log(`✅ AVAILABLE: ${m}`);
        } catch (e) {
            console.log(`❌ FAILED: ${m} -> ${e.message.split(' ').slice(0, 5).join(' ')}...`);
        }
    }
}

listModels();
