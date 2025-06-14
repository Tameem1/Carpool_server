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

#### Option A: Local PostgreSQL
1. Install PostgreSQL on your system
2. Create a new database:
   ```sql
   CREATE DATABASE carpool_db;
   ```
3. Create a database user (optional):
   ```sql
   CREATE USER carpool_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE carpool_db TO carpool_user;
   ```

#### Option B: Cloud Database (Neon, Supabase, etc.)
1. Create a PostgreSQL database instance
2. Note the connection string provided

### 4. Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/carpool_db

# Session Secret (generate a random string)
SESSION_SECRET=your-super-secret-session-key-here

# Telegram Bot (Optional - for notifications)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Application Environment
NODE_ENV=development
```

### 5. Database Migration

Push the database schema:

```bash
npm run db:push
```

This command will create all necessary tables in your PostgreSQL database.

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

### Common Issues

1. **Database Connection Error**:
   - Verify PostgreSQL is running
   - Check DATABASE_URL in .env file
   - Ensure database exists and is accessible

2. **Build Errors**:
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version (18+ required)

3. **Port Already in Use**:
   - Change port in package.json dev script
   - Kill existing processes: `lsof -ti:5000 | xargs kill`

4. **WebSocket Connection Issues**:
   - Ensure port 5001 is available
   - Check firewall settings

### Logs

Application logs are displayed in the terminal when running `npm run dev`. Check these for detailed error information.

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