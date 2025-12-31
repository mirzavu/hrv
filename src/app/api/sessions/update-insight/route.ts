import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

export async function POST(request: NextRequest) {
    console.log('[Update-Insight] ===== UPDATE INSIGHT API CALLED =====');
    try {
        const body = await request.json();
        console.log('[Update-Insight] Request body received:', {
            sessionId: body.sessionId,
            hasAiTitle: !!body.ai_title,
            hasAiInterpretation: !!body.ai_interpretation,
            aiTitle: body.ai_title,
            aiInterpretation: body.ai_interpretation ? body.ai_interpretation.substring(0, 50) + '...' : null
        });

        const { sessionId, ai_title, ai_interpretation } = body;

        if (!sessionId || !ai_title || !ai_interpretation) {
            console.error('[Update-Insight] ❌ Missing required fields:', {
                hasSessionId: !!sessionId,
                hasAiTitle: !!ai_title,
                hasAiInterpretation: !!ai_interpretation
            });
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log('[Update-Insight] All fields present, getting PocketBase admin client');
        const pb = await getAdminPb();

        // Find the session summary record for this session
        // Note: session_summary linked to session_id (relation)
        console.log('[Update-Insight] Searching for session_summary with session_id:', sessionId);
        const records = await pb.collection('session_summary').getList(1, 1, {
            filter: `session_id = "${sessionId}"`,
        });

        console.log('[Update-Insight] Query result:', {
            totalItems: records.totalItems,
            itemsFound: records.items.length,
            firstItemId: records.items[0]?.id
        });

        if (records.items.length === 0) {
            console.error('[Update-Insight] ❌ Session summary not found for sessionId:', sessionId);
            return NextResponse.json({ error: 'Session summary not found' }, { status: 404 });
        }

        const summaryRecord = records.items[0];
        console.log('[Update-Insight] Found session summary record:', {
            id: summaryRecord.id,
            session_id: summaryRecord.session_id,
            currentAiTitle: summaryRecord.ai_title,
            currentAiInterpretation: summaryRecord.ai_interpretation ? summaryRecord.ai_interpretation.substring(0, 50) + '...' : null
        });

        // Update the record
        console.log('[Update-Insight] Updating record with:', {
            recordId: summaryRecord.id,
            newAiTitle: ai_title,
            newAiInterpretation: ai_interpretation.substring(0, 50) + '...'
        });

        const updatedRecord = await pb.collection('session_summary').update(summaryRecord.id, {
            ai_title,
            ai_interpretation
        });

        console.log('[Update-Insight] ✅ Successfully updated record:', {
            id: updatedRecord.id,
            ai_title: updatedRecord.ai_title,
            ai_interpretation: updatedRecord.ai_interpretation ? updatedRecord.ai_interpretation.substring(0, 50) + '...' : null
        });

        return NextResponse.json({ success: true, record: updatedRecord });

    } catch (error: any) {
        console.error('[Update-Insight] ❌ Error updating AI insight:', error);
        console.error('[Update-Insight] Error message:', error.message);
        console.error('[Update-Insight] Error stack:', error.stack);
        return NextResponse.json(
            { error: 'Failed to update insight', details: error.message },
            { status: 500 }
        );
    }
}
