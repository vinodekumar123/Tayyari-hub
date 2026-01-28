require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!key) {
        console.error("No API Key");
        return;
    }
    const genAI = new GoogleGenerativeAI(key);

    console.log("Listing models...");
    try {
        // Not all SDK versions expose listModels directly easily without internal calls or using the efficient method.
        // But let's try a direct generation with a fallback model.

        const modelOne = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Attempting gemini-1.5-flash...");
        await modelOne.generateContent("test");
        console.log("✅ gemini-1.5-flash WORKS");
    } catch (e1) {
        console.error("❌ gemini-1.5-flash FAILED:", e1.message);

        try {
            console.log("Attempting gemini-pro...");
            const modelTwo = genAI.getGenerativeModel({ model: "gemini-pro" });
            await modelTwo.generateContent("test");
            console.log("✅ gemini-pro WORKS");
        } catch (e2) {
            console.error("❌ gemini-pro FAILED:", e2.message);
        }
    }
}

test();
