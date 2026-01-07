
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = "gpt-4o-mini";

// System prompt enforcing tone and rules
const SYSTEM_PROMPT = `
You are an expert HRV and Recovery Analyst for an athlete. 
Your goal is to provide a "Weekly Recovery Report" based on the user's data.

TONE & STYLE:
- Professional yet encouraging and personalized.
- Concise and actionable. Avoid fluff.
- Use 2-3 short paragraphs max.
- Highlight the single most important trend.

STRUCTURE OF THE INSIGHT:
1. **Headline**: 5-8 words summarizing the week.
2. **Observation**: What is the data saying? (Connect Stress, Sleep, Recovery, HRV).
3. **Action**: One specific recommendation for next week.

INPUT DATA EXPLANATION:
- **Phase**: User's training/baseline phase.
- **Weeks**: List of recent weeks with average HRV, Readiness, etc.
- **Trend**: Direction of HRV/Recovery (Improving, Declining, Stable).

OUTPUT FORMAT:
Return ONLY a valid JSON object with these keys:
{
  "title": "Headline here",
  "observation": "Observation text here",
  "action": "Actionable advice here"
}
Do not wrap in markdown code blocks. Just the raw JSON string.
`;

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json();

        // Support both the Weekly Report structure (simplified) and valid existing structures
        // The previous implementation had 'mode', 'data' etc. 
        // We should be robust to what the client sends.

        // Check if it's the weekly report vs one-off analysis
        let userPrompt = "";

        if (rawBody.phase && rawBody.weeks) {
            // Direct Weekly Report format
            userPrompt = `
        Analyze this weekly data:
        - Current Phase: ${rawBody.phase}
        - Trend: ${rawBody.trend}
        - Recent Data: ${JSON.stringify(rawBody.weeks, null, 2)}
        
        Generate the Weekly Recovery Insight in JSON format.
        `;
        } else if (rawBody.mode === 'weekly' && rawBody.data) {
            // Correctly unpack the payload from api/trends/weekly
            const { usagePhase, weekRange, scores, readiness, hrv, baseline, dailyData } = rawBody.data;
            userPrompt = `
        Weekly Recovery Analysis (${weekRange?.start} to ${weekRange?.end}):
        - Phase: ${usagePhase}
        
        Weekly Metrics:
        - Readiness: ${readiness?.avg} (Change: ${readiness?.change}%)
        - HRV (RMSSD): ${hrv?.avgRMSSD}ms (Stability/CV: ${hrv?.weeklyCV}%)
        - Scores: Energy ${scores?.energy?.avg}, Stress ${scores?.stress?.avg}, Health ${scores?.health?.avg}
        
        Baseline Context: ${baseline?.comparison}
        
        Daily Data:
        ${JSON.stringify(dailyData, null, 2)}
        
        Generate the Weekly Recovery Insight in JSON format.
        `;
        } else {
            // Fallback or other modes (like analysis/rewording)
            // For now, let's dump the whole body as context
            userPrompt = `Analyze the following data: ${JSON.stringify(rawBody)}`;
        }

        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_completion_tokens: 500,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;

        if (!content) {
            throw new Error("No content generated");
        }

        let jsonResponse;
        try {
            jsonResponse = JSON.parse(content);
        } catch (parseError) {
            console.error("JSON Parsing failed:", content);
            return NextResponse.json(
                { error: "Failed to parse AI response" },
                { status: 500 }
            );
        }

        return NextResponse.json(jsonResponse);

    } catch (error: any) {
        console.error("OpenAI API Error:", error);
        return NextResponse.json(
            {
                error: error.message || "Failed to generate insight",
                details: error
            },
            { status: 500 }
        );
    }
}
