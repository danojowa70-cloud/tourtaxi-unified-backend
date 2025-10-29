const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { getDistance } = require('geolib');

// TourTaxi Server with ride request delivery fixes
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// ========================================
// DATA STORAGE (In-memory for real-time features)
// ========================================
const activeDrivers = new Map(); // driver_id -> driver data
const pendingRides = new Map(); // ride_id -> ride data
const driverSessions = new Map(); // socket_id -> driver_id

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'TourTaxi Server Running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    stats: {
      activeDrivers: activeDrivers.size,
      pendingRides: pendingRides.size
    }
  });
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    message: 'TourTaxi Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    stats: {
      activeDrivers: activeDrivers.size,
      pendingRides: pendingRides.size,
      totalConnections: io.engine.clientsCount
    }
  });
});

// Get active drivers endpoint
app.get('/drivers', (req, res) => {
  const drivers = Array.from(activeDrivers.entries()).map(([id, data]) => ({
    driver_id: id,
    name: data.name,
    isOnline: data.isOnline,
    isAvailable: data.isAvailable,
    latitude: data.latitude,
    longitude: data.longitude,
    lastLocationUpdate: data.lastLocationUpdate
  }));
  
  res.json({
    drivers: drivers,
    count: drivers.length,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: { 
    origin: "*",
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Find nearby drivers within radius
function findNearbyDrivers(lat, lng, radiusKm = 5.0) {
  const nearbyDrivers = [];
  
  activeDrivers.forEach((driver, driverId) => {
    if (driver.isOnline && driver.isAvailable) {
      const distance = getDistance(
        { latitude: lat, longitude: lng },
        { latitude: driver.latitude, longitude: driver.longitude }
      ) / 1000;
      
      if (distance <= radiusKm) {
        nearbyDrivers.push({
          driver_id: driverId,
          distance: distance,
          rating: driver.rating || 4.5,
          name: driver.name
        });
      }
    }
  });
  
  return nearbyDrivers.sort((a, b) => a.distance - b.distance);
}

// Generate unique ride ID
function generateRideId() {
  return `ride_${Date.now()}_${uuidv4().substring(0, 8)}`;
}

// ========================================
// SOCKET.IO EVENT HANDLERS
// ========================================

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  
  // Passenger connection
  socket.on('connect_passenger', async (data) => {
    try {
      console.log(`👤 Passenger connecting: ${data.passenger_id}`);
      
      socket.passengerId = data.passenger_id;
      socket.join(`passenger_${data.passenger_id}`);
      
      socket.emit('passenger_connected', {
        status: 'success',
        passenger_id: data.passenger_id,
        timestamp: new Date().toISOString()
      });
      
      console.log(`✅ Passenger ${data.passenger_id} connected successfully`);
    } catch (error) {
      console.error('Error connecting passenger:', error);
    }
  });
  
  // CRITICAL FIX: Driver connection with proper room management
  socket.on('connect_driver', async (data) => {
    try {
      console.log(`🚗 Driver connecting: ${data.driver_id}`);
      
      if (!data.driver_id || !data.latitude || !data.longitude) {
        socket.emit('error', { message: 'Invalid driver data' });
        return;
      }

      const driverInfo = {
        socketId: socket.id,
        driver_id: data.driver_id,
        name: data.name || 'Driver',
        phone: data.phone || '',
        vehicle_type: data.vehicle_type || 'Sedan',
        vehicle_number: data.vehicle_number || 'GJO6PM8016',
        rating: data.rating || 4.5,
        latitude: data.latitude,
        longitude: data.longitude,
        isOnline: true,
        isAvailable: true,
        connectedAt: new Date().toISOString(),
        lastLocationUpdate: new Date().toISOString()
      };

      activeDrivers.set(data.driver_id, driverInfo);
      driverSessions.set(socket.id, data.driver_id);
      socket.driverId = data.driver_id;

      // CRITICAL: Join driver to Socket.IO rooms for receiving ride requests
      socket.join(`driver_${data.driver_id}`);
      socket.join('available_drivers');
      socket.join('online_drivers');
      console.log(`🔗 Driver ${data.driver_id} joined rooms: ${Array.from(socket.rooms)}`);

      socket.emit('driver_connected', {
        status: 'success',
        message: 'Successfully connected to TourTaxi',
        driver_id: data.driver_id,
        socket_rooms: Array.from(socket.rooms),
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Driver ${data.driver_id} connected successfully`);
    } catch (error) {
      console.error('Error connecting driver:', error);
      socket.emit('error', { message: 'Failed to connect driver', error: error.message });
    }
  });
  
  // FIXED: Location update handler
  socket.on('location_update', async (data) => {
    try {
      const driverId = socket.driverId;
      if (!driverId || !activeDrivers.has(driverId)) {
        return;
      }

      const driver = activeDrivers.get(driverId);
      driver.latitude = data.latitude;
      driver.longitude = data.longitude;
      driver.lastLocationUpdate = new Date().toISOString();

      console.log(`📍 Updated location for driver ${driverId}: ${data.latitude}, ${data.longitude}`);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });
  
  // ENHANCED: Ride request handling with multiple delivery methods
  socket.on('ride_request', async (rideData) => {
    try {
      console.log(`🚖 New ride request from passenger: ${rideData.passenger_name}`);
      
      const rideId = rideData.ride_id || generateRideId();
      const ride = {
        ride_id: rideId,
        passenger_id: rideData.passenger_id,
        passenger_name: rideData.passenger_name,
        passenger_phone: rideData.passenger_phone,
        pickup_latitude: rideData.pickup_latitude,
        pickup_longitude: rideData.pickup_longitude,
        pickup_address: rideData.pickup_address,
        destination_latitude: rideData.destination_latitude,
        destination_longitude: rideData.destination_longitude,
        destination_address: rideData.destination_address,
        distance: rideData.distance || 0,
        fare: rideData.fare || 0,
        status: 'requested',
        requested_at: new Date().toISOString()
      };
      
      pendingRides.set(rideId, ride);
      
      // Find nearby drivers
      const nearbyDrivers = findNearbyDrivers(
        rideData.pickup_latitude, 
        rideData.pickup_longitude, 
        5.0
      );
      
      console.log(`📍 Found ${nearbyDrivers.length} nearby drivers`);
      
      if (nearbyDrivers.length === 0) {
        socket.emit('no_drivers_available', {
          ride_id: rideId,
          message: 'No drivers available in your area'
        });
        return;
      }
      
      // Send to drivers using multiple methods for reliability
      let requestsSent = 0;
      nearbyDrivers.forEach(driverInfo => {
        const driver = activeDrivers.get(driverInfo.driver_id);
        if (driver && driver.isAvailable) {
          const rideRequestData = {
            ride_data: {
              ...ride,
              distance_km: driverInfo.distance.toFixed(2),
              driver_name: driver.name
            },
            distance_km: driverInfo.distance.toFixed(2),
            driver_name: driver.name
          };
          
          // Method 1: Direct socket emission
          console.log(`📱 Sending ride request to driver ${driverInfo.driver_id} via socket ${driver.socketId}`);
          io.to(driver.socketId).emit('ride_request', rideRequestData);
          
          // Method 2: Room-based emission as backup
          io.to(`driver_${driverInfo.driver_id}`).emit('ride_request', rideRequestData);
          
          requestsSent++;
        }
      });
      
      console.log(`📤 Ride request sent to ${requestsSent} drivers`);
      
    } catch (error) {
      console.error('Error processing ride request:', error);
      socket.emit('error', { message: 'Failed to process ride request' });
    }
  });
  
  // Ride acceptance with full driver info and OTP generation
  socket.on('ride_accept', async (data) => {
    try {
      const ride = pendingRides.get(data.ride_id);
      if (ride && ride.status === 'requested') {
        ride.status = 'accepted';
        ride.driver_id = data.driver_id;
        ride.accepted_at = new Date().toISOString();
        
        const driver = activeDrivers.get(data.driver_id);
        if (driver) {
          driver.isAvailable = false;
        }
        
        // Generate 4-digit OTP for ride verification
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        ride.otp = otp;
        console.log(`🔐 Generated OTP ${otp} for ride ${data.ride_id}`);
        
        // Prepare comprehensive ride_accepted event with ALL driver info
        const rideAcceptedData = {
          ride_id: data.ride_id,
          driver_id: data.driver_id,
          driver_name: driver?.name || 'Driver',
          driver_phone: driver?.phone || '',
          driver_vehicle: driver?.vehicle_type || 'Sedan',
          driver_vehicle_number: 'GJO6PM8016', // You should add this to driver data
          driver_rating: driver?.rating || 4.5,
          driver_image: null,
          driver_latitude: driver?.latitude,
          driver_longitude: driver?.longitude,
          estimated_arrival: '3 minutes',
          pickup_address: ride.pickup_address,
          destination_address: ride.destination_address,
          fare: ride.fare,
          distance: ride.distance + ' km',
          duration: '8 mins',
          route_polyline: ride.route_polyline || '',
          driver_to_pickup_polyline: '',
          driver_to_pickup_distance: '0.7 km',
          driver_to_pickup_duration: '3 mins',
          timestamp: new Date().toISOString()
        };
        
        // Emit to BOTH passenger and driver with comprehensive info
        io.emit('ride_accepted', rideAcceptedData);
        io.to(`passenger_${ride.passenger_id}`).emit('ride_accepted', rideAcceptedData);
        io.to(`driver_${data.driver_id}`).emit('ride_accepted', rideAcceptedData);
        
        // Send OTP separately to both
        const otpData = {
          ride_id: data.ride_id,
          otp: otp,
          timestamp: new Date().toISOString()
        };
        io.emit('ride_otp', otpData);
        io.to(`passenger_${ride.passenger_id}`).emit('ride_otp', otpData);
        io.to(`driver_${data.driver_id}`).emit('ride_otp', otpData);
        
        console.log(`✅ Ride ${data.ride_id} accepted by driver ${data.driver_id}`);
        console.log(`📤 Sent full driver info and OTP to passenger ${ride.passenger_id}`);
      }
    } catch (error) {
      console.error('Error accepting ride:', error);
    }
  });
  
  // Ride cancellation (by passenger)
  socket.on('ride_cancel', async (data) => {
    try {
      const ride = pendingRides.get(data.ride_id);
      if (ride) {
        ride.status = 'cancelled';
        ride.cancelled_at = new Date().toISOString();
        ride.cancellation_reason = data.reason || 'Passenger cancelled';
        
        // Notify all parties
        io.emit('ride_cancelled', {
          ride_id: data.ride_id,
          reason: ride.cancellation_reason,
          timestamp: new Date().toISOString()
        });
        
        // If driver was assigned, make them available again
        if (ride.driver_id) {
          const driver = activeDrivers.get(ride.driver_id);
          if (driver) {
            driver.isAvailable = true;
          }
          io.to(`driver_${ride.driver_id}`).emit('ride_cancelled', {
            ride_id: data.ride_id,
            reason: ride.cancellation_reason,
            timestamp: new Date().toISOString()
          });
        }
        
        pendingRides.delete(data.ride_id);
        console.log(`❌ Ride ${data.ride_id} cancelled: ${ride.cancellation_reason}`);
      }
    } catch (error) {
      console.error('Error cancelling ride:', error);
    }
  });
  
  // Ride rejection
  socket.on('ride_reject', (data) => {
    console.log(`❌ Driver ${data.driver_id} rejected ride ${data.ride_id}`);
    socket.emit('ride_rejected_confirmation', {
      ride_id: data.ride_id,
      status: 'success'
    });
  });
  
  // Ride started
  socket.on('ride_start', async (data) => {
    try {
      const ride = pendingRides.get(data.ride_id);
      if (ride) {
        ride.status = 'started';
        ride.started_at = new Date().toISOString();
        
        io.emit('ride_started', {
          ride_id: data.ride_id,
          driver_id: data.driver_id,
          timestamp: new Date().toISOString()
        });
        
        console.log(`🏁 Ride ${data.ride_id} started`);
      }
    } catch (error) {
      console.error('Error starting ride:', error);
    }
  });
  
  // Ride completed
  socket.on('ride_complete', async (data) => {
    try {
      const ride = pendingRides.get(data.ride_id);
      if (ride) {
        ride.status = 'completed';
        ride.completed_at = new Date().toISOString();
        
        // Set driver available again
        const driver = activeDrivers.get(data.driver_id);
        if (driver) {
          driver.isAvailable = true;
          console.log(`✅ Driver ${data.driver_id} is now available`);
        }
        
        io.emit('ride_completed', {
          ride_id: data.ride_id,
          driver_id: data.driver_id,
          timestamp: new Date().toISOString()
        });
        
        // Remove from pending
        pendingRides.delete(data.ride_id);
        console.log(`🏁 Ride ${data.ride_id} completed`);
      }
    } catch (error) {
      console.error('Error completing ride:', error);
    }
  });
  
  // Driver set available
  socket.on('driver_available', (data) => {
    try {
      const driver = activeDrivers.get(data.driver_id);
      if (driver) {
        driver.isAvailable = true;
        console.log(`✅ Driver ${data.driver_id} set to available`);
      }
    } catch (error) {
      console.error('Error setting driver available:', error);
    }
  });
  
  // Driver going offline
  socket.on('driver_offline', (data) => {
    try {
      const driver = activeDrivers.get(data.driver_id);
      if (driver) {
        driver.isOnline = false;
        driver.isAvailable = false;
        console.log(`🔴 Driver ${data.driver_id} went offline`);
      }
    } catch (error) {
      console.error('Error setting driver offline:', error);
    }
  });
  
  // Disconnect handler
  socket.on('disconnect', () => {
    try {
      const driverId = driverSessions.get(socket.id);
      if (driverId) {
        console.log(`🔌 Driver ${driverId} disconnected`);
        const driver = activeDrivers.get(driverId);
        if (driver) {
          driver.isOnline = false;
          driver.isAvailable = false;
        }
        driverSessions.delete(socket.id);
      } else {
        console.log(`🔌 Socket ${socket.id} disconnected`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Start server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚗 TourTaxi Fallback Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Status: http://localhost:${PORT}/status`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});