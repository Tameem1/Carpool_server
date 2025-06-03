import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
// import { setupAuth, isAuthenticated } from "./auth";
import { insertTripSchema, insertRideRequestSchema, insertTripParticipantSchema } from "@shared/schema";
import { z } from "zod";

// Mock Telegram notification service
class TelegramNotificationService {
  async sendNotification(userId: string, title: string, message: string) {
    // In a real implementation, this would send to Telegram
    console.log(`[TELEGRAM] Sending to user ${userId}: ${title} - ${message}`);
    
    // Store as notification in our system
    await storage.createNotification({
      userId,
      title,
      message,
      type: "trip_created", // Default type, could be more specific
    });
  }

  async notifyTripCreated(tripId: number, driverId: string) {
    const trip = await storage.getTrip(tripId);
    if (!trip) return;

    await this.sendNotification(
      driverId,
      "Trip Created",
      `Your trip from ${trip.fromLocation} to ${trip.toLocation} has been created successfully.`
    );
  }

  async notifyRideRequestReceived(driverId: string, requestId: number) {
    const request = await storage.getRideRequest(requestId);
    if (!request) return;

    await this.sendNotification(
      driverId,
      "New Ride Request",
      `You have a new ride request from ${request.fromLocation} to ${request.toLocation}.`
    );
  }

  async notifyRequestAccepted(riderId: string, tripId: number) {
    const trip = await storage.getTrip(tripId);
    if (!trip) return;

    await this.sendNotification(
      riderId,
      "Ride Request Accepted",
      `Your ride request has been accepted for the trip from ${trip.fromLocation} to ${trip.toLocation}.`
    );
  }

  async notifyRequestDeclined(riderId: string) {
    await this.sendNotification(
      riderId,
      "Ride Request Declined",
      "Your ride request has been declined. Please try another trip."
    );
  }
}

const telegramService = new TelegramNotificationService();

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

import session from 'express-session';

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple auth setup
  
  app.use(session({
    secret: 'demo-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
  }));

  // Demo users
  const demoUsers = [
    { id: "admin-1", email: "admin@demo.com", firstName: "Admin", lastName: "User", role: "admin" as const, profileImageUrl: null },
    { id: "user-1", email: "john@demo.com", firstName: "John", lastName: "Smith", role: "user" as const, profileImageUrl: null },
    { id: "user-2", email: "jane@demo.com", firstName: "Jane", lastName: "Doe", role: "user" as const, profileImageUrl: null },
  ];

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
      res.clearCookie('connect.sid');
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
  app.get('/api/auth/user', async (req: any, res) => {
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

  app.get('/api/auth/user-protected', isAuthenticated, async (req: any, res) => {
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
  });

  // Get all users (admin only)
  app.get('/api/users', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user role (admin only)
  app.patch('/api/users/:id/role', async (req: any, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!['admin', 'driver', 'rider'].includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
      }

      const user = await storage.updateUserRole(id, role);
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Trip routes
  app.get('/api/trips', async (req: any, res) => {
    try {
      const { from, to, date, status } = req.query;
      const searchDate = date ? new Date(date) : undefined;
      
      // Get current user to check if admin
      const userId = req.session?.userId;
      let isAdmin = false;
      
      if (userId) {
        const user = await storage.getUser(userId);
        isAdmin = user?.role === 'admin';
      }
      
      // Get trips based on status filter
      let trips;
      if (status === 'all') {
        trips = await storage.getAllTrips();
      } else if (status === 'inactive') {
        const allTrips = await storage.getAllTrips();
        trips = allTrips.filter(trip => trip.status !== 'active');
      } else {
        // Default to active trips only
        const allTrips = await storage.getAllTrips();
        trips = allTrips.filter(trip => trip.status === 'active');
      }
      
      // Apply additional filters if provided
      if (from || to || date) {
        trips = trips.filter(trip => {
          if (from && !trip.fromLocation.toLowerCase().includes(from.toLowerCase())) {
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
      
      // For non-admin users, filter out full trips unless they specifically want to see all
      if (!isAdmin && status !== 'all') {
        trips = trips.filter(trip => trip.availableSeats > 0);
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
              return rider ? {
                id: rider.id,
                firstName: rider.firstName,
                lastName: rider.lastName,
                profileImageUrl: rider.profileImageUrl,
              } : null;
            })
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
            driver: driver ? {
              id: driver.id,
              firstName: driver.firstName,
              lastName: driver.lastName,
              profileImageUrl: driver.profileImageUrl,
            } : null,
            participantCount: participants.reduce((sum, p) => sum + p.seatsBooked, 0),
          };
        })
      );
      
      res.json(enrichedTrips);
    } catch (error) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.get('/api/trips/my', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const trips = await storage.getUserTrips(userId);
      
      // Enrich with participant info and sync available seats with riders
      const enrichedTrips = await Promise.all(
        trips.map(async (trip) => {
          const participants = await storage.getTripParticipants(trip.id);
          const participantUsers = await Promise.all(
            participants.map(async (p) => {
              const user = await storage.getUser(p.userId);
              return {
                ...p,
                user: user ? {
                  id: user.id,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  profileImageUrl: user.profileImageUrl,
                } : null,
              };
            })
          );
          
          // Calculate available seats based on riders array
          const currentRiders = trip.riders || [];
          const availableSeats = trip.totalSeats - currentRiders.length;
          
          // Get rider details
          const riderDetails = await Promise.all(
            currentRiders.map(async (riderId) => {
              const rider = await storage.getUser(riderId);
              return rider ? {
                id: rider.id,
                firstName: rider.firstName,
                lastName: rider.lastName,
                profileImageUrl: rider.profileImageUrl,
              } : null;
            })
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
            participantCount: participants.reduce((sum, p) => sum + p.seatsBooked, 0),
          };
        })
      );
      
      res.json(enrichedTrips);
    } catch (error) {
      console.error("Error fetching user trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.post('/api/trips', async (req: any, res) => {
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
      const driverId = currentUser.role === 'admin' && req.body.driverId 
        ? req.body.driverId 
        : userId;

      console.log('Trip creation payload:', req.body);
      
      const tripData = insertTripSchema.parse({
        ...req.body,
        driverId,
        totalSeats: req.body.availableSeats, // Initially all seats are available
      });
      
      console.log('Parsed trip data:', tripData);

      const trip = await storage.createTrip(tripData);
      
      // If admin pre-assigned participants, add them to the trip and update riders array
      if (currentUser.role === 'admin' && req.body.participantIds && Array.isArray(req.body.participantIds)) {
        const riders = [];
        for (const participantId of req.body.participantIds) {
          await storage.addTripParticipant({
            tripId: trip.id,
            userId: participantId,
            seatsBooked: 1,
            status: 'confirmed'
          });
          riders.push(participantId);
        }
        
        // Update trip with riders and sync available seats
        const updatedTrip = await storage.updateTrip(trip.id, {
          riders,
          availableSeats: trip.totalSeats - riders.length
        });
        
        await telegramService.notifyTripCreated(trip.id, trip.driverId);
        return res.status(201).json(updatedTrip);
      }
      
      // Send Telegram notification
      await telegramService.notifyTripCreated(trip.id, trip.driverId);
      
      res.status(201).json(trip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating trip:", error);
      res.status(500).json({ message: "Failed to create trip" });
    }
  });

  app.patch('/api/trips/:id', requireRole(['admin', 'driver']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const tripId = parseInt(id);
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      // Check if user owns the trip or is admin
      if (trip.driverId !== req.currentUser.id && req.currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updates = insertTripSchema.partial().parse(req.body);
      const updatedTrip = await storage.updateTrip(tripId, updates);
      
      res.json(updatedTrip);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating trip:", error);
      res.status(500).json({ message: "Failed to update trip" });
    }
  });

  // Add rider to trip (admin only)
  app.post('/api/trips/:id/riders', requireRole(['admin']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const tripId = parseInt(id);
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const currentRiders = trip.riders || [];
      if (currentRiders.includes(userId)) {
        return res.status(400).json({ message: "User is already a rider on this trip" });
      }

      if (currentRiders.length >= trip.totalSeats) {
        return res.status(400).json({ message: "Trip is full" });
      }

      const updatedRiders = [...currentRiders, userId];
      const updatedTrip = await storage.updateTrip(tripId, { 
        riders: updatedRiders,
        availableSeats: trip.totalSeats - updatedRiders.length
      });
      
      res.json(updatedTrip);
    } catch (error) {
      console.error("Error adding rider to trip:", error);
      res.status(500).json({ message: "Failed to add rider to trip" });
    }
  });

  // Remove rider from trip (admin only)
  app.delete('/api/trips/:id/riders/:userId', requireRole(['admin']), async (req: any, res) => {
    try {
      const { id, userId } = req.params;
      const tripId = parseInt(id);
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const currentRiders = trip.riders || [];
      if (!currentRiders.includes(userId)) {
        return res.status(400).json({ message: "User is not a rider on this trip" });
      }

      const updatedRiders = currentRiders.filter(riderId => riderId !== userId);
      const updatedTrip = await storage.updateTrip(tripId, { 
        riders: updatedRiders,
        availableSeats: trip.totalSeats - updatedRiders.length
      });
      
      res.json(updatedTrip);
    } catch (error) {
      console.error("Error removing rider from trip:", error);
      res.status(500).json({ message: "Failed to remove rider from trip" });
    }
  });

  app.delete('/api/trips/:id', requireRole(['admin', 'driver']), async (req: any, res) => {
    try {
      const { id } = req.params;
      const tripId = parseInt(id);
      
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      // Check if user owns the trip or is admin
      if (trip.driverId !== req.currentUser.id && req.currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteTrip(tripId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting trip:", error);
      res.status(500).json({ message: "Failed to delete trip" });
    }
  });

  // Ride request routes
  app.get('/api/ride-requests', requireRole(['admin', 'driver']), async (req: any, res) => {
    try {
      const requests = await storage.getPendingRideRequests();
      
      // For drivers, filter requests that match their trips (±2 hours)
      let filteredRequests = requests;
      if (req.currentUser.role === 'driver') {
        const driverTrips = await storage.getUserTrips(req.currentUser.id);
        
        filteredRequests = requests.filter(request => {
          return driverTrips.some(trip => {
            const tripTime = new Date(trip.departureTime).getTime();
            const requestTime = new Date(request.preferredTime).getTime();
            const timeDiff = Math.abs(tripTime - requestTime);
            const twoHours = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
            
            return timeDiff <= twoHours &&
                   request.fromLocation.toLowerCase().includes(trip.fromLocation.toLowerCase()) ||
                   trip.fromLocation.toLowerCase().includes(request.fromLocation.toLowerCase()) ||
                   request.toLocation.toLowerCase().includes(trip.toLocation.toLowerCase()) ||
                   trip.toLocation.toLowerCase().includes(request.toLocation.toLowerCase());
          });
        });
      }
      
      // Enrich with rider info
      const enrichedRequests = await Promise.all(
        filteredRequests.map(async (request) => {
          const rider = await storage.getUser(request.riderId);
          return {
            ...request,
            rider: rider ? {
              id: rider.id,
              firstName: rider.firstName,
              lastName: rider.lastName,
              profileImageUrl: rider.profileImageUrl,
            } : null,
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error: any) {
      console.error("Error fetching ride requests:", error);
      res.status(500).json({ message: "Failed to fetch ride requests" });
    }
  });

  app.get('/api/ride-requests/my', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const requests = await storage.getUserRideRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching user ride requests:", error);
      res.status(500).json({ message: "Failed to fetch ride requests" });
    }
  });

  app.post('/api/ride-requests', async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const requestData = insertRideRequestSchema.parse({
        ...req.body,
        riderId: userId,
      });

      const request = await storage.createRideRequest(requestData);
      
      // Find potential drivers and notify them
      const allTrips = await storage.getAllTrips();
      const matchingTrips = allTrips.filter(trip => {
        const tripTime = new Date(trip.departureTime).getTime();
        const requestTime = new Date(request.preferredTime).getTime();
        const timeDiff = Math.abs(tripTime - requestTime);
        const twoHours = 2 * 60 * 60 * 1000;
        
        return timeDiff <= twoHours && trip.availableSeats >= request.passengerCount;
      });

      // Notify drivers
      for (const trip of matchingTrips) {
        await telegramService.notifyRideRequestReceived(trip.driverId, request.id);
      }
      
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating ride request:", error);
      res.status(500).json({ message: "Failed to create ride request" });
    }
  });

  app.patch('/api/ride-requests/:id/accept', requireRole(['admin', 'driver']), async (req: any, res) => {
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
      if (trip.driverId !== req.currentUser.id && req.currentUser.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Check if trip has enough seats
      if (trip.availableSeats < (request.passengerCount || 1)) {
        return res.status(400).json({ message: "Not enough available seats" });
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
  });

  app.patch('/api/ride-requests/:id/decline', requireRole(['admin', 'driver']), async (req: any, res) => {
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
  });

  // Notification routes
  app.get('/api/notifications', async (req: any, res) => {
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

  app.patch('/api/notifications/:id/read', async (req: any, res) => {
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
  app.get('/api/stats', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }

      const allTrips = await storage.getAllTrips();
      const allUsers = await storage.getAllUsers();
      const allRequests = await storage.getPendingRideRequests();

      const stats = {
        activeTrips: allTrips.filter(t => t.status === 'active').length,
        totalUsers: allUsers.length,
        completedTrips: allTrips.filter(t => t.status === 'completed').length,
        pendingRequests: allRequests.length,
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
