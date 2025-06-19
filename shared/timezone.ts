// GMT+3 timezone utilities
export const GMT_PLUS_3_OFFSET = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

/**
 * Convert a date to GMT+3 timezone
 */
export function toGMTPlus3(date: Date): Date {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + GMT_PLUS_3_OFFSET);
}

/**
 * Convert a GMT+3 date to UTC for database storage
 */
export function fromGMTPlus3ToUTC(date: Date): Date {
  return new Date(date.getTime() - GMT_PLUS_3_OFFSET);
}

/**
 * Format date for GMT+3 display (treat stored date as GMT+3)
 */
export function formatGMTPlus3(date: Date, locale: string = 'ar-SA'): string {
  // Display the date as-is (assume it's already in GMT+3)
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format time only for GMT+3 display (without date)
 */
export function formatGMTPlus3TimeOnly(date: Date, locale: string = 'ar-SA'): string {
  // Display the time as-is (assume it's already in GMT+3)
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Parse datetime-local input value and store as-is (treat as GMT+3)
 */
export function parseDateTimeLocalToUTC(dateTimeLocal: string | Date): Date {
  // Store the time exactly as entered - no timezone conversion
  if (typeof dateTimeLocal === 'string') {
    return new Date(dateTimeLocal);
  }
  return dateTimeLocal;
}

/**
 * Convert date from database to datetime-local format for input (no conversion)
 */
export function formatDateForInput(date: Date): string {
  // Use the date as-is for input formatting
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get current time (treat as GMT+3)
 */
export function nowGMTPlus3(): Date {
  return new Date();
}

/**
 * Get start and end of today in GMT+3
 */
export function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}