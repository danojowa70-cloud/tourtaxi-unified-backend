// =============================================================================
// Socket.io Handlers with Driver Status Logging
// =============================================================================
// This file contains Socket.io event handlers that integrate with the
// DriverStatusService to automatically log driver status changes
// =============================================================================

const DriverStatusService = require('./driver-status-service');

class SocketHandlers {
  constructor(io, supabaseUrl, supabaseKey) {
    this.io = io;
    this.driverStatusService = new DriverStatusService(supabaseUrl, supabaseKey);
    this.connectedDrivers = new Map(); // Store connected driver info
  }

  /**
   * Initialize all socket event handlers
   */
  initializeHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle driver connection
      socket.on('connect_driver', async (data) => {
        await this.handleDriverConnect(socket, data);
      });

      // Handle driver going offline
      socket.on('driver_offline', async (data) => {
        await this.handleDriverOffline(socket, data);
      });

      // Handle location updates
      socket.on('location_update', async (data) => {
        await this.handleLocationUpdate(socket, data);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        await this.handleDriverDisconnect(socket, reason);
      });

      // Handle ride events
      socket.on('ride_accept', (data) => this.handleRideAccept(socket, data));
      socket.on('ride_reject', (data) => this.handleRideReject(socket, data));
      socket.on('ride_start', (data) => this.handleRideStart(socket, data));
      socket.on('ride_complete', (data) => this.handleRideComplete(socket, data));
    });
  }

  /**
   * Handle driver connecting and going online
   */
  async handleDriverConnect(socket, data) {
    try {
      const {
        driver_id,
        name,
        phone,
        vehicle_type,
        vehicle_number,
        rating,
        total_rides,
        total_earnings,
        latitude,
        longitude
      } = data;

      console.log(`Driver connecting: ${name} (${driver_id})`);

      // Store driver info in connected drivers map
      const driverInfo = {
        id: driver_id,
        name,
        phone,
        vehicle_type,
        vehicle_number,
        rating,
        total_rides,
        total_earnings,
        location: { latitude, longitude },
        socketId: socket.id,
        connectedAt: new Date().toISOString()
      };

      this.connectedDrivers.set(socket.id, driverInfo);

      // Update driver status to online and log the change
      const result = await this.driverStatusService.updateDriverStatus(
        driver_id, 
        true, // isOnline = true
        {
          vehicle_type,
          vehicle_number,
          rating,
          total_rides,
          total_earnings,
          location: { latitude, longitude }
        }
      );

      if (result.success && result.statusChanged) {
        console.log(`Driver ${name} is now online`);
        
        // Broadcast to passengers that a new driver is online
        socket.broadcast.emit('driver:status:change', {
          type: 'online',
          driver: {
            id: driver_id,
            name,
            vehicle_type,
            rating,
            location: { latitude, longitude }
          }
        });

        // Confirm to driver
        socket.emit('connection_confirmed', {
          success: true,
          message: 'Successfully connected and marked online',
          driver_id
        });
      } else {
        console.log(`Driver ${name} connection processed (no status change)`);
        socket.emit('connection_confirmed', {
          success: true,
          message: 'Connection confirmed',
          statusChanged: false
        });
      }

    } catch (error) {
      console.error('Error handling driver connect:', error);
      socket.emit('connection_error', {
        error: 'Failed to connect driver',
        message: error.message
      });
    }
  }

  /**
   * Handle driver explicitly going offline
   */
  async handleDriverOffline(socket, data) {
    try {
      const { driver_id } = data;
      const driverInfo = this.connectedDrivers.get(socket.id);

      if (!driverInfo) {
        console.log('Driver offline request from unknown socket');
        return;
      }

      console.log(`Driver going offline: ${driverInfo.name} (${driver_id})`);

      // Update driver status to offline and log the change
      const result = await this.driverStatusService.updateDriverStatus(
        driver_id,
        false // isOnline = false
      );

      if (result.success && result.statusChanged) {
        console.log(`Driver ${driverInfo.name} is now offline`);

        // Broadcast to passengers that driver went offline
        socket.broadcast.emit('driver:status:change', {
          type: 'offline',
          driver: {
            id: driver_id,
            name: driverInfo.name
          }
        });

        // Confirm to driver
        socket.emit('offline_confirmed', {
          success: true,
          message: 'Successfully marked offline'
        });
      }

      // Remove from connected drivers
      this.connectedDrivers.delete(socket.id);

    } catch (error) {
      console.error('Error handling driver offline:', error);
      socket.emit('offline_error', {
        error: 'Failed to set driver offline',
        message: error.message
      });
    }
  }

  /**
   * Handle driver disconnect (unexpected or intentional)
   */
  async handleDriverDisconnect(socket, reason) {
    try {
      const driverInfo = this.connectedDrivers.get(socket.id);

      if (!driverInfo) {
        console.log(`Client disconnected: ${socket.id} (not a driver)`);
        return;
      }

      console.log(`Driver disconnected: ${driverInfo.name} (${driverInfo.id}), reason: ${reason}`);

      // Only set offline if it was an unexpected disconnect
      // (if driver manually went offline, they would have called driver_offline first)
      if (reason !== 'client namespace disconnect' && reason !== 'server namespace disconnect') {
        console.log(`Setting driver ${driverInfo.name} offline due to disconnect`);

        try {
          const result = await this.driverStatusService.updateDriverStatus(
            driverInfo.id,
            false // isOnline = false
          );

          if (result.success && result.statusChanged) {
            // Broadcast to passengers that driver went offline
            socket.broadcast.emit('driver:status:change', {
              type: 'offline',
              driver: {
                id: driverInfo.id,
                name: driverInfo.name
              },
              reason: 'disconnect'
            });
          }
        } catch (error) {
          console.error('Error setting driver offline on disconnect:', error);
        }
      }

      // Remove from connected drivers
      this.connectedDrivers.delete(socket.id);

    } catch (error) {
      console.error('Error handling driver disconnect:', error);
    }
  }

  /**
   * Handle location updates (doesn't change online status but updates location)
   */
  async handleLocationUpdate(socket, data) {
    try {
      const { driver_id, latitude, longitude } = data;
      const driverInfo = this.connectedDrivers.get(socket.id);

      if (driverInfo) {
        // Update stored location
        driverInfo.location = { latitude, longitude };
        this.connectedDrivers.set(socket.id, driverInfo);

        // Broadcast location update to passengers
        socket.broadcast.emit('driver:location:update', {
          driver_id,
          latitude,
          longitude,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  /**
   * Handle ride acceptance
   */
  handleRideAccept(socket, data) {
    try {
      const { ride_id, driver_id } = data;
      console.log(`Driver ${driver_id} accepted ride ${ride_id}`);

      // Broadcast to passenger that ride was accepted
      socket.broadcast.emit('ride:accepted', {
        ride_id,
        driver_id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error handling ride accept:', error);
    }
  }

  /**
   * Handle ride rejection
   */
  handleRideReject(socket, data) {
    try {
      const { ride_id, driver_id } = data;
      console.log(`Driver ${driver_id} rejected ride ${ride_id}`);

      // Broadcast to passenger that ride was rejected
      socket.broadcast.emit('ride:rejected', {
        ride_id,
        driver_id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error handling ride reject:', error);
    }
  }

  /**
   * Handle ride start
   */
  handleRideStart(socket, data) {
    try {
      const { ride_id, driver_id } = data;
      console.log(`Driver ${driver_id} started ride ${ride_id}`);

      // Broadcast to passenger that ride was started
      socket.broadcast.emit('ride:started', {
        ride_id,
        driver_id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error handling ride start:', error);
    }
  }

  /**
   * Handle ride completion
   */
  handleRideComplete(socket, data) {
    try {
      const { ride_id, driver_id } = data;
      console.log(`Driver ${driver_id} completed ride ${ride_id}`);

      // Broadcast to passenger that ride was completed
      socket.broadcast.emit('ride:completed', {
        ride_id,
        driver_id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error handling ride complete:', error);
    }
  }

  /**
   * Get currently connected drivers
   */
  getConnectedDrivers() {
    return Array.from(this.connectedDrivers.values()).map(driver => ({
      id: driver.id,
      name: driver.name,
      vehicle_type: driver.vehicle_type,
      rating: driver.rating,
      location: driver.location,
      connectedAt: driver.connectedAt
    }));
  }

  /**
   * Get driver status analytics
   */
  async getDriverAnalytics(days = 7) {
    try {
      return await this.driverStatusService.getDriverActivityAnalytics(days);
    } catch (error) {
      console.error('Error fetching driver analytics:', error);
      throw error;
    }
  }
}

module.exports = SocketHandlers;