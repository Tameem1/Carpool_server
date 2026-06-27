import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import {
  formatGMTPlus3TimeOnly,
} from "@shared/timezone";

// ─── Verification code store ────────────────────────────────────────────────
// In-memory: { code → { userId, expires } }
// Codes expire after CODE_TTL_MS and are pruned on every generate call.

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PendingCode {
  userId: string;
  expires: Date;
}

const pendingCodes = new Map<string, PendingCode>();

function pruneExpiredCodes() {
  const now = Date.now();
  for (const [code, data] of pendingCodes) {
    if (data.expires.getTime() < now) pendingCodes.delete(code);
  }
}

function generateCode(userId: string): string {
  pruneExpiredCodes();

  // Invalidate any existing code for this user
  for (const [code, data] of pendingCodes) {
    if (data.userId === userId) pendingCodes.delete(code);
  }

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  pendingCodes.set(code, { userId, expires: new Date(Date.now() + CODE_TTL_MS) });
  return code;
}

function consumeCode(code: string): string | null {
  pruneExpiredCodes();
  const entry = pendingCodes.get(code.toUpperCase());
  if (!entry) return null;
  pendingCodes.delete(code.toUpperCase());
  return entry.userId;
}

// ─── Markdown escaping ───────────────────────────────────────────────────────

function esc(text: string): string {
  return text.replace(/[[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ─── TelegramNotificationService ─────────────────────────────────────────────

class TelegramNotificationService {
  private bot: TelegramBot | null = null;
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      console.log("[TELEGRAM] No TELEGRAM_BOT_TOKEN provided — notifications disabled");
      return;
    }

    try {
      this.bot = new TelegramBot(token, { polling: true });
      console.log("[TELEGRAM] Bot initialized — polling started");
      this.registerCommands();
    } catch (err) {
      console.error("[TELEGRAM] Failed to initialize bot:", err);
      this.bot = null;
    }
  }

  // ─── Bot command handlers ─────────────────────────────────────────────────

  private registerCommands() {
    if (!this.bot) return;

    // /start [code]
    this.bot.onText(/^\/start(.*)$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const telegramUsername = msg.from?.username ?? null;
      const arg = (match?.[1] ?? "").trim();

      if (arg) {
        // /start CODE — try to link immediately
        await this.handleCodeSubmission(chatId, telegramUsername, arg);
      } else {
        await this.bot!.sendMessage(
          chatId,
          `👋 *مرحباً بك في بوت وصلني عالنادي\\!*\n\n` +
          `لربط حسابك:\n` +
          `1️⃣ افتح الموقع وانتقل إلى *الملف الشخصي*\n` +
          `2️⃣ اضغط على *ربط تيليغرام*\n` +
          `3️⃣ انسخ الكود الذي يظهر لك\n` +
          `4️⃣ أرسله هنا\n\n` +
          `الأوامر المتاحة:\n` +
          `/help \\- المساعدة\n` +
          `/status \\- حالة الاتصال\n` +
          `/unlink \\- إلغاء ربط الحساب`,
          { parse_mode: "MarkdownV2" },
        );
      }
    });

    // /help
    this.bot.onText(/^\/help$/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot!.sendMessage(
        chatId,
        `📖 *المساعدة*\n\n` +
        `/start \\- بدء البوت\n` +
        `/status \\- عرض حالة ربط حسابك\n` +
        `/unlink \\- إلغاء ربط حسابك\n\n` +
        `لربط حسابك، احصل على كود من صفحة الإعدادات في الموقع وأرسله هنا\\.`,
        { parse_mode: "MarkdownV2" },
      );
    });

    // /status
    this.bot.onText(/^\/status$/, async (msg) => {
      const chatId = msg.chat.id;
      const linked = await this.findUserByChatId(chatId);
      if (linked) {
        await this.bot!.sendMessage(
          chatId,
          `✅ *حسابك مرتبط*\n\nاسم المستخدم: *${esc(linked.username)}*\nالقسم: *${esc(linked.section)}*\n\nستصلك إشعارات الرحلات تلقائياً\\.`,
          { parse_mode: "MarkdownV2" },
        );
      } else {
        await this.bot!.sendMessage(
          chatId,
          `❌ *حسابك غير مرتبط*\n\nأرسل الكود من صفحة الإعدادات في الموقع لربط حسابك\\.`,
          { parse_mode: "MarkdownV2" },
        );
      }
    });

    // /unlink
    this.bot.onText(/^\/unlink$/, async (msg) => {
      const chatId = msg.chat.id;
      const linked = await this.findUserByChatId(chatId);
      if (!linked) {
        await this.bot!.sendMessage(chatId, "❌ لا يوجد حساب مرتبط بهذا الحساب على تيليغرام.");
        return;
      }
      await storage.updateUser(linked.id, { telegramId: null, telegramUsername: null });
      console.log(`[TELEGRAM] User unlinked via /unlink command: ${linked.username}`);
      await this.bot!.sendMessage(chatId, `✅ تم إلغاء ربط حسابك *${esc(linked.username)}* بنجاح\\.`, {
        parse_mode: "MarkdownV2",
      });
    });

    // Plain text messages — treat as verification codes
    this.bot.on("message", async (msg) => {
      if (!msg.text) return;
      if (msg.text.startsWith("/")) return; // already handled by onText
      const chatId = msg.chat.id;
      const telegramUsername = msg.from?.username ?? null;
      await this.handleCodeSubmission(chatId, telegramUsername, msg.text.trim());
    });

    this.bot.on("polling_error", (err) => {
      console.error("[TELEGRAM] Polling error:", err.message);
    });
  }

  // ─── Code submission (from bot message or /start CODE) ───────────────────

  private async handleCodeSubmission(
    chatId: number,
    telegramUsername: string | null,
    code: string,
  ) {
    const userId = consumeCode(code);
    if (!userId) {
      await this.bot!.sendMessage(
        chatId,
        "❌ الكود غير صحيح أو انتهت صلاحيته\\. احصل على كود جديد من الموقع\\.",
        { parse_mode: "MarkdownV2" },
      );
      return;
    }

    // Check if another account is already linked to this chatId
    const existing = await this.findUserByChatId(chatId);
    if (existing && existing.id !== userId) {
      await storage.updateUser(existing.id, { telegramId: null, telegramUsername: null });
    }

    await storage.updateUser(userId, {
      telegramId: String(chatId),
      telegramUsername: telegramUsername ?? null,
    });

    const user = await storage.getUser(userId);
    console.log(`[TELEGRAM] User linked: ${user?.username} ↔ chatId ${chatId}`);

    await this.bot!.sendMessage(
      chatId,
      `✅ *تم ربط حسابك بنجاح\\!*\n\nاسم المستخدم: *${esc(user?.username ?? "")}*\nستصلك الآن إشعارات الرحلات على تيليغرام\\.`,
      { parse_mode: "MarkdownV2" },
    );
  }

  // ─── Public API for route handlers ───────────────────────────────────────

  /** Generate a verification code for the given userId and return it. */
  generateVerificationCode(userId: string): string {
    return generateCode(userId);
  }

  /** Find the app user whose telegramId matches the given chatId. */
  async findUserByChatId(chatId: number): Promise<{ id: string; username: string; section: string } | null> {
    const allUsers = await storage.getAllUsers();
    const user = allUsers.find((u) => u.telegramId === String(chatId));
    return user ? { id: user.id, username: user.username, section: user.section } : null;
  }

  /** Verify a code submitted from the website (when user enters code in web UI instead of bot). */
  async verifyCodeFromWeb(code: string, chatId?: number): Promise<{ success: boolean; message: string }> {
    // Web flow: the code is consumed and the chatId from the pending code is used
    // For web verify we need the user to tell us their chatId — but that's only known to the bot.
    // Instead, the recommended flow is: enter the code IN the bot.
    // The web verify endpoint is a fallback that checks if the code was already consumed by the bot.
    // Since consumeCode removes it, if it's gone the linking already happened.
    const userId = consumeCode(code);
    if (!userId) {
      return { success: false, message: "الكود غير صحيح أو انتهت صلاحيته" };
    }
    // Code is valid but we don't have a chatId — put it back so the bot can consume it
    pendingCodes.set(code.toUpperCase(), { userId, expires: new Date(Date.now() + CODE_TTL_MS) });
    return { success: false, message: "أرسل الكود في البوت على تيليغرام لإتمام الربط" };
  }

  // ─── Notification delivery ────────────────────────────────────────────────

  /**
   * Send a Telegram notification to the app user identified by `userId`.
   * Looks up their telegramId (chat ID) and delivers the message.
   * Silently skips users with no linked Telegram account.
   */
  async sendNotification(userId: string, title: string, message: string, type: string) {
    try {
      const user = await storage.getUser(userId);
      if (!user?.telegramId) {
        console.log(`[TELEGRAM] User ${userId} has no linked Telegram — skipping notification (${type})`);
        return;
      }
      if (!this.bot) {
        console.log("[TELEGRAM] Bot unavailable — skipping notification");
        return;
      }

      const chatId = parseInt(user.telegramId, 10);
      if (isNaN(chatId)) {
        console.warn(`[TELEGRAM] Invalid telegramId for user ${userId}: "${user.telegramId}"`);
        return;
      }

      console.log(`[TELEGRAM] Sending notification (${type}) to user ${userId} (chatId: ${chatId})`);

      await this.bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });

      console.log(`[TELEGRAM] Notification sent (${type}) to user ${userId}`);
    } catch (err: any) {
      if (err?.response?.statusCode === 403) {
        // User blocked the bot — clear their telegramId so we stop trying
        console.warn(`[TELEGRAM] User ${userId} blocked the bot — unlinking`);
        await storage.updateUser(userId, { telegramId: null }).catch(() => {});
      } else {
        console.error(`[TELEGRAM] Failed to send notification (${type}) to user ${userId}:`, err?.message ?? err);
      }
    }
  }

  // ─── Named notification methods ───────────────────────────────────────────

  async notifyAdminsRideRequestCreated(requestId: number, riderId: string) {
    try {
      const request = await storage.getRideRequest(requestId);
      const rider = await storage.getUser(riderId);
      const admins = await storage.getAdminUsers();
      if (!request || !rider) return;

      const msg =
        `🚗 *طلب رحلة جديد من ${esc(rider.username)}*\n\n` +
        `📍 *من:* ${esc(request.fromLocation)}\n` +
        `📍 *إلى:* ${esc(request.toLocation)}\n` +
        `🕐 *الوقت المفضل:* ${formatGMTPlus3TimeOnly(new Date(request.preferredTime))}\n` +
        `👥 *عدد الركاب:* ${request.passengerCount}\n` +
        (request.notes ? `📝 *ملاحظات:* ${esc(request.notes)}\n` : "") +
        `\n*رقم الطلب:* ${requestId}`;

      for (const admin of admins.filter((a) => a.id !== riderId)) {
        await this.sendNotification(admin.id, "طلب رحلة جديد", msg, "admin_ride_request_created");
      }
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyAdminsRideRequestCreated:", err);
    }
  }

  async notifyTripCreated(tripId: number, driverId: string) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const msg =
        `🚗 *تم إنشاء رحلتك بنجاح*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n` +
        `👥 *المقاعد المتاحة:* ${trip.availableSeats}`;
      await this.sendNotification(driverId, "تم إنشاء الرحلة", msg, "trip_created");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyTripCreated:", err);
    }
  }

  async notifyAdminsTripCreated(tripId: number, driverId: string) {
    try {
      const trip = await storage.getTrip(tripId);
      const driver = await storage.getUser(driverId);
      const admins = await storage.getAdminUsers();
      if (!trip || !driver) return;

      const msg =
        `🚗 *رحلة جديدة من ${esc(driver.username)}*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n` +
        `👥 *المقاعد المتاحة:* ${trip.availableSeats}\n` +
        (trip.notes ? `📝 *ملاحظات:* ${esc(trip.notes)}\n` : "") +
        `\n*رقم الرحلة:* ${tripId}`;

      for (const admin of admins.filter((a) => a.id !== driverId)) {
        await this.sendNotification(admin.id, "رحلة جديدة تم إنشاؤها", msg, "admin_trip_created");
      }
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyAdminsTripCreated:", err);
    }
  }

  async notifyRideRequestReceived(driverId: string, requestId: number) {
    try {
      const request = await storage.getRideRequest(requestId);
      if (!request) return;
      const msg =
        `🚗 *طلب رحلة جديد*\n\n` +
        `📍 *من:* ${esc(request.fromLocation)}\n` +
        `📍 *إلى:* ${esc(request.toLocation)}`;
      await this.sendNotification(driverId, "طلب رحلة جديد", msg, "request_received");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyRideRequestReceived:", err);
    }
  }

  async notifyRequestAccepted(riderId: string, tripId: number) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const msg =
        `✅ *تم قبول طلب رحلتك*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n\n` +
        `الرجاء الإتصال مع السائق لتأكيد الوقت والمكان.`;
      await this.sendNotification(riderId, "تم قبول طلب الرحلة", msg, "request_accepted");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyRequestAccepted:", err);
    }
  }

  async notifyRequestDeclined(riderId: string) {
    try {
      const msg = `❌ *تم رفض طلب رحلتك*\n\nالرجاء تجربة رحلة أخرى.`;
      await this.sendNotification(riderId, "تم رفض طلب الرحلة", msg, "request_declined");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyRequestDeclined:", err);
    }
  }

  async notifyDriverRiderJoined(driverId: string, tripId: number, riderId: string, notes?: string) {
    try {
      const trip = await storage.getTrip(tripId);
      const rider = await storage.getUser(riderId);
      if (!trip || !rider) return;
      const msg =
        `👤 *راكب جديد انضم لرحلتك*\n\n` +
        `👤 *الراكب:* ${esc(rider.username)}\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n` +
        `👥 *المقاعد المتبقية:* ${trip.availableSeats - 1}\n` +
        (notes ? `📝 *ملاحظات:* ${esc(notes)}\n` : "") +
        `\n*رقم الرحلة:* ${tripId}`;
      await this.sendNotification(driverId, "راكب جديد انضم للرحلة", msg, "rider_joined");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyDriverRiderJoined:", err);
    }
  }

  async notifyTripMatchesRequest(userId: string, tripId: number) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const msg =
        `🔍 *رحلة متاحة تناسب طلبك*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n` +
        `👥 *المقاعد المتاحة:* ${trip.availableSeats}\n\n` +
        `افتح الموقع للانضمام إلى الرحلة.`;
      await this.sendNotification(userId, "رحلة متاحة تناسب طلبك", msg, "trip_match_found");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyTripMatchesRequest:", err);
    }
  }

  async notifyRidersTripUpdated(tripId: number) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const riderIds = trip.riders || [];
      if (riderIds.length === 0) return;

      const msg =
        `✏️ *تم تعديل تفاصيل الرحلة*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n` +
        `👥 *المقاعد المتاحة:* ${trip.availableSeats}\n\n` +
        `*رقم الرحلة:* ${tripId}`;

      for (const riderId of riderIds) {
        await this.sendNotification(riderId, "تم تحديث تفاصيل الرحلة", msg, "trip_updated");
      }
      console.log(`[TELEGRAM] Notified ${riderIds.length} rider(s) about updated trip ${tripId}`);
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyRidersTripUpdated:", err);
    }
  }

  async notifyRidersTripCancelled(tripId: number, riderIds: string[]) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const msg =
        `🚫 *تم إلغاء الرحلة*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *كان وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n\n` +
        `نعتذر عن الإزعاج. يرجى البحث عن رحلة بديلة.`;
      for (const riderId of riderIds) {
        await this.sendNotification(riderId, "تم إلغاء الرحلة", msg, "trip_cancelled");
      }
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyRidersTripCancelled:", err);
    }
  }

  async notifyJoinRequestApproved(riderId: string, tripId: number) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const msg =
        `✅ *تمت الموافقة على طلب انضمامك للرحلة*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n\n` +
        `الرجاء التواصل مع السائق لتأكيد التفاصيل.`;
      await this.sendNotification(riderId, "تمت الموافقة على طلب الانضمام", msg, "join_request_approved");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyJoinRequestApproved:", err);
    }
  }

  async notifyJoinRequestDeclined(riderId: string, tripId: number) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const msg =
        `❌ *تم رفض طلب انضمامك للرحلة*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n\n` +
        `يمكنك البحث عن رحلة أخرى أو إنشاء طلب جديد.`;
      await this.sendNotification(riderId, "تم رفض طلب الانضمام", msg, "join_request_declined");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyJoinRequestDeclined:", err);
    }
  }

  async notifyDriverJoinRequest(driverId: string, tripId: number, riderId: string, seatsRequested: number) {
    try {
      const trip = await storage.getTrip(tripId);
      const rider = await storage.getUser(riderId);
      if (!trip || !rider) return;
      const msg =
        `📨 *طلب انضمام جديد لرحلتك*\n\n` +
        `👤 *الراكب:* ${esc(rider.username)}\n` +
        `🪑 *المقاعد المطلوبة:* ${seatsRequested}\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n\n` +
        `افتح الموقع للموافقة أو الرفض.`;
      await this.sendNotification(driverId, "طلب انضمام جديد", msg, "join_request_received");
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyDriverJoinRequest:", err);
    }
  }

  async notifyReturnTripCreated(tripId: number, riderIds: string[]) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const msg =
        `🔄 *تم إنشاء رحلة العودة*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n` +
        `👥 *المقاعد المتاحة:* ${trip.availableSeats}`;
      for (const riderId of riderIds) {
        await this.sendNotification(riderId, "تم إنشاء رحلة العودة", msg, "return_trip_created");
      }
    } catch (err) {
      console.error("[TELEGRAM] Error in notifyReturnTripCreated:", err);
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const telegramService = new TelegramNotificationService();
