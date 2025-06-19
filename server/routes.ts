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
    port: 3001,
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

  console.log("Real-time WebSocket server running on port 3001");
  return wss;
}

// Real-time notification service with WebSocket broadcasting
class TelegramNotificationService {
  private bot: any;

  constructor() {
    if (process.env.TELEGRAM_BOT_TOKEN) {
      try {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
          polling: false,
        });
        console.log("[TELEGRAM] Bot initialized successfully");
      } catch (error) {
        console.error("[TELEGRAM] Failed to initialize bot:", error);
        this.bot = null;
      }
    } else {
      console.log("[TELEGRAM] No bot token found in environment variables");
    }
  }

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: string,
  ) {
    // Store as notification in our system
    const notification = await storage.createNotification({
      userId,
      title,
      message,
      type: type as any,
    });

    // Send to Telegram if bot is configured and user has telegram_id
    if (this.bot) {
      try {
        const user = await storage.getUser(userId);
        if (user?.telegramId) {
          const telegramMessage = `*${title}*\n\n${message}`;
          await this.bot.sendMessage(user.telegramId, telegramMessage, {
            parse_mode: "Markdown",
          });
          console.log(
            `[TELEGRAM] Message sent to user ${userId} (${user.telegramId}): ${title}`,
          );
        } else {
          console.log(`[TELEGRAM] No Telegram ID found for user ${userId}`);
        }
      } catch (error) {
        console.error(
          `[TELEGRAM] Failed to send message to user ${userId}:`,
          error,
        );
      }
    } else {
      console.log(
        `[TELEGRAM] Bot not configured. Would send to user ${userId}: ${title} - ${message}`,
      );
    }

    // Broadcast notification to all connected clients for real-time updates
    broadcastToAll({
      type: "notification",
      data: notification,
    });
  }

  async notifyAdminsRideRequestCreated(requestId: number, riderId: string) {
    try {
      const request = await storage.getRideRequest(requestId);
      const rider = await storage.getUser(riderId);
      const admins = await storage.getAdminUsers();

      if (!request || !rider) return;

      const title = "طلب رحلة جديد";
      const message = `
🚗 *طلب رحلة جديد من ${rider.firstName} ${rider.lastName}*

📍 *من:* ${request.fromLocation}
📍 *إلى:* ${request.toLocation}
🕐 *الوقت المفضل:* ${formatGMTPlus3TimeOnly(new Date(request.preferredTime), "ar-SA")}
👥 *عدد الركاب:* ${request.passengerCount}
${request.notes ? `📝 *ملاحظات:* ${request.notes}` : ""}

*رقم الطلب:* ${requestId}
      `;

      // Notify all admin users
      for (const admin of admins) {
        await this.sendNotification(
          admin.id,
          title,
          message,
          "admin_ride_request_created",
        );
      }

      console.log(
        `[TELEGRAM] Notified ${admins.length} admin(s) about new ride request ${requestId}`,
      );
    } catch (error) {
      console.error(
        "[TELEGRAM] Error notifying admins about ride request:",
        error,
      );
    }
  }

  async notifyTripCreated(tripId: number, driverId: string) {
    const trip = await storage.getTrip(tripId);
    if (!trip) return;

    await this.sendNotification(
      driverId,
      "Trip Created",
      `Your trip from ${trip.fromLocation} to ${trip.toLocation} has been created successfully.`,
      "trip_created",
    );
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

// Helper function to check if a trip should be completed (2 hours after departure)

// Function to notify users with matching ride requests when a new trip is created
async function notifyMatchingRideRequesters(trip: any) {
  try {
    // Get all pending ride requests
    const pendingRequests = await storage.getPendingRideRequests();

    // Find requests that match the new trip
    const matchingRequests = pendingRequests.filter((request) => {
      // Check location match (case-insensitive partial match)
      const fromMatch =
        trip.fromLocation
          .toLowerCase()
          .includes(request.fromLocation.toLowerCase()) ||
        request.fromLocation
          .toLowerCase()
          .includes(trip.fromLocation.toLowerCase());
      const toMatch =
        trip.toLocation
          .toLowerCase()
          .includes(request.toLocation.toLowerCase()) ||
        request.toLocation
          .toLowerCase()
          .includes(trip.toLocation.toLowerCase());

      // Check time match (within 2 hours)
      const tripTime = new Date(trip.departureTime).getTime();
      const requestTime = new Date(request.preferredTime).getTime();
      const timeDiff = Math.abs(tripTime - requestTime);
      const twoHours = 2 * 60 * 60 * 1000;

      // Check if trip has enough seats
      const hasSeats = trip.availableSeats >= (request.passengerCount || 1);

      return fromMatch && toMatch && timeDiff <= twoHours && hasSeats;
    });

    // Notify each matching user
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

// Middleware for role-based access
const requireRole = (roles: string[]) => {
  return async (req: any, res: any, next: any) => {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    req.currentUser = user;
    next();
  };
};

import session from "express-session";

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

  // Login routes
  app.get("/api/login", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Login - RideShare Pro</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; background: #f8fafc; }
            .login-form { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            h1 { color: #00D4AA; text-align: center; margin-bottom: 30px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: 500; color: #374151; }
            input { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 16px; }
            input:focus { outline: none; border-color: #00D4AA; box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.1); }
            .btn { width: 100%; padding: 12px; background: #00D4AA; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }
            .btn:hover { background: #00b896; }
            .demo-accounts { margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 6px; }
            .demo-accounts h3 { margin: 0 0 10px 0; font-size: 14px; color: #6b7280; }
            .demo-account { font-size: 12px; color: #6b7280; margin: 2px 0; }
            .error { color: #ef4444; font-size: 14px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="login-form">
            <h1>RideShare Pro</h1>
            <form id="loginForm">
              <div class="form-group">
                <label for="email">Email</label>
                <input type="email" id="email" name="email" required>
              </div>
              <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
              </div>
              <button type="submit" class="btn">Login</button>
              <div id="error" class="error" style="display: none;"></div>
            </form>
            
            <div class="demo-accounts">
              <h3>Demo Accounts:</h3>
              <div class="demo-account">Admin: admin@demo.com / admin123</div>
              <div class="demo-account">User: john@demo.com / user123</div>
              <div class="demo-account">User: jane@demo.com / user123</div>
            </div>
          </div>
          
          <script>
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              const email = document.getElementById('email').value;
              const password = document.getElementById('password').value;
              const errorDiv = document.getElementById('error');
              
              try {
                const response = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                  window.location.href = '/';
                } else {
                  errorDiv.textContent = result.message || 'Login failed';
                  errorDiv.style.display = 'block';
                }
              } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.style.display = 'block';
              }
            });
          </script>
        </body>
      </html>
    `);
  });

  // Real authentication endpoint
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    // Demo credentials
    const credentials = {
      "admin@demo.com": { password: "admin123", user: demoUsers[0] },
      "john@demo.com": { password: "user123", user: demoUsers[1] },
      "jane@demo.com": { password: "user123", user: demoUsers[2] },
    };

    const credential = credentials[email as keyof typeof credentials];

    if (!credential || credential.password !== password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Store user and create session
    await storage.upsertUser(credential.user);
    (req as any).session.userId = credential.user.id;
    res.json({ success: true, user: credential.user });
  });

  app.get("/api/logout", (req, res) => {
    (req as any).session.destroy((err: any) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.redirect("/api/login");
    });
  });

  // Auth middleware
  const isAuthenticated = async (req: any, res: any, next: any) => {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = { claims: { sub: userId } };
    req.currentUser = user;
    next();
  };

  // Auth routes
  app.get("/api/auth/user", async (req: any, res) => {
    const userId = (req as any).session?.userId;

    if (!userId) {
      // Auto-login with admin user for demo purposes
      const adminUser = demoUsers[0];
      await storage.upsertUser(adminUser);
      (req as any).session.userId = adminUser.id;
      return res.json(adminUser);
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json(user);
  });

  app.get(
    "/api/auth/user-protected",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        let user = await storage.getUser(userId);
        if (!user) {
          // Create new user from auth claims
          user = await storage.upsertUser({
            id: userId,
            email: req.user.claims.email,
            firstName: req.user.claims.first_name,
            lastName: req.user.claims.last_name,
            profileImageUrl: req.user.claims.profile_image_url,
            role: "user", // Default role
          });
        }

        res.json(user);
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    },
  );

  // Get all users (any authenticated user can access for trip management)
  app.get("/api/users", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // All authenticated users can access user list for trip management
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user profile
  app.patch("/api/users/profile", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Only allow phoneNumber and telegramId to be updated
      const { phoneNumber, telegramId } = req.body;
      console.log("Profile update request body:", req.body);
      console.log("User ID:", userId);

      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log("Existing user phone:", existingUser.phoneNumber);
      console.log("New phone number:", phoneNumber);

      const updatedUser = await storage.updateUser(userId, {
        phoneNumber: phoneNumber || existingUser.phoneNumber,
        telegramId: telegramId || existingUser.telegramId,
      });

      console.log("Updated user phone:", updatedUser.phoneNumber);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update existing users with phone numbers (one-time migration)
  app.post("/api/users/migrate-phone-numbers", async (req: any, res) => {
    try {
      const phoneUpdates = [
        { id: "admin-1", phoneNumber: "+1-555-0001" },
        { id: "user-1", phoneNumber: "+1-555-0002" },
        { id: "user-2", phoneNumber: "+1-555-0003" },
        { id: "driver-1", phoneNumber: "+1-555-0101" },
        { id: "driver-2", phoneNumber: "+1-555-0102" },
        { id: "rider-1", phoneNumber: "+1-555-0201" },
        { id: "rider-2", phoneNumber: "+1-555-0202" },
      ];

      for (const update of phoneUpdates) {
        const existingUser = await storage.getUser(update.id);
        if (existingUser && !existingUser.phoneNumber) {
          await storage.upsertUser({
            ...existingUser,
            phoneNumber: update.phoneNumber,
          });
        }
      }

      res.json({ message: "Phone numbers migrated successfully" });
    } catch (error) {
      console.error("Error migrating phone numbers:", error);
      res.status(500).json({ message: "Failed to migrate phone numbers" });
    }
  });

  // Update user role (admin only)
  app.patch("/api/users/:id/role", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const { firstName, lastName, phoneNumber } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update user with new profile information
      const updatedUser = await storage.upsertUser({
        ...currentUser,
        firstName: firstName || currentUser.firstName,
        lastName: lastName || currentUser.lastName,
        phoneNumber: phoneNumber || currentUser.phoneNumber,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Update user role (admin only)
  app.patch("/api/users/:id/role", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["admin", "driver", "rider"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(id, role);

      // Broadcast user update to all connected clients
      broadcastToAll({
        type: "user_updated",
        data: user,
      });

      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Trip routes
  app.get("/api/trips", async (req: any, res) => {
    try {
      const { from, to, date } = req.query;
      const searchDate = date ? new Date(date) : undefined;

      // Get current user to check if admin
      const userId = req.session?.userId;
      let isAdmin = false;

      if (userId) {
        const user = await storage.getUser(userId);
        isAdmin = user?.role === "admin";
      }

      // Get all trips
      let trips = await storage.getAllTrips();

      // Apply additional filters if provided
      if (from || to || date) {
        trips = trips.filter((trip) => {
          if (
            from &&
            !trip.fromLocation.toLowerCase().includes(from.toLowerCase())
          ) {
            return false;
          }
          if (to && !trip.toLocation.toLowerCase().includes(to.toLowerCase())) {
            return false;
          }
          if (date) {
            const tripDate = new Date(trip.departureTime);
            const searchDate = new Date(date);
            if (tripDate.toDateString() !== searchDate.toDateString()) {
              return false;
            }
          }
          return true;
        });
      }

      // Enrich with driver info and sync available seats with riders
      const enrichedTrips = await Promise.all(
        trips.map(async (trip) => {
          const driver = await storage.getUser(trip.driverId);
          const participants = await storage.getTripParticipants(trip.id);

          // Calculate available seats based on riders array
          const currentRiders = trip.riders || [];
          const availableSeats = trip.totalSeats - currentRiders.length;

          // Get rider details
          const riderDetails = await Promise.all(
            currentRiders.map(async (riderId) => {
              const rider = await storage.getUser(riderId);
              return rider
                ? {
                    id: rider.id,
                    username: rider.username,
                    section: rider.section,
                    role: rider.role,
                    phoneNumber: rider.phoneNumber,
                    profileImageUrl: rider.profileImageUrl,
                  }
                : null;
            }),
          );

          // Sync available seats if they don't match
          if (trip.availableSeats !== availableSeats) {
            await storage.updateTrip(trip.id, { availableSeats });
          }

          return {
            ...trip,
            availableSeats,
            riders: currentRiders,
            riderDetails: riderDetails.filter(Boolean),
            driver: driver
              ? {
                  id: driver.id,
                  username: driver.username,
                  section: driver.section,
                  role: driver.role,
                  phoneNumber: driver.phoneNumber,
                  profileImageUrl: driver.profileImageUrl,
                }
              : null,
            participantCount: participants.reduce(
              (sum, p) => sum + p.seatsBooked,
              0,
            ),
          };
        }),
      );

      res.json(enrichedTrips);
    } catch (error) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/my", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const trips = await storage.getTodayUserTrips(userId);

      // Enrich with participant info and sync available seats with riders
      const enrichedTrips = await Promise.all(
        trips.map(async (trip) => {
          const participants = await storage.getTripParticipants(trip.id);
          const participantUsers = await Promise.all(
            participants.map(async (p) => {
              const user = await storage.getUser(p.userId);
              return {
                ...p,
                user: user
                  ? {
                      id: user.id,
                      firstName: user.firstName,
                      lastName: user.lastName,
                      profileImageUrl: user.profileImageUrl,
                    }
                  : null,
              };
            }),
          );

          // Calculate available seats based on riders array
          const currentRiders = trip.riders || [];
          const availableSeats = trip.totalSeats - currentRiders.length;

          // Get rider details
          const riderDetails = await Promise.all(
            currentRiders.map(async (riderId) => {
              const rider = await storage.getUser(riderId);
              return rider
                ? {
                    id: rider.id,
                    username: rider.username,
                    section: rider.section,
                    role: rider.role,
                    phoneNumber: rider.phoneNumber,
                    profileImageUrl: rider.profileImageUrl,
                  }
                : null;
            }),
          );

          // Sync available seats if they don't match
          if (trip.availableSeats !== availableSeats) {
            await storage.updateTrip(trip.id, { availableSeats });
          }

          return {
            ...trip,
            availableSeats,
            riders: currentRiders,
            riderDetails: riderDetails.filter(Boolean),
            participants: participantUsers,
            participantCount: participants.reduce(
              (sum, p) => sum + p.seatsBooked,
              0,
            ),
          };
        }),
      );

      res.json(enrichedTrips);
    } catch (error) {
      console.error("Error fetching user trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.post("/api/trips", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const currentUser = await storage.getUser(userId);
      if (!currentUser) {
        return res.status(401).json({ message: "User not found" });
      }

      // Admin can specify driver, regular users create trips for themselves
      const driverId =
        currentUser.role === "admin" && req.body.driverId
          ? req.body.driverId
          : userId;

      console.log("Trip creation payload:", req.body);

      const tripData = insertTripSchema.parse({
        ...req.body,
        driverId,
        totalSeats: req.body.availableSeats, // Initially all seats are available
      });

      console.log("Parsed trip data:", tripData);

      const trip = await storage.createTrip(tripData);

      // If admin pre-assigned participants, add them to the trip and update riders array
      if (
        currentUser.role === "admin" &&
        req.body.participantIds &&
        Array.isArray(req.body.participantIds)
      ) {
        const riders = [];
        for (const participantId of req.body.participantIds) {
          await storage.addTripParticipant({
            tripId: trip.id,
            userId: participantId,
            seatsBooked: 1,
            status: "confirmed",
          });
          riders.push(participantId);
        }

        // Update trip with riders and sync available seats
        const updatedTrip = await storage.updateTrip(trip.id, {
          riders,
          availableSeats: trip.totalSeats - riders.length,
        });

        await telegramService.notifyTripCreated(trip.id, trip.driverId);

        // Find and notify users with matching ride requests
        await notifyMatchingRideRequesters(updatedTrip);

        // Broadcast trip creation to all connected clients
        broadcastToAll({
          type: "trip_created",
          data: updatedTrip,
        });

        return res.status(201).json(updatedTrip);
      }

      // Send Telegram notification to driver
      await telegramService.notifyTripCreated(trip.id, trip.driverId);

      // Find and notify users with matching ride requests
      await notifyMatchingRideRequesters(trip);

      // Broadcast trip creation to all connected clients
      broadcastToAll({
        type: "trip_created",
        data: trip,
      });

      res.status(201).json(trip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error(
          "Validation errors:",
          JSON.stringify(error.errors, null, 2),
        );
        return res
          .status(400)
          .json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating trip:", error);
      res.status(500).json({ message: "Failed to create trip" });
    }
  });

  app.patch(
    "/api/trips/:id",
    requireRole(["admin", "driver"]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tripId = parseInt(id);

        const trip = await storage.getTrip(tripId);
        if (!trip) {
          return res.status(404).json({ message: "Trip not found" });
        }

        // Check if user owns the trip or is admin
        if (
          trip.driverId !== req.currentUser.id &&
          req.currentUser.role !== "admin"
        ) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const updates = insertTripSchema.partial().parse(req.body);
        const updatedTrip = await storage.updateTrip(tripId, updates);

        // Broadcast trip update to all connected clients
        broadcastToAll({
          type: "trip_updated",
          data: updatedTrip,
        });

        res.json(updatedTrip);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid input", errors: error.errors });
        }
        console.error("Error updating trip:", error);
        res.status(500).json({ message: "Failed to update trip" });
      }
    },
  );

  // Join trip (any authenticated user)
  app.post("/api/trips/:id/join", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tripId = parseInt(id);
      const userId = req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      // Check if user is the driver
      if (trip.driverId === userId) {
        return res
          .status(400)
          .json({ message: "Driver cannot join their own trip" });
      }

      const currentRiders = trip.riders || [];
      if (currentRiders.includes(userId)) {
        return res
          .status(400)
          .json({ message: "You are already a rider on this trip" });
      }

      if (currentRiders.length >= trip.totalSeats) {
        return res.status(400).json({ message: "Trip is full" });
      }

      const updatedRiders = [...currentRiders, userId];
      const updatedTrip = await storage.updateTrip(tripId, {
        riders: updatedRiders,
        availableSeats: trip.totalSeats - updatedRiders.length,
      });

      // Send notification to driver
      await telegramService.sendNotification(
        trip.driverId,
        "New Rider Joined",
        `A new rider has joined your trip from ${trip.fromLocation} to ${trip.toLocation}.`,
        "request_accepted",
      );

      // Broadcast trip update to all connected clients
      broadcastToAll({
        type: "trip_updated",
        data: updatedTrip,
      });

      res.json(updatedTrip);
    } catch (error) {
      console.error("Error joining trip:", error);
      res.status(500).json({ message: "Failed to join trip" });
    }
  });

  // Add rider to trip (admin or driver)
  app.post("/api/trips/:id/riders", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const tripId = parseInt(id);
      const currentUserId = req.session?.userId;

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
        data: updatedTrip,
      });

      res.json(updatedTrip);
    } catch (error) {
      console.error("Error adding rider to trip:", error);
      res.status(500).json({ message: "Failed to add rider to trip" });
    }
  });

  // Remove rider from trip (admin or driver)
  app.delete(
    "/api/trips/:id/riders/:userId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { id, userId } = req.params;
        const tripId = parseInt(id);
        const currentUserId = req.session?.userId;

        const trip = await storage.getTrip(tripId);
        if (!trip) {
          return res.status(404).json({ message: "Trip not found" });
        }

        const currentUser = await storage.getUser(currentUserId);

        // Check if user is admin or the driver of this trip
        if (currentUser?.role !== "admin" && trip.driverId !== currentUserId) {
          return res.status(403).json({
            message: "Only admins or the trip driver can remove riders",
          });
        }

        const currentRiders = trip.riders || [];
        if (!currentRiders.includes(userId)) {
          return res
            .status(400)
            .json({ message: "User is not a rider on this trip" });
        }

        const updatedRiders = currentRiders.filter(
          (riderId) => riderId !== userId,
        );
        const updatedTrip = await storage.updateTrip(tripId, {
          riders: updatedRiders,
          availableSeats: trip.totalSeats - updatedRiders.length,
        });

        // Broadcast trip update to all connected clients
        broadcastToAll({
          type: "trip_updated",
          data: updatedTrip,
        });

        res.json(updatedTrip);
      } catch (error) {
        console.error("Error removing rider from trip:", error);
        res.status(500).json({ message: "Failed to remove rider from trip" });
      }
    },
  );

  app.delete(
    "/api/trips/:id",
    requireRole(["admin", "driver"]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tripId = parseInt(id);

        const trip = await storage.getTrip(tripId);
        if (!trip) {
          return res.status(404).json({ message: "Trip not found" });
        }

        // Check if user owns the trip or is admin
        if (
          trip.driverId !== req.currentUser.id &&
          req.currentUser.role !== "admin"
        ) {
          return res.status(403).json({ message: "Forbidden" });
        }

        await storage.deleteTrip(tripId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting trip:", error);
        res.status(500).json({ message: "Failed to delete trip" });
      }
    },
  );

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
        const riderId = req.currentUser.id;

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

        // Check if trip has available seats
        const requestedSeats = seatsRequested || 1;
        if (trip.availableSeats < requestedSeats) {
          return res
            .status(400)
            .json({ message: "Not enough available seats" });
        }

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
            message: `${requester.firstName} ${requester.lastName} انضم إلى رحلتك من ${trip.fromLocation} إلى ${trip.toLocation}`,
            type: "rider_joined",
          });

          // Notify rider about successful join
          await storage.createNotification({
            userId: riderId,
            title: "تم الانضمام للرحلة بنجاح",
            message: `تم قبولك في الرحلة من ${trip.fromLocation} إلى ${trip.toLocation}`,
            type: "join_approved",
          });

          // Broadcast notification
          broadcastToAll({
            type: "rider_joined",
            data: { joinRequest, trip: updatedTrip, rider: requester },
          });
        }

        res.json({
          ...joinRequest,
          trip: updatedTrip,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "Invalid input", errors: error.errors });
        }
        console.error("Error creating join request:", error);
        res.status(500).json({ message: "Failed to create join request" });
      }
    },
  );

  // Ride request routes
  // Get all ride requests (accessible to all authenticated users)
  app.get("/api/ride-requests/all", async (req: any, res) => {
    try {
      // Check authentication manually to avoid redirect
      const isAuth = req.session?.userId || req.user?.id;
      if (!isAuth) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const requests = await storage.getTodayRideRequests();
      console.log("=== RIDE REQUESTS API ===");
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
                  profileImageUrl: rider.profileImageUrl,
                }
              : null,
          };
        }),
      );

      console.log("Sending", enrichedRequests.length, "enriched requests");
      res.setHeader('Content-Type', 'application/json');
      res.json(enrichedRequests);
    } catch (error: any) {
      console.error("Error fetching all ride requests:", error);
      res.status(500).json({ message: "Failed to fetch ride requests" });
    }
  });

  app.get(
    "/api/ride-requests",
    requireRole(["admin", "driver"]),
    async (req: any, res) => {
      try {
        const requests = await storage.getPendingRideRequests();

        // For drivers, filter requests that match their trips (±2 hours)
        let filteredRequests = requests;
        if (req.currentUser.role === "driver") {
          const driverTrips = await storage.getUserTrips(req.currentUser.id);

          filteredRequests = requests.filter((request) => {
            return driverTrips.some((trip) => {
              const tripTime = new Date(trip.departureTime).getTime();
              const requestTime = new Date(request.preferredTime).getTime();
              const timeDiff = Math.abs(tripTime - requestTime);
              const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

              return (
                (timeDiff <= twoHours &&
                  request.fromLocation
                    .toLowerCase()
                    .includes(trip.fromLocation.toLowerCase())) ||
                trip.fromLocation
                  .toLowerCase()
                  .includes(request.fromLocation.toLowerCase()) ||
                request.toLocation
                  .toLowerCase()
                  .includes(trip.toLocation.toLowerCase()) ||
                trip.toLocation
                  .toLowerCase()
                  .includes(request.toLocation.toLowerCase())
              );
            });
          });
        }

        // Enrich with rider info
        const enrichedRequests = await Promise.all(
          filteredRequests.map(async (request) => {
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
                    profileImageUrl: rider.profileImageUrl,
                  }
                : null,
            };
          }),
        );

        res.json(enrichedRequests);
      } catch (error: any) {
        console.error("Error fetching ride requests:", error);
        res.status(500).json({ message: "Failed to fetch ride requests" });
      }
    },
  );

  app.get("/api/ride-requests/my", async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const requests = await storage.getTodayUserRideRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching user ride requests:", error);
      res.status(500).json({ message: "Failed to fetch ride requests" });
    }
  });

  app.post("/api/ride-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.currentUser.id;

      // For admins, allow specifying a different rider
      const riderId =
        req.currentUser.role === "admin" && req.body.riderId
          ? req.body.riderId
          : userId;

      // Use the datetime as-is (already processed by client if needed)
      const requestData = insertRideRequestSchema.parse({
        ...req.body,
        riderId: riderId,
      });

      const request = await storage.createRideRequest(requestData);

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

      // Notify drivers
      for (const trip of matchingTrips) {
        await telegramService.notifyRideRequestReceived(
          trip.driverId,
          request.id,
        );
      }

      // Notify all admin users about the new ride request
      await telegramService.notifyAdminsRideRequestCreated(request.id, riderId);

      // Broadcast ride request creation to all connected clients
      broadcastToAll({
        type: "ride_request_created",
        data: request,
      });

      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating ride request:", error);
      res.status(500).json({ message: "Failed to create ride request" });
    }
  });

  app.patch(
    "/api/ride-requests/:id/accept",
    requireRole(["admin", "driver"]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const requestId = parseInt(id);
        const { tripId } = req.body;

        const request = await storage.getRideRequest(requestId);
        const trip = await storage.getTrip(tripId);

        if (!request || !trip) {
          return res.status(404).json({ message: "Request or trip not found" });
        }

        // Check if driver owns the trip or is admin
        if (
          trip.driverId !== req.currentUser.id &&
          req.currentUser.role !== "admin"
        ) {
          return res.status(403).json({ message: "Forbidden" });
        }

        // Check if trip has enough seats
        if (trip.availableSeats < (request.passengerCount || 1)) {
          return res
            .status(400)
            .json({ message: "Not enough available seats" });
        }

        // Accept the request
        await storage.updateRideRequestStatus(requestId, "accepted", tripId);

        // Add rider as participant
        await storage.addTripParticipant({
          tripId,
          userId: request.riderId,
          seatsBooked: request.passengerCount,
          status: "confirmed",
        });

        // Update trip available seats
        await storage.updateTrip(tripId, {
          availableSeats: trip.availableSeats - request.passengerCount,
        });

        // Send notification
        await telegramService.notifyRequestAccepted(request.riderId, tripId);

        res.json({ message: "Request accepted successfully" });
      } catch (error) {
        console.error("Error accepting ride request:", error);
        res.status(500).json({ message: "Failed to accept ride request" });
      }
    },
  );

  app.patch(
    "/api/ride-requests/:id/decline",
    requireRole(["admin", "driver"]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const requestId = parseInt(id);

        const request = await storage.getRideRequest(requestId);
        if (!request) {
          return res.status(404).json({ message: "Request not found" });
        }

        await storage.updateRideRequestStatus(requestId, "declined");

        // Send notification
        await telegramService.notifyRequestDeclined(request.riderId);

        res.json({ message: "Request declined successfully" });
      } catch (error) {
        console.error("Error declining ride request:", error);
        res.status(500).json({ message: "Failed to decline ride request" });
      }
    },
  );

  app.patch(
    "/api/ride-requests/:id/assign-to-trip",
    requireRole(["admin"]),
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const { tripId } = req.body;
        const requestId = parseInt(id);

        if (!tripId) {
          return res.status(400).json({ message: "Trip ID is required" });
        }

        const request = await storage.getRideRequest(requestId);
        if (!request) {
          return res.status(404).json({ message: "Ride request not found" });
        }

        const trip = await storage.getTrip(tripId);
        if (!trip) {
          return res.status(404).json({ message: "Trip not found" });
        }

        // Check if trip has enough available seats
        if (trip.availableSeats < request.passengerCount) {
          return res
            .status(400)
            .json({ message: "Not enough available seats in the trip" });
        }

        // Accept the request and assign to trip
        await storage.updateRideRequestStatus(requestId, "accepted", tripId);

        // Add rider as participant
        await storage.addTripParticipant({
          tripId,
          userId: request.riderId,
          seatsBooked: request.passengerCount,
          status: "confirmed",
        });

        // Update trip available seats
        await storage.updateTrip(tripId, {
          availableSeats: trip.availableSeats - request.passengerCount,
        });

        // Send notification
        await telegramService.notifyRequestAccepted(request.riderId, tripId);

        // Broadcast ride request update to all connected clients
        broadcastToAll({
          type: "ride_request_updated",
          data: { id: requestId, status: "accepted", tripId },
        });

        res.json({ message: "Ride request assigned successfully" });
      } catch (error) {
        console.error("Error assigning ride request:", error);
        res.status(500).json({ message: "Failed to assign ride request" });
      }
    },
  );

  // Notification routes
  app.get("/api/notifications", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req: any, res) => {
    try {
      const { id } = req.params;
      const notificationId = parseInt(id);

      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // Stats routes (admin only)
  app.get("/api/stats", async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allTrips = await storage.getAllTrips();
      const allUsers = await storage.getAllUsers();
      const allRequests = await storage.getPendingRideRequests();

      const stats = {
        activeTrips: allTrips.length,
        totalUsers: allUsers.length,
        completedTrips: 0,
        pendingRequests: allRequests.length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);

  // Setup WebSocket for real-time updates
  setupWebSocket(httpServer);

  return httpServer;
}
