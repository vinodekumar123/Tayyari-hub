import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Cache context to avoid scraping on every request
let cachedContext: string | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache (increased from 30 min)

async function fetchWebsiteContent(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            next: { revalidate: 3600 }, // Cache for 1 hour
            signal: AbortSignal.timeout(5000) // 5s timeout per request
        });
        if (!response.ok) return `[Failed to fetch ${url}]`;
        const html = await response.text();
        return html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ').trim()
            .substring(0, 8000); // Reduced to 8k chars for speed
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return `[Error accessing ${url}]`;
    }
}

async function getMultiSiteContext() {
    const now = Date.now();
    if (cachedContext && (now - lastCacheTime < CACHE_DURATION)) {
        return cachedContext;
    }

    try {
        console.log("Fetching contexts...");
        // Fetch all pages in parallel for speed
        const [tayyariText, medicoText, aboutText, contactText, privacyText, fresherText, improverText] = await Promise.all([
            fetchWebsiteContent('https://tayyarihub.com'),
            fetchWebsiteContent('https://medicoengineer.com'),
            fetchWebsiteContent('https://tayyarihub.com/about-us'),
            fetchWebsiteContent('https://tayyarihub.com/contact-us'),
            fetchWebsiteContent('https://tayyarihub.com/privacy-policy'),
            fetchWebsiteContent('https://tayyarihub.com/series/fresher'),
            fetchWebsiteContent('https://tayyarihub.com/series/improver')
        ]);

        const context = `
You are the Official AI Support Assistant for **Tayyari Hub** AND **MedicoEngineer**.
You represent BOTH platforms.

**SOURCE 1: TAYYARI HUB (MDCAT/FSc Prep)**
**Homepage (Courses, Features, Reviews, Pricing):**
${tayyariText}

**Fresher Series:**
${fresherText}

**Improver Series:**
${improverText}

**About Us:**
${aboutText}

**Contact Us:**
${contactText}

**Privacy Policy:**
${privacyText}

**SOURCE 2: MEDICOENGINEER (MDCAT Platform)**
${medicoText}

**YOUR INSTRUCTIONS:**
1. **Role**: You are the intelligent, helpful AI Support Assistant.
2. **Knowledge Base**: Use the content above as your source of truth.
   - If a user asks about "MedicoEngineer", check Source 2.
   - If a user asks about "Tayyari Hub", check Source 1.
   - If unspecified, assume they are asking about the site they are likely on (Tayyari Hub), but you can mention the other if relevant.

3. **Conversational Ability**:
   - Be helpful, professional, and warm.
   - You can answer greetings and follow-up questions.

4. **Logic & Reasoning (CRITICAL)**:
   - **Think Step-by-Step**: Before answering, internally verify facts.
   - **Math**: EXACTLY calculate discounts. 
     - *User*: "Freshers Bundle is 2000, 30% discount pe ktna hoga?"
     - *You*: "Original Fee: 2000. Discount: 30% (600). Final Fee: 1400."
   - **Context Matching**: If user says "Freshers Bundle", FIND the price in the text. If text says "2000", USE IT.

5. **Language Support (Roman Urdu)**:
   - You MUST understand and reply in **Roman Urdu** if the user speaks it.
   - User: "Fees ktni hai?" -> You: "Freshers Bundle ki fee 2000 hai."
   - Keep tone helpful and natural.

6. **Escalation Protocol**: 
   - For specific account/payment issues you cannot solve:
   - **Direct to WhatsApp**: "Please contact Admin via WhatsApp at **03237507673**."

7. **Downloads & PDFs**:
   - If user asks for "Schedule", "Date Sheet", "PDF Download":
   - **Ask Clarity**: "Which schedule? Fresher or Improver?"
   - OR if unsure, APPEND: **###ACTION:DOWNLOAD_SCHEDULE_OPTIONS###**
   - Example: "Please select which schedule you want to download below. ###ACTION:DOWNLOAD_SCHEDULE_OPTIONS###"
`;
        cachedContext = context;
        lastCacheTime = now;
        return context;

    } catch (error) {
        console.error("Context Gen Error:", error);
        return "I am unable to access the websites right now. Please contact WhatsApp 03237507673.";
    }
}

export async function POST(req: NextRequest) {
    try {
        const { message, history } = await req.json();
        const systemPrompt = await getMultiSiteContext();

        let chatHistory = [];
        if (history && Array.isArray(history)) {
            chatHistory = history.map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            }));
            if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
                chatHistory.shift();
            }
        }

        const chat = model.startChat({
            history: [
                { role: 'user', parts: [{ text: systemPrompt }] },
                { role: 'model', parts: [{ text: "Understood. I will use the context from both Tayyari Hub and MedicoEngineer to assist the user." }] },
                ...chatHistory.slice(-4) // Keep last 4 for speed
            ]
        });

        const result = await chat.sendMessage(message);
        const response = result.response.text();

        return NextResponse.json({ response });

    } catch (error: any) {
        console.error("Chat API Error:", error);
        return NextResponse.json({
            error: `Error: ${error.message}`
        }, { status: 500 });
    }
}
