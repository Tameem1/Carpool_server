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

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;
  updateUserRole(id: string, role: UserRole): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Trip operations
  createTrip(trip: InsertTrip): Promise<Trip>;
  getTrip(id: number): Promise<Trip | undefined>;
  getUserTrips(userId: string): Promise<Trip[]>;
  getAllTrips(): Promise<Trip[]>;
  updateTrip(id: number, updates: Partial<InsertTrip>): Promise<Trip>;
  deleteTrip(id: number): Promise<void>;
  searchTrips(fromLocation?: string, toLocation?: string, date?: Date): Promise<Trip[]>;
  
  // Ride request operations
  createRideRequest(request: InsertRideRequest): Promise<RideRequest>;
  getRideRequest(id: number): Promise<RideRequest | undefined>;
  getUserRideRequests(userId: string): Promise<RideRequest[]>;
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

  // Check if a trip should be marked as completed (2 hours after departure time)
  private shouldTripBeCompleted(trip: Trip): boolean {
    const now = new Date();
    const departureTime = new Date(trip.departureTime);
    const twoHoursAfterDeparture = new Date(departureTime.getTime() + 2 * 60 * 60 * 1000);
    
    // Only mark as completed if:
    // 1. Trip status is currently active
    // 2. Current time is more than 2 hours after departure time
    // 3. Departure time is in the past (not a future trip)
    return trip.status === "active" && 
           now > twoHoursAfterDeparture && 
           now > departureTime;
  }

  // Update expired trips to completed status
  private async updateExpiredTrips(): Promise<void> {
    try {
      // Get trips directly from database to avoid circular dependency
      const allTrips = await db.select().from(trips);
      const expiredTrips = allTrips.filter(trip => this.shouldTripBeCompleted(trip));
      
      for (const trip of expiredTrips) {
        await this.updateTrip(trip.id, { status: "completed" });
      }
      
      if (expiredTrips.length > 0) {
        console.log(`Updated ${expiredTrips.length} expired trips to completed status`);
      }
    } catch (error) {
      console.error("Error updating expired trips:", error);
    }
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
          role: 'admin' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'driver-1',
          email: 'alice.driver@demo.com',
          firstName: 'Alice',
          lastName: 'Johnson',
          role: 'user' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'driver-2', 
          email: 'bob.driver@demo.com',
          firstName: 'Bob',
          lastName: 'Smith',
          role: 'user' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'rider-1',
          email: 'charlie.rider@demo.com',
          firstName: 'Charlie',
          lastName: 'Brown',
          role: 'user' as UserRole,
          profileImageUrl: null,
        },
        {
          id: 'rider-2',
          email: 'diana.rider@demo.com',
          firstName: 'Diana',
          lastName: 'Wilson',
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
          profileImageUrl: userData.profileImageUrl || null,
          role: userData.role || "user",
          updatedAt: new Date(),
        }
      })
      .returning();
    return user;
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
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
        status: tripData.status || "active",
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

  async getAllTrips(): Promise<Trip[]> {
    return await db.select().from(trips);
  }

  async updateTrip(id: number, updates: Partial<InsertTrip>): Promise<Trip> {
    const [trip] = await db
      .update(trips)
      .set({ ...updates, updatedAt: new Date() })
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
    let query = db.select().from(trips).where(eq(trips.status, "active"));
    
    // Note: This is a simplified search. For production, you'd want to use proper text search capabilities
    const allTrips = await query;
    
    return allTrips.filter(trip => {
      // Check if trip is still within the 2-hour active window
      if (this.shouldTripBeCompleted(trip)) {
        return false;
      }
      
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

  async getPendingRideRequests(): Promise<RideRequest[]> {
    return await db.select().from(rideRequests).where(eq(rideRequests.status, "pending"));
  }

  private getCustomDayRange(date?: Date): { start: Date; end: Date } {
    const now = date || new Date();
    const currentHour = now.getHours();
    
    // If it's before 5 AM, we're in the previous day (started at 5 AM yesterday)
    const dayStart = new Date(now);
    if (currentHour < 5) {
      dayStart.setDate(dayStart.getDate() - 1);
    }
    dayStart.setHours(5, 0, 0, 0);
    
    // Day ends at 4 AM the next day
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(4, 0, 0, 0);
    
    return { start: dayStart, end: dayEnd };
  }

  async getTodayRideRequests(): Promise<RideRequest[]> {
    const { start, end } = this.getCustomDayRange();
    return await db.select()
      .from(rideRequests)
      .where(
        and(
          eq(rideRequests.status, "pending"),
          gte(rideRequests.createdAt, start),
          lt(rideRequests.createdAt, end)
        )
      );
  }

  async updateRideRequestStatus(id: number, status: RideRequest["status"], tripId?: number): Promise<RideRequest> {
    const [request] = await db
      .update(rideRequests)
      .set({ 
        status, 
        tripId: tripId || undefined,
        updatedAt: new Date() 
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
      .set({ status, updatedAt: new Date() })
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
