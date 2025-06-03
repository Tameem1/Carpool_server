import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
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
    const userId = req.user?.claims?.sub;
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    const userId = (req as any).session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
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
          role: "rider", // Default role
        });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user role (admin only)
  app.patch('/api/users/:id/role', requireRole(['admin']), async (req: any, res) => {
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
      const { from, to, date } = req.query;
      const searchDate = date ? new Date(date) : undefined;
      
      const trips = await storage.searchTrips(from, to, searchDate);
      
      // Enrich with driver info and participant count
      const enrichedTrips = await Promise.all(
        trips.map(async (trip) => {
          const driver = await storage.getUser(trip.driverId);
          const participants = await storage.getTripParticipants(trip.id);
          
          return {
            ...trip,
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
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const trips = await storage.getUserTrips(userId);
      
      // Enrich with participant info
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
          
          return {
            ...trip,
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

  app.post('/api/trips', requireRole(['admin', 'driver']), async (req: any, res) => {
    try {
      const tripData = insertTripSchema.parse({
        ...req.body,
        driverId: req.currentUser.id,
        totalSeats: req.body.availableSeats, // Initially all seats are available
      });

      const trip = await storage.createTrip(tripData);
      
      // Send Telegram notification
      await telegramService.notifyTripCreated(trip.id, trip.driverId);
      
      res.status(201).json(trip);
    } catch (error) {
      if (error instanceof z.ZodError) {
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
    } catch (error) {
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
      if (trip.availableSeats < request.passengerCount) {
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
      const userId = req.user?.claims?.sub;
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
  app.get('/api/stats', requireRole(['admin']), async (req: any, res) => {
    try {
      const allTrips = await storage.getAllTrips();
      const allUsers = Array.from((storage as any).users.values());
      const allRequests = Array.from((storage as any).rideRequests.values());

      const stats = {
        activeTrips: allTrips.filter(t => t.status === 'active').length,
        totalUsers: allUsers.length,
        completedTrips: allTrips.filter(t => t.status === 'completed').length,
        pendingRequests: allRequests.filter(r => r.status === 'pending').length,
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
