import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Helper: Extract image URLs from HTML content
function extractImageUrls(html: string): string[] {
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const urls: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}

// Helper: Fetch image and convert to base64
async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
    try {
        // Skip invalid URLs
        if (!url || url.startsWith('data:')) {
            // Already base64, extract it
            if (url.startsWith('data:')) {
                const match = url.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                    return { mimeType: match[1], data: match[2] };
                }
            }
            return null;
        }

        const response = await fetch(url, {
            signal: AbortSignal.timeout(5000) // 5s timeout per image
        });

        if (!response.ok) {
            console.warn(`Failed to fetch image: ${url} - Status: ${response.status}`);
            return null;
        }

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        return {
            mimeType: contentType.split(';')[0], // Remove charset if present
            data: base64
        };
    } catch (error) {
        console.warn(`Error fetching image ${url}:`, error);
        return null;
    }
}

// Helper: Strip HTML tags for text content
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
}

export async function POST(req: Request) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error("GEMINI_API_KEY is missing in server environment variables");
            return NextResponse.json({ error: 'Server Misconfiguration: GEMINI_API_KEY is missing' }, { status: 500 });
        }

        const body = await req.json();
        const { questions, validChapters, subject, model: selectedModel, syllabusContext } = body;

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return NextResponse.json({ error: 'No questions provided' }, { status: 400 });
        }

        if (!validChapters || !Array.isArray(validChapters) || validChapters.length === 0) {
            return NextResponse.json({ error: 'No valid chapters provided' }, { status: 400 });
        }

        // Use selected model or default to gemini-3-flash-preview (with vision support)
        const modelName = selectedModel || 'gemini-3-flash-preview';
        const model = genAI.getGenerativeModel({ model: modelName });

        console.log(`[Auto-Tag] Using model: ${modelName}, Processing ${questions.length} questions`);

        // Process questions - extract images and prepare for multimodal
        const processedQuestions: { id: string; text: string; images: { data: string; mimeType: string }[] }[] = [];

        for (const q of questions) {
            const rawText = q.questionText || q.text || '';
            const imageUrls = extractImageUrls(rawText);
            const cleanText = stripHtml(rawText);

            // Fetch images in parallel (with limit)
            const imageResults = await Promise.all(
                imageUrls.slice(0, 3).map(url => fetchImageAsBase64(url)) // Max 3 images per question
            );

            const validImages = imageResults.filter((img): img is { data: string; mimeType: string } => img !== null);

            processedQuestions.push({
                id: q.id,
                text: cleanText,
                images: validImages
            });

            if (validImages.length > 0) {
                console.log(`[Auto-Tag] Question ${q.id}: Found ${validImages.length} image(s)`);
            }
        }

        // Build multimodal content parts
        const contentParts: Part[] = [];

        // Add the main text prompt first
        const promptText = `
## Role
You are an **Expert Academic AI** specialized in **Competitive Exam Question Analysis (MDCAT / NEET-style)**.

## Instruction
Classify the provided questions based strictly on the **${syllabusContext || 'General Standard'}** curriculum.
If a question contains images (diagrams, charts, formulas, figures), analyze them to better understand the question context.

## Input Context
Subject: "${subject}"
Syllabus Scope: ${syllabusContext || 'General'}
Valid Chapters: ${JSON.stringify(validChapters)}

## Questions to Analyze
${processedQuestions.map((q, idx) => `
### Question ${idx + 1} (ID: ${q.id})
Text: ${q.text}
${q.images.length > 0 ? `[Contains ${q.images.length} image(s) - see attached]` : '[No images]'}
`).join('\n')}

## AI Tasks
1. **Chapter Mapping**: Match question to the most relevant chapter from "Valid Chapters". If overlap, choose primary. Never guess randomly.
2. **Difficulty Classification**:
   - **Easy**: Direct fact/definition.
   - **Medium**: Conceptual understanding.
   - **Hard**: Multi-step reasoning/traps.

## Output Format (STRICT JSON)
Return ONLY valid JSON. No markdown formatting. No \`\`\`json wrappers.
Structure:
{
  "results": [
    {
      "question_id": "id",
      "subject": "${subject}",
      "assigned_chapter": "Chapter Name",
      "difficulty": "Easy" | "Medium" | "Hard"
    }
  ]
}

## Quality Rules
- ❌ No random guessing
- ❌ No hallucinated chapters (Must be from Valid Chapters list)
- ✅ Prefer syllabus-aligned logic
- ✅ Use image context when available for better accuracy
`;

        contentParts.push({ text: promptText });

        // Add images for each question that has them
        for (const q of processedQuestions) {
            if (q.images.length > 0) {
                // Add a text marker for which question's images follow
                contentParts.push({ text: `\n[Images for Question ID: ${q.id}]` });

                for (const img of q.images) {
                    contentParts.push({
                        inlineData: {
                            mimeType: img.mimeType,
                            data: img.data
                        }
                    });
                }
            }
        }

        const result = await model.generateContent(contentParts);
        const response = result.response;
        const text = response.text();

        console.log("[Auto-Tag] AI Raw Response:", text.substring(0, 200) + "...");

        // Clean and parse
        let data;
        try {
            // Remove any potential markdown wrappers just in case
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            data = JSON.parse(cleanJson);
        } catch (e) {
            console.error("JSON Parse Error:", e);
            console.error("Offending Text:", text);
            return NextResponse.json({ error: "Failed to parse AI response: " + text.substring(0, 100) }, { status: 502 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Auto-Tag API Error Details:', error);

        // Extract inner error message if available
        const msg = error?.message || "Unknown Error";

        // Serialize full error object including non-enumerable properties like stack
        const details = JSON.stringify(error, Object.getOwnPropertyNames(error));

        return NextResponse.json({
            error: `AI Error: ${msg}`,
            details: details
        }, { status: 500 });
    }
}
