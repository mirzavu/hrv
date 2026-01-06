/**
 * Date Utilities for Timezone-Aware Operations
 * 
 * All date operations should use these utilities to ensure consistent
 * timezone handling across the app. Dates are stored in UTC in the database
 * but displayed and processed in the user's local timezone.
 */

// Default timezone fallback (used when user timezone is not set)
export const DEFAULT_TIMEZONE = 'UTC';

/**
 * Convert a UTC date to the user's local date string (YYYY-MM-DD)
 * This is the primary function for grouping sessions by day in the user's timezone
 */
export function toLocalDateString(utcDate: Date | string, timezone: string): string {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    // Use Intl.DateTimeFormat to format in the target timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    // en-CA format gives us YYYY-MM-DD
    return formatter.format(date);
}

/**
 * Get local date components (year, month, day) for a UTC date in a specific timezone
 */
export function getLocalDateParts(utcDate: Date | string, timezone: string): { year: number; month: number; day: number } {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    });

    const parts = formatter.formatToParts(date);
    const partMap: Record<string, number> = {};

    for (const part of parts) {
        if (part.type === 'year') partMap.year = parseInt(part.value, 10);
        if (part.type === 'month') partMap.month = parseInt(part.value, 10);
        if (part.type === 'day') partMap.day = parseInt(part.value, 10);
    }

    return {
        year: partMap.year || 0,
        month: partMap.month || 0,
        day: partMap.day || 0,
    };
}

/**
 * Get the start of a local day as a UTC Date
 * Used for database queries - converts local day boundaries to UTC for filtering
 */
export function getLocalDayStartUTC(localDateStr: string, timezone: string): Date {
    // 1. Parse the input date
    const [year, month, day] = localDateStr.split('-').map(Number);

    // 2. Create a "Naive" UTC date for this calendar day (e.g., 2026-01-06 00:00 UTC)
    const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // 3. Ask Intl what time it is in the target timezone at that exact UTC moment
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false, // Ensure 24h format
    });

    const parts = formatter.formatToParts(utcGuess);
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

    // 4. Reconstruct what the timezone "thinks" the time is, placed into a UTC container
    // Example: If it's 05:30 in India, we create a date "2026-01-06 05:30 UTC"
    const localTimeAtGuess = new Date(Date.UTC(
        getPart('year'),
        getPart('month') - 1,
        getPart('day'),
        getPart('hour'),
        getPart('minute'),
        getPart('second')
    ));

    // 5. Calculate the offset (Difference between Local Time and UTC)
    // For India (+5:30), this will be positive 5.5 hours in ms
    const offsetMs = localTimeAtGuess.getTime() - utcGuess.getTime();

    // 6. Subtract the offset from our original guess to find true Local Midnight in UTC
    // Logic: If Local is AHEAD of UTC, we must go BACK in time to find midnight.
    const startUTC = new Date(utcGuess.getTime() - offsetMs);

    return startUTC;
}

// Helper to get the full range (Start + End) for DB queries
export function getUserDayRangeUTC(localDateStr: string, timezone: string) {
    const startUTC = getLocalDayStartUTC(localDateStr, timezone);

    // Create End Time (Start + 23h 59m 59s 999ms)
    // We add explicitly rather than calculating 'tomorrow' to avoid DST boundary issues
    const endUTC = new Date(startUTC.getTime() + (24 * 60 * 60 * 1000) - 1);

    return { startUTC, endUTC };
}

/**
 * Get the end of a local day as a UTC Date
 */
export function getLocalDayEndUTC(localDateStr: string, timezone: string): Date {
    const startOfDay = getLocalDayStartUTC(localDateStr, timezone);
    // Add 24 hours - 1 millisecond
    return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/**
 * Format a UTC date for display in the user's timezone
 */
export function formatLocalDateTime(utcDate: Date | string, timezone: string, options?: Intl.DateTimeFormatOptions): string {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    const defaultOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    };

    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(date);
}

/**
 * Format just the time portion in the user's timezone
 */
export function formatLocalTime(utcDate: Date | string, timezone: string): string {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;

    return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

/**
 * Count unique local dates in a set of UTC dates
 * Used for calibration progress calculation
 */
export function countUniqueDays(utcDates: (Date | string)[], timezone: string): number {
    const uniqueDates = new Set<string>();

    for (const date of utcDates) {
        const localDateStr = toLocalDateString(date, timezone);
        uniqueDates.add(localDateStr);
    }

    return uniqueDates.size;
}

/**
 * Format a date for PocketBase queries
 * PocketBase stores and expects dates with space separator (not T)
 * This converts ISO format (with T) to PocketBase format (with space)
 * 
 * @param date - Date object or ISO string
 * @returns Date string formatted for PocketBase: "YYYY-MM-DD HH:MM:SS.mmmZ"
 */
export function formatDateForPocketBase(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    // toISOString() produces "2024-01-15T10:30:00.000Z"
    // Replace T with space to match PocketBase format: "2024-01-15 10:30:00.000Z"
    return dateObj.toISOString().replace('T', ' ');
}
