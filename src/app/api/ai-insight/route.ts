
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const MODEL_NAME = "gpt-4o-mini";

// System prompt for Weekly Reports
const WEEKLY_REPORT_SYSTEM_PROMPT = `
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

OUTPUT FORMAT:
Return ONLY a valid JSON object with these keys:
{
  "title": "Headline here",
  "observation": "Observation text here",
  "action": "Actionable advice here"
}
Do not wrap in markdown code blocks. Just the raw JSON string.
`;

// System prompt for Single Session Analysis
const SINGLE_SESSION_SYSTEM_PROMPT = `
You are an expert HRV and Recovery Analyst for an athlete.
Your goal is to provide a concise, insightful interpretation of a single HRV session.

TONE & STYLE:
- Professional yet encouraging and personalized.
- Concise and descriptive. Focus on what the data means.
- Use 1-2 short paragraphs max.
- Highlight the key insight from this session.

STRUCTURE OF THE INSIGHT:
1. **Title**: 5-8 words summarizing this session's key finding.
2. **Interpretation**: A brief explanation of what the HRV metrics indicate about recovery, stress, or autonomic balance for this specific session.

OUTPUT FORMAT:
Return ONLY a valid JSON object with these keys:
{
  "title": "Session title here",
  "interpretation": "Interpretation text here"
}
Do not wrap in markdown code blocks. Just the raw JSON string.
`;

export async function POST(req: NextRequest) {
    try {
        const rawBody = await req.json();
        console.log("[AI API] 🚀 Request Received");

        let userPrompt = "";
        let systemPrompt = "";
        let expectedFormat = "";

        // Determine request type and set appropriate prompts
        if (rawBody.phase && rawBody.weeks) {
            // Direct Weekly Report format
            systemPrompt = WEEKLY_REPORT_SYSTEM_PROMPT;
            expectedFormat = "weekly";
            userPrompt = `
        Analyze this weekly data:
        - Current Phase: ${rawBody.phase}
        - Trend: ${rawBody.trend}
        - Recent Data: ${JSON.stringify(rawBody.weeks, null, 2)}
        
        Generate the Weekly Recovery Insight in JSON format.
        `;
        } else if (rawBody.mode === 'weekly' && rawBody.data) {
            // Weekly report from api/trends/weekly
            systemPrompt = WEEKLY_REPORT_SYSTEM_PROMPT;
            expectedFormat = "weekly";
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
        } else if (rawBody.mode === 'analysis' && rawBody.data) {
            // Single session analysis (calibration phase)
            systemPrompt = SINGLE_SESSION_SYSTEM_PROMPT;
            expectedFormat = "single";
            const { metricData, context } = rawBody.data;
            userPrompt = `
        Analyze this single HRV session:
        - Phase: ${context?.phaseContext || 'calibration phase'}
        - Time Context: ${context?.timeContext || 'this session'}
        
        Metric Changes:
        - RMSSD: ${metricData.rmssd?.value}ms (Change: ${metricData.rmssd?.change > 0 ? '+' : ''}${metricData.rmssd?.change}%)
        - SDNN: ${metricData.sdnn?.value}ms (Change: ${metricData.sdnn?.change > 0 ? '+' : ''}${metricData.sdnn?.change}%)
        - LF Power: ${metricData.lf?.value}ms² (Change: ${metricData.lf?.change > 0 ? '+' : ''}${metricData.lf?.change}%)
        - HF Power: ${metricData.hf?.value}ms² (Change: ${metricData.hf?.change > 0 ? '+' : ''}${metricData.hf?.change}%)
        - AMo50: ${metricData.amo50?.value}%
        
        Generate a concise interpretation of what these metrics indicate about this session's recovery state.
        `;
        } else if (rawBody.mode === 'rewording' && rawBody.data) {
            // Single session rewording (baseline phase)
            systemPrompt = SINGLE_SESSION_SYSTEM_PROMPT;
            expectedFormat = "single";
            const { existingInterpretation } = rawBody.data;
            userPrompt = `
        Reword this HRV session interpretation to be more concise and natural:
        - Title: ${existingInterpretation.title}
        - Physiological State: ${existingInterpretation.physiologicalState}
        - Recommended Action: ${existingInterpretation.recommendedAction}
        - Combined Advice: ${existingInterpretation.combinedAdvice}
        
        Generate a concise, natural interpretation that captures the essence of this session.
        `;
        } else {
            // Fallback - assume weekly report format
            systemPrompt = WEEKLY_REPORT_SYSTEM_PROMPT;
            expectedFormat = "weekly";
            userPrompt = `Analyze the following data: ${JSON.stringify(rawBody)}`;
        }

        console.log("[AI API] 📥 Incoming Request Payload:", JSON.stringify(rawBody, null, 2));
        console.log("[AI API] 📝 User Prompt Generated:", userPrompt.substring(0, 500) + "...");

        const completion = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_completion_tokens: 500,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        console.log("[AI API] 🤖 OpenAI Response Content:", content);

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

        // Transform response if needed for backward compatibility
        if (expectedFormat === "single" && jsonResponse.observation && !jsonResponse.interpretation) {
            // If AI returned weekly format for single session, combine observation + action into interpretation
            jsonResponse.interpretation = [jsonResponse.observation, jsonResponse.action]
                .filter(Boolean)
                .join(' ');
            delete jsonResponse.observation;
            delete jsonResponse.action;
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
