# 🚗 TourTaxi Backend Server

Complete real-time backend system for TourTaxi Driver App with accurate distance calculations and live notifications.

## ✨ Features

- 🚗 **Real-time Driver Management** - Online/offline status, location tracking
- 📱 **Live Ride Requests** - Instant notifications to nearby drivers
- 🗺️ **Accurate Distance Calculation** - Google Maps API integration for road distances
- 💰 **Dynamic Fare Calculation** - Based on distance, duration, and traffic
- ⭐ **Rating System** - Driver and passenger ratings
- 🔄 **Complete Ride Lifecycle** - Request → Accept → Start → Complete
- 📊 **Real-time Statistics** - Live driver and ride data
- 🛡️ **Error Handling** - Comprehensive error management
- ⏰ **Auto Cleanup** - Scheduled maintenance tasks

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
PORT=3000
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NODE_ENV=development
```

### 3. Start Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 📡 Real-time Events

### Driver Events

#### Connect Driver
```javascript
socket.emit('connect_driver', {
  driver_id: 'driver_123',
  name: 'John Doe',
  phone: '+1234567890',
  vehicle_type: 'Sedan',
  vehicle_number: 'ABC-123',
  rating: 4.8,
  latitude: 37.7749,
  longitude: -122.4194
});
```

#### Location Update
```javascript
socket.emit('location_update', {
  driver_id: 'driver_123',
  latitude: 37.7749,
  longitude: -122.4194,
  timestamp: '2024-01-01T12:00:00Z'
});
```

#### Accept Ride
```javascript
socket.emit('ride_accept', {
  ride_id: 'ride_123',
  driver_id: 'driver_123',
  timestamp: '2024-01-01T12:00:00Z'
});
```

#### Start Ride
```javascript
socket.emit('ride_start', {
  ride_id: 'ride_123',
  driver_id: 'driver_123',
  timestamp: '2024-01-01T12:00:00Z'
});
```

#### Complete Ride
```javascript
socket.emit('ride_complete', {
  ride_id: 'ride_123',
  driver_id: 'driver_123',
  fare: '15.50',
  timestamp: '2024-01-01T12:00:00Z'
});
```

### Passenger Events

#### Request Ride
```javascript
socket.emit('ride_request', {
  passenger_id: 'passenger_123',
  passenger_name: 'Jane Smith',
  passenger_phone: '+1987654321',
  pickup_latitude: 37.7749,
  pickup_longitude: -122.4194,
  pickup_address: '123 Main St, San Francisco, CA',
  destination_latitude: 37.7849,
  destination_longitude: -122.4094,
  destination_address: '456 Market St, San Francisco, CA'
});
```

## 📨 Server Responses

### Driver Connected
```javascript
socket.on('driver_connected', (data) => {
  console.log('Connected:', data.message);
});
```

### Ride Request (to Driver)
```javascript
socket.on('ride_request', (rideData) => {
  console.log('New ride request:', rideData.passenger_name);
  console.log('From:', rideData.pickup_address);
  console.log('To:', rideData.destination_address);
  console.log('Fare:', rideData.fare);
  console.log('Distance:', rideData.distance_text);
  console.log('Duration:', rideData.duration_text);
});
```

### Ride Accepted (to Passenger)
```javascript
socket.on('ride_accepted', (data) => {
  console.log('Driver:', data.driver_name);
  console.log('Vehicle:', data.driver_vehicle);
  console.log('Rating:', data.driver_rating);
  console.log('Phone:', data.driver_phone);
  console.log('ETA:', data.estimated_arrival);
});
```

### Ride Started (to Passenger)
```javascript
socket.on('ride_started', (data) => {
  console.log('Ride started by:', data.driver_name);
  console.log('Duration:', data.estimated_duration);
});
```

### Ride Completed (to Passenger)
```javascript
socket.on('ride_completed', (data) => {
  console.log('Ride completed!');
  console.log('Final fare:', data.fare);
  console.log('Distance:', data.distance);
  console.log('Please rate your experience!');
});
```

## 🗺️ Distance & Fare Calculation

### Accurate Distance
- Uses Google Maps Distance Matrix API
- Calculates real road distances (not straight-line)
- Includes traffic conditions
- Fallback to straight-line distance if API fails

### Dynamic Fare Structure
```javascript
const fare = baseFare + (distance * perKmRate) + (duration * perMinuteRate);
// Base fare: $3.00
// Per km: $1.80
// Per minute: $0.30
// Minimum fare: $8.00
```

## 📊 API Endpoints

### System Status
```
GET /
```
Returns server status and statistics.

### Active Drivers
```
GET /drivers
```
Returns list of all active drivers.

### Pending Rides
```
GET /rides
```
Returns list of all pending rides.

### Completed Rides
```
GET /completed-rides
```
Returns list of all completed rides.

### Driver Details
```
GET /driver/:driverId
```
Returns specific driver information.

### Ride Details
```
GET /ride/:rideId
```
Returns specific ride information.

## 🔧 Configuration

### Environment Variables
- `PORT` - Server port (default: 3000)
- `GOOGLE_MAPS_API_KEY` - Google Maps API key for distance calculations
- `NODE_ENV` - Environment (development/production)

### Google Maps API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Distance Matrix API
3. Create API key
4. Add to `.env` file

## 🛡️ Error Handling

The server includes comprehensive error handling:
- Invalid driver data
- Missing ride information
- Network connectivity issues
- Google Maps API failures
- Socket connection problems

## 📈 Performance Features

- **Connection Management** - Automatic cleanup of disconnected drivers
- **Memory Optimization** - Regular cleanup of old completed rides
- **Real-time Updates** - Efficient broadcasting to relevant clients
- **Scalable Architecture** - Ready for horizontal scaling

## 🔄 Ride Flow

1. **Driver Goes Online** → `connect_driver`
2. **Passenger Requests Ride** → `ride_request`
3. **Driver Receives Request** → `ride_request` event
4. **Driver Accepts** → `ride_accept`
5. **Passenger Notified** → `ride_accepted` event
6. **Driver Starts Ride** → `ride_start`
7. **Passenger Notified** → `ride_started` event
8. **Driver Completes Ride** → `ride_complete`
9. **Passenger Notified** → `ride_completed` event
10. **Passenger Rates** → `ride_rating`

## 🚀 Production Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name "tourtaxi-backend"
pm2 startup
pm2 save
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📱 Flutter Integration

Update your Flutter app's constants:
```dart
// lib/constants/app_constants.dart
static const String socketUrl = 'http://your-server-ip:3000';
```

## 🎯 Testing

Test the server using the API endpoints:
- http://localhost:3000 - Server status
- http://localhost:3000/drivers - Active drivers
- http://localhost:3000/rides - Pending rides

## 📞 Support

For issues or questions:
1. Check the console logs for error messages
2. Verify Google Maps API key is valid
3. Ensure all required environment variables are set
4. Check network connectivity

---

**Your TourTaxi Backend is now ready for production! 🚗✨**