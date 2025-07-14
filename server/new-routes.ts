import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./new-auth";
import passport from "passport";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
const PgSession = ConnectPgSimple(session);
import {
  insertTripSchema,
  insertRideRequestSchema,
  insertTripParticipantSchema,
  insertTripJoinRequestSchema,
} from "@shared/schema";
import { z } from "zod";
import TelegramBot from "node-telegram-bot-api";
import {
  formatGMTPlus3,
  formatGMTPlus3TimeOnly,
  formatDateForInput,
} from "@shared/timezone";

// WebSocket connection management
const connectedClients = new Set();

function broadcastToAll(data: any) {
  const message = JSON.stringify(data);
  connectedClients.forEach((ws: any) => {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(message);
    }
  });
}

function setupWebSocket(server: Server) {
  
   const wss = new WebSocketServer({
    server: server,
    path: '/ws'});

  wss.on("connection", (ws) => {
    console.log("Client connected to real-time WebSocket");
    connectedClients.add(ws);

    ws.on("close", () => {
      console.log("Client disconnected from real-time WebSocket");
      connectedClients.delete(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      connectedClients.delete(ws);
    });
  });

  console.log(`Real-time WebSocket server attached to main HTTP server on path /ws`);
  return wss;
}

// Telegram notification service
class TelegramNotificationService {
  private bot: any;
  
  // Helper function to escape Markdown special characters
  private escapeMarkdown(text: string): string {
    return text.replace(/[[\]()~`>#+=|{}.!-]/g, '\\$&');
  }

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      try {
        this.bot = new TelegramBot(token, { polling: false });
        console.log("[TELEGRAM] Bot initialized successfully");
      } catch (error) {
        console.error("[TELEGRAM] Error initializing bot:", error);
        this.bot = null;
      }
    } else {
      console.log("[TELEGRAM] No bot token provided");
      this.bot = null;
    }
  }

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
  ) {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.telegramUsername) {
        console.log(`[TELEGRAM] No Telegram Username found for user ${userId}. User data:`, {
          id: user?.id,
          username: user?.username,
          telegramUsername: user?.telegramUsername
        });
        return;
      }

      if (!this.bot) {
        console.log("[TELEGRAM] Bot not available");
        return;
      }

      const telegramMessage = `*${title}*\n\n${message}`;
      
      console.log(`[TELEGRAM] Attempting to send message to user ${userId} (${user.telegramUsername})`);
      await this.bot.sendMessage(user.telegramUsername, telegramMessage, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });

      console.log(`[TELEGRAM] Notification sent successfully to user ${userId} (${user.telegramUsername})`);
    } catch (error) {
      console.error(
        `[TELEGRAM] Error sending notification to user ${userId}:`,
        error,
      );
    }
  }

  async notifyAdminsRideRequestCreated(requestId: number, riderId: string) {
    try {
      const request = await storage.getRideRequest(requestId);
      const rider = await storage.getUser(riderId);
      const admins = await storage.getAdminUsers();

      if (!request || !rider) return;

      const title = "طلب رحلة جديد";
      const message = `
🚗 *طلب رحلة جديد من ${this.escapeMarkdown(rider.username)}*

📍 *من:* ${this.escapeMarkdown(request.fromLocation)}
📍 *إلى:* ${this.escapeMarkdown(request.toLocation)}
🕐 *الوقت المفضل:* ${formatGMTPlus3TimeOnly(new Date(request.preferredTime))}
👥 *عدد الركاب:* ${request.passengerCount}
${request.notes ? `📝 *ملاحظات:* ${this.escapeMarkdown(request.notes)}` : ""}

*رقم الطلب:* ${requestId}
      `;

      // Filter out the rider from admin notifications to avoid duplicates if rider is also admin
      const adminsToNotify = admins.filter(admin => admin.id !== riderId);
      
      for (const admin of adminsToNotify) {
        await this.sendNotification(
          admin.id,
          title,
          message,
          "admin_ride_request_created",
        );
      }

      console.log(`[TELEGRAM] Notified ${adminsToNotify.length} admin(s) about new ride request ${requestId} (excluded rider from admin notifications)`);
    } catch (error) {
      console.error("Error notifying admins about ride request:", error);
    }
  }

  async notifyTripCreated(tripId: number, driverId: string) {
    try {
      const trip = await storage.getTrip(tripId);
      if (!trip) return;

      await this.sendNotification(
        driverId,
        "تم إنشاء الرحلة",
        `🚗 *تم إنشاء رحلتك بنجاح*\n\n📍 *من:* ${this.escapeMarkdown(trip.fromLocation)}\n📍 *إلى:* ${this.escapeMarkdown(trip.toLocation)}\n🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}\n👥 *المقاعد المتاحة:* ${trip.availableSeats}`,
        "trip_created",
      );
    } catch (error) {
      console.error("Error notifying trip creation:", error);
    }
  }

  async notifyAdminsTripCreated(tripId: number, driverId: string) {
    try {
      const trip = await storage.getTrip(tripId);
      const driver = await storage.getUser(driverId);
      const admins = await storage.getAdminUsers();

      if (!trip || !driver) return;

      console.log(`[TELEGRAM] Debug - Driver ID: ${driverId}, Admin IDs: ${admins.map(a => a.id).join(', ')}`);

      const title = "رحلة جديدة تم إنشاؤها";
      const message = `
🚗 *رحلة جديدة من ${this.escapeMarkdown(driver.username)}*

📍 *من:* ${this.escapeMarkdown(trip.fromLocation)}
📍 *إلى:* ${this.escapeMarkdown(trip.toLocation)}
🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}
👥 *المقاعد المتاحة:* ${trip.availableSeats}
${trip.notes ? `📝 *ملاحظات:* ${this.escapeMarkdown(trip.notes)}` : ""}

*رقم الرحلة:* ${tripId}
      `;

      // Filter out the driver from admin notifications to avoid duplicates
      const adminsToNotify = admins.filter(admin => admin.id !== driverId);
      
      console.log(`[TELEGRAM] Admins to notify after filtering: ${adminsToNotify.map(a => `${a.id}(${a.username})`).join(', ')}`);
      
      for (const admin of adminsToNotify) {
        await this.sendNotification(
          admin.id,
          title,
          message,
          "admin_trip_created",
        );
      }

      console.log(`[TELEGRAM] Notified ${adminsToNotify.length} admin(s) about new trip ${tripId} (excluded driver from admin notifications)`);
    } catch (error) {
      console.error("Error notifying admins about trip creation:", error);
    }
  }

  async notifyRideRequestReceived(driverId: string, requestId: number) {
    const request = await storage.getRideRequest(requestId);
    if (!request) return;

    await this.sendNotification(
      driverId,
      "New Ride Request",
      `You have a new ride request from ${request.fromLocation} to ${request.toLocation}.`,
      "request_received",
    );
  }

  async notifyRequestAccepted(riderId: string, tripId: number) {
    const trip = await storage.getTrip(tripId);
    if (!trip) return;

    await this.sendNotification(
      riderId,
      "Ride Request Accepted",
      `Your ride request has been accepted for the trip from ${trip.fromLocation} to ${trip.toLocation}.`,
      "request_accepted",
    );
  }

  async notifyDriverRiderJoined(driverId: string, tripId: number, riderId: string, notes?: string) {
    try {
      const trip = await storage.getTrip(tripId);
      const rider = await storage.getUser(riderId);
      
      if (!trip || !rider) return;

      const title = "راكب جديد انضم للرحلة";
      const message = `
🚗 *راكب جديد انضم لرحلتك*

👤 *الراكب:* ${this.escapeMarkdown(rider.username)}
📍 *من:* ${this.escapeMarkdown(trip.fromLocation)}
📍 *إلى:* ${this.escapeMarkdown(trip.toLocation)}
🕐 *وقت المغادرة:* ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}
👥 *المقاعد المتبقية:* ${trip.availableSeats - 1}
${notes ? `📝 *ملاحظات الراكب:* ${this.escapeMarkdown(notes)}` : ""}

*رقم الرحلة:* ${tripId}
      `;

      await this.sendNotification(
        driverId,
        title,
        message,
        "rider_joined",
      );

      console.log(`[TELEGRAM] Notified driver ${driverId} about new rider ${riderId} joining trip ${tripId}`);
    } catch (error) {
      console.error("Error notifying driver about rider joining:", error);
    }
  }

  async notifyRequestDeclined(riderId: string) {
    await this.sendNotification(
      riderId,
      "Ride Request Declined",
      "Your ride request has been declined. Please try another trip.",
      "request_declined",
    );
  }

  async notifyTripMatchesRequest(userId: string, tripId: number) {
    const trip = await storage.getTrip(tripId);
    if (!trip) return;

    const dashboardUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://localhost:5000"}/dashboard`;

    await this.sendNotification(
      userId,
      "New Trip Available",
      `A new trip matching your request is available from ${this.escapeMarkdown(trip.fromLocation)} to ${this.escapeMarkdown(trip.toLocation)} departing at ${formatGMTPlus3TimeOnly(new Date(trip.departureTime))}. Click here to join: ${dashboardUrl}`,
      "trip_match_found",
    );
  }
}

const telegramService = new TelegramNotificationService();

async function notifyMatchingRideRequesters(trip: any) {
  try {
    const requests = await storage.getPendingRideRequests();

    const matchingRequests = requests.filter((request) => {
      const fromMatch =
        request.fromLocation
          .toLowerCase()
          .includes(trip.fromLocation.toLowerCase()) ||
        trip.fromLocation
          .toLowerCase()
          .includes(request.fromLocation.toLowerCase());
      const toMatch =
        request.toLocation
          .toLowerCase()
          .includes(trip.toLocation.toLowerCase()) ||
        trip.toLocation
          .toLowerCase()
          .includes(request.toLocation.toLowerCase());

      const requestTime = new Date(request.preferredTime).getTime();
      const tripTime = new Date(trip.departureTime).getTime();
      const timeDiff = Math.abs(requestTime - tripTime);
      const twoHours = 2 * 60 * 60 * 1000;

      const hasSeats = trip.availableSeats >= (request.passengerCount || 1);

      return fromMatch && toMatch && timeDiff <= twoHours && hasSeats;
    });

    for (const request of matchingRequests) {
      await telegramService.notifyTripMatchesRequest(request.riderId, trip.id);
    }

    console.log(
      `Notified ${matchingRequests.length} users about the new trip matching their requests`,
    );
  } catch (error) {
    console.error("Error notifying matching ride requesters:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Setup session middleware
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "fallback-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      },
    }),
  );

  // Setup authentication
  await setupAuth(app);

  // Setup WebSocket
  setupWebSocket(server);

  
   // Authentication routes
  app.get("/api/auth/sections", async (req, res) => {
    try {
      const sections = await storage.getUniqueSections();
      res.json(sections);
    } catch (error) {
      console.error("Error fetching sections:", error);
      res.status(500).json({ message: "Failed to fetch sections" });
    }
  });

  app.get("/api/auth/users/:section", async (req, res) => {
    try {
      const { section } = req.params;
      const users = await storage.getUsersBySection(section);
      const usernames = users
        .map((user) => ({
          id: user.id,
          username: user.username,
        }))
        .sort((a, b) => a.username.localeCompare(b.username));
      res.json(usernames);
    } catch (error) {
      console.error("Error fetching users by section:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      // Also destroy the session to ensure complete logout
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error("Session destroy error:", sessionErr);
        }
        res.json({ success: true });
      });
    });
  });

  // Fallback logout endpoint for compatibility
  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      // Also destroy the session to ensure complete logout
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error("Session destroy error:", sessionErr);
        }
        res.json({ success: true });
      });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Update user profile
  app.patch("/api/users/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Allow updating phone number and Telegram username
      const { phoneNumber, telegramUsername } = req.body;

      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(userId, {
        phoneNumber: phoneNumber ?? existingUser.phoneNumber,
        telegramUsername: telegramUsername ?? existingUser.telegramUsername,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Trips routes
  app.get("/api/trips", async (req, res) => {
    try {
      const trips = await storage.getAllTrips();

      const tripsWithDetails = await Promise.all(
        trips.map(async (trip) => {
          // Get rider details from the riders array in the trip
          const riderDetails = await Promise.all(
            (trip.riders || []).map(async (riderId) => {
              const user = await storage.getUser(riderId);
              return user
                ? {
                    id: user.id,
                    username: user.username,
                    section: user.section,
                    role: user.role,
                    phoneNumber: user.phoneNumber,
                  }
                : null;
            }),
          );

          const driver = await storage.getUser(trip.driverId);

          return {
            ...trip,
            participantCount: trip.riders?.length || 0,
            riderDetails: riderDetails.filter(Boolean),
            driver: driver
              ? {
                  id: driver.id,
                  username: driver.username,
                  section: driver.section,
                  role: driver.role,
                  phoneNumber: driver.phoneNumber,
                }
              : null,
          };
        }),
      );

      res.json(tripsWithDetails);
    } catch (error) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/my", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const trips = await storage.getUserTrips(userId);

      const tripsWithDetails = await Promise.all(
        trips.map(async (trip) => {
          // Get rider details from the riders array in the trip
          const riderDetails = await Promise.all(
            (trip.riders || []).map(async (riderId) => {
              const user = await storage.getUser(riderId);
              return user
                ? {
                    id: user.id,
                    username: user.username,
                    section: user.section,
                    role: user.role,
                    phoneNumber: user.phoneNumber,
                  }
                : null;
            }),
          );

          const driver = await storage.getUser(trip.driverId);

          return {
            ...trip,
            participantCount: trip.riders?.length || 0,
            riderDetails: riderDetails.filter(Boolean),
            driver: driver
              ? {
                  id: driver.id,
                  username: driver.username,
                  section: driver.section,
                  role: driver.role,
                  phoneNumber: driver.phoneNumber,
                }
              : null,
          };
        }),
      );

      res.json(tripsWithDetails);
    } catch (error) {
      console.error("Error fetching user trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.post("/api/trips", isAuthenticated, async (req: any, res) => {
    try {
      const tripData = insertTripSchema.parse(req.body);

      console.log("Trip creation payload:", req.body);

      // Get current user to check if admin
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Admin can specify driver, regular users create trips for themselves
      const driverId = currentUser.role === "admin" && tripData.driverId 
        ? tripData.driverId 
        : req.user.id;

      const parsedTripData = {
        driverId,
        riders: tripData.riders || [],
        fromLocation: tripData.fromLocation,
        toLocation: tripData.toLocation,
        departureTime: new Date(tripData.departureTime),
        availableSeats: tripData.availableSeats,
        totalSeats: tripData.totalSeats || tripData.availableSeats,
        isRecurring: tripData.isRecurring || false,
        recurringDays: JSON.stringify(tripData.recurringDays || []),
        participantIds: tripData.participantIds || [],
      };

      console.log("Parsed trip data:", parsedTripData);

      const trip = await storage.createTrip(parsedTripData);

      // If admin pre-assigned participants, add them to the trip and update riders array
      if (currentUser.role === "admin" && tripData.participantIds && Array.isArray(tripData.participantIds)) {
        const riders = [];
        for (const participantId of tripData.participantIds) {
          await storage.addTripParticipant({
            tripId: trip.id,
            userId: participantId,
            status: "confirmed"
          });
          riders.push(participantId);
        }
        
        // Update trip with riders and recalculate available seats
        if (riders.length > 0) {
          await storage.updateTrip(trip.id, {
            riders,
            availableSeats: trip.totalSeats - riders.length
          });
        }
      }

      console.log(`[TELEGRAM] Sending trip creation notifications for trip ${trip.id}, driver ${trip.driverId}`);
      
      // Send driver notification
      await telegramService.notifyTripCreated(trip.id, trip.driverId);
      
      // Send admin notifications to other admins (excluding the driver)
      await telegramService.notifyAdminsTripCreated(trip.id, trip.driverId);
      await notifyMatchingRideRequesters(trip);

      broadcastToAll({
        type: "trip_created",
        trip: trip,
      });

      res.status(201).json(trip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid trip data",
          errors: error.errors,
        });
      }
      console.error("Error creating trip:", error);
      res.status(500).json({ message: "Failed to create trip" });
    }
  });

  // Continue with remaining routes...
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Add rider to trip (admin or driver)
  app.post("/api/trips/:id/riders", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const tripId = parseInt(id);
      const currentUserId = req.user.id;

      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const currentUser = await storage.getUser(currentUserId);

      // Check if user is admin or the driver of this trip
      if (currentUser?.role !== "admin" && trip.driverId !== currentUserId) {
        return res
          .status(403)
          .json({ message: "Only admins or the trip driver can add riders" });
      }

      const currentRiders = trip.riders || [];
      if (currentRiders.includes(userId)) {
        return res
          .status(400)
          .json({ message: "User is already a rider on this trip" });
      }



      const updatedRiders = [...currentRiders, userId];
      const updatedTrip = await storage.updateTrip(tripId, {
        riders: updatedRiders,
        availableSeats: trip.totalSeats - updatedRiders.length,
      });

      // Broadcast trip update to all connected clients
      broadcastToAll({
        type: "trip_updated",
        trip: updatedTrip,
      });

      res.json({ message: "Rider added successfully", trip: updatedTrip });
    } catch (error) {
      console.error("Error adding rider to trip:", error);
      res.status(500).json({ message: "Failed to add rider to trip" });
    }
  });

  // Remove rider from trip (admin, driver, or the rider themselves)
  app.delete("/api/trips/:id/riders/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const { id, userId } = req.params;
      const tripId = parseInt(id);
      const currentUserId = req.user.id;

      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const currentUser = await storage.getUser(currentUserId);

      // Allow removal if the requester is (1) an admin, (2) the trip driver, **or**
      // (3) the rider themselves trying to leave the trip.
      const isAdmin = currentUser?.role === "admin";
      const isDriver = trip.driverId === currentUserId;
      const isSelfRemoval = userId === currentUserId;

      if (!isAdmin && !isDriver && !isSelfRemoval) {
        return res
          .status(403)
          .json({ message: "Not authorized to remove this rider" });
      }

      const currentRiders = trip.riders || [];
      if (!currentRiders.includes(userId)) {
        return res
          .status(400)
          .json({ message: "User is not a rider on this trip" });
      }

      const updatedRiders = currentRiders.filter(id => id !== userId);
      const updatedTrip = await storage.updateTrip(tripId, {
        riders: updatedRiders,
        availableSeats: trip.totalSeats - updatedRiders.length,
      });

      // Clean up related records so the rider can re-join in the future
      try {
        // 1) Remove the rider from the trip participants table (if present)
        await storage.removeTripParticipant(tripId, userId);

        // 2) Delete any existing join-requests for this rider on this trip
        const joinRequests = await storage.getTripJoinRequests(tripId);
        for (const req of joinRequests) {
          if (req.riderId === userId) {
            await storage.deleteTripJoinRequest(req.id);
          }
        }
      } catch (cleanupError) {
        console.error("Error cleaning up participant/join-request records:", cleanupError);
      }

      // Broadcast trip update to all connected clients
      broadcastToAll({
        type: "trip_updated",
        trip: updatedTrip,
      });

      res.json({ message: "Rider removed successfully", trip: updatedTrip });
    } catch (error) {
      console.error("Error removing rider from trip:", error);
      res.status(500).json({ message: "Failed to remove rider from trip" });
    }
  });

  // Register API routes before any middleware that might interfere
  app.all("/api/ride-requests/all", (req, res, next) => {
    // Bypass any middleware for this specific route
    if (req.method === 'GET') {
      console.log("Intercepted ride requests API call");
      next();
    } else {
      next();
    }
  });

  // Ride request routes
  // Get all ride requests (accessible to all authenticated users)
  app.get("/api/ride-requests/all", async (req: any, res) => {
    console.log("=== RIDE REQUESTS API ROUTE HIT ===");
    console.log("Session:", req.session);
    console.log("User:", req.user);
    console.log("IsAuthenticated:", req.isAuthenticated?.());
    
    // Check authentication manually
    if (!req.isAuthenticated?.() && !req.session?.userId) {
      console.log("Authentication failed");
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    try {
      const requests = await storage.getTodayRideRequests();
      console.log("User authenticated:", req.session?.userId || req.user?.id);
      console.log("Found requests:", requests.length);

      // Enrich with rider info
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const rider = await storage.getUser(request.riderId);
          return {
            ...request,
            rider: rider
              ? {
                  id: rider.id,
                  username: rider.username,
                  section: rider.section,
                  role: rider.role,
                  phoneNumber: rider.phoneNumber,
                }
              : null,
          };
        }),
      );

      console.log("Returning", enrichedRequests.length, "enriched requests");
      
      // Ensure response is not cached and is proper JSON
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      return res.status(200).json(enrichedRequests);
    } catch (error: any) {
      console.error("Error fetching all ride requests:", error);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(500).json({ message: "Failed to fetch ride requests" });
    }
  });

  // POST route for creating ride requests
  app.post("/api/ride-requests", isAuthenticated, async (req: any, res) => {
    try {
      console.log("=== RIDE REQUEST CREATION ===");
      console.log("Request body:", req.body);
      console.log("Current user:", req.user);
      console.log("Session:", req.session);

      const userId = req.user.id;

      // For admins, allow specifying a different rider
      const riderId =
        req.user.role === "admin" && req.body.riderId
          ? req.body.riderId
          : userId;

      console.log("Using rider ID:", riderId);

      // Use the datetime as-is (already processed by client if needed)
      const requestData = insertRideRequestSchema.parse({
        ...req.body,
        riderId: riderId,
      });

      console.log("Parsed request data:", requestData);

      const request = await storage.createRideRequest(requestData);
      console.log("Created ride request:", request);

      // Find potential drivers and notify them
      const allTrips = await storage.getAllTrips();
      const matchingTrips = allTrips.filter((trip) => {
        const tripTime = new Date(trip.departureTime).getTime();
        const requestTime = new Date(request.preferredTime).getTime();
        const timeDiff = Math.abs(tripTime - requestTime);
        const twoHours = 2 * 60 * 60 * 1000;

        return (
          timeDiff <= twoHours && trip.availableSeats >= request.passengerCount
        );
      });

      console.log("Found matching trips:", matchingTrips.length);

      // Notify drivers
      for (const trip of matchingTrips) {
        try {
          await telegramService.notifyRideRequestReceived(
            trip.driverId,
            request.id,
          );
        } catch (notificationError) {
          console.error("Error sending notification:", notificationError);
        }
      }

      // Notify all admin users about the new ride request
      try {
        await telegramService.notifyAdminsRideRequestCreated(request.id, riderId);
      } catch (notificationError) {
        console.error("Error sending admin notification:", notificationError);
      }

      // Broadcast ride request creation to all connected clients
      broadcastToAll({
        type: "ride_request_created",
        data: request,
      });

      res.status(201).json(request);
    } catch (error) {
      console.error("=== RIDE REQUEST CREATION ERROR ===");
      console.error("Error details:", error);
      
      if (error instanceof z.ZodError) {
        console.error("Zod validation errors:", error.errors);
        return res
          .status(400)
          .json({ message: "Invalid input", errors: error.errors });
      }
      
      res.status(500).json({ message: "Failed to create ride request" });
    }
  });

  // Delete trip endpoint
  app.delete("/api/trips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tripId = parseInt(id);
      const userId = req.user.id;

      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      // Check if user is the trip owner or admin
      const user = await storage.getUser(userId);
      if (trip.driverId !== userId && user?.role !== "admin") {
        return res.status(403).json({ message: "You can only delete your own trips" });
      }

      await storage.deleteTrip(tripId);

      // Broadcast trip deletion to all connected clients
      broadcastToAll({
        type: "trip_deleted",
        tripId: tripId,
      });

      res.status(200).json({ message: "Trip deleted successfully" });
    } catch (error) {
      console.error("Error deleting trip:", error);
      res.status(500).json({ message: "Failed to delete trip" });
    }
  });

  // Trip join request routes
  // Create a join request for a specific trip (auto-approved)
  app.post(
    "/api/trips/:id/join-requests",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tripId = parseInt(id);
        const { seatsRequested, message } = req.body;
        const riderId = req.user.id;

        const trip = await storage.getTrip(tripId);
        if (!trip) {
          return res.status(404).json({ message: "Trip not found" });
        }

        // Check if user is the driver
        if (trip.driverId === riderId) {
          return res
            .status(400)
            .json({ message: "You cannot request to join your own trip" });
        }

        // Check if user is already a rider
        const currentRiders = trip.riders || [];
        if (currentRiders.includes(riderId)) {
          return res
            .status(400)
            .json({ message: "You are already a rider on this trip" });
        }

        // Check if user has already requested to join
        const existingRequests = await storage.getTripJoinRequests(tripId);
        const userHasRequest = existingRequests.some(
          (req) => req.riderId === riderId,
        );
        if (userHasRequest) {
          return res
            .status(400)
            .json({ message: "You have already requested to join this trip" });
        }

        // Allow joining regardless of available seats
        const requestedSeats = seatsRequested || 1;

        // Create join request with approved status
        const joinRequestData = insertTripJoinRequestSchema.parse({
          tripId,
          riderId,
          seatsRequested: requestedSeats,
          message,
          status: "approved",
        });

        const joinRequest =
          await storage.createTripJoinRequest(joinRequestData);

        // Automatically add rider to trip
        const updatedRiders = [...currentRiders, riderId];
        const updatedTrip = await storage.updateTrip(tripId, {
          riders: updatedRiders,
          availableSeats: trip.totalSeats - updatedRiders.length,
        });

        // Add trip participant record
        await storage.addTripParticipant({
          tripId,
          userId: riderId,
          seatsBooked: requestedSeats,
        });

        // Notify driver about the new rider
        const driver = await storage.getUser(trip.driverId);
        const requester = await storage.getUser(riderId);

        if (driver && requester) {
          await storage.createNotification({
            userId: driver.id,
            title: "راكب جديد انضم للرحلة",
            message: `${requester.username} انضم إلى رحلتك من ${trip.fromLocation} إلى ${trip.toLocation}`,
            type: "rider_joined",
          });

          // Notify rider about successful join
          await storage.createNotification({
            userId: riderId,
            title: "تم الانضمام للرحلة بنجاح",
            message: `تم قبولك في الرحلة من ${trip.fromLocation} إلى ${trip.toLocation}`,
            type: "join_approved",
          });

          // Send Telegram notifications if available
          try {
            await telegramService.notifyRequestAccepted(riderId, tripId);
            // Notify driver about the new rider joining
            await telegramService.notifyDriverRiderJoined(trip.driverId, tripId, riderId, message);
          } catch (notificationError) {
            console.error("Error sending Telegram notification:", notificationError);
          }

          // Broadcast notification
          broadcastToAll({
            type: "rider_joined",
            data: { joinRequest, trip: updatedTrip, rider: requester },
          });

          // Remove rider's pending ride requests once they are assigned to a trip
          try {
            const riderRequests = await storage.getUserRideRequests(riderId);
            const pendingRequests = riderRequests.filter((r) => r.status === "pending");
            for (const pending of pendingRequests) {
              await storage.updateRideRequestStatus(pending.id, "accepted", tripId);

              // Broadcast the update so all clients refresh their lists
              broadcastToAll({
                type: "ride_request_updated",
                data: { id: pending.id, status: "accepted", tripId },
              });
            }
          } catch (updateError) {
            console.error("Error updating rider's pending ride requests:", updateError);
          }
        }

        res.json({
          ...joinRequest,
          trip: updatedTrip,
        });
      } catch (error) {
        console.error("Error creating trip join request:", error);
        
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid input", errors: error.errors });
        }
        
        res.status(500).json({ message: "Failed to create join request" });
      }
    },
  );

  // Assignment route for admins to assign ride requests to trips
  app.patch("/api/ride-requests/:id/assign-to-trip", isAuthenticated, async (req: any, res) => {
    console.log("ASSIGNMENT API TRIGGERED");
    console.log("Request ID:", req.params.id);
    console.log("Body:", req.body);
    console.log("User:", req.user);
    
    try {
      const requestId = parseInt(req.params.id);
      const { tripId } = req.body;
      
      if (!requestId || !tripId) {
        return res.status(400).json({ success: false, message: "Missing request ID or trip ID" });
      }
      
      // Get the ride request and trip
      const request = await storage.getRideRequest(requestId);
      const trip = await storage.getTrip(tripId);
      
      if (!request) {
        return res.status(404).json({ success: false, message: "Ride request not found" });
      }
      
      if (!trip) {
        return res.status(404).json({ success: false, message: "Trip not found" });
      }
      
      if (request.status !== "pending") {
        return res.status(400).json({ success: false, message: "Request is not pending" });
      }
      

      
      console.log("Updating request status...");
      // Update the ride request status and assign it to the trip
      await storage.updateRideRequestStatus(requestId, "accepted", tripId);
      
      console.log("Getting updated trip data...");
      // Get current trip data to update riders array
      const currentTrip = await storage.getTrip(tripId);
      if (!currentTrip) {
        throw new Error("Trip not found after request update");
      }
      
      console.log("Updating trip with new rider...");
      // Update trip riders array and available seats
      const currentRiders = currentTrip.riders || [];
      const newRiders = [...currentRiders, request.riderId];
      
      await storage.updateTrip(tripId, {
        riders: newRiders,
        availableSeats: currentTrip.availableSeats - 1
      });
      
      console.log("Assignment completed successfully");

      // After successful assignment, mark any other pending ride requests by this rider as accepted
      try {
        const riderPending = await storage.getUserRideRequests(request.riderId);
        const otherPending = riderPending.filter((r) => r.status === "pending" && r.id !== requestId);
        for (const pending of otherPending) {
          await storage.updateRideRequestStatus(pending.id, "accepted", tripId);
          broadcastToAll({
            type: "ride_request_updated",
            data: { id: pending.id, status: "accepted", tripId },
          });
        }
      } catch (err) {
        console.error("Error updating rider's other pending requests:", err);
      }

      // Send notifications
      try {
        await telegramService.notifyRequestAccepted(request.riderId, tripId);
        // Notify driver about the new rider assignment
        await telegramService.notifyDriverRiderJoined(trip.driverId, tripId, request.riderId);
      } catch (notificationError) {
        console.error("Error sending notification:", notificationError);
      }
      
      // Broadcast the assignment to all connected clients
      broadcastToAll({
        type: "request_assigned",
        data: { requestId, tripId, riderId: request.riderId }
      });
      
      res.json({ 
        success: true, 
        message: "تم تعيين الطلب للرحلة بنجاح" 
      });
      
    } catch (error: any) {
      console.error("Assignment error:", error);
      console.error("Error details:", error.message);
      res.status(500).json({ 
        success: false, 
        message: `فشل في تعيين الطلب للرحلة: ${error.message}` 
      });
    }
  });

  return server;
}
