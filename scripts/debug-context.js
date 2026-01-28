const fetch = require('node-fetch'); // You might need to install this or use built-in fetch if node 18+

async function fetchWebsiteContent(url) {
    try {
        console.log(`Fetching ${url}...`);
        const response = await fetch(url);
        if (!response.ok) return `[Failed to fetch ${url}]`;
        const html = await response.text();

        // precise cleaning logic from route.ts
        let text = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ').trim()
            .substring(0, 10000);

        return text;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return `[Error accessing ${url}]`;
    }
}

async function debug() {
    const text = await fetchWebsiteContent('https://tayyarihub.com');
    console.log("--- START OF CONTEXT ---");
    console.log(text);
    console.log("--- END OF CONTEXT ---");

    // Check for specific keywords user mentioned
    console.log("\n--- KEYWORD CHECK ---");
    console.log("Contains 'Fresher':", text.toLowerCase().includes('fresher'));
    console.log("Contains 'Improver':", text.toLowerCase().includes('improver'));
    console.log("Contains 'Schedule':", text.toLowerCase().includes('schedule'));
    console.log("Contains 'Series 1':", text.toLowerCase().includes('series 1'));

    // Check for unique content likely in Fresher but not Improver (or vice versa) to confirm both are present
    // Fresher typically has "Class XII" or "Class XI" mentions
    console.log("Contains 'Class XII':", text.includes('Class XII'));
    console.log("Contains 'Class XI':", text.includes('Class XI'));
}

debug();
