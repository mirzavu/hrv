import { NextRequest, NextResponse } from 'next/server';
import { getAdminPb } from '@/lib/pbAdmin';
import { withDollarId } from '@/lib/pbMap';
import { buildSessionSummary } from '@/utils/buildSessionSummary';
import { SessionSummaryPayload } from '@/types';
import * as fflate from 'fflate';

// GET /api/sessions/[sessionId] - Fetch full session data with summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> | { sessionId: string } }
) {
  try {
    // Handle both sync and async params (Next.js 14 vs 15)
    const resolvedParams = params instanceof Promise ? await params : params;
    const sessionId = resolvedParams.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const pb = await getAdminPb();

    // Fetch session record to get duration and metadata
    let session;
    try {
      session = await pb.collection('sessions').getOne(sessionId);
    } catch (error) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch session summary
    const summaryResult = await pb.collection('session_summary').getList(1, 1, {
      filter: `session_id = "${sessionId}"`
    });

    if (summaryResult.items.length === 0) {
      return NextResponse.json({ error: 'Session summary not found' }, { status: 404 });
    }

    const summaryRecord = withDollarId(summaryResult.items[0]);

    // Calculate duration from session startTime and endTime
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    // Fetch and process raw data if available
    const rawData: Array<{ timestamp: number; rrInterval?: number; allRrIntervals?: number[] }> = [];

    if (session.rawFile) {
      try {
        const fileUrl = pb.files.getUrl(session, session.rawFile);
        console.log(`[API] Fetching raw file from: ${fileUrl}`);

        // Fetch the file
        const fileResponse = await fetch(fileUrl);
        if (fileResponse.ok) {
          const arrayBuffer = await fileResponse.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Unzip the file
          const unzipped = fflate.unzipSync(uint8Array);

          // Find the CSV file inside the zip (there should be only one)
          const csvFileName = Object.keys(unzipped).find(name => name.endsWith('.csv'));

          if (csvFileName) {
            const csvContent = fflate.strFromU8(unzipped[csvFileName]);
            const lines = csvContent.split('\n');

            // Find header line
            let headerIndex = -1;
            const dataLines = [];

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (line.startsWith('#')) continue; // Skip comments
              if (!line) continue; // Skip empty lines

              if (headerIndex === -1) {
                headerIndex = i;
              } else {
                dataLines.push(line);
              }
            }

            if (headerIndex !== -1) {
              const headers = lines[headerIndex].split(',').map(h => h.trim().replace(/"/g, ''));
              const rrIndex = headers.indexOf('rrInterval');
              const timestampIndex = headers.indexOf('timestamp');
              const allRrIndex = headers.indexOf('allRrIntervals');

              if (rrIndex !== -1 && timestampIndex !== -1) {
                // Parse data lines
                for (const line of dataLines) {
                  // Handle potential quoted CSV values (simple parser)
                  // For our simple CSV where arrays might be quoted "[1,2]"
                  let columns: string[] = [];
                  let inQuote = false;
                  let currentValue = '';

                  for (let c = 0; c < line.length; c++) {
                    const char = line[c];
                    if (char === '"') {
                      inQuote = !inQuote;
                    } else if (char === ',' && !inQuote) {
                      columns.push(currentValue);
                      currentValue = '';
                    } else {
                      currentValue += char;
                    }
                  }
                  columns.push(currentValue);

                  if (columns.length > rrIndex && columns.length > timestampIndex) {
                    const timestamp = parseFloat(columns[timestampIndex]);
                    const rrInterval = parseFloat(columns[rrIndex]);

                    if (!isNaN(timestamp) && !isNaN(rrInterval)) {
                      const entry: { timestamp: number; rrInterval: number; allRrIntervals?: number[] } = {
                        timestamp,
                        rrInterval
                      };

                      // Try to parse allRrIntervals if present
                      if (allRrIndex !== -1 && columns.length > allRrIndex) {
                        try {
                          const allRrStr = columns[allRrIndex].replace(/^"|"$/g, '').trim();
                          if (allRrStr.startsWith('[') && allRrStr.endsWith(']')) {
                            const parsed = JSON.parse(allRrStr);
                            if (Array.isArray(parsed)) {
                              entry.allRrIntervals = parsed;
                            }
                          }
                        } catch (e) {
                          // Ignore parsing error for array
                        }
                      }

                      rawData.push(entry);
                    }
                  }
                }
              }
            }
          }
        } else {
          console.error(`[API] Failed to fetch raw file: ${fileResponse.status}`);
        }
      } catch (error) {
        console.error('[API] Error processing raw file:', error);
      }
    }

    console.log(`[API] Extracted ${rawData.length} data points from raw file`);

    // Convert SessionSummaryRecord to SessionSummaryPayload
    const payload: SessionSummaryPayload = {
      session_id: summaryRecord.session_id,
      user_id: summaryRecord.user_id,
      rmssd_session_ms: summaryRecord.rmssd_session_ms,
      rmssd_cv_percent: summaryRecord.rmssd_cv_percent ?? null,
      sdnn_session_ms: summaryRecord.sdnn_session_ms,
      pnn50_percent: summaryRecord.pnn50_percent,
      session_mean_hr: summaryRecord.session_mean_hr,
      amode_50: summaryRecord.amode_50 ?? null,
      AMo50_count: summaryRecord.AMo50_count ?? null,
      rr_max_ms: summaryRecord.rr_max_ms,
      rr_min_ms: summaryRecord.rr_min_ms,
      mxdmn_ms: summaryRecord.mxdmn_ms,
      rmssd_start_ms: summaryRecord.rmssd_start_ms,
      rmssd_end_ms: summaryRecord.rmssd_end_ms,
      time_to_stabilize_seconds: summaryRecord.time_to_stabilize_seconds,
      resp_coherence_score: summaryRecord.resp_coherence_score,
      restoration_index: summaryRecord.restoration_index,
      session_stress_index: summaryRecord.session_stress_index,
      mean_rr_ms: summaryRecord.mean_rr_ms ?? null,
      lf_power_ms2: summaryRecord.lf_power_ms2 ?? null,
      hf_power_ms2: summaryRecord.hf_power_ms2 ?? null,
      lfhf_ratio: summaryRecord.lfhf_ratio ?? null,
      total_power_ms2: summaryRecord.total_power_ms2 ?? null,
      sd1_ms: summaryRecord.sd1_ms ?? null,
      sd2_ms: summaryRecord.sd2_ms ?? null,
      sd2_sd1_ratio: summaryRecord.sd2_sd1_ratio ?? null,
      baevsky_mo: summaryRecord.baevsky_mo ?? null,
      baevsky_amo: summaryRecord.baevsky_amo ?? null,
      baevsky_mxdmn_ms: summaryRecord.baevsky_mxdmn_ms ?? null,
      baevsky_stress_index: summaryRecord.baevsky_stress_index ?? null,
      sd1_sd2_balance_score_nbs: summaryRecord.sd1_sd2_balance_score_nbs ?? null,
      sd1_sd2_parasympathetic_percent: summaryRecord.sd1_sd2_parasympathetic_percent ?? null,
      sd1_sd2_sympathetic_percent: summaryRecord.sd1_sd2_sympathetic_percent ?? null,
      energy_score: summaryRecord.energy_score ?? null,
      stress_score: summaryRecord.stress_score ?? null,
      health_score: summaryRecord.health_score ?? null,
      focus_score: summaryRecord.focus_score ?? null,
      hrv_score: summaryRecord.hrv_score ?? null,
      session_date: summaryRecord.session_date ?? null,
    };

    // Build SessionSummary with ACTUAL raw data
    // If raw extraction failed (rawData empty), fall back to estimate for data points count
    const dataPointsCount = rawData.length > 0 ? rawData.length : Math.max(60, durationSeconds);
    const sessionSummary = buildSessionSummary(payload, durationSeconds, dataPointsCount, rawData);

    return NextResponse.json({
      session: withDollarId(session),
      summary: sessionSummary,
      summaryRecord: summaryRecord
    });

  } catch (error: unknown) {
    console.error('Error fetching session data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

