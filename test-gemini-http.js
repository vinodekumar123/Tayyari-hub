
const API_KEY = "AIzaSyAVBKkq05dY8CNe01_68Qen-xAxvsHg_Bk";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

async function testHttp() {
    console.log("Testing Raw HTTP...");
    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: "Hello" }]
                }]
            })
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Body:", text);

    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

testHttp();
