import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

// Cache context to avoid scraping on every request
let cachedContext: string | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours (increased from 1 hour)

// Pre-built static context for faster cold starts
const STATIC_CONTEXT = `
**TAYYARI HUB - QUICK FACTS:**
- MDCAT Preparation Platform
- Two main series: Fresher Series (new students) & Improver Series (repeaters)
- Features: AI Tutor, Mock Tests, Question Bank, Performance Analytics
- Contact: WhatsApp 03237507673

**PRICING (Verify for latest):**
- Fresher Series: Starting from PKR 2000
- Improver Series: Starting from PKR 2500
- Discounts available for early registration

**SUPPORT:**
- For account/payment issues: WhatsApp 03237507673
- Technical support via chat
`;

async function fetchWebsiteContent(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            next: { revalidate: 86400 }, // Cache for 24 hours
            signal: AbortSignal.timeout(3000) // Reduced to 3s timeout
        });
        if (!response.ok) return '';
        const html = await response.text();

        // More efficient HTML cleaning
        return html
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gm, "")
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gm, "")
            .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gm, "") // Remove nav
            .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gm, "") // Remove footer
            .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gm, "") // Remove header
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 5000); // Reduced from 8k for speed
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        return '';
    }
}

async function getMultiSiteContext() {
    const now = Date.now();
    if (cachedContext && (now - lastCacheTime < CACHE_DURATION)) {
        return cachedContext;
    }

    try {
        console.log("Fetching website contexts...");

        // Fetch only essential pages in parallel
        const results = await Promise.allSettled([
            fetchWebsiteContent('https://tayyarihub.com'),
            fetchWebsiteContent('https://tayyarihub.com/series/fresher'),
            fetchWebsiteContent('https://tayyarihub.com/series/improver'),
            fetchWebsiteContent('https://tayyarihub.com/about-us'),
        ]);

        const [tayyariText, fresherText, improverText, aboutText] = results.map(
            r => r.status === 'fulfilled' ? r.value : ''
        );

        const context = `
You are the Official AI Support Assistant for **Tayyari Hub**.

${STATIC_CONTEXT}

**LIVE WEBSITE CONTENT:**

**Homepage:**
${tayyariText.substring(0, 3000) || 'Unable to fetch - use static info above'}

**Fresher Series:**
${fresherText.substring(0, 2000) || 'Details on fresherihub.com/series/fresher'}

**Improver Series:**
${improverText.substring(0, 2000) || 'Details on tayyarihub.com/series/improver'}

**About Us:**
${aboutText.substring(0, 1500) || 'Pakistan\'s leading MDCAT preparation platform'}

**YOUR INSTRUCTIONS:**
1. **Role**: Helpful AI Support Assistant for Tayyari Hub.
2. **Knowledge Base**: Use the content above as source of truth.
3. **Conversational Ability**: Be helpful, professional, and warm. Answer greetings naturally.

4. **Logic & Reasoning (CRITICAL)**:
   - **Think Step-by-Step**: Before answering, verify facts.
   - **Math**: EXACTLY calculate discounts.
     - User: "Freshers Bundle 2000, 30% discount?"
     - You: "Original: 2000. Discount: 30% (600). Final: 1400."
   - **Context Matching**: If something is in the text, use that exact information.

5. **Language Support (Roman Urdu)**:
   - Understand and reply in **Roman Urdu** if user speaks it.
   - User: "Fees ktni hai?" → You: "Freshers Bundle ki fee 2000 hai."

6. **Escalation Protocol**: 
   - For account/payment issues: "Please contact Admin via WhatsApp at **03237507673**."

7. **Downloads & PDFs**:
   - If user asks for "Schedule", "Date Sheet", "PDF Download":
   - APPEND: **###ACTION:DOWNLOAD_SCHEDULE_OPTIONS###**
   - Example: "Please select which schedule you want below. ###ACTION:DOWNLOAD_SCHEDULE_OPTIONS###"

8. **Suggested Actions**:
   - End responses with helpful next steps when appropriate.
   - Example: "Would you like to know about pricing or course features?"
`;
        cachedContext = context;
        lastCacheTime = now;
        return context;

    } catch (error) {
        console.error("Context Gen Error:", error);
        // Return static context as fallback
        return `You are Tayyari Hub's AI Assistant. ${STATIC_CONTEXT} For detailed info, please visit tayyarihub.com or WhatsApp 03237507673.`;
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
                { role: 'model', parts: [{ text: "Understood. I'll help users with Tayyari Hub information." }] },
                ...chatHistory.slice(-6) // Increased to 6 for better context
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
