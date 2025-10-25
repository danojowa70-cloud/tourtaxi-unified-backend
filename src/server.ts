import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

import { env } from './config/env';
import { logger } from './utils/logger';
import supabase from './config/supabase';
import { registerDriverHandlers, activeDrivers, pendingRides, completedRides, driverSessions, updateDriverStatus } from './handlers/driverHandler';
import { registerPassengerHandlers, activePassengers, passengerSessions } from './handlers/passengerHandler';
import { ClientToServerEvents, ServerToClientEvents } from './types/index';
import boardingPassesRouter from './routes/boarding-passes.routes';
import adminRouter from './routes/admin.routes';

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (_req: express.Request, res: express.Response) => {
  let supabaseConnected = true;
  try {
    const { error } = await supabase
      .from('ride_events')
      .select('id', { count: 'exact', head: true });
    if (error) supabaseConnected = false;
  } catch {
    supabaseConnected = false;
  }

  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.nodeEnv,
    supabaseConnected,
  });
});

// System status endpoint
app.get('/status', (_req: express.Request, res: express.Response) => {
  res.json({
    message: 'TourTaxi Unified Backend Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    stats: {
      activeDrivers: activeDrivers.size,
      activePassengers: activePassengers.size,
      pendingRides: pendingRides.size,
      completedRides: completedRides.size,
    },
  });
});

// API Routes for monitoring and management
app.get('/api/drivers', (_req: express.Request, res: express.Response) => {
  const drivers = Array.from(activeDrivers.entries()).map(([id, data]) => ({
    driver_id: id,
    name: data.name,
    phone: data.phone,
    vehicle_type: data.vehicle_type,
    vehicle_number: data.vehicle_number,
    rating: data.rating,
    isOnline: data.isOnline,
    isAvailable: data.isAvailable,
    currentRide: data.currentRide,
    totalRides: data.totalRides,
    totalEarnings: data.totalEarnings,
    lastLocationUpdate: data.lastLocationUpdate,
    connectedAt: data.connectedAt,
  }));

  res.json({
    drivers,
    count: drivers.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/passengers', (_req: express.Request, res: express.Response) => {
  const passengers = Array.from(activePassengers.entries()).map(([id, data]) => ({
    passenger_id: id,
    name: data.name,
    phone: data.phone,
    connectedAt: data.connectedAt,
  }));

  res.json({
    passengers,
    count: passengers.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/rides', (_req: express.Request, res: express.Response) => {
  const rides = Array.from(pendingRides.entries()).map(([id, data]) => ({
    ...data,
    ride_id: id,
  }));

  res.json({
    rides,
    count: rides.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/completed-rides', (_req: express.Request, res: express.Response) => {
  const rides = Array.from(completedRides.entries()).map(([id, data]) => ({
    ...data,
    ride_id: id,
  }));

  res.json({
    rides,
    count: rides.length,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/driver/:driverId', (req: express.Request, res: express.Response) => {
  const driverId = req.params.driverId;
  const driver = activeDrivers.get(driverId);

  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  res.json({
    ...driver,
    driver_id: driverId,
  });
});

app.get('/api/passenger/:passengerId', (req: express.Request, res: express.Response) => {
  const passengerId = req.params.passengerId;
  const passenger = activePassengers.get(passengerId);

  if (!passenger) {
    return res.status(404).json({ error: 'Passenger not found' });
  }

  res.json({
    ...passenger,
    passenger_id: passengerId,
  });
});

app.get('/api/ride/:rideId', (req: express.Request, res: express.Response) => {
  const rideId = req.params.rideId;
  const ride = pendingRides.get(rideId) || completedRides.get(rideId);

  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }

  res.json({
    ...ride,
    ride_id: rideId,
  });
});

// Recent ride_events (for monitoring all events including passenger activity)
// GET /api/ride-events?limit=50&driver_id=<uuid>&passenger_id=<uuid>&event_type=driver:online,passenger:connected,ride:requested
app.get('/api/ride-events', async (req: express.Request, res: express.Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const driverId = (req.query.driver_id as string) || '';
    const passengerId = (req.query.passenger_id as string) || '';
    const eventType = (req.query.event_type as string) || '';

    let query = supabase
      .from('ride_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (driverId) {
      // Filter JSON payload->>driver_id equals provided driverId
      query = query.filter('payload->>driver_id', 'eq', driverId);
    }
    
    if (passengerId) {
      // Filter JSON payload->>passenger_id equals provided passengerId
      query = query.filter('payload->>passenger_id', 'eq', passengerId);
    }

    if (eventType) {
      const types = eventType.split(',').map((s) => s.trim()).filter(Boolean);
      if (types.length > 0) {
        query = query.in('event_type', types);
      }
    }

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch ride events', details: error.message });
    }

    res.json({
      events: data ?? [],
      count: data?.length ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'Server error', message: e?.message || 'Unknown error' });
  }
});

// Boarding passes API routes
app.use('/api/boarding-passes', boardingPassesRouter);

// Admin panel API routes
app.use('/api', adminRouter);

// Driver status update endpoint
app.post('/driver/status', updateDriverStatus);

// Test ride request endpoint for debugging
app.post('/test/ride-request', async (req: express.Request, res: express.Response) => {
  try {
    const { passenger_id, pickup_lat, pickup_lng, destination_lat, destination_lng } = req.body;
    
    if (!passenger_id || !pickup_lat || !pickup_lng) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Find nearby drivers for testing
    const nearbyDrivers = [];
    
    // Get all active drivers
    activeDrivers.forEach((driver, driverId) => {
      if (driver.isOnline && driver.isAvailable) {
        // Calculate simple distance (for testing)
        const distance = Math.abs(driver.latitude - pickup_lat) + Math.abs(driver.longitude - pickup_lng);
        nearbyDrivers.push({
          driver_id: driverId,
          name: driver.name,
          distance: distance,
          rating: driver.rating,
          vehicle_type: driver.vehicle_type,
          phone: driver.phone,
          vehicle_number: driver.vehicle_number
        });
      }
    });
    
    if (nearbyDrivers.length === 0) {
      return res.json({ 
        message: 'No nearby drivers found',
        test_result: 'no_drivers',
        active_drivers_count: activeDrivers.size,
        driver_details: Array.from(activeDrivers.entries()).map(([id, driver]) => ({
          driver_id: id,
          name: driver.name,
          isOnline: driver.isOnline,
          isAvailable: driver.isAvailable
        }))
      });
    }
    
    // Test ride request emission
    let testResults = [];
    const testPayload = {
      ride_id: `test_${Date.now()}`,
      passenger_id,
      passenger_name: 'Test Passenger',
      passenger_phone: '1234567890',
      pickup_latitude: pickup_lat,
      pickup_longitude: pickup_lng,
      pickup_address: 'Test Pickup Location',
      destination_latitude: destination_lat || pickup_lat + 0.01,
      destination_longitude: destination_lng || pickup_lng + 0.01,
      destination_address: 'Test Destination',
      distance: '2.5',
      distance_text: '2.5 km',
      duration: 8,
      duration_text: '8 mins',
      fare: '15.00',
      status: 'requested' as const,
      requested_at: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };
    
    for (const driverInfo of nearbyDrivers) {
      const driver = activeDrivers.get(driverInfo.driver_id);
      if (driver && driver.isAvailable) {
        try {
          // Test all three emission methods
          const estimatedArrival = Math.round(driverInfo.distance * 60); // minutes
          const rideRequest = {
            ...testPayload,
            estimated_arrival: `${estimatedArrival} minutes`,
            driver_distance: driverInfo.distance.toFixed(2)
          };
          
          // Method 1: Driver-specific room
          io.to(`driver_${driverInfo.driver_id}`).emit('ride_request', rideRequest);
          
          // Method 2: Direct socket ID
          io.to(driver.socketId).emit('ride_request', rideRequest);
          
          // Method 3: Available drivers room
          io.to('available_drivers').emit('ride_request', {
            ...rideRequest,
            target_driver_id: driverInfo.driver_id
          });
          
          testResults.push({
            driver_id: driverInfo.driver_id,
            driver_name: driver.name,
            socket_id: driver.socketId,
            emission_status: 'success',
            distance: driverInfo.distance,
            methods_used: [
              `driver_${driverInfo.driver_id}`,
              driver.socketId,
              'available_drivers'
            ]
          });
        } catch (error: any) {
          testResults.push({
            driver_id: driverInfo.driver_id,
            emission_status: 'failed',
            error: error.message
          });
        }
      }
    }
    
    res.json({
      message: 'Test ride request sent',
      test_payload: testPayload,
      nearby_drivers_found: nearbyDrivers.length,
      emissions_sent: testResults.length,
      results: testResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    res.status(500).json({ error: 'Test failed', message: error.message });
  }
});

// Force driver recovery endpoint with immediate status fix
app.post('/driver/:driverId/recover', async (req: express.Request, res: express.Response) => {
  try {
    const driverId = req.params.driverId;
    
    // Get driver from database
    const { data: driverData, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .single();
    
    if (error || !driverData) {
      return res.status(404).json({ error: 'Driver not found in database' });
    }
    
    // Mark driver as online and available in database
    await supabase
      .from('drivers')
      .update({
        is_online: true,
        is_available: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverId);
    
    // Update active_drivers table
    await supabase.rpc('update_driver_online_status', {
      available_status: true,
      driver_id: driverId,
      online_status: true
    });
    
    // Also update in-memory if driver exists
    const memoryDriver = activeDrivers.get(driverId);
    if (memoryDriver) {
      memoryDriver.isOnline = true;
      memoryDriver.isAvailable = true;
      memoryDriver.lastLocationUpdate = new Date().toISOString();
      logger.info({ driver_id: driverId }, 'Driver recovered in both database and memory');
    } else {
      logger.info({ driver_id: driverId }, 'Driver recovered in database only (not in memory)');
    }
    
    logger.info({ driver_id: driverId }, 'Driver manually recovered to online status');
    
    res.json({
      success: true,
      message: 'Driver recovered to online status',
      driver_id: driverId,
      in_memory: !!memoryDriver,
      database_updated: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error({ error }, 'Failed to recover driver');
    res.status(500).json({ error: 'Failed to recover driver', message: error.message });
  }
});

// Force cleanup and sync driver statuses (emergency endpoint)
app.post('/admin/sync-drivers', async (req: express.Request, res: express.Response) => {
  try {
    let syncedDrivers = 0;
    let cleanedDrivers = 0;
    
    // Sync all drivers in memory with database
    for (const [driverId, driver] of activeDrivers) {
      try {
        // Update database to match memory status
        await supabase
          .from('drivers')
          .update({
            is_online: driver.isOnline,
            is_available: driver.isAvailable,
            updated_at: new Date().toISOString()
          })
          .eq('id', driverId);
          
        // Update active_drivers table
        await supabase.rpc('update_driver_online_status', {
          available_status: driver.isAvailable,
          driver_id: driverId,
          online_status: driver.isOnline
        });
        
        syncedDrivers++;
      } catch (error) {
        logger.error({ error, driver_id: driverId }, 'Failed to sync driver status');
      }
    }
    
    // Clean up stale connections immediately
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    
    activeDrivers.forEach(async (driver, driverId) => {
      const lastUpdate = new Date(driver.lastLocationUpdate || driver.connectedAt);
      const timeDiff = now.getTime() - lastUpdate.getTime();
      
      if (timeDiff > staleThreshold && driver.isOnline) {
        driver.isOnline = false;
        driver.isAvailable = false;
        cleanedDrivers++;
        
        // Update database
        await supabase
          .from('drivers')
          .update({
            is_online: false,
            is_available: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', driverId);
      }
    });
    
    logger.info({ 
      synced_drivers: syncedDrivers, 
      cleaned_drivers: cleanedDrivers 
    }, 'Manual driver sync completed');
    
    res.json({
      success: true,
      message: 'Driver statuses synchronized',
      synced_drivers: syncedDrivers,
      cleaned_stale_drivers: cleanedDrivers,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error({ error }, 'Failed to sync driver statuses');
    res.status(500).json({ error: 'Failed to sync driver statuses', message: error.message });
  }
});

// FCM token update endpoint
app.post('/driver/fcm-token', async (req: express.Request, res: express.Response) => {
  try {
    const { driver_id, fcm_token } = req.body;
    
    if (!driver_id || !fcm_token) {
      return res.status(400).json({ 
        error: 'Missing required fields: driver_id and fcm_token' 
      });
    }
    
    const { data, error } = await supabase
      .from('drivers')
      .update({
        fcm_token: fcm_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', driver_id);
    
    if (error) {
      logger.error({ error, driver_id }, 'Failed to update FCM token in database');
      return res.status(400).json({ error: error.message });
    }
    
    logger.info({ driver_id }, 'FCM token updated successfully');
    
    return res.status(200).json({ 
      success: true, 
      data: {
        driver_id,
        updated_at: new Date().toISOString()
      }
    });
    
  } catch (err: any) {
    logger.error({ error: err }, 'Internal server error updating FCM token');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint to check driver status in database
app.get('/driver/:driverId/status', async (req: express.Request, res: express.Response) => {
  try {
    const driverId = req.params.driverId;
    
    const { data, error } = await supabase
      .from('drivers')
      .select('id, name, is_online, is_available, updated_at')
      .eq('id', driverId)
      .single();
    
    if (error) {
      return res.status(404).json({ error: 'Driver not found in database', details: error.message });
    }
    
    // Also get from memory for comparison
    const memoryDriver = activeDrivers.get(driverId);
    
    // Check active_drivers table
    const { data: activeDriverData, error: activeDriverError } = await supabase
      .from('active_drivers')
      .select('id, name, is_online, is_available, last_seen, updated_at')
      .eq('id', driverId)
      .single();
    
    res.json({
      database: data,
      active_drivers: activeDriverError ? null : activeDriverData,
      memory: memoryDriver ? {
        id: driverId,
        name: memoryDriver.name,
        isOnline: memoryDriver.isOnline,
        isAvailable: memoryDriver.isAvailable
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get driver status', message: error.message });
  }
});


// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error in Express');
  res.status(500).json({ 
    error: 'Internal server error',
    message: env.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Create HTTP server
const server = http.createServer(app);

// Configure Socket.IO with mobile-optimized connection stability
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { 
    origin: env.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingInterval: 10000,   // 10s for mobile networks
  pingTimeout: 8000,     // 8s timeout for faster detection
  transports: ['websocket', 'polling'], // Allow fallback to polling
  allowEIO3: true,       // Support older clients
  connectTimeout: 60000, // 60 seconds for slower networks
  upgradeTimeout: 20000, // 20 seconds upgrade timeout
  maxHttpBufferSize: 1e6, // 1MB buffer for mobile
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info({ socket_id: socket.id }, 'New socket connection');

  // Register both driver and passenger handlers for each socket connection
  registerDriverHandlers(io, socket);
  registerPassengerHandlers(io, socket);

  // Handle disconnection
  socket.on('disconnect', async (reason) => {
    try {
      logger.info({ socket_id: socket.id, reason }, 'Socket disconnected');

      // Clean up driver session
      const driverId = driverSessions.get(socket.id);
      if (driverId) {
        logger.info({ driver_id: driverId }, 'Driver disconnected');
        
        const driver = activeDrivers.get(driverId);
        if (driver) {
          driver.isOnline = false;
          driver.isAvailable = false;
          // driver.disconnectedAt = new Date().toISOString();
          
          // If driver was on a ride, handle cancellation
          if (driver.currentRide) {
            const ride = pendingRides.get(driver.currentRide);
            if (ride) {
              ride.status = 'cancelled';
              ride.cancelled_at = new Date().toISOString();
              ride.cancellation_reason = 'Driver disconnected';
              
              // Notify passengers about ride cancellation
              io.emit('ride_cancelled', {
                ride_id: driver.currentRide,
                reason: 'Driver disconnected',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        
        // Clean up keep-alive ping
        if ((socket as any).keepAlivePing) {
          clearInterval((socket as any).keepAlivePing);
        }
        
        // Clean up session
        driverSessions.delete(socket.id);
        
        // Broadcast driver offline
        io.emit('driver_offline', {
          driver_id: driverId,
          timestamp: new Date().toISOString()
        });

        // Also log to ride_events
        try {
          await supabase.from('ride_events').insert({
            ride_id: null,
            actor: 'driver',
            event_type: 'driver:offline',
            payload: {
              driver_id: driverId,
              driver_name: driver?.name ?? '',
              status: 'offline',
              timestamp: new Date().toISOString(),
            },
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          logger.error({ e, driver_id: driverId }, 'Failed to insert driver:offline event');
        }
      }

      // Clean up passenger session
      const passengerId = passengerSessions.get(socket.id);
      if (passengerId) {
        logger.info({ passenger_id: passengerId }, 'Passenger disconnected');
        
        // Log passenger disconnection event
        try {
          const passenger = activePassengers.get(passengerId);
          await supabase.from('ride_events').insert({
            ride_id: null,
            actor: 'passenger',
            event_type: 'passenger:disconnected',
            payload: {
              passenger_id: passengerId,
              passenger_name: passenger?.name || '',
              timestamp: new Date().toISOString(),
            },
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          logger.error({ e, passenger_id: passengerId }, 'Failed to log passenger disconnection');
        }
        
        activePassengers.delete(passengerId);
        passengerSessions.delete(socket.id);
      }

    } catch (error) {
      logger.error({ error, socket_id: socket.id }, 'Error handling socket disconnect');
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    logger.error({ error, socket_id: socket.id }, 'Socket error occurred');
  });
});

// Handle Socket.IO errors
io.engine.on('connection_error', (err) => {
  logger.error({ error: err }, 'Socket.IO connection error');
});

// Start the server
const PORT = env.port;
server.listen(PORT, () => {
  logger.info({
    port: PORT,
    environment: env.nodeEnv,
    cors_origin: env.corsOrigin
  }, '🚗 TourTaxi Unified Backend Server Started');
  
  console.log('='.repeat(60));
  console.log('🚗 TourTaxi Unified Backend Server');
  console.log('='.repeat(60));
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
  console.log(`🎯 Environment: ${env.nodeEnv}`);
  console.log(`🌍 CORS Origin: ${env.corsOrigin}`);
  console.log(`⏰ Cron jobs scheduled for maintenance`);
  console.log(`🗺️  Google Maps API configured`);
  console.log('='.repeat(60));
  console.log('📋 Available endpoints:');
  console.log('   GET  /health                     - Health check');
  console.log('   GET  /status                     - System status');
  console.log('   GET  /api/drivers                - Active drivers');
  console.log('   GET  /api/passengers             - Active passengers');
  console.log('   GET  /api/rides                  - Pending rides');
  console.log('   GET  /api/completed-rides        - Completed rides');
  console.log('   GET  /api/driver/:driverId       - Get specific driver');
  console.log('   GET  /api/passenger/:passengerId - Get specific passenger');
  console.log('   GET  /api/ride/:rideId           - Get specific ride');
  console.log('   GET  /api/ride-events            - Ride events (with filters)');
  console.log('   GET  /api/boarding-passes        - Get user boarding passes');
  console.log('  POST  /api/boarding-passes        - Create new boarding pass');
  console.log('  PATCH /api/boarding-passes/:id/status - Update boarding pass status');
  console.log('  POST  /driver/status              - Update driver online/offline status');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception occurred');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled promise rejection occurred');
  process.exit(1);
});

export default app;