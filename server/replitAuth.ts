import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import MemoryStore from "memorystore";

// Demo users for development
const demoUsers = [
  { id: "admin-1", email: "admin@demo.com", firstName: "Admin", lastName: "User", role: "admin" as const, profileImageUrl: null },
  { id: "driver-1", email: "driver@demo.com", firstName: "John", lastName: "Driver", role: "driver" as const, profileImageUrl: null },
  { id: "rider-1", email: "rider@demo.com", firstName: "Jane", lastName: "Rider", role: "rider" as const, profileImageUrl: null },
];

export async function setupAuth(app: Express) {
  // Session middleware first
  const memoryStore = MemoryStore(session);
  app.use(session({
    secret: 'demo-secret-key',
    store: new memoryStore({ checkPeriod: 86400000 }),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
  }));

  // Simple demo login routes
  app.get("/api/login", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Demo Login</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
            .user-card { border: 1px solid #ccc; padding: 20px; margin: 10px 0; border-radius: 8px; cursor: pointer; }
            .user-card:hover { background-color: #f5f5f5; }
            h1 { color: #00D4AA; }
          </style>
        </head>
        <body>
          <h1>RideShare Pro - Demo Login</h1>
          <p>Choose a demo user to login as:</p>
          ${demoUsers.map(user => `
            <div class="user-card" onclick="loginAs('${user.id}')">
              <strong>${user.firstName} ${user.lastName}</strong><br>
              <em>${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</em><br>
              ${user.email}
            </div>
          `).join('')}
          <script>
            function loginAs(userId) {
              fetch('/api/demo-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
              }).then(() => {
                window.location.href = '/';
              });
            }
          </script>
        </body>
      </html>
    `);
  });

  app.post("/api/demo-login", async (req, res) => {
    const { userId } = req.body;
    const user = demoUsers.find(u => u.id === userId);
    
    if (!user) {
      return res.status(400).json({ message: "Invalid user" });
    }

    // Store user in storage
    await storage.upsertUser(user);
    
    // Set session
    (req as any).session.userId = userId;
    res.json({ success: true });
  });

  app.get("/api/logout", (req, res) => {
    (req as any).session.destroy((err: any) => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const userId = (req as any).session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  (req as any).user = { claims: { sub: userId } };
  (req as any).currentUser = user;
  next();
};