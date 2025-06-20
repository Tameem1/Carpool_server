// GMT+3 timezone utilities - All times in this app are treated as GMT+3
export const GMT_PLUS_3_OFFSET = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

/**
 * Get current time in GMT+3 timezone
 * This is the primary function for getting "now" in the app
 */
export function nowGMTPlus3(): Date {
  // Get current UTC time and convert to GMT+3
  const utcNow = new Date();
  return new Date(utcNow.getTime() + GMT_PLUS_3_OFFSET);
}

/**
 * Convert any date to GMT+3 timezone
 * Use this when you have a UTC date and need to display it in GMT+3
 */
export function toGMTPlus3(date: Date): Date {
  return new Date(date.getTime() + GMT_PLUS_3_OFFSET);
}

/**
 * Convert a GMT+3 date to UTC for database storage
 * Use this when storing user input that was entered in GMT+3 time
 */
export function fromGMTPlus3ToUTC(date: Date): Date {
  return new Date(date.getTime() - GMT_PLUS_3_OFFSET);
}

/**
 * Parse datetime-local input and convert to UTC for database storage
 * Assumes the input was entered in GMT+3 local time
 */
export function parseDateTimeLocalToUTC(dateTimeLocal: string | Date): Date {
  let localDate: Date;
  
  if (typeof dateTimeLocal === 'string') {
    // Parse the string as if it's in GMT+3 timezone
    localDate = new Date(dateTimeLocal);
  } else {
    localDate = dateTimeLocal;
  }
  
  // Convert from GMT+3 to UTC for database storage
  return fromGMTPlus3ToUTC(localDate);
}

/**
 * Parse time string (HH:MM) and convert to today's timestamp in UTC
 * Assumes the time is in GMT+3 timezone
 */
export function parseTimeToTodayUTC(timeString: string): Date {
  if (!timeString) throw new Error("Time string is required");
  
  const [hours, minutes] = timeString.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error("Invalid time format");
  }
  
  // Create date for today with the specified time
  // Treat this as if the user entered the time in GMT+3
  const today = new Date();
  today.setHours(hours, minutes, 0, 0);
  
  // The user entered this time thinking in GMT+3, so we need to adjust it to UTC
  // If user enters 17:37 thinking it's GMT+3, we need to store 14:37 UTC
  return new Date(today.getTime() - GMT_PLUS_3_OFFSET);
}

/**
 * Format date for GMT+3 display
 */
export function formatGMTPlus3(date: Date, locale: string = 'ar-SA'): string {
  // Convert UTC database time to GMT+3 for display
  const gmt3Date = toGMTPlus3(date);
  
  return gmt3Date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC' // We already converted to GMT+3, so treat as UTC
  });
}

/**
 * Format time only for GMT+3 display (without date)
 */
export function formatGMTPlus3TimeOnly(date: Date, locale: string = 'ar-SA'): string {
  // Convert UTC database time to GMT+3 for display
  const gmt3Date = toGMTPlus3(date);
  
  // Extract hours and minutes from GMT+3 time
  const hours = gmt3Date.getUTCHours();
  const minutes = gmt3Date.getUTCMinutes();
  
  // Format in 12-hour format
  const ampm = hours >= 12 ? (locale === 'ar-SA' ? 'م' : 'PM') : (locale === 'ar-SA' ? 'ص' : 'AM');
  const displayHours = hours % 12 || 12;
  
  // Use Arabic or English numerals based on locale
  if (locale === 'ar-SA') {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const hourStr = displayHours.toString().split('').map(d => arabicNumerals[parseInt(d)]).join('');
    const minuteStr = minutes.toString().padStart(2, '0').split('').map(d => arabicNumerals[parseInt(d)]).join('');
    return `${hourStr}:${minuteStr} ${ampm}`;
  } else {
    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}

/**
 * Extract time in HH:MM format from a UTC database timestamp, displayed in GMT+3
 */
export function extractTimeFromUTC(utcDate: Date): string {
  const gmt3Date = toGMTPlus3(utcDate);
  const hours = gmt3Date.getUTCHours();
  const minutes = gmt3Date.getUTCMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Convert UTC database date to datetime-local format for form inputs
 */
export function formatDateForInput(utcDate: Date): string {
  const gmt3Date = toGMTPlus3(utcDate);
  
  const year = gmt3Date.getUTCFullYear();
  const month = String(gmt3Date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(gmt3Date.getUTCDate()).padStart(2, '0');
  const hours = String(gmt3Date.getUTCHours()).padStart(2, '0');
  const minutes = String(gmt3Date.getUTCMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get start and end of current day in GMT+3, returned as UTC for database queries
 * Custom day starts at 5 AM GMT+3 and ends at 5 AM next day GMT+3
 */
export function getTodayRangeUTC(): { start: Date; end: Date } {
  const nowInGMT3 = nowGMTPlus3();
  const currentHour = nowInGMT3.getUTCHours();
  
  // Create day start in GMT+3
  const dayStartGMT3 = new Date(nowInGMT3);
  
  // If it's before 5 AM GMT+3, we're in the previous day (which started at 5 AM yesterday)
  if (currentHour < 5) {
    dayStartGMT3.setUTCDate(dayStartGMT3.getUTCDate() - 1);
  }
  dayStartGMT3.setUTCHours(5, 0, 0, 0);
  
  // Day ends at 5 AM the next day GMT+3
  const dayEndGMT3 = new Date(dayStartGMT3);
  dayEndGMT3.setUTCDate(dayEndGMT3.getUTCDate() + 1);
  
  // Convert to UTC for database queries
  return {
    start: fromGMTPlus3ToUTC(dayStartGMT3),
    end: fromGMTPlus3ToUTC(dayEndGMT3)
  };
}

/**
 * Get start and end of specific date in GMT+3, returned as UTC for database queries
 */
export function getDateRangeUTC(date?: Date): { start: Date; end: Date } {
  const targetDate = date ? toGMTPlus3(date) : nowGMTPlus3();
  
  // Create day boundaries in GMT+3
  const startGMT3 = new Date(targetDate);
  startGMT3.setUTCHours(0, 0, 0, 0);
  
  const endGMT3 = new Date(targetDate);
  endGMT3.setUTCHours(23, 59, 59, 999);
  
  // Convert to UTC for database queries
  return {
    start: fromGMTPlus3ToUTC(startGMT3),
    end: fromGMTPlus3ToUTC(endGMT3)
  };
}