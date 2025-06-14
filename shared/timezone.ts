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
  // Convert UTC to GMT+3
  const gmt3Time = date.getTime() + GMT_PLUS_3_OFFSET;
  const gmt3Date = new Date(gmt3Time);
  
  return gmt3Date.toLocaleString(locale, {
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
  // Convert UTC to GMT+3
  const gmt3Time = date.getTime() + GMT_PLUS_3_OFFSET;
  const gmt3Date = new Date(gmt3Time);
  
  return gmt3Date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Parse datetime-local input value as GMT+3 and convert to UTC for storage
 */
export function parseDateTimeLocalToUTC(dateTimeLocal: string | Date): Date {
  // datetime-local gives us local time, we treat it as GMT+3
  let localDate: Date;
  
  if (typeof dateTimeLocal === 'string') {
    // Parse the string as local time (assumed to be GMT+3)
    localDate = new Date(dateTimeLocal);
  } else {
    localDate = dateTimeLocal;
  }
  
  // The parsed date is interpreted in the browser's timezone
  // We need to adjust it to be GMT+3 then convert to UTC
  const offsetMinutes = localDate.getTimezoneOffset();
  const utcTime = localDate.getTime() + (offsetMinutes * 60000);
  const gmt3Time = utcTime + GMT_PLUS_3_OFFSET;
  
  return new Date(gmt3Time);
}

/**
 * Convert UTC date from database to datetime-local format for input (as GMT+3)
 */
export function formatDateForInput(utcDate: Date): string {
  // Convert UTC to GMT+3
  const gmt3Time = utcDate.getTime() + GMT_PLUS_3_OFFSET;
  const gmt3Date = new Date(gmt3Time);
  
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