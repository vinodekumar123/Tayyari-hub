
const { GoogleGenerativeAI } = require("@google/generative-ai");
const API_KEY = process.env.GEMINI_TEST_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
    console.log("Listing models...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Dummy init to access system
        // Actually, listing models requires distinct call usually or we just try known ones.
        // The SDK might not have a clean 'listModels' helper exposed on the instance directly in this version?
        // Let's use the raw HTTP request which I know works for listing.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(`- ${m.name}`));
        } else {
            console.log("No models found or error:", data);
        }

    } catch (e) {
        console.error("List Error:", e);
    }
}

listModels();
