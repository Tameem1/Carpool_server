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
    port: 5001,
    host: "0.0.0.0",
  });

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

  console.log("Real-time WebSocket server running on port 5001");
  return wss;
}

// Telegram notification service
class TelegramNotificationService {
  private bot: any;

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
      if (!user || !user.telegramId) {
        console.log(`[TELEGRAM] No Telegram ID found for user ${userId}`);
        return;
      }

      if (!this.bot) {
        console.log("[TELEGRAM] Bot not available");
        return;
      }

      const telegramMessage = `*${title}*\n\n${message}`;

      await this.bot.sendMessage(user.telegramId, telegramMessage, {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });

      console.log(`[TELEGRAM] Notification sent to user ${userId}`);
    } catch (error) {
      console.error(
        `[TELEGRAM] Error sending notification to user ${userId}:`,
        error,
      );
    }
  }

  async notifyAdminsRideRequestCreated(requestId: number, riderId: string) {
    try {
      const admins = await storage.getAdminUsers();

      for (const admin of admins) {
        await this.sendNotification(
          admin.id,
          "New Ride Request",
          `A new ride request has been submitted by user ${riderId}.`,
          "ride_request_created",
        );
      }
    } catch (error) {
      console.error("Error notifying admins about ride request:", error);
    }
  }

  async notifyTripCreated(tripId: number, driverId: string) {
    try {
      await this.sendNotification(
        driverId,
        "Trip Created",
        `Your trip has been successfully created with ID ${tripId}.`,
        "trip_created",
      );
    } catch (error) {
      console.error("Error notifying trip creation:", error);
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
      `A new trip matching your request is available from ${trip.fromLocation} to ${trip.toLocation} departing at ${new Date(trip.departureTime).toLocaleString()}. Click here to join: ${dashboardUrl}`,
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

      const requestTime = new Date(request.departureTime).getTime();
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
      const { phoneNumber, telegramId } = req.body;

      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(userId, {
        phoneNumber: phoneNumber || existingUser.phoneNumber,
        telegramId: telegramId || existingUser.telegramId,
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
          const participants = await storage.getTripParticipants(trip.id);
          const riderDetails = await Promise.all(
            participants.map(async (p) => {
              const user = await storage.getUser(p.userId);
              return user
                ? {
                    id: user.id,
                    username: user.username,
                    section: user.section,
                    role: user.role,
                  }
                : null;
            }),
          );

          const driver = await storage.getUser(trip.driverId);

          return {
            ...trip,
            participantCount: participants.length,
            riderDetails: riderDetails.filter(Boolean),
            driver: driver
              ? {
                  id: driver.id,
                  username: driver.username,
                  section: driver.section,
                  role: driver.role,
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
          const participants = await storage.getTripParticipants(trip.id);
          const riderDetails = await Promise.all(
            participants.map(async (p) => {
              const user = await storage.getUser(p.userId);
              return user
                ? {
                    id: user.id,
                    username: user.username,
                    section: user.section,
                    role: user.role,
                  }
                : null;
            }),
          );

          const driver = await storage.getUser(trip.driverId);

          return {
            ...trip,
            participantCount: participants.length,
            riderDetails: riderDetails.filter(Boolean),
            driver: driver
              ? {
                  id: driver.id,
                  username: driver.username,
                  section: driver.section,
                  role: driver.role,
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

      const parsedTripData = {
        driverId: req.user.id,
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

      await telegramService.notifyTripCreated(trip.id, trip.driverId);
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

      if (currentRiders.length >= trip.totalSeats) {
        return res.status(400).json({ message: "Trip is full" });
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

  // Remove rider from trip (admin or driver)
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

      // Check if user is admin or the driver of this trip
      if (currentUser?.role !== "admin" && trip.driverId !== currentUserId) {
        return res
          .status(403)
          .json({ message: "Only admins or the trip driver can remove riders" });
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

  return server;
}
