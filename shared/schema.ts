import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum - expanded to include teacher, student, manager
export const userRoles = ["teacher", "student", "manager", "admin"] as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").notNull(),
  section: varchar("section").notNull(),
  telegramUsername: varchar("telegram_username"),
  password: varchar("password").notNull(),
  telegramId: varchar("telegram_id"),
  role: varchar("role", { enum: userRoles }).notNull().default("student"),
});

export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  driverId: varchar("driver_id").notNull(),
  riders: text("riders").array(), // Array of rider user IDs
  fromLocation: text("from_location").notNull(),
  toLocation: text("to_location").notNull(),
  departureTime: timestamp("departure_time").notNull(),
  availableSeats: integer("available_seats").notNull(),
  totalSeats: integer("total_seats").notNull(),

  isRecurring: boolean("is_recurring").default(false),
  recurringDays: text("recurring_days"), // JSON array of days
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rideRequests = pgTable("ride_requests", {
  id: serial("id").primaryKey(),
  riderId: varchar("rider_id").notNull(),
  fromLocation: text("from_location").notNull(),
  toLocation: text("to_location").notNull(),
  preferredTime: timestamp("preferred_time").notNull(),
  passengerCount: integer("passenger_count").notNull().default(1),
  notes: text("notes"),
  status: varchar("status", { enum: ["pending", "accepted", "declined", "cancelled"] }).default("pending"),
  tripId: integer("trip_id"), // null when pending, set when accepted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tripParticipants = pgTable("trip_participants", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull(),
  userId: varchar("user_id").notNull(),
  seatsBooked: integer("seats_booked").notNull().default(1),
  status: varchar("status", { enum: ["confirmed", "pending", "cancelled"] }).default("pending"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const tripJoinRequests = pgTable("trip_join_requests", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull(),
  riderId: varchar("rider_id").notNull(),
  seatsRequested: integer("seats_requested").notNull().default(1),
  message: text("message"),
  status: varchar("status", { enum: ["pending", "approved", "declined"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type", { enum: ["trip_created", "request_received", "request_accepted", "request_declined", "trip_updated", "trip_match_found", "join_request_received", "join_request_approved", "join_request_declined", "rider_joined", "join_approved"] }).notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  rideRequests: many(rideRequests),
  tripParticipants: many(tripParticipants),
  tripJoinRequests: many(tripJoinRequests),
  notifications: many(notifications),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  driver: one(users, {
    fields: [trips.driverId],
    references: [users.id],
  }),
  participants: many(tripParticipants),
  rideRequests: many(rideRequests),
  joinRequests: many(tripJoinRequests),
}));

export const rideRequestsRelations = relations(rideRequests, ({ one }) => ({
  rider: one(users, {
    fields: [rideRequests.riderId],
    references: [users.id],
  }),
  trip: one(trips, {
    fields: [rideRequests.tripId],
    references: [trips.id],
  }),
}));

export const tripParticipantsRelations = relations(tripParticipants, ({ one }) => ({
  trip: one(trips, {
    fields: [tripParticipants.tripId],
    references: [trips.id],
  }),
  user: one(users, {
    fields: [tripParticipants.userId],
    references: [users.id],
  }),
}));

export const tripJoinRequestsRelations = relations(tripJoinRequests, ({ one }) => ({
  trip: one(trips, {
    fields: [tripJoinRequests.tripId],
    references: [trips.id],
  }),
  rider: one(users, {
    fields: [tripJoinRequests.riderId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  departureTime: z.string().transform((str) => new Date(str)),
  driverId: z.string().optional(), // Allow admin to specify driver
  riders: z.array(z.string()).optional(), // Array of rider user IDs
  participantIds: z.array(z.string()).optional(), // Admin can pre-assign participants
  totalSeats: z.number().optional(), // Make optional since it's derived from availableSeats
  recurringDays: z.array(z.string()).optional().transform((arr) => arr ? JSON.stringify(arr) : null), // Convert array to JSON string
});

export const insertRideRequestSchema = createInsertSchema(rideRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tripId: true,
}).extend({
  preferredTime: z.string().transform((str) => new Date(str)),
});

export const insertTripParticipantSchema = createInsertSchema(tripParticipants).omit({
  id: true,
  joinedAt: true,
});

export const insertTripJoinRequestSchema = createInsertSchema(tripJoinRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type RideRequest = typeof rideRequests.$inferSelect;
export type InsertRideRequest = z.infer<typeof insertRideRequestSchema>;
export type TripParticipant = typeof tripParticipants.$inferSelect;
export type InsertTripParticipant = z.infer<typeof insertTripParticipantSchema>;
export type TripJoinRequest = typeof tripJoinRequests.$inferSelect;
export type InsertTripJoinRequest = z.infer<typeof insertTripJoinRequestSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UserRole = typeof userRoles[number];
