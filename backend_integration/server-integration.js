// =============================================================================
// Server Integration Example
// =============================================================================
// This file shows how to integrate the DriverStatusService and SocketHandlers
// into your existing Render backend server
// =============================================================================

const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');

// Import your new services
const SocketHandlers = require('./socket-handlers');
const DriverStatusService = require('./driver-status-service');

// Environment variables (set these in your Render dashboard)
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Use service key for backend operations

class TourTaxiServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*", // Configure properly for production
        methods: ["GET", "POST"]
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling'],
      allowEIO3: true
    });

    this.driverStatusService = new DriverStatusService(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    this.socketHandlers = new SocketHandlers(this.io, SUPABASE_URL, SUPABASE_SERVICE_KEY);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocket();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'TourTaxi Backend'
      });
    });

    // Get driver status events (for analytics/monitoring)
    this.app.get('/api/driver-events', async (req, res) => {
      try {
        const { driver_id, limit = 10 } = req.query;
        const events = await this.driverStatusService.getDriverStatusEvents(driver_id, parseInt(limit));
        res.json({ success: true, events });
      } catch (error) {
        console.error('Error fetching driver events:', error);
        res.status(500).json({ error: 'Failed to fetch driver events', message: error.message });
      }
    });

    // Get driver activity analytics
    this.app.get('/api/driver-analytics', async (req, res) => {
      try {
        const { days = 7 } = req.query;
        const analytics = await this.driverStatusService.getDriverActivityAnalytics(parseInt(days));
        res.json({ success: true, analytics });
      } catch (error) {
        console.error('Error fetching driver analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
      }
    });

    // Get currently connected drivers
    this.app.get('/api/connected-drivers', (req, res) => {
      try {
        const drivers = this.socketHandlers.getConnectedDrivers();
        res.json({ success: true, drivers, count: drivers.length });
      } catch (error) {
        console.error('Error fetching connected drivers:', error);
        res.status(500).json({ error: 'Failed to fetch connected drivers', message: error.message });
      }
    });

    // Manual driver status update endpoint (for testing or admin purposes)
    this.app.post('/api/driver/:id/status', async (req, res) => {
      try {
        const { id } = req.params;
        const { is_online, ...additionalData } = req.body;

        const result = await this.driverStatusService.updateDriverStatus(
          id, 
          is_online, 
          additionalData
        );

        res.json({ success: true, result });
      } catch (error) {
        console.error('Error updating driver status:', error);
        res.status(500).json({ error: 'Failed to update driver status', message: error.message });
      }
    });

    // Socket.io endpoint info
    this.app.get('/socket.io', (req, res) => {
      res.json({
        message: 'Socket.IO endpoint is active',
        path: '/socket.io',
        transports: ['websocket', 'polling']
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'TourTaxi Unified Backend',
        version: '1.0.0',
        endpoints: [
          'GET /health - Health check',
          'GET /api/driver-events - Get driver status events',
          'GET /api/driver-analytics - Get driver activity analytics',
          'GET /api/connected-drivers - Get currently connected drivers',
          'POST /api/driver/:id/status - Update driver status',
          'Socket.IO /socket.io - Real-time communication'
        ],
        websocket: {
          url: '/socket.io',
          events: [
            'connect_driver - Driver connects and goes online',
            'driver_offline - Driver goes offline',
            'location_update - Driver location update',
            'ride_accept - Accept ride request',
            'ride_reject - Reject ride request',
            'ride_start - Start ride',
            'ride_complete - Complete ride'
          ]
        }
      });
    });
  }

  setupSocket() {
    // Initialize socket event handlers
    this.socketHandlers.initializeHandlers();

    // Log connection stats periodically
    setInterval(() => {
      const connectedDrivers = this.socketHandlers.getConnectedDrivers();
      console.log(`Connected drivers: ${connectedDrivers.length}`);
    }, 60000); // Every minute
  }

  start() {
    this.server.listen(PORT, () => {
      console.log(`🚗 TourTaxi Backend Server running on port ${PORT}`);
      console.log(`📊 Driver status logging: ENABLED`);
      console.log(`🔌 Socket.IO: ENABLED`);
      console.log(`📡 Supabase integration: ${SUPABASE_URL ? 'CONNECTED' : 'NOT CONFIGURED'}`);
      
      if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.warn('⚠️  WARNING: Supabase credentials not configured. Driver status logging will fail.');
        console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
      }
    });
  }
}

// Create and start server
if (require.main === module) {
  const server = new TourTaxiServer();
  server.start();
}

module.exports = TourTaxiServer;