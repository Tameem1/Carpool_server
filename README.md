# Carpool Coordination Platform

A comprehensive carpool coordination platform that streamlines trip management through an intuitive web interface with advanced multi-user role support and robust administrative controls.

## Features

- **Multi-role User Management**: Admin, Driver, and Rider roles with appropriate permissions
- **Trip Management**: Create, edit, and manage carpool trips
- **Ride Requests**: Request rides and match with available trips
- **Real-time Updates**: WebSocket-powered live updates
- **Telegram Notifications**: Automated notifications for admins and users
- **Responsive Design**: Mobile-friendly interface built with React and Tailwind CSS
- **Timezone Support**: GMT+3 timezone handling for regional users

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket (ws)
- **Authentication**: Passport.js with session management
- **Notifications**: Telegram Bot API
- **UI Components**: Radix UI, shadcn/ui

## Prerequisites

Before running this application locally, ensure you have the following installed:

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **PostgreSQL** (version 12 or higher)
- **Git** (for cloning the repository)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd carpool-platform
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

The application supports both local PostgreSQL and cloud-hosted databases. Choose the option that best fits your needs.

#### Option A: Local PostgreSQL Setup

**Step 1: Install PostgreSQL**

- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- **macOS**: 
  ```bash
  # Using Homebrew
  brew install postgresql
  brew services start postgresql
  ```
- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt update
  sudo apt install postgresql postgresql-contrib
  sudo systemctl start postgresql
  sudo systemctl enable postgresql
  ```

**Step 2: Create Database and User**

```bash
# Switch to postgres user (Linux/macOS)
sudo -u postgres psql

# Or connect directly (Windows/macOS with Homebrew)
psql postgres
```

Then run these SQL commands:

```sql
-- Create a new database
CREATE DATABASE carpool_db;

-- Create a dedicated user (recommended for security)
CREATE USER carpool_user WITH PASSWORD 'your_secure_password_here';

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE carpool_db TO carpool_user;

-- Grant schema permissions (required for Drizzle ORM)
\c carpool_db
GRANT ALL ON SCHEMA public TO carpool_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO carpool_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO carpool_user;

-- Exit psql
\q
```

**Step 3: Test the Connection**

```bash
# Test connection with the new user
psql -h localhost -U carpool_user -d carpool_db
# Enter your password when prompted
```

#### Option B: Cloud Database (Neon, Supabase, Railway, etc.)

**Neon (Recommended for serverless)**:
1. Visit [neon.tech](https://neon.tech) and create an account
2. Create a new project
3. Copy the connection string from the dashboard

**Supabase**:
1. Visit [supabase.com](https://supabase.com) and create an account
2. Create a new project
3. Go to Settings → Database and copy the connection string

**Railway**:
1. Visit [railway.app](https://railway.app) and create an account
2. Create a new PostgreSQL database
3. Copy the connection string from the variables tab

### 4. Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database Configuration - Choose ONE of these formats:

# For Local PostgreSQL:
DATABASE_URL=postgresql://carpool_user:your_secure_password_here@localhost:5432/carpool_db

# For Neon (Serverless):
DATABASE_URL=postgresql://username:password@ep-example-123456.us-east-2.aws.neon.tech/dbname?sslmode=require

# For Supabase:
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres

# For Railway:
DATABASE_URL=postgresql://postgres:password@containers-us-west-1.railway.app:5432/railway

# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-session-key-here

# Telegram Bot (Optional - for notifications)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Application Environment
NODE_ENV=development

# Database Provider (affects db.ts configuration)
DB_PROVIDER=local  # Options: 'local' or 'neon' or 'cloud'
```

**Important Notes for Local Setup**:
- Replace `your_secure_password_here` with your actual password
- Ensure PostgreSQL is running before starting the application
- The default PostgreSQL port is 5432
- If you're using a different port, update the DATABASE_URL accordingly

### Switching from Neon to Local PostgreSQL

The project currently uses Neon's serverless PostgreSQL by default. To switch to a local PostgreSQL database:

**Option 1: Use the Local Database Configuration File**

1. Install the standard PostgreSQL driver:
   ```bash
   npm install pg @types/pg
   ```

2. Replace the database import in your server files:
   ```bash
   # In all server files that import from './db', change:
   # import { db, pool } from './db';
   # to:
   # import { db, pool } from './db-local';
   ```

3. Or rename the files:
   ```bash
   mv server/db.ts server/db-neon.ts
   mv server/db-local.ts server/db.ts
   ```

**Option 2: Modify db.ts Directly**

Replace the contents of `server/db.ts` with:
```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false // Disabled for local development
});

export const db = drizzle({ client: pool, schema });
```

### 5. Database Migration

Push the database schema:

```bash
npm run db:push
```

This command will create all necessary tables in your PostgreSQL database.

**Note**: If you see an error about missing packages when using local PostgreSQL, you may need to install the standard PostgreSQL driver:

```bash
npm install pg @types/pg
```

The project automatically detects your database provider and uses the appropriate driver.

### 6. Start the Application

```bash
npm run dev
```

The application will start on:
- **Frontend**: http://localhost:5000
- **WebSocket Server**: Port 5001 (for real-time features)

## Usage

### First Time Setup

1. Navigate to http://localhost:5000
2. The application will automatically create sample users on first run
3. Default admin credentials are created automatically

### User Roles

- **Admin**: Full access to manage users, trips, and ride requests
- **Driver**: Can create trips and manage their own trips
- **Rider**: Can request rides and join available trips

### Core Features

1. **Creating Trips** (Drivers/Admins):
   - Navigate to Dashboard
   - Click "Create Trip"
   - Fill in departure/arrival locations, time, and available seats

2. **Requesting Rides** (Riders):
   - Use "Request Ride" feature
   - Specify pickup/dropoff locations and preferred time
   - System will match with available trips

3. **Managing Requests** (Admins):
   - View all ride requests in Admin Dashboard
   - Approve/decline requests
   - Monitor trip utilization

## Optional: Telegram Notifications

To enable Telegram notifications for ride requests and trip updates:

1. **Create a Telegram Bot**:
   - Message @BotFather on Telegram
   - Send `/newbot` and follow instructions
   - Save the bot token

2. **Get Your Telegram ID**:
   - Message @userinfobot on Telegram
   - Note your numeric user ID

3. **Configure the Bot**:
   - Add `TELEGRAM_BOT_TOKEN` to your `.env` file
   - Update user profiles with Telegram IDs for notifications

See `TELEGRAM_SETUP.md` for detailed Telegram integration instructions.

## Development Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Type checking
npm run check

# Database schema push
npm run db:push
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility functions
├── server/                # Node.js backend
│   ├── auth.ts           # Authentication logic
│   ├── routes.ts         # API routes
│   ├── storage.ts        # Database operations
│   └── index.ts          # Server entry point
├── shared/               # Shared types and utilities
│   ├── schema.ts         # Database schema & types
│   └── timezone.ts       # Timezone utilities
└── package.json          # Dependencies and scripts
```

## Database Schema

The application uses the following main entities:

- **Users**: User accounts with roles (admin, driver, rider)
- **Trips**: Carpool trips with driver, route, and timing
- **Ride Requests**: User requests for rides
- **Trip Participants**: Users who joined specific trips
- **Trip Join Requests**: Requests to join existing trips
- **Notifications**: System notifications for users

## API Endpoints

### Authentication
- `GET /api/auth/user` - Get current user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Trips
- `GET /api/trips` - Get all trips
- `POST /api/trips` - Create new trip
- `PUT /api/trips/:id` - Update trip
- `DELETE /api/trips/:id` - Delete trip

### Ride Requests
- `GET /api/ride-requests` - Get user's ride requests
- `POST /api/ride-requests` - Create ride request
- `PUT /api/ride-requests/:id/status` - Update request status

### Admin
- `GET /api/users` - Get all users (admin only)
- `GET /api/stats` - Get platform statistics
- `PUT /api/users/:id/role` - Update user role

## Troubleshooting

### Database Setup Issues

#### 1. **PostgreSQL Connection Errors**

**Error**: `error: password authentication failed for user`
```bash
# Solution: Check your credentials and recreate the user
sudo -u postgres psql
DROP USER IF EXISTS carpool_user;
CREATE USER carpool_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE carpool_db TO carpool_user;
```

**Error**: `FATAL: database "carpool_db" does not exist`
```bash
# Solution: Create the database
sudo -u postgres psql
CREATE DATABASE carpool_db;
```

**Error**: `ECONNREFUSED` or `connection refused`
```bash
# Solution: Start PostgreSQL service
# Linux/Ubuntu:
sudo systemctl start postgresql
sudo systemctl enable postgresql

# macOS (Homebrew):
brew services start postgresql

# Windows: Start PostgreSQL service from Services app
```

#### 2. **Database Provider Detection Issues**

**Error**: Cannot find module '@neondatabase/serverless'
```bash
# Solution: The app is trying to use Neon driver for local database
# Set DB_PROVIDER in your .env file:
echo "DB_PROVIDER=local" >> .env

# Or install missing packages if using Neon:
npm install @neondatabase/serverless ws
```

**Error**: Cannot find module 'pg'
```bash
# Solution: Install PostgreSQL driver for local database
npm install pg @types/pg
```

#### 3. **Schema Migration Issues**

**Error**: `permission denied for schema public`
```sql
-- Solution: Grant schema permissions
\c carpool_db
GRANT ALL ON SCHEMA public TO carpool_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO carpool_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO carpool_user;
-- For future tables:
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO carpool_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO carpool_user;
```

**Error**: `relation "users" does not exist`
```bash
# Solution: Run database migration
npm run db:push
```

#### 4. **SSL Connection Issues**

**Error**: `no pg_hba.conf entry for host` or SSL errors
```bash
# For local development, edit pg_hba.conf (usually in /etc/postgresql/*/main/):
# Add this line for local connections:
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5

# Then restart PostgreSQL:
sudo systemctl restart postgresql
```

### General Issues

#### 1. **Build Errors**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version (18+ required)
node --version
```

#### 2. **Port Already in Use**
```bash
# Kill processes on port 5000
lsof -ti:5000 | xargs kill

# Or use different port by modifying package.json dev script
```

#### 3. **WebSocket Connection Issues**
```bash
# Ensure port 5001 is available
lsof -ti:5001 | xargs kill

# Check firewall settings (Linux)
sudo ufw allow 5001
```

### Environment Variable Validation

Create this test script to validate your setup:

```bash
# Create test-db.js
cat > test-db.js << 'EOF'
require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: false 
  });
  
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', result.rows[0].version);
    
    client.release();
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  } finally {
    await pool.end();
  }
}

testConnection();
EOF

# Run the test
node test-db.js

# Clean up
rm test-db.js
```

### Logs and Debugging

**Application logs** are displayed in the terminal when running `npm run dev`. For database-specific issues:

```bash
# Enable detailed PostgreSQL logging
export DEBUG=pg:*
npm run dev

# Check PostgreSQL logs (Linux)
sudo tail -f /var/log/postgresql/postgresql-*.log

# Check PostgreSQL logs (macOS Homebrew)
tail -f /usr/local/var/log/postgres.log
```

### Quick Reset (Nuclear Option)

If all else fails, completely reset your local database:

```bash
# Stop the application
# Kill PostgreSQL connections to your database
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'carpool_db';"

# Drop and recreate database
sudo -u postgres psql << EOF
DROP DATABASE IF EXISTS carpool_db;
DROP USER IF EXISTS carpool_user;
CREATE USER carpool_user WITH PASSWORD 'your_password';
CREATE DATABASE carpool_db;
GRANT ALL PRIVILEGES ON DATABASE carpool_db TO carpool_user;
\c carpool_db
GRANT ALL ON SCHEMA public TO carpool_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO carpool_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO carpool_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO carpool_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO carpool_user;
EOF

# Recreate schema
npm run db:push

# Start application
npm run dev
```

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a secure `SESSION_SECRET`
3. Configure production database
4. Build the application: `npm run build`
5. Start with: `npm run start`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check this README and troubleshooting section
2. Review application logs for error details
3. Ensure all prerequisites are properly installed
4. Verify environment variables are correctly set