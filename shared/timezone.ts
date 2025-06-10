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
 * Format date for GMT+3 display
 */
export function formatGMTPlus3(date: Date, locale: string = 'ar-SA'): string {
  const gmt3Date = toGMTPlus3(date);
  return gmt3Date.toLocaleString(locale, {
    timeZone: 'Asia/Riyadh', // GMT+3
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Parse datetime-local input value to GMT+3 then convert to UTC for storage
 */
export function parseDateTimeLocalToUTC(dateTimeLocal: string): Date {
  // datetime-local gives us local time, we treat it as GMT+3
  const localDate = new Date(dateTimeLocal);
  // Convert from GMT+3 to UTC for storage
  return fromGMTPlus3ToUTC(localDate);
}

/**
 * Convert UTC date from database to datetime-local format for input
 */
export function formatDateForInput(utcDate: Date): string {
  const gmt3Date = toGMTPlus3(utcDate);
  // Format for datetime-local input (YYYY-MM-DDTHH:mm)
  const year = gmt3Date.getFullYear();
  const month = String(gmt3Date.getMonth() + 1).padStart(2, '0');
  const day = String(gmt3Date.getDate()).padStart(2, '0');
  const hours = String(gmt3Date.getHours()).padStart(2, '0');
  const minutes = String(gmt3Date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get current time in GMT+3
 */
export function nowGMTPlus3(): Date {
  return toGMTPlus3(new Date());
}