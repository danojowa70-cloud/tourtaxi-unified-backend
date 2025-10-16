# TourTaxi Unified Backend

A TypeScript-based unified backend server that handles both Driver and Passenger functionality for the TourTaxi ride-sharing application.

## Features

- **Unified Architecture**: Single backend handling both drivers and passengers
- **Real-time Communication**: Socket.IO for live updates and messaging
- **TypeScript**: Full type safety and modern JavaScript features
- **Google Maps Integration**: Accurate distance calculation and route planning
- **Database Integration**: Supabase for persistent data storage
- **Production Ready**: Comprehensive error handling and logging

## Architecture

```
┌─────────────────┐    Socket.IO    ┌─────────────────┐
│  Driver App     │ ←──────────────→ │                │
│  (Flutter)      │                 │  Unified        │
└─────────────────┘                 │  Backend        │
                                    │  (Node.js +     │
┌─────────────────┐    Socket.IO    │   TypeScript)   │
│  Passenger App  │ ←──────────────→ │                │
│  (Flutter)      │                 └─────────────────┘
└─────────────────┘                          │
                                             │
                                    ┌─────────────────┐
                                    │    Supabase     │
                                    │   (Database)    │
                                    └─────────────────┘
```

## Socket Events

### Driver Events
- `connect_driver` - Driver authentication and connection
- `location_update` - Real-time location tracking  
- `ride_accept` - Accept ride requests
- `ride_reject` - Reject ride requests
- `ride_start` - Start accepted ride
- `ride_complete` - Complete ongoing ride
- `driver_offline` - Go offline
- `driver_available` - Set availability status

### Passenger Events  
- `connect_passenger` - Passenger authentication and connection
- `ride_request` - Request a new ride
- `ride_cancel` - Cancel pending ride
- `ride_rating` - Rate completed ride
- `get_ride_history` - Fetch ride history
- `get_nearby_drivers` - Find nearby available drivers

### Chat Events
- `driver_message` - Driver sends message
- `passenger_message` - Passenger sends message

## API Endpoints

- `GET /health` - Health check
- `GET /status` - System status with statistics  
- `GET /api/drivers` - List active drivers
- `GET /api/passengers` - List active passengers
- `GET /api/rides` - List pending rides
- `GET /api/completed-rides` - List completed rides
- `GET /api/driver/:driverId` - Get specific driver info
- `GET /api/passenger/:passengerId` - Get specific passenger info
- `GET /api/ride/:rideId` - Get specific ride info

## Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google Maps API key

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration

5. Start development server:
   ```bash
   npm run dev
   ```

### Build
```bash
npm run build
npm start
```

## Deployment on Render

### Step 1: Prepare for Deployment

1. **Environment Variables**: Copy all variables from `.env.example` and set them in Render's environment variables section.

2. **Build Configuration**:
   - **Build Command**: `npm install && npm run build`  
   - **Start Command**: `npm start`
   - **Node Version**: 18 or higher

### Step 2: Deploy on Render

1. **Create Web Service**: 
   - Go to [render.com](https://render.com)
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Service Configuration**:
   - **Name**: `tourtaxi-unified-backend`
   - **Environment**: `Node`  
   - **Branch**: `main` (or your deployment branch)
   - **Root Directory**: `unified-backend` (if this folder is not at repo root)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for production)

3. **Environment Variables**: Add all variables from `.env.example`:
   ```
   NODE_ENV=production
   PORT=10000
   CORS_ORIGIN=*
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   # ... other variables
   ```

4. **Deploy**: Click "Create Web Service" and wait for deployment

### Step 3: Update Flutter Apps

Once deployed, update your Flutter apps to use the new backend URL:

**Driver App** - Update `lib/constants/app_constants.dart`:
```dart
class AppConstants {
  static const String socketUrl = 'https://your-app-name.onrender.com';
}
```

**Passenger App** - Update `lib/constants/app_constants.dart`:
```dart  
class AppConstants {
  static const String socketUrl = 'https://your-app-name.onrender.com';
}
```

### Step 4: Test Deployment

1. **Health Check**: Visit `https://your-app-name.onrender.com/health`
2. **System Status**: Visit `https://your-app-name.onrender.com/status`
3. **Test Socket Connection**: Use your Flutter apps to connect and test functionality

## Project Structure

```
unified-backend/
├── src/
│   ├── config/
│   │   ├── env.ts          # Environment configuration
│   │   └── supabase.ts     # Supabase client setup
│   ├── handlers/
│   │   ├── driverHandler.ts    # Driver socket events
│   │   └── passengerHandler.ts # Passenger socket events  
│   ├── types/
│   │   └── index.ts        # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts       # Logging utility
│   └── server.ts           # Main server file
├── dist/                   # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Key Features

### Real-time Functionality
- Live driver location tracking
- Instant ride request/acceptance notifications  
- Real-time chat between drivers and passengers
- Live ride status updates

### Business Logic
- Automatic driver matching based on location
- Dynamic fare calculation with Google Maps
- Commission tracking and earnings management
- Rating system for quality control

### Production Features  
- Comprehensive error handling
- Structured logging with Pino
- Graceful shutdown handling
- Database connection pooling
- CORS configuration
- Rate limiting ready

### Scalability
- In-memory caching for real-time features
- Database persistence for reliability
- Horizontal scaling support
- Load balancer friendly

## Troubleshooting

### Common Issues

1. **CORS Errors**: Update `CORS_ORIGIN` environment variable with your app domains
2. **Database Connection**: Verify Supabase URL and keys
3. **Google Maps**: Check API key and enable required services
4. **Socket Disconnections**: Review network configuration and firewall settings

### Logs
Check application logs in Render dashboard or use:
```bash
# For local development
npm run dev

# View logs with more details  
DEBUG=* npm run dev
```

## Support

For support or questions:
- Check the logs in Render dashboard
- Review environment variable configuration
- Test API endpoints directly
- Verify Flutter app socket URLs

## License
OJOWA CLOUD TECHNOLOGY License - See LICENSE file for details
