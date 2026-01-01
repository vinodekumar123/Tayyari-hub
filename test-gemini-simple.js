
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Hardcoded key from previous context to ensure we test the exact same credential
const API_KEY = "AIzaSyAVBKkq05dY8CNe01_68Qen-xAxvsHg_Bk";

async function testGenAI() {
    console.log("Testing Gemini API...");
    const genAI = new GoogleGenerativeAI(API_KEY);

    // Test 1: List Models (to check connection)
    // console.log("Fetching models...");
    // try {
    //     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    //     console.log("Model initialized.");
    // } catch (e) {
    //     console.error("Init Error:", e);
    // }

    // Test 2: Generate Content
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        const text = response.text();
        console.log("Success! Response:", text);
    } catch (error) {
        console.error("Test Failed!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        if (error.cause) console.error("Cause:", error.cause);
        if (error.stack) console.error("Stack:", error.stack);
    }
}

testGenAI();
