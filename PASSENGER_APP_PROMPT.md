# Passenger App Implementation Prompt

## Context
I have a Flutter passenger app that needs to be updated to work with a new Socket.IO backend server. The server is already deployed and working with the driver app.

## Server Details
- **Server URL:** `https://tourtaxi-unified-backend.onrender.com`
- **Technology:** Socket.IO + Express + Supabase
- **Socket.IO Version:** 4.x

## Task
Update the passenger app to integrate with the new server for ride requesting functionality. The app structure already exists, I just need the socket integration and event handling updated.

## Required Implementation

### 1. Socket Connection Setup
The passenger app needs to:
- Connect to `https://tourtaxi-unified-backend.onrender.com` via Socket.IO
- Emit `connect_passenger` event on connection with payload:
  ```json
  {
    "passenger_id": "string",
    "name": "string",
    "phone": "string"
  }
  ```
- Listen for `passenger_connected` confirmation event

### 2. Request Ride Functionality
When passenger requests a ride, emit `ride_request` event with:
```json
{
  "passenger_id": "string",
  "passenger_name": "string",
  "passenger_phone": "string",
  "passenger_image": "string (optional)",
  "pickup_latitude": number,
  "pickup_longitude": number,
  "pickup_address": "string",
  "destination_latitude": number,
  "destination_longitude": number,
  "destination_address": "string",
  "notes": "string (optional)",
  "fare": "string (optional)",
  "ride_id": "string (optional)"
}
```

### 3. Listen for Server Responses
The passenger app must listen for these events:

#### `ride_request_submitted` - Request accepted by server
```json
{
  "ride_id": "string",
  "status": "submitted",
  "message": "Ride request sent to X nearby drivers",
  "estimated_fare": "string",
  "distance": "string (e.g., '12.5 km')",
  "duration": "string (e.g., '25 mins')",
  "timestamp": "string"
}
```

#### `no_drivers_available` - No drivers found
```json
{
  "ride_id": "string",
  "message": "No drivers available in your area",
  "timestamp": "string"
}
```

#### `ride_timeout` - No driver accepted within timeout
```json
{
  "ride_id": "string",
  "message": "No driver accepted your ride request",
  "timestamp": "string"
}
```

#### `ride_accepted` - Driver accepted the ride ⭐ MOST IMPORTANT
```json
{
  "ride_id": "string",
  "driver_id": "string",
  "driver_name": "string",
  "driver_phone": "string",
  "driver_vehicle": "string",
  "driver_vehicle_number": "string",
  "driver_rating": number,
  "driver_image": "string | null",
  "driver_latitude": number,
  "driver_longitude": number,
  "estimated_arrival": "string (e.g., '5 minutes')",
  "pickup_address": "string",
  "destination_address": "string",
  "fare": "string",
  "distance": "string",
  "duration": "string",
  "route_polyline": "string (encoded polyline)",
  "driver_to_pickup_polyline": "string (encoded polyline)",
  "driver_to_pickup_distance": "string",
  "driver_to_pickup_duration": "string",
  "timestamp": "string"
}
```

#### `ride_driver_location` - Real-time driver location updates
```json
{
  "ride_id": "string",
  "driver_id": "string",
  "latitude": number,
  "longitude": number,
  "timestamp": "string"
}
```

#### `ride_started` - Driver started the trip
```json
{
  "ride_id": "string",
  "driver_id": "string",
  "driver_name": "string",
  "driver_phone": "string",
  "driver_vehicle": "string",
  "driver_vehicle_number": "string",
  "started_at": "string",
  "estimated_duration": "string",
  "destination_address": "string",
  "timestamp": "string"
}
```

#### `ride_completed` - Trip finished
```json
{
  "ride_id": "string",
  "driver_id": "string",
  "driver_name": "string",
  "completed_at": "string",
  "fare": "string",
  "distance": "string",
  "duration": "string",
  "rating_request": true,
  "timestamp": "string"
}
```

#### `ride_cancelled` - Ride cancelled by driver
```json
{
  "ride_id": "string",
  "reason": "string",
  "timestamp": "string"
}
```

### 4. Cancel Ride Functionality
Emit `ride_cancel` event:
```json
{
  "ride_id": "string",
  "passenger_id": "string",
  "reason": "string (optional)"
}
```

Listen for `ride_cancelled_confirmation`:
```json
{
  "ride_id": "string",
  "status": "cancelled",
  "message": "Ride cancelled successfully",
  "timestamp": "string"
}
```

### 5. Rate Driver Functionality
After ride completion, emit `ride_rating` event:
```json
{
  "ride_id": "string",
  "rating": number (1-5),
  "feedback": "string (optional)"
}
```

Listen for `rating_submitted`:
```json
{
  "ride_id": "string",
  "rating": number,
  "message": "Thank you for your feedback!",
  "timestamp": "string"
}
```

### 6. Optional Features

#### Get Nearby Drivers
Emit `get_nearby_drivers`:
```json
{
  "latitude": number,
  "longitude": number,
  "radius": number (optional, default 10 km)
}
```

Listen for `nearby_drivers`:
```json
{
  "latitude": number,
  "longitude": number,
  "radius": number,
  "drivers": [
    {
      "driver_id": "string",
      "name": "string",
      "phone": "string",
      "vehicle_type": "string",
      "vehicle_number": "string",
      "rating": number,
      "distance": number,
      "estimated_arrival": number
    }
  ],
  "count": number,
  "timestamp": "string"
}
```

#### Get Ride History
Emit `get_ride_history`:
```json
{
  "passenger_id": "string",
  "limit": number (optional, default 10)
}
```

Listen for `ride_history`:
```json
{
  "passenger_id": "string",
  "rides": [...],
  "total_rides": number,
  "timestamp": "string"
}
```

### 7. Error Handling
Listen for `error` event:
```json
{
  "message": "string",
  "error": "string (optional)"
}
```

## Implementation Requirements

### Must Have:
1. ✅ Socket.IO connection to server
2. ✅ `connect_passenger` on app start
3. ✅ `ride_request` when user books ride
4. ✅ Listen for `ride_request_submitted`
5. ✅ Listen for `ride_accepted` and show driver details
6. ✅ Listen for `ride_driver_location` for real-time tracking
7. ✅ Listen for `ride_started` and `ride_completed`
8. ✅ `ride_cancel` functionality
9. ✅ `ride_rating` after completion
10. ✅ Error handling for all events

### Should Have:
11. ✅ Handle `no_drivers_available` scenario
12. ✅ Handle `ride_timeout` scenario
13. ✅ Handle `ride_cancelled` by driver
14. ✅ Display driver marker on map with real-time updates
15. ✅ Show route polyline on map

### Nice to Have:
16. ⭐ Show nearby drivers before requesting
17. ⭐ Display driver-to-pickup route
18. ⭐ Show ETA to pickup
19. ⭐ In-ride chat messaging
20. ⭐ Ride history

## UI Flow

### 1. Booking Screen
- Show pickup and destination on map
- Calculate estimated fare (optional, server will calculate)
- Button: "Request Ride"

### 2. Searching Screen (after request submitted)
- Show loading animation
- Display: "Searching for nearby drivers..."
- Show estimated fare, distance, duration
- Button: "Cancel Request"
- Handle timeout after 60 seconds

### 3. Driver Found Screen (after ride accepted)
- Show driver photo, name, rating, vehicle info
- Show driver location on map (updating in real-time)
- Show route from driver to pickup (polyline)
- Display ETA: "Driver arriving in 5 minutes"
- Button: "Cancel Ride"
- Button: "Call Driver"
- Button: "Message Driver" (optional)

### 4. Driver Arriving Screen
- Same as Driver Found but highlight ETA
- Show notification when driver is close

### 5. Trip In Progress Screen (after ride started)
- Show current location to destination route
- Display driver info
- Real-time location tracking
- Button: "Emergency"
- Button: "Message Driver" (optional)

### 6. Trip Completed Screen
- Show trip summary (distance, duration, fare)
- Star rating widget (1-5 stars)
- Feedback text box (optional)
- Button: "Submit Rating"
- Button: "Skip"

## Data Models

### Ride Model
```dart
class Ride {
  final String id;
  final String passengerId;
  final String? driverId;
  final String? driverName;
  final String? driverPhone;
  final String? driverVehicle;
  final String? driverVehicleNumber;
  final double? driverRating;
  final String? driverImage;
  final double pickupLatitude;
  final double pickupLongitude;
  final String pickupAddress;
  final double destinationLatitude;
  final double destinationLongitude;
  final String destinationAddress;
  final String? distance;
  final String? duration;
  final String? fare;
  final String? routePolyline;
  final String? driverToPickupPolyline;
  final String? driverToPickupDistance;
  final String? driverToPickupDuration;
  final double? driverLatitude;
  final double? driverLongitude;
  final String status; // 'requested', 'accepted', 'started', 'completed', 'cancelled'
  final String? estimatedArrival;
  final DateTime requestedAt;
  final DateTime? acceptedAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final int? rating;
  final String? feedback;
}
```

## Socket Service Structure

```dart
class SocketService {
  static io.Socket? _socket;
  
  // Streams for events
  static Stream<Map<String, dynamic>> get rideAcceptedStream;
  static Stream<Map<String, dynamic>> get rideStartedStream;
  static Stream<Map<String, dynamic>> get rideCompletedStream;
  static Stream<Map<String, dynamic>> get rideCancelledStream;
  static Stream<Map<String, dynamic>> get driverLocationStream;
  static Stream<String> get connectionStatusStream;
  
  // Methods
  static Future<void> initialize();
  static Future<void> connectPassenger({...});
  static Future<void> requestRide({...});
  static Future<void> cancelRide({...});
  static Future<void> rateDriver({...});
  static Future<void> getNearbyDrivers({...});
  static void dispose();
}
```

## Testing
After implementation, test:
1. Connect passenger - verify at: `https://tourtaxi-unified-backend.onrender.com/api/passengers`
2. Request ride - check pending rides: `https://tourtaxi-unified-backend.onrender.com/api/rides`
3. Accept from driver app - verify passenger receives `ride_accepted`
4. Track real-time location updates
5. Complete ride - verify passenger receives `ride_completed`

## Important Notes
1. **Server handles all calculations:** distance, duration, fare, route polylines
2. **Real-time updates:** Driver location updates every 10 seconds during active ride
3. **Automatic room management:** Server automatically joins passenger to `ride_${ride_id}` room
4. **Timeout:** Ride requests timeout after 60 seconds if no driver accepts
5. **Data parsing:** Fare and distance can be strings or numbers, handle both

## Files to Check/Update
Based on typical Flutter app structure:
- `lib/services/socket_service.dart` - Socket.IO implementation
- `lib/models/ride_model.dart` - Ride data model
- `lib/screens/booking_screen.dart` - Ride request UI
- `lib/screens/searching_screen.dart` - Waiting for driver UI
- `lib/screens/ride_tracking_screen.dart` - Active ride UI
- `lib/screens/ride_completed_screen.dart` - Rating UI
- `lib/constants/app_constants.dart` - Add server URL

## Example Implementation Reference
Check the driver app for similar patterns:
- Path: `C:\Users\vansh\StudioProjects\tour_taxi_driver\`
- Files to reference:
  - `lib/services/socket_service.dart`
  - `lib/models/ride_model.dart`
  - `lib/screens/home/home_screen.dart`

## Success Criteria
✅ Passenger can connect to server
✅ Passenger can request rides
✅ Passenger receives driver assignment with all details
✅ Passenger can see driver location in real-time
✅ Passenger receives trip start notification
✅ Passenger receives trip completion notification
✅ Passenger can rate driver
✅ Passenger can cancel rides
✅ All edge cases handled (no drivers, timeout, cancellation)

---

**Start by analyzing the existing passenger app code structure, then implement the socket service and update the relevant screens to handle all these events.**
