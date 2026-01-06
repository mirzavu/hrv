import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';

export async function POST(request: NextRequest) {

    try {
        const body = await request.json();


        const { sessionId, ai_title, ai_interpretation } = body;

        if (!sessionId || !ai_title || !ai_interpretation) {
            console.error('Missing required fields:', {
                hasSessionId: !!sessionId,
                hasAiTitle: !!ai_title,
                hasAiInterpretation: !!ai_interpretation
            });
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }


        const pb = await getAdminPb();

        // Find the session summary record for this session
        // Note: session_summary linked to session_id (relation)

        const records = await pb.collection('session_summary').getList(1, 1, {
            filter: `session_id = "${sessionId}"`,
        });



        if (records.items.length === 0) {
            console.error('Session summary not found for sessionId:', sessionId);
            return NextResponse.json({ error: 'Session summary not found' }, { status: 404 });
        }

        const summaryRecord = records.items[0];


        // Update the record


        const updatedRecord = await pb.collection('session_summary').update(summaryRecord.id, {
            ai_title,
            ai_interpretation
        });



        return NextResponse.json({ success: true, record: updatedRecord });

    } catch (error: any) {
        console.error('Error updating AI insight:', error);
        return NextResponse.json(
            { error: 'Failed to update insight', details: error.message },
            { status: 500 }
        );
    }
}
