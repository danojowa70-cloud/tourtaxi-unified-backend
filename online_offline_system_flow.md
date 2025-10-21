# Online/Offline Status System Flow & Database Tables

## 📱 **Where Driver Updates Online/Offline Status**

### **Driver App Location:**
- **File**: `lib/screens/home/home_screen.dart`
- **UI Component**: `OnlineToggle` widget (positioned at top of home screen)
- **Method**: `_toggleOnlineStatus(bool isOnline)`

### **Toggle Implementation:**
```dart
// Location: lib/widgets/online_toggle.dart
OnlineToggle(
  isOnline: _isOnline,           // Current status
  onToggle: _toggleOnlineStatus, // Callback when toggled
)
```

## 🔄 **Complete Status Update Flow**

| Step | Component | Action | Details |
|------|-----------|---------|---------|
| 1 | **Driver App UI** | Driver taps toggle | `OnlineToggle` widget triggers `_toggleOnlineStatus()` |
| 2 | **HomeScreen** | Validates & Updates UI | Checks driver profile, location, socket connection |
| 3 | **API Service** | REST API Call | `POST /driver/status` to update database |
| 4 | **Backend Handler** | Updates Database | `updateDriverStatus()` in `driverHandler.ts` |
| 5 | **Socket Service** | Real-time Sync | Connects/disconnects driver via Socket.IO |
| 6 | **Location Service** | GPS Tracking | Starts/stops location tracking |
| 7 | **Broadcast** | Notify All Apps | Socket broadcasts to passenger apps |

## 🗄️ **Database Tables Used**

### **Primary Table: `drivers`**
```sql
-- Table: drivers (Supabase)
id UUID PRIMARY KEY,                    -- Driver ID (matches auth user)
email TEXT NOT NULL,                    -- Email address
name TEXT NOT NULL,                     -- Full name
phone TEXT NOT NULL,                    -- Phone number
vehicle_type TEXT,                      -- Vehicle type
vehicle_number TEXT,                    -- License plate
license_number TEXT,                    -- Driver license
profile_image TEXT,                     -- Profile photo URL
is_online BOOLEAN DEFAULT false,        -- ⭐ ONLINE STATUS
is_available BOOLEAN DEFAULT false,     -- ⭐ AVAILABLE FOR RIDES
rating DECIMAL(3,2) DEFAULT 5.0,       -- Driver rating
total_rides INTEGER DEFAULT 0,          -- Total completed rides
total_earnings DECIMAL(10,2) DEFAULT 0, -- Total earnings
current_latitude DECIMAL(10,8),         -- Current GPS lat
current_longitude DECIMAL(11,8),        -- Current GPS lng
last_location_update TIMESTAMP,         -- Last location update
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
```

### **Location History: `driver_locations`**
```sql
-- Table: driver_locations (Supabase)
id UUID PRIMARY KEY,
driver_id UUID REFERENCES drivers(id),
latitude DECIMAL(10,8),
longitude DECIMAL(11,8),
timestamp TIMESTAMP DEFAULT NOW()
```

### **Event Logging: `ride_events`**
```sql
-- Table: ride_events (Supabase) 
id UUID PRIMARY KEY,
ride_id UUID,                           -- Can be NULL for driver events
actor TEXT,                             -- 'driver' or 'passenger'
event_type TEXT,                        -- 'driver:online', 'driver:offline'
payload JSONB,                          -- Event details
created_at TIMESTAMP DEFAULT NOW()
```

## 📡 **API Endpoints Used**

### **Driver Status Update API**
```http
POST https://tourtaxi-unified-backend.onrender.com/driver/status
Content-Type: application/json

{
  "driver_id": "uuid",
  "is_online": true/false,
  "is_available": true/false  // Auto-set same as is_online
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "driver_id": "uuid",
    "is_online": true,
    "is_available": true,
    "updated_at": "2025-01-17T09:17:27.000Z"
  }
}
```

## 📱 **How Passenger App Sees Driver Status**

### **Real-time Methods:**

1. **Socket.IO Events** (Real-time):
   ```javascript
   // Passenger app receives these events:
   socket.on('driver_online', (data) => {
     // Driver came online
     // data: { driver_id, name, vehicle_type, latitude, longitude, rating }
   });
   
   socket.on('driver_offline', (data) => {
     // Driver went offline  
     // data: { driver_id, timestamp }
   });
   
   socket.on('driver_location_update', (data) => {
     // Driver location changed
     // data: { driver_id, latitude, longitude, isAvailable }
   });
   ```

2. **REST API Queries**:
   ```http
   GET https://tourtaxi-unified-backend.onrender.com/api/drivers
   ```
   Returns list of online/available drivers

3. **Database Queries** (For passenger backend):
   ```sql
   -- Get all online drivers
   SELECT * FROM drivers 
   WHERE is_online = true AND is_available = true;
   
   -- Get nearby online drivers
   SELECT *, 
          (6371 * acos(cos(radians(?)) * cos(radians(current_latitude)) * 
           cos(radians(current_longitude) - radians(?)) + 
           sin(radians(?)) * sin(radians(current_latitude)))) AS distance
   FROM drivers 
   WHERE is_online = true AND is_available = true
   HAVING distance < 10  -- Within 10km
   ORDER BY distance;
   ```

## 🔍 **Status Fields Explanation**

| Field | Purpose | When True | When False |
|-------|---------|-----------|------------|
| `is_online` | Driver app connected | Driver is using app, GPS active | Driver closed app or went offline |
| `is_available` | Can accept rides | Ready for new ride requests | On a ride or temporarily unavailable |

### **Status Combinations:**
- **Online + Available**: Can receive ride requests ✅
- **Online + Unavailable**: Connected but busy (on ride) 🚗
- **Offline + Unavailable**: Not connected to app ❌

## 🏗️ **In-Memory Storage (Backend)**

```typescript
// Real-time data structures in driverHandler.ts
export const activeDrivers = new Map<string, Driver>();     // Online drivers
export const pendingRides = new Map<string, Ride>();        // Active rides  
export const completedRides = new Map<string, Ride>();      // Completed rides
export const driverSessions = new Map<string, string>();    // socket_id -> driver_id
```

## 🚨 **Key Points for Passenger Apps**

1. **Primary Query**: Query `drivers` table where `is_online = true AND is_available = true`
2. **Real-time Updates**: Subscribe to Socket.IO events for live status changes
3. **Location**: Use `current_latitude` and `current_longitude` for driver positioning
4. **Last Seen**: Check `last_location_update` timestamp for freshness

## 🔄 **Status Update Triggers**

### **Driver Goes Online:**
1. Database: `is_online = true, is_available = true`
2. Socket: Joins driver pool, starts location tracking
3. Broadcast: `driver_online` event to all passenger apps

### **Driver Goes Offline:**
1. Database: `is_online = false, is_available = false`  
2. Socket: Disconnects, stops location tracking
3. Broadcast: `driver_offline` event to all passenger apps
4. Cleanup: Cancels any pending rides

This system ensures **real-time synchronization** between driver and passenger apps! 🚀