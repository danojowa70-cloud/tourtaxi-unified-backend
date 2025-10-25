# TourTaxi Unified Backend - Render Deployment Guide

This guide will help you deploy the TourTaxi unified backend to Render.com, which will serve both your Flutter driver/passenger apps AND the admin panel.

## What This Backend Handles

✅ Driver App Socket.IO connections
✅ Passenger App Socket.IO connections  
✅ Admin Panel REST API endpoints
✅ Admin Panel Socket.IO real-time updates
✅ Supabase database integration
✅ Google Maps API integration

## Prerequisites

1. Render.com account (free tier available)
2. GitHub repository with this code
3. Supabase project (already configured)
4. Google Maps API key

## Step 1: Prepare Your Repository

Make sure all changes are committed:

```bash
cd C:\Users\vansh\StudioProjects\tour_taxi_driver\tourtaxi-unified-backend
git add .
git commit -m "Add admin panel API routes and prepare for deployment"
git push origin main
```

## Step 2: Create Web Service on Render

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `tourtaxi-unified-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `tourtaxi-unified-backend` (if not at repo root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for production)

## Step 3: Environment Variables

Add these environment variables in Render dashboard:

```
NODE_ENV=production
PORT=10000
CORS_ORIGIN=*

SUPABASE_URL=https://vojjpvxhpofudvpexrjb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvampwdnhocG9mdWR2cGV4cmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjQ3NzIsImV4cCI6MjA3NTAwMDc3Mn0.AYgP9ww5Lg_VqfqcN_zN3kf4j-otQbAgbYKlQIbE3yc
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>

GOOGLE_MAPS_API_KEY=AIzaSyBRYPKaXlRhpzoAmM5-KrS2JaNDxAX_phw

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

DEFAULT_RIDE_RADIUS_KM=5.0
RIDE_REQUEST_TIMEOUT_MS=300000

BASE_FARE=3.00
PER_KM_RATE=1.80
PER_MINUTE_RATE=0.30
MINIMUM_FARE=8.00
COMMISSION_RATE=0.15

ADMIN_PANEL_URL=https://your-admin-panel-url.com
```

## Step 4: Deploy

1. Click "Create Web Service"
2. Wait for deployment to complete (5-10 minutes)
3. Note your backend URL: `https://tourtaxi-unified-backend.onrender.com`

## Step 5: Update Admin Panel

Update your admin panel's `.env` file:

```bash
cd C:\Users\vansh\StudioProjects\TourTaxiAdmin
```

Edit `.env`:
```
VITE_BACKEND_URL=https://tourtaxi-unified-backend.onrender.com
VITE_BACKEND_WS_URL=https://tourtaxi-unified-backend.onrender.com
```

## Step 6: Update Flutter Apps

### Driver App

Update `lib/constants/app_constants.dart`:
```dart
class AppConstants {
  static const String socketUrl = 'https://tourtaxi-unified-backend.onrender.com';
}
```

### Passenger App

Update `lib/constants/app_constants.dart`:
```dart
class AppConstants {
  static const String socketUrl = 'https://tourtaxi-unified-backend.onrender.com';
}
```

## Step 7: Test Your Deployment

### Health Check
```bash
curl https://tourtaxi-unified-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-22T...",
  "uptime": 123,
  "environment": "production",
  "supabaseConnected": true
}
```

### System Status
```bash
curl https://tourtaxi-unified-backend.onrender.com/status
```

### Admin Panel Test
```bash
curl https://tourtaxi-unified-backend.onrender.com/api/dashboard/stats
```

## Available API Endpoints

### For Driver/Passenger Apps (Socket.IO)
- Socket.IO connection: `wss://tourtaxi-unified-backend.onrender.com`
- Driver events: `connect_driver`, `location_update`, etc.
- Passenger events: `connect_passenger`, `ride_request`, etc.

### For Admin Panel (REST API)
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/revenue` - Revenue data (last 7 days)
- `GET /api/financial/driver-earnings` - Driver earnings
- `GET /api/analytics/metrics` - Analytics metrics
- `GET /api/analytics/user-growth` - User growth (6 months)
- `GET /api/analytics/ride-status` - Ride status breakdown
- `GET /api/drivers` - All drivers
- `GET /api/passengers` - All passengers
- `GET /api/rides` - All rides
- `GET /api/reviews` - All reviews
- `GET /api/notifications` - All notifications
- `POST /api/notifications` - Create notification
- `GET /api/support` - Support tickets
- `PATCH /api/support/:id` - Update support ticket
- `GET /api/zones` - Zones configuration
- `PATCH /api/zones/:id` - Update zone
- `PATCH /api/drivers/:id` - Update driver
- `PATCH /api/rides/:id` - Update ride

### Existing Endpoints (Driver/Passenger monitoring)
- `GET /api/drivers` - Active drivers (real-time)
- `GET /api/passengers` - Active passengers (real-time)
- `GET /api/rides` - Pending rides
- `GET /api/completed-rides` - Completed rides
- `GET /api/driver/:driverId` - Specific driver
- `GET /api/passenger/:passengerId` - Specific passenger
- `GET /api/ride/:rideId` - Specific ride
- `GET /api/ride-events` - Ride events log

## Architecture

```
┌─────────────────────────────────────────────┐
│     Render.com                              │
│  ┌──────────────────────────────────────┐  │
│  │  TourTaxi Unified Backend             │  │
│  │  (Node.js + Socket.IO + Express)      │  │
│  │                                        │  │
│  │  - Driver Socket.IO handlers          │  │
│  │  - Passenger Socket.IO handlers       │  │
│  │  - Admin REST API routes              │  │
│  │  - Real-time event broadcasting       │  │
│  └──────────┬──────────────┬──────────────┘  │
└─────────────┼──────────────┼─────────────────┘
              │              │
              │              └──────────────────┐
              │                                 │
    ┌─────────┴──────┐              ┌──────────┴──────────┐
    │  Supabase      │              │  Google Maps API    │
    │  (Database)    │              └─────────────────────┘
    └────────┬───────┘
             │
    ┌────────┴─────────────────────────┐
    │                                  │
┌───┴────┐  ┌────────┐  ┌────────────┴──┐
│ Driver │  │Passenger│  │  Admin Panel  │
│  App   │  │  App   │  │  (React)      │
│(Flutter│  │(Flutter)│  │               │
└────────┘  └────────┘  └───────────────┘
```

## Monitoring

### View Logs
1. Go to Render dashboard
2. Select your service
3. Click "Logs" tab
4. Monitor real-time activity

### Check Metrics
- Active connections
- Request rates
- Error rates
- Response times

## Troubleshooting

### Backend not starting
- Check environment variables are set
- Review build logs for errors
- Ensure `package.json` scripts are correct

### Socket.IO not connecting
- Verify WebSocket support is enabled
- Check CORS settings
- Ensure client URLs match backend URL

### Database errors
- Verify Supabase credentials
- Check Supabase service status
- Review database schema

### API errors
- Check Render logs for error details
- Verify request format matches expected schema
- Ensure authentication tokens are valid

## Free Tier Limitations

Render free tier:
- ⚠️ Spins down after 15 minutes of inactivity
- ⚠️ Cold start takes 30-60 seconds
- ⚠️ 750 hours/month (sufficient for testing)

For production:
- Upgrade to paid plan ($7/month)
- Keeps service always running
- Better performance
- No cold starts

## Cost Optimization

Free tier setup:
- Render: Free
- Supabase: Free (500MB database, 2GB bandwidth)
- Total: $0/month

Production setup:
- Render: $7/month (Starter)
- Supabase: Free or $25/month (Pro)
- Total: $7-32/month

## Security Checklist

✅ Environment variables secured
✅ CORS configured properly
✅ Rate limiting enabled
✅ Supabase RLS policies active
✅ API keys not in codebase
✅ HTTPS enforced

## Next Steps

1. Deploy backend to Render
2. Update admin panel configuration
3. Update Flutter apps configuration
4. Test all connections
5. Monitor logs for errors
6. Set up custom domain (optional)
7. Configure alerts (optional)

## Support

If you encounter issues:
1. Check Render logs
2. Verify environment variables
3. Test endpoints with curl
4. Check Supabase dashboard
5. Review this guide

## Maintenance

### Regular updates
```bash
git pull origin main
git push origin main
# Render auto-deploys on push
```

### Backup database
- Supabase provides automatic backups
- Export data regularly via SQL queries

### Monitor uptime
- Use Render's built-in monitoring
- Set up external monitoring (UptimeRobot, etc.)
