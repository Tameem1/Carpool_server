import {
  users,
  trips,
  rideRequests,
  tripParticipants,
  notifications,
  type User,
  type InsertUser,
  type Trip,
  type InsertTrip,
  type RideRequest,
  type InsertRideRequest,
  type TripParticipant,
  type InsertTripParticipant,
  type Notification,
  type InsertNotification,
  type UserRole,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: InsertUser): Promise<User>;
  updateUserRole(id: string, role: UserRole): Promise<User>;
  
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
  updateRideRequestStatus(id: number, status: RideRequest["status"], tripId?: number): Promise<RideRequest>;
  deleteRideRequest(id: number): Promise<void>;
  
  // Trip participant operations
  addTripParticipant(participant: InsertTripParticipant): Promise<TripParticipant>;
  getTripParticipants(tripId: number): Promise<TripParticipant[]>;
  removeTripParticipant(tripId: number, userId: string): Promise<void>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private trips: Map<number, Trip>;
  private rideRequests: Map<number, RideRequest>;
  private tripParticipants: Map<number, TripParticipant>;
  private notifications: Map<number, Notification>;
  private currentTripId: number;
  private currentRideRequestId: number;
  private currentParticipantId: number;
  private currentNotificationId: number;

  constructor() {
    this.users = new Map();
    this.trips = new Map();
    this.rideRequests = new Map();
    this.tripParticipants = new Map();
    this.notifications = new Map();
    this.currentTripId = 1;
    this.currentRideRequestId = 1;
    this.currentParticipantId = 1;
    this.currentNotificationId = 1;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: InsertUser): Promise<User> {
    const existing = this.users.get(userData.id!);
    const user: User = {
      id: userData.id!,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      role: userData.role || "rider",
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    
    const updatedUser: User = { ...user, role, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Trip operations
  async createTrip(tripData: InsertTrip): Promise<Trip> {
    const id = this.currentTripId++;
    const trip: Trip = {
      id,
      driverId: tripData.driverId,
      fromLocation: tripData.fromLocation,
      toLocation: tripData.toLocation,
      departureTime: tripData.departureTime,
      availableSeats: tripData.availableSeats,
      totalSeats: tripData.totalSeats,

      isRecurring: tripData.isRecurring || null,
      recurringDays: tripData.recurringDays || null,
      notes: tripData.notes || null,
      status: tripData.status || "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.trips.set(id, trip);
    return trip;
  }

  async getTrip(id: number): Promise<Trip | undefined> {
    return this.trips.get(id);
  }

  async getUserTrips(userId: string): Promise<Trip[]> {
    return Array.from(this.trips.values()).filter(trip => trip.driverId === userId);
  }

  async getAllTrips(): Promise<Trip[]> {
    return Array.from(this.trips.values());
  }

  async updateTrip(id: number, updates: Partial<InsertTrip>): Promise<Trip> {
    const trip = this.trips.get(id);
    if (!trip) throw new Error("Trip not found");
    
    const updatedTrip: Trip = { ...trip, ...updates, updatedAt: new Date() };
    this.trips.set(id, updatedTrip);
    return updatedTrip;
  }

  async deleteTrip(id: number): Promise<void> {
    this.trips.delete(id);
    // Also remove participants
    Array.from(this.tripParticipants.values())
      .filter(p => p.tripId === id)
      .forEach(p => this.tripParticipants.delete(p.id));
  }

  async searchTrips(fromLocation?: string, toLocation?: string, date?: Date): Promise<Trip[]> {
    return Array.from(this.trips.values()).filter(trip => {
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
      return trip.status === "active" && trip.availableSeats > 0;
    });
  }

  // Ride request operations
  async createRideRequest(requestData: InsertRideRequest): Promise<RideRequest> {
    const id = this.currentRideRequestId++;
    const request: RideRequest = {
      id,
      riderId: requestData.riderId,
      fromLocation: requestData.fromLocation,
      toLocation: requestData.toLocation,
      preferredTime: requestData.preferredTime,
      passengerCount: requestData.passengerCount || 1,
      notes: requestData.notes || null,
      status: requestData.status || "pending",
      tripId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rideRequests.set(id, request);
    return request;
  }

  async getRideRequest(id: number): Promise<RideRequest | undefined> {
    return this.rideRequests.get(id);
  }

  async getUserRideRequests(userId: string): Promise<RideRequest[]> {
    return Array.from(this.rideRequests.values()).filter(request => request.riderId === userId);
  }

  async getPendingRideRequests(): Promise<RideRequest[]> {
    return Array.from(this.rideRequests.values()).filter(request => request.status === "pending");
  }

  async updateRideRequestStatus(id: number, status: RideRequest["status"], tripId?: number): Promise<RideRequest> {
    const request = this.rideRequests.get(id);
    if (!request) throw new Error("Ride request not found");
    
    const updatedRequest: RideRequest = { 
      ...request, 
      status, 
      tripId: tripId || request.tripId,
      updatedAt: new Date() 
    };
    this.rideRequests.set(id, updatedRequest);
    return updatedRequest;
  }

  async deleteRideRequest(id: number): Promise<void> {
    this.rideRequests.delete(id);
  }

  // Trip participant operations
  async addTripParticipant(participantData: InsertTripParticipant): Promise<TripParticipant> {
    const id = this.currentParticipantId++;
    const participant: TripParticipant = {
      id,
      tripId: participantData.tripId,
      userId: participantData.userId,
      seatsBooked: participantData.seatsBooked || 1,
      status: participantData.status || "pending",
      joinedAt: new Date(),
    };
    this.tripParticipants.set(id, participant);
    return participant;
  }

  async getTripParticipants(tripId: number): Promise<TripParticipant[]> {
    return Array.from(this.tripParticipants.values()).filter(p => p.tripId === tripId);
  }

  async removeTripParticipant(tripId: number, userId: string): Promise<void> {
    const participant = Array.from(this.tripParticipants.values())
      .find(p => p.tripId === tripId && p.userId === userId);
    if (participant) {
      this.tripParticipants.delete(participant.id);
    }
  }

  // Notification operations
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const id = this.currentNotificationId++;
    const notification: Notification = {
      id,
      userId: notificationData.userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      isRead: notificationData.isRead || false,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime());
  }

  async markNotificationAsRead(id: number): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      this.notifications.set(id, { ...notification, isRead: true });
    }
  }
}

export const storage = new MemStorage();
