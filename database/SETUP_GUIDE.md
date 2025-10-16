# Database Setup and Socket.io Configuration Guide

## 🗄️ Supabase Trigger Setup

### Step 1: Create the Driver Online Status Trigger

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor**

2. **Execute the Trigger Script**
   - Copy the entire content from `triggers/driver_online_trigger.sql`
   - Paste it in the SQL Editor
   - Click **Run** to execute

3. **Verify Installation**
   Run this query to confirm the trigger is installed:
   ```sql
   SELECT 
     tgname as trigger_name,
     tgrelid::regclass as table_name
   FROM pg_trigger 
   WHERE tgname = 'driver_online_status_trigger';
   ```

4. **Test the Trigger**
   ```sql
   -- Find a driver to test with
   SELECT id, name, is_online FROM drivers LIMIT 1;
   
   -- Update driver status (replace with actual driver ID)
   UPDATE drivers SET is_online = true WHERE id = 'your-driver-id-here';
   
   -- Check if event was created
   SELECT * FROM ride_events 
   WHERE event_type = 'driver:online' 
   ORDER BY created_at DESC LIMIT 5;
   ```

### Step 2: Apply Performance Optimizations

1. **Run Optimization Script**
   - Copy content from `triggers/optimize_ride_events.sql`
   - Paste in SQL Editor and execute
   - This creates indexes for better query performance

## 🔌 Socket.io Timeout Fix

### Current Issues Identified:

1. **Missing timeout configurations**
2. **No reconnection strategy**
3. **Limited transport options**
4. **No connection health monitoring**

### Solution: Updated Socket Service

Replace your current `SocketService` with the improved version below:

```dart
import 'dart:async';
import 'dart:developer' as dev;
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/app_constants.dart';
import '../models/ride_model.dart';

class SocketService {
  static io.Socket? _socket;
  static Timer? _reconnectTimer;
  static Timer? _heartbeatTimer;
  static bool _isReconnecting = false;
  static int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  
  static final StreamController<Ride> _rideRequestController = StreamController<Ride>.broadcast();
  static final StreamController<Map<String, dynamic>> _locationUpdateController = StreamController<Map<String, dynamic>>.broadcast();
  static final StreamController<String> _connectionStatusController = StreamController<String>.broadcast();

  static Stream<Ride> get rideRequestStream => _rideRequestController.stream;
  static Stream<Map<String, dynamic>> get locationUpdateStream => _locationUpdateController.stream;
  static Stream<String> get connectionStatusStream => _connectionStatusController.stream;

  static bool get isConnected => _socket?.connected ?? false;

  static Future<void> initialize() async {
    try {
      _socket = io.io(AppConstants.socketUrl, <String, dynamic>{
        'transports': ['websocket', 'polling'], // Allow fallback to polling
        'autoConnect': false,
        'timeout': 20000, // 20 second timeout
        'connectTimeout': 20000, // 20 second connection timeout
        'reconnection': true,
        'reconnectionDelay': 2000, // 2 seconds between reconnect attempts
        'reconnectionDelayMax': 10000, // Maximum 10 seconds between attempts
        'reconnectionAttempts': _maxReconnectAttempts,
        'forceNew': true,
      });

      _setupEventListeners();
      await connect();
      _startHeartbeat();
    } catch (e) {
      dev.log('Socket initialization failed: $e', name: 'SocketService');
      _scheduleReconnect();
    }
  }

  static void _setupEventListeners() {
    _socket?.on('connect', (_) {
      dev.log('Socket connected successfully', name: 'SocketService');
      _connectionStatusController.add('connected');
      _reconnectAttempts = 0;
      _isReconnecting = false;
      _cancelReconnectTimer();
    });

    _socket?.on('disconnect', (reason) {
      dev.log('Socket disconnected: $reason', name: 'SocketService');
      _connectionStatusController.add('disconnected');
      if (reason != 'io client disconnect') {
        _scheduleReconnect();
      }
    });

    _socket?.on('connect_error', (error) {
      dev.log('Socket connection error: $error', name: 'SocketService');
      _connectionStatusController.add('error');
      _scheduleReconnect();
    });

    _socket?.on('connect_timeout', (_) {
      dev.log('Socket connection timeout', name: 'SocketService');
      _connectionStatusController.add('timeout');
      _scheduleReconnect();
    });

    // Heartbeat response
    _socket?.on('pong', (_) {
      dev.log('Received pong from server', name: 'SocketService');
    });

    // App-specific event listeners
    _socket?.on('ride_request', (data) {
      dev.log('Received ride request: $data', name: 'SocketService');
      try {
        final ride = Ride.fromJson(data);
        _rideRequestController.add(ride);
      } catch (e) {
        dev.log('Error parsing ride request: $e', name: 'SocketService');
      }
    });

    _socket?.on('location_update', (data) {
      dev.log('Received location update: $data', name: 'SocketService');
      _locationUpdateController.add(data);
    });

    _socket?.on('ride_accepted', (data) {
      dev.log('Ride accepted: $data', name: 'SocketService');
    });

    _socket?.on('ride_started', (data) {
      dev.log('Ride started: $data', name: 'SocketService');
    });

    _socket?.on('ride_completed', (data) {
      dev.log('Ride completed: $data', name: 'SocketService');
    });

    _socket?.on('driver_offline', (data) {
      dev.log('Driver offline: $data', name: 'SocketService');
    });
  }

  static void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(Duration(seconds: 30), (timer) {
      if (isConnected) {
        _socket?.emit('ping');
        dev.log('Sent ping to server', name: 'SocketService');
      }
    });
  }

  static void _scheduleReconnect() {
    if (_isReconnecting || _reconnectAttempts >= _maxReconnectAttempts) {
      if (_reconnectAttempts >= _maxReconnectAttempts) {
        dev.log('Max reconnection attempts reached', name: 'SocketService');
        _connectionStatusController.add('failed');
      }
      return;
    }

    _isReconnecting = true;
    _reconnectAttempts++;
    
    final delay = Duration(seconds: 2 * _reconnectAttempts); // Exponential backoff
    dev.log('Scheduling reconnection attempt $_reconnectAttempts in ${delay.inSeconds} seconds', name: 'SocketService');
    
    _reconnectTimer = Timer(delay, () {
      dev.log('Attempting to reconnect...', name: 'SocketService');
      connect();
    });
  }

  static void _cancelReconnectTimer() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  static Future<void> connect() async {
    try {
      if (!isConnected) {
        _socket?.connect();
        dev.log('Attempting socket connection...', name: 'SocketService');
      }
    } catch (e) {
      dev.log('Socket connection failed: $e', name: 'SocketService');
      _scheduleReconnect();
    }
  }

  static Future<void> disconnect() async {
    try {
      _cancelReconnectTimer();
      _heartbeatTimer?.cancel();
      _socket?.disconnect();
      dev.log('Socket disconnected manually', name: 'SocketService');
    } catch (e) {
      dev.log('Socket disconnection failed: $e', name: 'SocketService');
    }
  }

  // ... rest of your existing methods (connectDriver, updateLocation, etc.)
  // Keep all the existing emit methods unchanged
}
```

## 🛠️ Backend Configuration (Render Server)

### Update your backend Socket.io configuration:

```javascript
// server.js or similar
const io = require('socket.io')(server, {
  cors: {
    origin: "*", // Configure properly for production
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Add connection health monitoring
io.on('connection', (socket) => {
  console.log('Driver connected:', socket.id);
  
  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Driver disconnected:', socket.id, 'Reason:', reason);
  });
  
  // Your existing socket event handlers...
});
```

## 🔧 Troubleshooting

### Socket.io Connection Issues:

1. **Check Render Server Status**
   ```bash
   curl https://tourtaxi-unified-backend.onrender.com/health
   ```

2. **Verify Server Logs**
   - Check Render dashboard logs for connection errors
   - Look for CORS issues or timeout problems

3. **Test Local Connection**
   ```dart
   // Add this to test connectivity
   static Future<bool> testConnection() async {
     try {
       final response = await http.get(
         Uri.parse('${AppConstants.socketUrl}/socket.io/')
       );
       return response.statusCode == 200;
     } catch (e) {
       dev.log('Connection test failed: $e');
       return false;
     }
   }
   ```

### Common Socket.io Timeout Causes:

1. **Server sleeping on Render** - Free tier servers sleep after inactivity
2. **Network connectivity issues** - Mobile networks can be unstable
3. **CORS configuration** - Ensure proper CORS setup on server
4. **Firewall blocking WebSocket** - Fallback to polling should handle this

### Performance Tips:

1. **Use connection pooling** on the server
2. **Implement proper error handling** for all socket events
3. **Add connection retry logic** with exponential backoff
4. **Monitor connection health** with ping/pong heartbeat

## ✅ Verification Steps

1. **Test Supabase Trigger**:
   - Update a driver's `is_online` status
   - Check `ride_events` table for new entries

2. **Test Socket.io Connection**:
   - Run the app and check logs for connection success
   - Verify heartbeat messages are working
   - Test reconnection by temporarily disabling network

3. **Monitor Performance**:
   - Use Supabase dashboard to monitor database performance
   - Check Render logs for socket connection metrics

## 📞 Support

If you encounter issues:

1. Check Render server logs for errors
2. Verify Supabase connection strings
3. Ensure all environment variables are set correctly
4. Test with a local development server first