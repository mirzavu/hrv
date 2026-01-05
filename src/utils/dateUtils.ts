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
    // localDateStr is YYYY-MM-DD (local date we want to query)
    // We need to find the UTC time that corresponds to midnight in the user's timezone
    const [year, month, day] = localDateStr.split('-').map(Number);

    // Create a date string that represents midnight in the user's timezone
    // Then parse it as if it were that timezone
    const localMidnight = new Date(`${localDateStr}T00:00:00`);

    // Get the offset for this timezone at this date
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
    });

    // Simple approach: calculate the offset
    // Create a reference date in the target timezone
    const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Get what time it is in the target timezone when it's midnight UTC
    const localParts = getLocalDateParts(utcDate, timezone);

    // If local date matches, offset is 0
    // If local date is ahead (e.g., Asia/Kolkata), we need to go back in UTC
    // If local date is behind (e.g., America/New_York), we need to go forward in UTC

    // Use a different approach: Format a known date in the timezone to get the offset
    const testDate = new Date(`${localDateStr}T12:00:00Z`); // noon UTC on the target date
    const localDateOnTestDate = toLocalDateString(testDate, timezone);

    if (localDateOnTestDate === localDateStr) {
        // Noon UTC falls on the same local date - offset is roughly 0 or within ±12h
        // We need to find exact midnight

        // Try a binary search-like approach or use a library
        // For simplicity, let's try different hour offsets
        for (let hourOffset = -14; hourOffset <= 14; hourOffset++) {
            const tryDate = new Date(Date.UTC(year, month - 1, day, -hourOffset, 0, 0, 0));
            const tryLocalDate = toLocalDateString(tryDate, timezone);
            const tryLocalParts = getLocalDateParts(tryDate, timezone);

            // Check if this UTC time corresponds to midnight in the local timezone
            const timeFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: 'numeric',
                minute: 'numeric',
                hour12: false,
            });
            const timeStr = timeFormatter.format(tryDate);

            if (tryLocalDate === localDateStr && timeStr === '00:00') {
                return tryDate;
            }
        }
    }

    // Fallback: Use the date as-is with midnight UTC
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
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
