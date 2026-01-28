
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const models = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" }).apiKey; // seemingly just need the client, but listModels is on the client? 
        // Wait, listModels is not directly on the class instance in the node SDK sometimes, let's check documentation pattern or just try the manager if accessible.
        // Actually, in the google-generative-ai package, it's usually not exposed directly on the simplified client.
        // However, we can try to just make a raw REST call if the SDK doesn't expose it easily, OR assume we might be able to use the raw fetch.

        // Let's try the direct node SDK method if I recall correctly it might be `genAI.getGenerativeModel` but listing is often separate.
        // Actually, let's use a simple fetch to the API endpoint which is easier and guaranteed to work.

        const key = process.env.GEMINI_API_KEY;
        if (!key) {
            console.error("No API Key found");
            return;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.displayName}): ${m.supportedGenerationMethods.join(', ')}`);
            });
        } else {
            console.log("Error listing models:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
