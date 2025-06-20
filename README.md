# Carpool Management System

A comprehensive ride-sharing application built with React, Express.js, and PostgreSQL. This system enables users to create trips, request rides, and manage carpooling activities with real-time notifications.

## Features

- **User Management**: Multi-role system (Admin, Driver, Rider)
- **Trip Creation**: Drivers can create and manage trips
- **Ride Requests**: Riders can request rides with automatic matching
- **Real-time Updates**: WebSocket-based live notifications
- **Telegram Integration**: Optional notifications via Telegram bot
- **Admin Dashboard**: Complete administrative control panel
- **Multi-language Support**: Arabic and English interface

## Prerequisites

Before running the application, ensure you have:

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **PostgreSQL** database (local or remote)

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd carpool-management-system

# Install dependencies
npm install
```

### 2. Database Setup

#### Option A: Using Replit's Built-in Database
If you're running on Replit, the PostgreSQL database is automatically configured.

#### Option B: Local PostgreSQL Setup
```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER carpool_user WITH PASSWORD 'your_secure_password';
CREATE DATABASE carpool_db OWNER carpool_user;
GRANT ALL PRIVILEGES ON DATABASE carpool_db TO carpool_user;
EOF
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://carpool_user:your_secure_password@localhost:5432/carpool_db

# Session Configuration
SESSION_SECRET=your_very_secure_session_secret_here

# Optional: Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

### 4. Database Schema Setup

```bash
# Push database schema to create tables
npm run db:push
```

### 5. Running on Port 3000

To run the application on port 3000 instead of the default port 5000, you have two options:

#### Option A: Temporary Port Change
```bash
# Set PORT environment variable
PORT=3000 npm run dev
```

#### Option B: Permanent Port Change
Modify the `server/index.ts` file:

```bash
# Edit the server configuration
# Change line 64 from: const port = 5000;
# To: const port = process.env.PORT || 3000;
```

Then create or update your `.env` file:
```env
PORT=3000
# ... other environment variables
```

### 6. Start the Application

```bash
# Development mode
npm run dev

# The application will be available at:
# http://localhost:3000 (if you modified the port)
# http://localhost:5000 (default configuration)
```

## Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run check

# Database schema operations
npm run db:push
```

## Application Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages/routes
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions and helpers
├── server/                # Express.js backend
│   ├── auth.ts           # Authentication middleware
│   ├── routes.ts         # API route definitions
│   ├── storage.ts        # Database operations layer
│   ├── index.ts          # Server entry point
│   └── new-routes.ts     # Updated API routes
├── shared/               # Shared types and schemas
│   ├── schema.ts         # Database schema definitions
│   └── timezone.ts       # Timezone utilities
└── README.md             # This file
```

## First Time Usage

### Default Access
1. Navigate to your application URL (http://localhost:3000 or configured port)
2. The system automatically creates sample users on first startup
3. Check the console logs for default admin credentials

### User Roles

- **Admin**: Full system access, user management, trip oversight
- **Driver**: Can create trips, manage passengers, view requests
- **Rider**: Can request rides, join available trips, view notifications

### Core Workflows

#### Creating a Trip (Drivers/Admins)
1. Log in with driver or admin credentials
2. Navigate to Dashboard
3. Click "Create Trip"
4. Fill in:
   - Departure location
   - Arrival location
   - Departure time
   - Available seats
   - Optional notes

#### Requesting a Ride (Riders)
1. Log in with rider credentials
2. Use "Request Ride" feature
3. Specify:
   - Pickup location
   - Drop-off location
   - Preferred time
   - Number of passengers
4. System automatically matches with available trips

#### Managing Requests (Admins)
1. Access Admin Dashboard
2. View all pending ride requests
3. Approve/decline requests manually
4. Monitor trip utilization and user activity

## Telegram Integration (Optional)

To enable Telegram notifications:

### 1. Create a Telegram Bot
```bash
# Message @BotFather on Telegram
# Send: /newbot
# Follow the prompts to create your bot
# Save the provided bot token
```

### 2. Configure Environment
Add to your `.env` file:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
```

### 3. Get User Telegram IDs
- Users message @userinfobot to get their Telegram ID
- Update user profiles with their Telegram IDs
- Admins can configure notifications in the dashboard

## Production Deployment

### Environment Setup
```env
NODE_ENV=production
SESSION_SECRET=very_secure_production_secret
DATABASE_URL=your_production_database_url
PORT=3000
```

### Build and Deploy
```bash
# Build the application
npm run build

# Start production server
npm start
```

### Security Considerations
- Use strong, unique SESSION_SECRET
- Enable SSL/TLS for production
- Configure firewall rules appropriately
- Regular database backups
- Monitor application logs

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using the port
lsof -ti:3000

# Kill the process
lsof -ti:3000 | xargs kill

# Or use a different port
PORT=3001 npm run dev
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Test connection
psql -h localhost -U carpool_user -d carpool_db
```

#### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18+
```

#### Missing Tables Error
```bash
# Recreate database schema
npm run db:push
```

### Development Tips

- Monitor application logs for debugging information
- Use browser developer tools for frontend issues
- Check network tab for API request/response details
- WebSocket connections require both ports (main app + WebSocket server)

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/user` - Get current user

### Trips
- `GET /api/trips` - List all trips
- `POST /api/trips` - Create new trip
- `PUT /api/trips/:id` - Update trip
- `DELETE /api/trips/:id` - Delete trip

### Ride Requests
- `GET /api/ride-requests` - List ride requests
- `POST /api/ride-requests` - Create ride request
- `PUT /api/ride-requests/:id` - Update request status

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
1. Check this README and troubleshooting section
2. Review application logs for error details
3. Ensure all prerequisites are properly installed
4. Verify database connectivity and schema

---

**Note**: This application is designed for educational and internal use. Ensure proper security measures are implemented before deploying to production environments.