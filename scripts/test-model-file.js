require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');

async function test() {
    const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(key);
    let log = "Starting Test...\n";

    const models = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro", "gemini-1.0-pro"];

    for (const m of models) {
        log += `\nTesting ${m}...\n`;
        try {
            const model = genAI.getGenerativeModel({ model: m });
            const res = await model.generateContent("hi");
            log += `✅ SUCCESS: ${m}\n`;
        } catch (e) {
            log += `❌ FAILED: ${m} - ${e.message}\n`;
        }
    }

    fs.writeFileSync('debug_output.txt', log);
    console.log("Done. Wrote to debug_output.txt");
}

test();
