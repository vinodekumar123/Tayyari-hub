
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        fs.writeFileSync('models.json', JSON.stringify({ error: "No API Key" }));
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();
        fs.writeFileSync('models.json', JSON.stringify(data, null, 2));
        console.log("Done writing models.json");
    } catch (error) {
        fs.writeFileSync('models.json', JSON.stringify({ error: error.message }));
    }
}

listModels();
