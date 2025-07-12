import {
  users,
  trips,
  rideRequests,
  tripParticipants,
  tripJoinRequests,
  notifications,
  type User,
  type InsertUser,
  type Trip,
  type InsertTrip,
  type RideRequest,
  type InsertRideRequest,
  type TripParticipant,
  type InsertTripParticipant,
  type TripJoinRequest,
  type InsertTripJoinRequest,
  type Notification,
  type InsertNotification,
  type UserRole,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lt } from "drizzle-orm";
import { nowGMTPlus3, getTodayRangeUTC, fromGMTPlus3ToUTC } from "@shared/timezone";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsernameAndSection(username: string, section: string): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateUserRole(id: string, role: UserRole): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getAdminUsers(): Promise<User[]>;
  getUsersBySection(section: string): Promise<User[]>;
  getUniqueSections(): Promise<string[]>;
  
  // Trip operations
  createTrip(trip: InsertTrip): Promise<Trip>;
  getTrip(id: number): Promise<Trip | undefined>;
  getUserTrips(userId: string): Promise<Trip[]>;
  getTodayUserTrips(userId: string): Promise<Trip[]>;
  getTodayTrips(): Promise<Trip[]>;
  getAllTrips(): Promise<Trip[]>;
  updateTrip(id: number, updates: Partial<InsertTrip>): Promise<Trip>;
  deleteTrip(id: number): Promise<void>;
  searchTrips(fromLocation?: string, toLocation?: string, date?: Date): Promise<Trip[]>;
  
  // Ride request operations
  createRideRequest(request: InsertRideRequest): Promise<RideRequest>;
  getRideRequest(id: number): Promise<RideRequest | undefined>;
  getUserRideRequests(userId: string): Promise<RideRequest[]>;
  getTodayUserRideRequests(userId: string): Promise<RideRequest[]>;
  getPendingRideRequests(): Promise<RideRequest[]>;
  getTodayRideRequests(): Promise<RideRequest[]>;
  updateRideRequestStatus(id: number, status: RideRequest["status"], tripId?: number): Promise<RideRequest>;
  deleteRideRequest(id: number): Promise<void>;
  
  // Trip participant operations
  addTripParticipant(participant: InsertTripParticipant): Promise<TripParticipant>;
  getTripParticipants(tripId: number): Promise<TripParticipant[]>;
  removeTripParticipant(tripId: number, userId: string): Promise<void>;
  
  // Trip join request operations
  createTripJoinRequest(request: InsertTripJoinRequest): Promise<TripJoinRequest>;
  getTripJoinRequest(id: number): Promise<TripJoinRequest | undefined>;
  getTripJoinRequests(tripId: number): Promise<TripJoinRequest[]>;
  getAllTripJoinRequests(): Promise<TripJoinRequest[]>;
  getTodayTripJoinRequests(): Promise<TripJoinRequest[]>;
  getUserTripJoinRequests(userId: string): Promise<TripJoinRequest[]>;
  updateTripJoinRequestStatus(id: number, status: TripJoinRequest["status"]): Promise<TripJoinRequest>;
  deleteTripJoinRequest(id: number): Promise<void>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize sample users for testing (one-time setup)
    this.initializeSampleUsers();
    // Note: Periodic cleanup is handled manually via API calls to avoid aggressive filtering
  }



  private async initializeSampleUsers() {
    try {
      // Check if users already exist to avoid duplicates
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length > 0) return;

      const sampleUsers = [
        {
          id: 'admin-1',
          username: 'admin',
          section: 'admin',
          password: 'admin123',
          phoneNumber: '+1-555-0001',
          role: 'admin' as UserRole,
          telegramUsername: null,
          telegramId: null,
        },
        {
          id: 'driver-1',
          username: 'alice',
          section: 'drivers',
          password: 'driver123',
          phoneNumber: '+1-555-0101',
          role: 'user' as UserRole,
          telegramUsername: null,
          telegramId: null,
        },
        {
          id: 'driver-2', 
          username: 'bob',
          section: 'drivers',
          password: 'driver123',
          phoneNumber: '+1-555-0102',
          role: 'user' as UserRole,
          telegramUsername: null,
          telegramId: null,
        },
        {
          id: 'rider-1',
          username: 'charlie',
          section: 'riders',
          password: 'rider123',
          phoneNumber: '+1-555-0201',
          role: 'user' as UserRole,
          telegramUsername: null,
          telegramId: null,
        },
        {
          id: 'rider-2',
          username: 'diana',
          section: 'riders',
          password: 'rider123',
          phoneNumber: '+1-555-0202',
          role: 'user' as UserRole,
          telegramUsername: null,
          telegramId: null,
        }
      ];

      await db.insert(users).values(sampleUsers);
    } catch (error) {
      console.log('Sample users may already exist or database not ready:', error);
    }
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsernameAndSection(username: string, section: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.username, username), eq(users.section, section))
    );
    return user || undefined;
  }

  async getUsersBySection(section: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.section, section));
  }

  async getUniqueSections(): Promise<string[]> {
    const result = await db.select({ section: users.section }).from(users);
    const uniqueSections = Array.from(new Set(result.map(r => r.section))).sort();
    return uniqueSections;
  }

  async upsertUser(userData: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: userData.id!,
        username: userData.username,
        section: userData.section,
        password: userData.password,
        phoneNumber: userData.phoneNumber || null,
        telegramUsername: userData.telegramUsername || null,
        telegramId: userData.telegramId || null,
        role: userData.role || "user",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: userData.username,
          section: userData.section,
          password: userData.password,
          phoneNumber: userData.phoneNumber || null,
          telegramUsername: userData.telegramUsername || null,
          telegramId: userData.telegramId || null,
          role: userData.role || "user",
        }
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    return this.updateUser(id, { role });
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAdminUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.role, "admin"));
  }

  // Trip operations
  async createTrip(tripData: InsertTrip): Promise<Trip> {
    const now = fromGMTPlus3ToUTC(nowGMTPlus3());
    const [trip] = await db
      .insert(trips)
      .values({
        driverId: tripData.driverId || '',
        riders: tripData.riders || [],
        fromLocation: tripData.fromLocation,
        toLocation: tripData.toLocation,
        departureTime: tripData.departureTime,
        availableSeats: tripData.availableSeats,
        totalSeats: tripData.totalSeats ?? tripData.availableSeats,
        isRecurring: tripData.isRecurring || false,
        recurringDays: tripData.recurringDays || null,
        notes: tripData.notes || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return trip;
  }

  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip || undefined;
  }

  async getUserTrips(userId: string): Promise<Trip[]> {
    // Get trips where user is the driver
    const driverTrips = await db.select().from(trips).where(eq(trips.driverId, userId));
    
    // Get trips where user is a participant
    const participantTrips = await db
      .select({
        id: trips.id,
        driverId: trips.driverId,
        riders: trips.riders,
        fromLocation: trips.fromLocation,
        toLocation: trips.toLocation,
        departureTime: trips.departureTime,
        availableSeats: trips.availableSeats,
        totalSeats: trips.totalSeats,
        isRecurring: trips.isRecurring,
        recurringDays: trips.recurringDays,
        notes: trips.notes,
        createdAt: trips.createdAt,
        updatedAt: trips.updatedAt,
      })
      .from(trips)
      .innerJoin(tripParticipants, eq(trips.id, tripParticipants.tripId))
      .where(eq(tripParticipants.userId, userId));
    
    // Combine and deduplicate trips
    const allTrips = [...driverTrips, ...participantTrips];
    const uniqueTrips = allTrips.filter((trip, index, self) => 
      index === self.findIndex(t => t.id === trip.id)
    );
    
    return uniqueTrips;
  }

  async getTodayUserTrips(userId: string): Promise<Trip[]> {
    const { start, end } = this.getCustomDayRange();
    
    // Get trips where user is the driver
    const driverTrips = await db.select()
      .from(trips)
      .where(
        and(
          eq(trips.driverId, userId),
          gte(trips.departureTime, start),
          lt(trips.departureTime, end)
        )
      );
    
    // Get trips where user is a participant
    const participantTrips = await db
      .select({
        id: trips.id,
        driverId: trips.driverId,
        riders: trips.riders,
        fromLocation: trips.fromLocation,
        toLocation: trips.toLocation,
        departureTime: trips.departureTime,
        availableSeats: trips.availableSeats,
        totalSeats: trips.totalSeats,
        isRecurring: trips.isRecurring,
        recurringDays: trips.recurringDays,
        notes: trips.notes,
        createdAt: trips.createdAt,
        updatedAt: trips.updatedAt,
      })
      .from(trips)
      .innerJoin(tripParticipants, eq(trips.id, tripParticipants.tripId))
      .where(
        and(
          eq(tripParticipants.userId, userId),
          gte(trips.departureTime, start),
          lt(trips.departureTime, end)
        )
      );
    
    // Combine and deduplicate trips
    const allTrips = [...driverTrips, ...participantTrips];
    const uniqueTrips = allTrips.filter((trip, index, self) => 
      index === self.findIndex(t => t.id === trip.id)
    );
    
    return uniqueTrips;
  }

  async getTodayTrips(): Promise<Trip[]> {
    const { start, end } = this.getCustomDayRange();
    
    return await db.select()
      .from(trips)
      .where(
        and(
          gte(trips.departureTime, start),
          lt(trips.departureTime, end)
        )
      )
      .orderBy(trips.departureTime);
  }

  async getAllTrips(): Promise<Trip[]> {
    return await db.select().from(trips).orderBy(trips.departureTime);
  }

  async updateTrip(id: number, updates: Partial<InsertTrip>): Promise<Trip> {
    const now = fromGMTPlus3ToUTC(nowGMTPlus3());
    const [trip] = await db
      .update(trips)
      .set({ ...updates, updatedAt: now })
      .where(eq(trips.id, id))
      .returning();
    if (!trip) throw new Error("Trip not found");
    return trip;
  }

  async deleteTrip(id: number): Promise<void> {
    // First remove participants
    await db.delete(tripParticipants).where(eq(tripParticipants.tripId, id));
    // Then remove the trip
    await db.delete(trips).where(eq(trips.id, id));
  }

  async searchTrips(fromLocation?: string, toLocation?: string, date?: Date): Promise<Trip[]> {
    const allTrips = await db.select().from(trips);
    
    return allTrips.filter(trip => {
      if (fromLocation && !trip.fromLocation.toLowerCase().includes(fromLocation.toLowerCase())) {
        return false;
      }
      if (toLocation && !trip.toLocation.toLowerCase().includes(toLocation.toLowerCase())) {
        return false;
      }
      if (date) {
        const tripDate = new Date(trip.departureTime);
        const searchDate = new Date(date);
        if (tripDate.toDateString() !== searchDate.toDateString()) {
          return false;
        }
      }
      return trip.availableSeats > 0;
    });
  }

  // Ride request operations
  async createRideRequest(requestData: InsertRideRequest): Promise<RideRequest> {
    const now = fromGMTPlus3ToUTC(nowGMTPlus3());
    const [request] = await db
      .insert(rideRequests)
      .values({
        riderId: requestData.riderId,
        fromLocation: requestData.fromLocation,
        toLocation: requestData.toLocation,
        preferredTime: requestData.preferredTime,
        passengerCount: requestData.passengerCount || 1,
        notes: requestData.notes || null,
        status: requestData.status || "pending",
        tripId: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return request;
  }

  async getRideRequest(id: number): Promise<RideRequest | undefined> {
    const [request] = await db.select().from(rideRequests).where(eq(rideRequests.id, id));
    return request || undefined;
  }

  async getUserRideRequests(userId: string): Promise<RideRequest[]> {
    return await db.select().from(rideRequests).where(eq(rideRequests.riderId, userId));
  }

  async getTodayUserRideRequests(userId: string): Promise<RideRequest[]> {
    const { start, end } = this.getCustomDayRange();
    return await db.select()
      .from(rideRequests)
      .where(
        and(
          eq(rideRequests.riderId, userId),
          gte(rideRequests.createdAt, start),
          lt(rideRequests.createdAt, end)
        )
      );
  }

  async getPendingRideRequests(): Promise<RideRequest[]> {
    return await db.select().from(rideRequests).where(eq(rideRequests.status, "pending"));
  }

  private getCustomDayRange(date?: Date): { start: Date; end: Date } {
    return getTodayRangeUTC();
  }

  async getTodayRideRequests(): Promise<RideRequest[]> {
    console.log("Getting today's pending ride requests...");
    
    try {
      const { start, end } = this.getCustomDayRange();
      
      console.log("Date range for today's requests:");
      console.log("Start UTC:", start.toISOString());
      console.log("End UTC:", end.toISOString());
      
      const results = await db.select()
        .from(rideRequests)
        .where(
          and(
            eq(rideRequests.status, "pending"),
            gte(rideRequests.preferredTime, start),
            lt(rideRequests.preferredTime, end)
          )
        )
        .orderBy(rideRequests.preferredTime);
      
      console.log(`Found today's pending ride requests: ${results.length}`);
      if (results.length > 0) {
        console.log("Sample request:", results[0]);
      }
      
      // Also log all pending requests to see what's there
      const allPending = await db.select()
        .from(rideRequests)
        .where(eq(rideRequests.status, "pending"))
        .orderBy(rideRequests.preferredTime);
      
      console.log(`Total pending requests in database: ${allPending.length}`);
      if (allPending.length > 0) {
        console.log("Latest pending request:", allPending[allPending.length - 1]);
      }
      
      return results;
    } catch (error) {
      console.error("Error in getTodayRideRequests:", error);
      throw error;
    }
  }

  async updateRideRequestStatus(id: number, status: RideRequest["status"], tripId?: number): Promise<RideRequest> {
    const updateData: any = { 
      status, 
      updatedAt: fromGMTPlus3ToUTC(nowGMTPlus3()) 
    };
    
    if (tripId !== undefined) {
      updateData.tripId = tripId;
    }

    const [request] = await db
      .update(rideRequests)
      .set(updateData)
      .where(eq(rideRequests.id, id))
      .returning();
    
    if (!request) throw new Error("Ride request not found");
    return request;
  }

  async deleteRideRequest(id: number): Promise<void> {
    await db.delete(rideRequests).where(eq(rideRequests.id, id));
  }

  // Trip participant operations
  async addTripParticipant(participantData: InsertTripParticipant): Promise<TripParticipant> {
    const now = fromGMTPlus3ToUTC(nowGMTPlus3());
    const [participant] = await db
      .insert(tripParticipants)
      .values({
        tripId: participantData.tripId,
        userId: participantData.userId,
        seatsBooked: participantData.seatsBooked || 1,
        status: participantData.status || "pending",
        joinedAt: now,
      })
      .returning();
    return participant;
  }

  async getTripParticipants(tripId: number): Promise<TripParticipant[]> {
    return await db.select().from(tripParticipants).where(eq(tripParticipants.tripId, tripId));
  }

  async removeTripParticipant(tripId: number, userId: string): Promise<void> {
    await db.delete(tripParticipants)
      .where(and(eq(tripParticipants.tripId, tripId), eq(tripParticipants.userId, userId)));
  }

  // Trip join request operations
  async createTripJoinRequest(requestData: InsertTripJoinRequest): Promise<TripJoinRequest> {
    const now = fromGMTPlus3ToUTC(nowGMTPlus3());
    const [request] = await db
      .insert(tripJoinRequests)
      .values({
        tripId: requestData.tripId,
        riderId: requestData.riderId,
        seatsRequested: requestData.seatsRequested || 1,
        message: requestData.message,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return request;
  }

  async getTripJoinRequest(id: number): Promise<TripJoinRequest | undefined> {
    const [request] = await db.select().from(tripJoinRequests).where(eq(tripJoinRequests.id, id));
    return request;
  }

  async getTripJoinRequests(tripId: number): Promise<TripJoinRequest[]> {
    return await db.select().from(tripJoinRequests).where(eq(tripJoinRequests.tripId, tripId));
  }

  async getAllTripJoinRequests(): Promise<TripJoinRequest[]> {
    return await db.select().from(tripJoinRequests).orderBy(tripJoinRequests.createdAt);
  }

  async getTodayTripJoinRequests(): Promise<TripJoinRequest[]> {
    const { start, end } = this.getCustomDayRange();
    return await db.select()
      .from(tripJoinRequests)
      .where(
        and(
          gte(tripJoinRequests.createdAt, start),
          lt(tripJoinRequests.createdAt, end)
        )
      )
      .orderBy(tripJoinRequests.createdAt);
  }

  async getUserTripJoinRequests(userId: string): Promise<TripJoinRequest[]> {
    return await db.select().from(tripJoinRequests).where(eq(tripJoinRequests.riderId, userId));
  }

  async updateTripJoinRequestStatus(id: number, status: TripJoinRequest["status"]): Promise<TripJoinRequest> {
    const [request] = await db
      .update(tripJoinRequests)
      .set({ status, updatedAt: fromGMTPlus3ToUTC(nowGMTPlus3()) })
      .where(eq(tripJoinRequests.id, id))
      .returning();
    return request;
  }

  async deleteTripJoinRequest(id: number): Promise<void> {
    await db.delete(tripJoinRequests).where(eq(tripJoinRequests.id, id));
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const now = fromGMTPlus3ToUTC(nowGMTPlus3());
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: notificationData.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        isRead: notificationData.isRead || false,
        createdAt: now,
      })
      .returning();
    return notification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(notifications.createdAt);
  }

  async markNotificationAsRead(id: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }
}

export const storage = new DatabaseStorage();
