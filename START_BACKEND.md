# 🚀 Start TourTaxi Backend Server

## Quick Setup Instructions

### 1. Install Node.js
- Download from [nodejs.org](https://nodejs.org/)
- Install the LTS version

### 2. Start the Backend Server

```bash
# Navigate to backend folder
cd backend

# Install dependencies (first time only)
npm install

# Start the server
npm run dev
```

### 3. Verify Server is Running

You should see:
```
🚗 TourTaxi Backend Server Started
📡 Server running on port 3000
🌐 API available at http://localhost:3000
🔌 Socket.io ready for connections
⏰ Cron jobs scheduled for maintenance
🗺️  Google Maps API configured for accurate distances
=====================================
```

### 4. Test the Server

Open your browser and go to:
- http://localhost:3000 - Server status
- http://localhost:3000/drivers - Active drivers
- http://localhost:3000/rides - Pending rides

### 5. Run the Flutter App

```bash
# In the main project directory
flutter run
```

## 🎯 What Happens When You Go Online

1. **Driver Toggles Online** → Connects to backend server
2. **Location Tracking Starts** → Sends location updates every 10 seconds
3. **Driver Available** → Can receive ride requests
4. **Ride Request Received** → Popup appears with passenger details
5. **Driver Accepts** → Passenger gets driver details notification
6. **Ride Starts** → Real-time tracking begins
7. **Ride Completes** → Fare calculated and earnings updated

## 🔧 Configuration

### Google Maps API (Optional)
For accurate distance calculations, add your Google Maps API key to `backend/.env`:
```env
GOOGLE_MAPS_API_KEY=your_api_key_here
```

### Change Server Port
Edit `backend/.env`:
```env
PORT=3000
```

## 🚨 Troubleshooting

### Server Won't Start
- Check if port 3000 is free
- Make sure Node.js is installed
- Run `npm install` in backend folder

### Flutter Can't Connect
- Verify backend server is running
- Check `socketUrl` in `lib/constants/app_constants.dart`
- Ensure device/emulator can reach localhost

### No Ride Requests
- Make sure driver is online
- Check backend console for errors
- Verify location permissions

## 📱 Testing the Complete Flow

1. **Start Backend**: `npm run dev` in backend folder
2. **Run Flutter App**: `flutter run`
3. **Go Online**: Toggle online switch in app
4. **Simulate Ride Request**: Use a tool like Postman or create a simple test script
5. **Accept Ride**: Use the popup in the app
6. **Complete Ride**: Follow the ride flow

## 🎉 Success!

Your TourTaxi Driver App is now running with a complete real-time backend system!

- ✅ Real-time driver connection
- ✅ Live location tracking  
- ✅ Instant ride notifications
- ✅ Accurate distance calculations
- ✅ Complete ride lifecycle
- ✅ Professional-grade backend

**Ready for production deployment! 🚗✨**

