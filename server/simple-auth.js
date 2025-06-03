const session = require('express-session');

// Demo users for development
const demoUsers = [
  { id: "admin-1", email: "admin@demo.com", firstName: "Admin", lastName: "User", role: "admin", profileImageUrl: null },
  { id: "driver-1", email: "driver@demo.com", firstName: "John", lastName: "Driver", role: "driver", profileImageUrl: null },
  { id: "rider-1", email: "rider@demo.com", firstName: "Jane", lastName: "Rider", role: "rider", profileImageUrl: null },
];

async function setupAuth(app, storage) {
  // Session middleware
  app.use(session({
    secret: 'demo-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 }
  }));

  // Demo login page
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
    req.session.userId = userId;
    res.json({ success: true });
  });

  app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      res.redirect("/");
    });
  });
}

const isAuthenticated = async (req, res, next) => {
  const userId = req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // This would normally check storage, but we'll just continue for demo
  req.user = { claims: { sub: userId } };
  req.currentUser = { id: userId };
  next();
};

module.exports = { setupAuth, isAuthenticated };