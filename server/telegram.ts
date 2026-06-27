import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { formatGMTPlus3TimeOnly } from "@shared/timezone";

// ─── Verification code store ─────────────────────────────────────────────────
// In-memory map: code → { userId, expires }
// 10-minute TTL, one active code per user at a time.

const CODE_TTL_MS = 10 * 60 * 1000;

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
    if (data.userId === userId) {
      pendingCodes.delete(code);
      console.log(`[TELEGRAM] Invalidated old code for user ${userId}`);
    }
  }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  pendingCodes.set(code, { userId, expires: new Date(Date.now() + CODE_TTL_MS) });
  console.log(`[TELEGRAM] Code generated for user ${userId}: ${code} (expires in 10 min, total pending: ${pendingCodes.size})`);
  return code;
}

function consumeCode(raw: string): string | null {
  pruneExpiredCodes();
  const code = raw.trim().toUpperCase();
  const entry = pendingCodes.get(code);
  if (!entry) {
    console.log(`[TELEGRAM] Code lookup failed: "${code}" not found. Pending codes: [${Array.from(pendingCodes.keys()).join(", ")}]`);
    return null;
  }
  pendingCodes.delete(code);
  console.log(`[TELEGRAM] Code "${code}" consumed for userId=${entry.userId}`);
  return entry.userId;
}

// ─── Markdown escaping ────────────────────────────────────────────────────────

function esc(text: string): string {
  return text.replace(/[[\]()~`>#+=|{}.!-]/g, "\\$&");
}

// ─── TelegramNotificationService ─────────────────────────────────────────────

class TelegramNotificationService {
  private bot: TelegramBot | null = null;
  private initialized = false;
  private botUsername: string | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initialized) return;
    this.initialized = true;

    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      console.warn("[TELEGRAM] ⚠️  TELEGRAM_BOT_TOKEN is not set — bot disabled, notifications will be skipped");
      return;
    }

    console.log(`[TELEGRAM] Token found (length=${token.length}) — initializing bot...`);

    try {
      this.bot = new TelegramBot(token, { polling: true });

      // Verify the token works by calling getMe
      const me = await this.bot.getMe();
      this.botUsername = me.username ?? null;
      console.log(`[TELEGRAM] ✅ Bot initialized: @${me.username} (id=${me.id})`);
      console.log(`[TELEGRAM] Polling started — listening for updates`);

      this.registerCommands();
    } catch (err: any) {
      console.error("[TELEGRAM] ❌ Failed to initialize bot:", err?.message ?? err);
      if (err?.response?.statusCode === 401) {
        console.error("[TELEGRAM] Invalid bot token — check TELEGRAM_BOT_TOKEN");
      }
      this.bot = null;
    }
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────────

  getStatus() {
    return {
      botEnabled: !!this.bot,
      botUsername: this.botUsername,
      tokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      pendingCodes: pendingCodes.size,
    };
  }

  // ─── Bot command handlers ─────────────────────────────────────────────────

  private registerCommands() {
    if (!this.bot) return;

    // /start [code]
    this.bot.onText(/^\/start(.*)$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const username = msg.from?.username ?? null;
      const userId = msg.from?.id;
      const arg = (match?.[1] ?? "").trim();

      console.log(`[TELEGRAM] /start received — chatId=${chatId}, username=@${username}, userId=${userId}, arg="${arg}"`);

      if (arg) {
        await this.handleCodeSubmission(chatId, username, arg);
      } else {
        try {
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
          console.log(`[TELEGRAM] Welcome message sent to chatId=${chatId}`);
        } catch (err: any) {
          console.error(`[TELEGRAM] Failed to send welcome to chatId=${chatId}:`, err?.message);
        }
      }
    });

    // /help
    this.bot.onText(/^\/help$/, async (msg) => {
      const chatId = msg.chat.id;
      console.log(`[TELEGRAM] /help from chatId=${chatId}`);
      try {
        await this.bot!.sendMessage(
          chatId,
          `📖 *المساعدة*\n\n` +
          `/start \\- بدء البوت\n` +
          `/status \\- عرض حالة ربط حسابك\n` +
          `/unlink \\- إلغاء ربط حسابك\n\n` +
          `لربط حسابك، احصل على كود من صفحة الإعدادات في الموقع وأرسله هنا\\.`,
          { parse_mode: "MarkdownV2" },
        );
      } catch (err: any) {
        console.error(`[TELEGRAM] /help reply failed for chatId=${chatId}:`, err?.message);
      }
    });

    // /status
    this.bot.onText(/^\/status$/, async (msg) => {
      const chatId = msg.chat.id;
      console.log(`[TELEGRAM] /status from chatId=${chatId}`);
      try {
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
      } catch (err: any) {
        console.error(`[TELEGRAM] /status reply failed for chatId=${chatId}:`, err?.message);
      }
    });

    // /unlink
    this.bot.onText(/^\/unlink$/, async (msg) => {
      const chatId = msg.chat.id;
      console.log(`[TELEGRAM] /unlink from chatId=${chatId}`);
      try {
        const linked = await this.findUserByChatId(chatId);
        if (!linked) {
          await this.bot!.sendMessage(chatId, "❌ لا يوجد حساب مرتبط بهذا الحساب على تيليغرام.");
          return;
        }
        await storage.updateUser(linked.id, { telegramId: null, telegramUsername: null });
        console.log(`[TELEGRAM] User unlinked via /unlink: userId=${linked.id} (${linked.username}), chatId=${chatId}`);
        await this.bot!.sendMessage(
          chatId,
          `✅ تم إلغاء ربط حسابك *${esc(linked.username)}* بنجاح\\.`,
          { parse_mode: "MarkdownV2" },
        );
      } catch (err: any) {
        console.error(`[TELEGRAM] /unlink failed for chatId=${chatId}:`, err?.message);
      }
    });

    // Plain text → treat as verification code
    this.bot.on("message", async (msg) => {
      if (!msg.text) return;
      if (msg.text.startsWith("/")) return;
      const chatId = msg.chat.id;
      const username = msg.from?.username ?? null;
      console.log(`[TELEGRAM] Text message from chatId=${chatId}: "${msg.text}"`);
      await this.handleCodeSubmission(chatId, username, msg.text.trim());
    });

    this.bot.on("polling_error", (err) => {
      console.error("[TELEGRAM] ❌ Polling error:", err.message ?? err);
    });

    console.log("[TELEGRAM] All command handlers registered");
  }

  // ─── Code submission ──────────────────────────────────────────────────────

  private async handleCodeSubmission(chatId: number, telegramUsername: string | null, rawCode: string) {
    console.log(`[TELEGRAM] Code submission: chatId=${chatId}, username=@${telegramUsername}, code="${rawCode}"`);

    const userId = consumeCode(rawCode);
    if (!userId) {
      console.log(`[TELEGRAM] Invalid or expired code "${rawCode}" from chatId=${chatId}`);
      try {
        await this.bot!.sendMessage(
          chatId,
          "❌ الكود غير صحيح أو انتهت صلاحيته\\.\n\nاحصل على كود جديد من صفحة الملف الشخصي في الموقع\\.",
          { parse_mode: "MarkdownV2" },
        );
      } catch (err: any) {
        console.error(`[TELEGRAM] Failed to send invalid-code reply to chatId=${chatId}:`, err?.message);
      }
      return;
    }

    // Unlink any other account that currently uses this chatId
    const existing = await this.findUserByChatId(chatId);
    if (existing && existing.id !== userId) {
      console.log(`[TELEGRAM] chatId=${chatId} was linked to userId=${existing.id} — unlinking first`);
      await storage.updateUser(existing.id, { telegramId: null, telegramUsername: null });
    }

    // Link the new account
    await storage.updateUser(userId, {
      telegramId: String(chatId),
      telegramUsername: telegramUsername ?? null,
    });

    const user = await storage.getUser(userId);
    console.log(`[TELEGRAM] ✅ Account linked: userId=${userId} (${user?.username}) ↔ chatId=${chatId} (@${telegramUsername})`);

    try {
      await this.bot!.sendMessage(
        chatId,
        `✅ *تم ربط حسابك بنجاح\\!*\n\nاسم المستخدم: *${esc(user?.username ?? "")}*\nستصلك الآن إشعارات الرحلات على تيليغرام\\.`,
        { parse_mode: "MarkdownV2" },
      );
      console.log(`[TELEGRAM] Confirmation message sent to chatId=${chatId}`);
    } catch (err: any) {
      console.error(`[TELEGRAM] Failed to send confirmation to chatId=${chatId}:`, err?.message);
    }
  }

  // ─── Public helpers ───────────────────────────────────────────────────────

  generateVerificationCode(userId: string): string {
    return generateCode(userId);
  }

  async findUserByChatId(chatId: number): Promise<{ id: string; username: string; section: string } | null> {
    const allUsers = await storage.getAllUsers();
    const user = allUsers.find((u) => u.telegramId === String(chatId));
    return user ? { id: user.id, username: user.username, section: user.section } : null;
  }

  // ─── Notification delivery ────────────────────────────────────────────────

  async sendNotification(userId: string, title: string, message: string, type: string) {
    console.log(`[TELEGRAM] Queuing notification (${type}) for userId=${userId}`);

    if (!this.bot) {
      console.warn(`[TELEGRAM] Bot not initialized — skipping notification (${type}) for userId=${userId}`);
      return;
    }

    let user;
    try {
      user = await storage.getUser(userId);
    } catch (err: any) {
      console.error(`[TELEGRAM] Failed to fetch user ${userId}:`, err?.message);
      return;
    }

    if (!user?.telegramId) {
      console.log(`[TELEGRAM] userId=${userId} has no linked Telegram — skipping (${type})`);
      return;
    }

    const chatId = parseInt(user.telegramId, 10);
    if (isNaN(chatId)) {
      console.error(`[TELEGRAM] Invalid telegramId="${user.telegramId}" for userId=${userId}`);
      return;
    }

    console.log(`[TELEGRAM] Sending (${type}) to userId=${userId}, chatId=${chatId}`);

    try {
      await this.bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
      console.log(`[TELEGRAM] ✅ Notification sent (${type}) to userId=${userId}, chatId=${chatId}`);
    } catch (err: any) {
      const status = err?.response?.statusCode;
      const errBody = err?.response?.body;
      console.error(`[TELEGRAM] ❌ Failed to send (${type}) to chatId=${chatId}: HTTP ${status}`, errBody ?? err?.message);

      if (status === 403) {
        console.warn(`[TELEGRAM] User blocked the bot — unlinking userId=${userId}`);
        await storage.updateUser(userId, { telegramId: null }).catch(() => {});
      } else if (status === 400) {
        console.warn(`[TELEGRAM] Bad request — chatId=${chatId} may be invalid`);
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

      const targets = admins.filter((a) => a.id !== riderId);
      console.log(`[TELEGRAM] Notifying ${targets.length} admin(s) about ride request #${requestId}`);
      for (const admin of targets) {
        await this.sendNotification(admin.id, "طلب رحلة جديد", msg, "admin_ride_request_created");
      }
    } catch (err) {
      console.error("[TELEGRAM] notifyAdminsRideRequestCreated error:", err);
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
      console.error("[TELEGRAM] notifyTripCreated error:", err);
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

      const targets = admins.filter((a) => a.id !== driverId);
      console.log(`[TELEGRAM] Notifying ${targets.length} admin(s) about new trip #${tripId}`);
      for (const admin of targets) {
        await this.sendNotification(admin.id, "رحلة جديدة تم إنشاؤها", msg, "admin_trip_created");
      }
    } catch (err) {
      console.error("[TELEGRAM] notifyAdminsTripCreated error:", err);
    }
  }

  async notifyRideRequestReceived(driverId: string, requestId: number) {
    try {
      const request = await storage.getRideRequest(requestId);
      if (!request) return;
      const msg =
        `📨 *طلب رحلة جديد*\n\n` +
        `📍 *من:* ${esc(request.fromLocation)}\n` +
        `📍 *إلى:* ${esc(request.toLocation)}`;
      await this.sendNotification(driverId, "طلب رحلة جديد", msg, "request_received");
    } catch (err) {
      console.error("[TELEGRAM] notifyRideRequestReceived error:", err);
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
      console.error("[TELEGRAM] notifyRequestAccepted error:", err);
    }
  }

  async notifyRequestDeclined(riderId: string) {
    try {
      const msg = `❌ *تم رفض طلب رحلتك*\n\nالرجاء تجربة رحلة أخرى.`;
      await this.sendNotification(riderId, "تم رفض طلب الرحلة", msg, "request_declined");
    } catch (err) {
      console.error("[TELEGRAM] notifyRequestDeclined error:", err);
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
      console.error("[TELEGRAM] notifyDriverRiderJoined error:", err);
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
      console.error("[TELEGRAM] notifyTripMatchesRequest error:", err);
    }
  }

  async notifyRidersTripUpdated(tripId: number) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;
      const riderIds = trip.riders || [];
      if (riderIds.length === 0) {
        console.log(`[TELEGRAM] No riders to notify for trip #${tripId}`);
        return;
      }
      const msg =
        `✏️ *تم تعديل تفاصيل الرحلة*\n\n` +
        `📍 *من:* ${esc(trip.fromLocation)}\n` +
        `📍 *إلى:* ${esc(trip.toLocation)}\n` +
        `🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n` +
        `👥 *المقاعد المتاحة:* ${trip.availableSeats}\n\n` +
        `*رقم الرحلة:* ${tripId}`;
      console.log(`[TELEGRAM] Notifying ${riderIds.length} rider(s) about updated trip #${tripId}`);
      for (const riderId of riderIds) {
        await this.sendNotification(riderId, "تم تحديث تفاصيل الرحلة", msg, "trip_updated");
      }
    } catch (err) {
      console.error("[TELEGRAM] notifyRidersTripUpdated error:", err);
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
      console.log(`[TELEGRAM] Notifying ${riderIds.length} rider(s) about cancelled trip #${tripId}`);
      for (const riderId of riderIds) {
        await this.sendNotification(riderId, "تم إلغاء الرحلة", msg, "trip_cancelled");
      }
    } catch (err) {
      console.error("[TELEGRAM] notifyRidersTripCancelled error:", err);
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
      console.error("[TELEGRAM] notifyJoinRequestApproved error:", err);
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
      console.error("[TELEGRAM] notifyJoinRequestDeclined error:", err);
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
      console.error("[TELEGRAM] notifyDriverJoinRequest error:", err);
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
      console.log(`[TELEGRAM] Notifying ${riderIds.length} rider(s) about return trip #${tripId}`);
      for (const riderId of riderIds) {
        await this.sendNotification(riderId, "تم إنشاء رحلة العودة", msg, "return_trip_created");
      }
    } catch (err) {
      console.error("[TELEGRAM] notifyReturnTripCreated error:", err);
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const telegramService = new TelegramNotificationService();
