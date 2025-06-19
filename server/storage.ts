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
import { nowGMTPlus3, toGMTPlus3, GMT_PLUS_3_OFFSET } from "@shared/timezone";

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
          email: 'admin@demo.com',
          firstName: 'Admin',
          lastName: 'User',
          phoneNumber: '+1-555-0001',
          role: 'admin' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'driver-1',
          email: 'alice.driver@demo.com',
          firstName: 'Alice',
          lastName: 'Johnson',
          phoneNumber: '+1-555-0101',
          role: 'user' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'driver-2', 
          email: 'bob.driver@demo.com',
          firstName: 'Bob',
          lastName: 'Smith',
          phoneNumber: '+1-555-0102',
          role: 'user' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'rider-1',
          email: 'charlie.rider@demo.com',
          firstName: 'Charlie',
          lastName: 'Brown',
          phoneNumber: '+1-555-0201',
          role: 'user' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'rider-2',
          email: 'diana.rider@demo.com',
          firstName: 'Diana',
          lastName: 'Wilson',
          phoneNumber: '+1-555-0202',
          role: 'user' as UserRole,
          profileImageUrl: null,
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
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
        role: userData.role || "user",
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email || null,
          firstName: userData.firstName || null,
          lastName: userData.lastName || null,
          phoneNumber: userData.phoneNumber || null,
          telegramUsername: userData.telegramUsername || null,
          telegramId: userData.telegramId || null,
          profileImageUrl: userData.profileImageUrl || null,
          role: userData.role || "user",
          updatedAt: nowGMTPlus3(),
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
      })
      .returning();
    return trip;
  }

  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(trips).where(eq(trips.id, id));
    return trip || undefined;
  }

  async getUserTrips(userId: string): Promise<Trip[]> {
    return await db.select().from(trips).where(eq(trips.driverId, userId));
  }

  async getTodayUserTrips(userId: string): Promise<Trip[]> {
    const { start, end } = this.getCustomDayRange();
    return await db.select()
      .from(trips)
      .where(
        and(
          eq(trips.driverId, userId),
          gte(trips.departureTime, start),
          lt(trips.departureTime, end)
        )
      );
  }

  async getAllTrips(): Promise<Trip[]> {
    return await db.select().from(trips);
  }

  async updateTrip(id: number, updates: Partial<InsertTrip>): Promise<Trip> {
    const [trip] = await db
      .update(trips)
      .set({ ...updates, updatedAt: nowGMTPlus3() })
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
    // Use GMT+3 time for all calculations
    const now = date ? toGMTPlus3(date) : nowGMTPlus3();
    const currentHour = now.getHours();
    
    // If it's before 5 AM GMT+3, we're in the previous day (started at 5 AM yesterday GMT+3)
    const dayStart = new Date(now);
    if (currentHour < 5) {
      dayStart.setDate(dayStart.getDate() - 1);
    }
    dayStart.setHours(5, 0, 0, 0);
    
    // Day ends at 4 AM the next day GMT+3
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(4, 0, 0, 0);
    
    // Convert back to UTC for database queries
    const startUTC = new Date(dayStart.getTime() - 3 * 60 * 60 * 1000);
    const endUTC = new Date(dayEnd.getTime() - 3 * 60 * 60 * 1000);
    
    return { start: startUTC, end: endUTC };
  }

  async getTodayRideRequests(): Promise<RideRequest[]> {
    const { start, end } = this.getCustomDayRange();
    console.log("Getting today's ride requests between:", start, "and", end);
    
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
    
    console.log("Found ride requests in storage:", results.length);
    return results;
  }

  async updateRideRequestStatus(id: number, status: RideRequest["status"], tripId?: number): Promise<RideRequest> {
    const [request] = await db
      .update(rideRequests)
      .set({ 
        status, 
        tripId: tripId || undefined,
        updatedAt: nowGMTPlus3() 
      })
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
    const [participant] = await db
      .insert(tripParticipants)
      .values({
        tripId: participantData.tripId,
        userId: participantData.userId,
        seatsBooked: participantData.seatsBooked || 1,
        status: participantData.status || "pending",
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
    const [request] = await db
      .insert(tripJoinRequests)
      .values({
        tripId: requestData.tripId,
        riderId: requestData.riderId,
        seatsRequested: requestData.seatsRequested || 1,
        message: requestData.message,
        status: "pending",
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
      .set({ status, updatedAt: nowGMTPlus3() })
      .where(eq(tripJoinRequests.id, id))
      .returning();
    return request;
  }

  async deleteTripJoinRequest(id: number): Promise<void> {
    await db.delete(tripJoinRequests).where(eq(tripJoinRequests.id, id));
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: notificationData.userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        isRead: notificationData.isRead || false,
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
