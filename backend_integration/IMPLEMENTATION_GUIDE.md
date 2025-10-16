# Backend Integration Guide - Driver Status Logging

This guide shows you how to integrate automatic driver status logging into your existing Render backend without using database triggers.

## 🎯 What This Does

When a driver connects/disconnects or changes their online status, the backend will automatically:
- ✅ Update the `drivers` table in Supabase
- ✅ Log the event to `ride_events` table with full driver information
- ✅ Broadcast the status change to connected passengers
- ✅ Track analytics and provide monitoring endpoints

## 📁 Files Overview

### Core Services:
- **`driver-status-service.js`** - Handles all Supabase operations and event logging
- **`socket-handlers.js`** - Socket.io event handlers with status logging integration
- **`server-integration.js`** - Complete server example showing integration

## 🚀 Integration Steps

### Step 1: Install Dependencies

Add these to your `package.json`:

```bash
npm install @supabase/supabase-js socket.io express cors
```

### Step 2: Set Environment Variables

In your Render dashboard, set these environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
PORT=3000
```

> **Important**: Use the **Service Role Key** (not the anon key) for backend operations.

### Step 3: Copy the Service Files

Copy these files to your backend project:
- `driver-status-service.js`
- `socket-handlers.js`

### Step 4: Integrate into Your Existing Server

#### Option A: Replace Your Existing Server

Replace your current server file with the example in `server-integration.js`.

#### Option B: Integrate into Existing Server

If you have an existing server, integrate like this:

```javascript
// Your existing server.js
const SocketHandlers = require('./socket-handlers');
const DriverStatusService = require('./driver-status-service');

// Initialize services
const driverStatusService = new DriverStatusService(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const socketHandlers = new SocketHandlers(
  io, // your existing socket.io instance
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize socket handlers (replaces your existing socket setup)
socketHandlers.initializeHandlers();

// Add new API endpoints
app.get('/api/driver-events', async (req, res) => {
  try {
    const { driver_id, limit = 10 } = req.query;
    const events = await driverStatusService.getDriverStatusEvents(driver_id, parseInt(limit));
    res.json({ success: true, events });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch driver events', message: error.message });
  }
});

app.get('/api/connected-drivers', (req, res) => {
  try {
    const drivers = socketHandlers.getConnectedDrivers();
    res.json({ success: true, drivers, count: drivers.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch connected drivers' });
  }
});
```

### Step 5: Update Socket.io Configuration

Make sure your Socket.io server has these settings:

```javascript
const io = new Server(server, {
  cors: {
    origin: "*", // Configure properly for production
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,    // 60 seconds
  pingInterval: 25000,   // 25 seconds
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
```

### Step 6: Deploy to Render

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Add driver status logging integration"
   git push
   ```

2. **Render will automatically redeploy** your service

3. **Verify deployment**:
   - Check `https://tourtaxi-unified-backend.onrender.com/health`
   - Verify environment variables are set in Render dashboard

## 🔧 How It Works

### Driver Connection Flow:

1. **Driver App** sends `connect_driver` event with driver data
2. **Backend** receives event and:
   - Stores driver in connected drivers map
   - Calls `updateDriverStatus(driver_id, true)`
   - Updates `drivers.is_online = true` in Supabase
   - Logs event to `ride_events` table
   - Broadcasts `driver:status:change` to passengers

### Driver Disconnection Flow:

1. **Driver App** sends `driver_offline` event OR socket disconnects
2. **Backend**:
   - Calls `updateDriverStatus(driver_id, false)`
   - Updates `drivers.is_online = false` in Supabase
   - Logs event to `ride_events` table
   - Broadcasts status change to passengers
   - Removes driver from connected drivers map

## 📊 Database Events Created

Each status change creates an entry in `ride_events`:

```json
{
  "ride_id": null,
  "actor": "driver",
  "event_type": "driver:online",
  "payload": {
    "driver_id": "uuid-here",
    "driver_name": "John Doe",
    "driver_phone": "+1234567890",
    "vehicle_type": "Sedan",
    "vehicle_number": "ABC-123",
    "rating": 4.5,
    "total_rides": 42,
    "total_earnings": 1250.50,
    "status": "online",
    "timestamp": "2024-01-01T12:00:00Z",
    "location": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "created_at": "2024-01-01T12:00:00Z"
}
```

## 🛠️ New API Endpoints

Your backend will now have these endpoints:

- **`GET /api/driver-events`** - Get driver status events
  - Query params: `driver_id` (optional), `limit` (default 10)
  
- **`GET /api/driver-analytics`** - Get driver activity analytics
  - Query params: `days` (default 7)
  
- **`GET /api/connected-drivers`** - Get currently connected drivers

- **`POST /api/driver/:id/status`** - Manual driver status update
  - Body: `{ "is_online": true, ...additionalData }`

## 🧪 Testing

### Test Driver Connection:

1. **Run your driver app** and connect
2. **Check server logs** for:
   ```
   Driver connecting: John Doe (driver-id)
   Driver John Doe is now online
   ```
3. **Verify database**: Check `ride_events` table for new entry
4. **Test API**: `GET /api/connected-drivers` should show the driver

### Test Driver Disconnect:

1. **Close driver app** or toggle offline
2. **Check server logs** for:
   ```
   Driver going offline: John Doe (driver-id)
   Driver John Doe is now offline
   ```
3. **Verify database**: Check for `driver:offline` event in `ride_events`

### Test Analytics:

```bash
# Get driver events
curl "https://tourtaxi-unified-backend.onrender.com/api/driver-events?limit=5"

# Get analytics
curl "https://tourtaxi-unified-backend.onrender.com/api/driver-analytics?days=7"

# Get connected drivers
curl "https://tourtaxi-unified-backend.onrender.com/api/connected-drivers"
```

## 🔍 Monitoring & Debugging

### Server Logs to Watch:

```
🚗 TourTaxi Backend Server running on port 3000
📊 Driver status logging: ENABLED
🔌 Socket.IO: ENABLED
📡 Supabase integration: CONNECTED
Driver connecting: John Doe (abc-123)
Successfully logged driver online event for driver: John Doe
Driver John Doe is now online
Connected drivers: 1
```

### Common Issues:

1. **"Supabase integration: NOT CONFIGURED"**
   - Set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in Render environment variables

2. **"Error logging driver status change"**
   - Check Supabase service key permissions
   - Verify `ride_events` table exists and has correct schema

3. **Socket connection failures**
   - Check CORS configuration
   - Verify Socket.io client is using correct server URL

## 🎯 Benefits

✅ **Automatic Logging** - No manual code needed in driver app  
✅ **Real-time Tracking** - Instant status updates to passengers  
✅ **Rich Analytics** - Full driver activity history and stats  
✅ **Connection Monitoring** - Track active drivers in real-time  
✅ **Error Handling** - Robust error recovery and logging  
✅ **Scalable** - Handles multiple drivers and high connection volume  

## 🚀 Production Ready

Your backend now automatically tracks all driver activity without requiring database triggers, making it perfect for your Render deployment with Supabase integration!

The system will handle:
- Driver online/offline status changes
- Connection/disconnection events  
- Real-time passenger notifications
- Analytics and monitoring
- Error recovery and logging

Your TourTaxi app now has enterprise-grade driver tracking! 🎉