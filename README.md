# Carpool Management System

A full-stack ride-sharing application built with React, Express.js, and PostgreSQL. Features real-time notifications, Telegram integration, and comprehensive trip management.

## Features

- **User Authentication**: Secure login system with role-based access (Admin, User, Student)
- **Trip Management**: Create, view, and manage carpooling trips
- **Ride Requests**: Request rides and match with available trips
- **Real-time Updates**: WebSocket-based live notifications
- **Telegram Integration**: Automated notifications via Telegram bot
- **Admin Dashboard**: User and trip management interface
- **Mobile-Responsive**: Works seamlessly on desktop and mobile devices

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket (ws)
- **Authentication**: Passport.js with session management
- **Notifications**: Telegram Bot API
- **Build Tool**: Vite

## Prerequisites

Before setting up the project, ensure you have:

- **Node.js** 18 or higher
- **PostgreSQL** 12 or higher
- **Git** for version control
- **PM2** (for production deployment)
- **Nginx** (for reverse proxy in production)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd carpool-management-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

Create a PostgreSQL database:

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE carpool_db;
CREATE USER carpool_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE carpool_db TO carpool_user;
\q
```

### 4. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://carpool_user:your_secure_password@localhost:5432/carpool_db

# Session
SESSION_SECRET=your_very_secure_session_secret_key_here

# Application
NODE_ENV=development
PORT=5000

# Telegram Bot (Optional - for notifications)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

### 5. Database Schema Setup

Push the database schema:

```bash
npm run db:push
```

### 6. Start Development Server

```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5000
- WebSocket: ws://localhost:5001

## Production Deployment on Linux Server

### 1. Server Preparation

Update your system and install required packages:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

### 2. Create Application User

```bash
# Create a dedicated user for the application
sudo adduser carpool --disabled-password --gecos ""
sudo usermod -aG sudo carpool
```

### 3. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create production database
CREATE DATABASE carpool_production;
CREATE USER carpool_prod WITH PASSWORD 'your_production_password';
GRANT ALL PRIVILEGES ON DATABASE carpool_production TO carpool_prod;
ALTER USER carpool_prod CREATEDB;
\q
```

### 4. Deploy Application

```bash
# Switch to application user
sudo su - carpool

# Clone the repository
git clone <your-repository-url> /home/carpool/carpool-app
cd /home/carpool/carpool-app

# Install dependencies
npm ci --only=production

# Create production environment file
cat > .env << EOF
NODE_ENV=production
DATABASE_URL=postgresql://carpool_prod:your_production_password@localhost:5432/carpool_production
SESSION_SECRET=your_very_secure_production_session_secret
PORT=5000
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
EOF

# Push database schema
npm run db:push

# Build the application
npm run build
```

### 5. PM2 Configuration

Create a PM2 ecosystem file:

```bash
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'carpool-app',
    script: './dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G'
  }]
};
EOF

# Create logs directory
mkdir -p logs

# Start the application with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 6. Nginx Configuration

Create Nginx configuration:

```bash
sudo tee /etc/nginx/sites-available/carpool << EOF
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration (add your certificates)
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Main application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF

# Enable the site
sudo ln -s /etc/nginx/sites-available/carpool /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL Certificate Setup (Using Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (certbot usually sets this up automatically)
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 8. Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5432/tcp  # PostgreSQL (if external access needed)
```

## Deployment Commands

### Update Deployment

```bash
# Switch to application user
sudo su - carpool
cd /home/carpool/carpool-app

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --only=production

# Update database schema
npm run db:push

# Build application
npm run build

# Restart with PM2
pm2 restart carpool-app
```

### Backup Database

```bash
# Create backup
pg_dump -h localhost -U carpool_prod carpool_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -h localhost -U carpool_prod carpool_production < backup_file.sql
```

## Monitoring and Maintenance

### PM2 Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs carpool-app

# Monitor resources
pm2 monit

# Restart application
pm2 restart carpool-app

# Stop application
pm2 stop carpool-app
```

### Log Management

```bash
# View application logs
tail -f /home/carpool/carpool-app/logs/combined.log

# Rotate logs (setup logrotate)
sudo tee /etc/logrotate.d/carpool << EOF
/home/carpool/carpool-app/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 carpool carpool
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### System Monitoring

```bash
# Check system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Check PostgreSQL status
sudo systemctl status postgresql

# Check Nginx status
sudo systemctl status nginx
```

## Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   pm2 logs carpool-app
   
   # Check if port is in use
   sudo netstat -tlnp | grep :5000
   ```

2. **Database connection issues**
   ```bash
   # Test database connection
   psql -h localhost -U carpool_prod carpool_production
   
   # Check PostgreSQL status
   sudo systemctl status postgresql
   ```

3. **Nginx configuration errors**
   ```bash
   # Test Nginx configuration
   sudo nginx -t
   
   # Check Nginx logs
   sudo tail -f /var/log/nginx/error.log
   ```

4. **SSL certificate issues**
   ```bash
   # Renew certificates
   sudo certbot renew
   
   # Check certificate status
   sudo certbot certificates
   ```

### Performance Optimization

1. **Database Optimization**
   ```sql
   -- Add indexes for frequently queried columns
   CREATE INDEX idx_trips_driver_id ON trips(driver_id);
   CREATE INDEX idx_ride_requests_rider_id ON ride_requests(rider_id);
   CREATE INDEX idx_trip_participants_trip_id ON trip_participants(trip_id);
   ```

2. **PM2 Cluster Mode**
   - The ecosystem.config.js is configured for cluster mode
   - Adjust `instances` based on your server's CPU cores

3. **Nginx Performance**
   ```nginx
   # Add to server block for better performance
   location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files to version control
2. **Database Security**: Use strong passwords and limit database access
3. **Regular Updates**: Keep all dependencies updated
4. **Backup Strategy**: Implement automated database backups
5. **Monitoring**: Set up log monitoring and alerts
6. **Firewall**: Configure firewall rules to limit access

## API Documentation

The application provides RESTful API endpoints:

- `POST /api/auth/login` - User authentication
- `GET /api/trips` - List trips
- `POST /api/trips` - Create trip
- `GET /api/ride-requests` - List ride requests
- `POST /api/ride-requests` - Create ride request
- `GET /api/users` - List users (admin only)

## Support

For issues and questions:

1. Check the application logs: `pm2 logs carpool-app`
2. Review the troubleshooting section above
3. Check database connectivity and schema
4. Verify environment variables are correctly set

## License

MIT License - See LICENSE file for details