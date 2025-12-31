import { NextRequest, NextResponse } from 'next/server';

const GEN_AI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-flash-latest";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEN_AI_API_KEY}`;

// System prompt enforcing tone and rules
const SYSTEM_PROMPT = `
You are a supportive, empathetic, and expert HRV data analyst. Your goal is to provide a brief, human-sounding specific insight about the user's autonomic nervous system state.

Output Format: JSON with "title" and "interpretation" keys.

Rules for "title":
- Short (2-4 words).
- Professional yet warm (e.g., "Recovery in Progress", "Peak Readiness").
- NO "AI" or "Robot" mentions.

Rules for "interpretation":
- Maximum 2 sentences.
- Use a supportive and empathetic tone.
- Use simple, natural language. Avoid jargon where possible.
- STRICTLY NO medical advice or diagnostic claims.
- NO population comparisons; only interpret relative to the user's own baseline/context.
- If signals are mixed, acknowledge it gracefully (e.g., "Your recovery is good, but stress stability is lower today.").
`;

// Simplified fetch without retry
async function fetchWithRetry(payload: any, maxRetries = 1) {
    try {
        console.log(`[API/AI-Insight] ===== GEMINI API REQUEST =====`);
        console.log(`[API/AI-Insight] API URL: ${API_URL.replace(GEN_AI_API_KEY || '', '[REDACTED]')}`);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log(`[API/AI-Insight] Response Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[API/AI-Insight] ❌ Gemini API Error Response:`, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[API/AI-Insight] ✅ Gemini API Success Response size:`, JSON.stringify(data).length);
        return data;
    } catch (error: any) {
        console.error(`[API/AI-Insight] ❌ Request failed:`, error.message);
        throw error;
    }
}

export async function POST(request: NextRequest) {
    // TEMPORARY: Disable Gemini API calls completely to preserve quota
    return NextResponse.json({
        title: 'Insight Unavailable',
        interpretation: 'AI insights are temporarily disabled.'
    });

    // --- ALL CODE BELOW IS UNREACHABLE WHILE DISABLED ---
    console.log('[API/AI-Insight] ===== REQUEST RECEIVED =====');
    console.log('[API/AI-Insight] Request URL:', request.url);
    console.log('[API/AI-Insight] Request Method:', request.method);
    console.log('[API/AI-Insight] Request Headers:', Object.fromEntries(request.headers.entries()));

    try {
        if (!GEN_AI_API_KEY) {
            console.error('[API/AI-Insight] ❌ Missing GEMINI_API_KEY');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        console.log('[API/AI-Insight] ✅ GEMINI_API_KEY is present (length:', GEN_AI_API_KEY.length, ')');

        // Parse request body with explicit error handling
        let body: any;
        try {
            const rawBody = await request.text();
            console.log('[API/AI-Insight] Raw request body length:', rawBody.length);
            console.log('[API/AI-Insight] Raw request body (first 500 chars):', rawBody.substring(0, 500));
            body = JSON.parse(rawBody);
            console.log('[API/AI-Insight] ✅ Request body parsed successfully');
        } catch (parseError: any) {
            console.error('[API/AI-Insight] ❌ Failed to parse request body:', parseError.message);
            return NextResponse.json({ error: 'Invalid JSON in request body', details: parseError.message }, { status: 400 });
        }

        console.log('[API/AI-Insight] Request body received:', JSON.stringify(body, null, 2));
        const { mode, data } = body;
        console.log('[API/AI-Insight] Extracted mode:', mode);
        console.log('[API/AI-Insight] Extracted data keys:', Object.keys(data || {}));

        let userPrompt = "";

        if (mode === 'analysis') {
            const { metricData, context } = data;
            userPrompt = `
        HRV Session Data:
        - RMSSD: ${metricData.rmssd.value}ms (${metricData.rmssd.change}% change)
        - SDNN: ${metricData.sdnn.value}ms (${metricData.sdnn.change}% change)
        - LF: ${metricData.lf.value}ms² (${metricData.lf.change}% change)
        - HF: ${metricData.hf.value}ms² (${metricData.hf.change}% change)
        - AMo50: ${metricData.amo50.value}%
        
        Context:
        - Comparison: ${context.timeContext}
        - Phase: ${context.phaseContext}
      `.trim();
        } else if (mode === 'rewording') {
            const { existingInterpretation } = data;
            userPrompt = `
        Here is the standard interpretation for this user's current HRV pattern:
        Title: "${existingInterpretation.title}"
        State: "${existingInterpretation.physiologicalState}"
        Action: "${existingInterpretation.recommendedAction}"
        Advice: "${existingInterpretation.combinedAdvice}"

        Please reword this insight to be fresh, supportive, and empathetic. Keep the core meaning but make it sound natural and non-repetitive.
       `.trim();
        } else {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
        }

        // Combine system prompt with user prompt to avoid "Unknown name systemInstruction" error
        // even on v1beta for some model versions.
        const combinedPrompt = `
        ${SYSTEM_PROMPT}
        
        ----------------
        ${userPrompt}
        `;

        // Log exact prompt text sent to Gemini
        console.log('[API/AI-Insight] ===== PROMPT SENT TO GEMINI =====');
        console.log(combinedPrompt);
        console.log('[API/AI-Insight] ====================================');

        const payload = {
            contents: [{ parts: [{ text: combinedPrompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                candidateCount: 1,
                maxOutputTokens: 1024, // Increased to prevent truncation
                temperature: 0.7
            }
        };

        console.log('[API/AI-Insight] ===== PAYLOAD TO GEMINI =====');
        console.log('[API/AI-Insight] Full payload structure:', JSON.stringify(payload, null, 2));
        console.log('[API/AI-Insight] Prompt length:', combinedPrompt.length, 'characters');
        console.log('[API/AI-Insight] Model:', MODEL_NAME);

        const result = await fetchWithRetry(payload);

        // Parse Gemini response
        const candidate = result.candidates?.[0];
        if (!candidate) {
            console.error('[API/AI-Insight] No candidate in response');
            throw new Error("No candidate generated");
        }

        const rawText = candidate.content?.parts?.[0]?.text;
        if (!rawText) {
            console.error('[API/AI-Insight] No text in response');
            throw new Error("No content generated");
        }

        // Log exact response received from Gemini
        console.log('[API/AI-Insight] ===== RESPONSE FROM GEMINI =====');
        console.log(rawText);
        console.log('[API/AI-Insight] ====================================');

        // Try to parse JSON - handle potential markdown code blocks
        let jsonText = rawText.trim();

        // Remove markdown code blocks if present (```json ... ```)
        if (jsonText.startsWith('```')) {
            const lines = jsonText.split('\n');
            // Find first and last line with ```
            const firstCodeBlock = lines.findIndex((l: string) => l.trim().startsWith('```'));
            const lastCodeBlock = lines.findLastIndex((l: string) => l.trim().startsWith('```'));
            if (firstCodeBlock !== -1 && lastCodeBlock !== -1 && firstCodeBlock !== lastCodeBlock) {
                jsonText = lines.slice(firstCodeBlock + 1, lastCodeBlock).join('\n').trim();
            }
        }

        // Remove leading/trailing whitespace and newlines
        jsonText = jsonText.trim();

        let content;
        try {
            content = JSON.parse(jsonText);

            // Log parsed content
            console.log('[API/AI-Insight] Parsed content:', JSON.stringify(content, null, 2));
        } catch (parseError: any) {
            console.error('[API/AI-Insight] JSON parse error:', parseError.message);

            // If JSON is truncated, try to extract what we can
            if (parseError.message.includes('Unterminated') || parseError.message.includes('Unexpected end')) {
                // Try to extract partial JSON
                const titleMatch = jsonText.match(/"title"\s*:\s*"([^"]*)"/);
                const interpretationMatch = jsonText.match(/"interpretation"\s*:\s*"([^"]*)/);

                if (titleMatch && interpretationMatch) {
                    content = {
                        title: titleMatch[1],
                        interpretation: interpretationMatch[1] + '...' // Indicate truncation
                    };
                } else {
                    throw new Error(`Failed to parse JSON: ${parseError.message}. Response may be truncated.`);
                }
            } else {
                throw new Error(`Failed to parse JSON: ${parseError.message}`);
            }
        }

        return NextResponse.json(content);

    } catch (error: any) {
        console.error('[API/AI-Insight] ❌ ===== FATAL ERROR =====');
        console.error('[API/AI-Insight] Error name:', error.name);
        console.error('[API/AI-Insight] Error message:', error.message);
        console.error('[API/AI-Insight] Error stack:', error.stack);
        console.error('[API/AI-Insight] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        return NextResponse.json(
            { error: 'Failed to generate insight', details: error.message },
            { status: 500 }
        );
    }
}
