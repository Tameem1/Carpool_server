// Daily driver-shortage check.
//
// At 9 AM and 12 PM (GMT+3) we scan today's schedule slots, find the ones where
// fewer drivers have registered than the slot needs, and send a single Telegram
// digest to the admin-curated recipient list (see shortage_alert_recipients).
// The check is dependency-injected via a `notify` callback so it can be unit-run
// and reused by the manual "run now" admin endpoint.
import cron from "node-cron";
import { storage } from "./storage";
import { getTodayRangeUTC, formatGMTPlus3TimeOnly } from "@shared/timezone";

// Sends one Telegram message to a user; matches TelegramNotificationService.sendNotification.
// It already no-ops for users without a linked telegramUsername.
export type ShortageNotifier = (
  userId: string,
  title: string,
  message: string,
  type: string,
) => Promise<void>;

export interface ShortageCheckResult {
  understaffed: number; // number of slots short on drivers today
  recipientsNotified: number; // recipients we attempted to message
}

// Escape Telegram Markdown special chars in dynamic text (mirrors the service helper).
function escapeMarkdown(text: string): string {
  return text.replace(/[[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// Core check: compute today's shortages and notify the recipient list.
export async function runDriverShortageCheck(
  notify: ShortageNotifier,
): Promise<ShortageCheckResult> {
  const { start, end } = getTodayRangeUTC();
  const slots = await storage.getSlotsBetween(start, end);

  if (slots.length === 0) {
    console.log("[SHORTAGE] No schedule slots today — nothing to check");
    return { understaffed: 0, recipientsNotified: 0 };
  }

  const counts = await storage.getSlotRegistrationCounts(slots.map((s) => s.id));

  const understaffed = slots
    .map((slot) => {
      const registered = counts.get(slot.id) ?? 0;
      return { slot, registered, missing: slot.driversNeeded - registered };
    })
    .filter((row) => row.missing > 0);

  if (understaffed.length === 0) {
    console.log("[SHORTAGE] All of today's slots are fully staffed");
    return { understaffed: 0, recipientsNotified: 0 };
  }

  const lines = understaffed.map(({ slot, registered, missing }) => {
    const time = formatGMTPlus3TimeOnly(new Date(slot.startTime));
    return `🚗 *${escapeMarkdown(slot.destination)}*\n🕐 ${time}\n❗ ناقص ${missing} سائق \\(مطلوب ${slot.driversNeeded}، مسجّل ${registered}\\)`;
  });

  const title = "تنبيه: نقص في السائقين اليوم";
  const message = `🚨 *يوجد نقص في عدد السائقين للرحلات التالية اليوم:*\n\n${lines.join("\n\n")}`;

  const recipients = await storage.getShortageAlertRecipients();
  if (recipients.length === 0) {
    console.log(
      `[SHORTAGE] ${understaffed.length} understaffed slot(s) today but no recipients configured`,
    );
    return { understaffed: understaffed.length, recipientsNotified: 0 };
  }

  for (const recipient of recipients) {
    await notify(recipient.id, title, message, "driver_shortage");
  }

  console.log(
    `[SHORTAGE] ${understaffed.length} understaffed slot(s) today — digest sent to ${recipients.length} recipient(s)`,
  );
  return { understaffed: understaffed.length, recipientsNotified: recipients.length };
}

// Register the daily cron jobs (9 AM and 12 PM, Asia/Riyadh = GMT+3, no DST).
// Each run is wrapped so a failure can never crash the process.
export function startDriverShortageJobs(notify: ShortageNotifier): void {
  const tick = async (label: string) => {
    try {
      console.log(`[SHORTAGE] Running ${label} driver-shortage check`);
      await runDriverShortageCheck(notify);
    } catch (error) {
      console.error(`[SHORTAGE] ${label} check failed:`, error);
    }
  };

  const options = { timezone: "Asia/Riyadh" } as const;
  cron.schedule("0 9 * * *", () => tick("09:00"), options);
  cron.schedule("0 12 * * *", () => tick("12:00"), options);

  console.log("[SHORTAGE] Scheduled daily driver-shortage checks at 09:00 and 12:00 (Asia/Riyadh)");
}
