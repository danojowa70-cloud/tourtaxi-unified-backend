import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { 
  Passenger,
  PassengerConnection,
  PassengerConnectionSchema,
  RideRequest,
  RideRequestSchema,
  Ride,
  ClientToServerEvents,
  ServerToClientEvents
} from '../types/index';

import { 
  activeDrivers,
  pendingRides,
  completedRides,
  generateRideId,
  validateRideData,
  calculateAccurateDistance,
  getRoutePolyline,
  calculateFare,
  findNearbyDrivers,
  saveRideToDatabase
} from './driverHandler';

// In-memory storage for passengers
export const activePassengers = new Map<string, Passenger>();
export const passengerSessions = new Map<string, string>(); // socket_id -> passenger_id

// ========================================
// PASSENGER SOCKET HANDLERS
// ========================================

export function registerPassengerHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {

  // ========================================
  // PASSENGER CONNECTION & AUTHENTICATION
  // ========================================

  socket.on('connect_passenger', (data: PassengerConnection) => {
    try {
      logger.info({ passenger_id: data.passenger_id }, 'Passenger connecting');

      // Validate passenger data
      const validatedData = PassengerConnectionSchema.parse(data);

      if (!validatedData.passenger_id) {
        socket.emit('error', { message: 'Invalid passenger data' });
        return;
      }

      // Store passenger information
      const passengerInfo: Passenger = {
        socketId: socket.id,
        passenger_id: validatedData.passenger_id,
        name: validatedData.name,
        phone: validatedData.phone,
        connectedAt: new Date().toISOString()
      };

      activePassengers.set(validatedData.passenger_id, passengerInfo);
      passengerSessions.set(socket.id, validatedData.passenger_id);
      (socket as any).passengerId = validatedData.passenger_id;

      // Notify passenger of successful connection
      socket.emit('passenger_connected', {
        status: 'success',
        passenger_id: validatedData.passenger_id,
        timestamp: new Date().toISOString(),
      });

      logger.info({ passenger_id: validatedData.passenger_id }, 'Passenger connected successfully');

    } catch (error) {
      logger.error({ error }, 'Error connecting passenger');
      socket.emit('error', { message: 'Failed to connect passenger' });
    }
  });

  // ========================================
  // RIDE REQUEST HANDLING
  // ========================================

  socket.on('ride_request', async (rideData: RideRequest) => {
    try {
      logger.info({ passenger_name: rideData.passenger_name }, 'New ride request from passenger');
      
      // Validate ride data
      const validatedRideData = RideRequestSchema.parse(rideData);
      validateRideData(validatedRideData);
      
      // Generate unique ride ID
      const rideId = validatedRideData.ride_id || generateRideId();
      
      // Calculate accurate distance and duration
      const distanceInfo = await calculateAccurateDistance(
        validatedRideData.pickup_latitude, 
        validatedRideData.pickup_longitude,
        validatedRideData.destination_latitude, 
        validatedRideData.destination_longitude
      );
      
      // Get route polyline for the ride
      const routeInfo = await getRoutePolyline(
        validatedRideData.pickup_latitude, 
        validatedRideData.pickup_longitude,
        validatedRideData.destination_latitude, 
        validatedRideData.destination_longitude
      );
      
      // Calculate fare
      const calculatedFare = calculateFare(distanceInfo.distance, distanceInfo.duration);
      
      // Create ride object
      const ride: Ride = {
        ride_id: rideId,
        passenger_id: validatedRideData.passenger_id,
        passenger_name: validatedRideData.passenger_name,
        passenger_phone: validatedRideData.passenger_phone,
        passenger_image: validatedRideData.passenger_image || null,
        pickup_latitude: validatedRideData.pickup_latitude,
        pickup_longitude: validatedRideData.pickup_longitude,
        pickup_address: validatedRideData.pickup_address,
        destination_latitude: validatedRideData.destination_latitude,
        destination_longitude: validatedRideData.destination_longitude,
        destination_address: validatedRideData.destination_address,
        distance: distanceInfo.distance.toFixed(2),
        distance_text: distanceInfo.distanceText,
        duration: Math.round(distanceInfo.duration),
        duration_text: distanceInfo.durationText,
        fare: validatedRideData.fare || calculatedFare.toFixed(2),
        route_polyline: routeInfo ? routeInfo.polyline : null,
        route_steps: routeInfo ? routeInfo.steps : null,
        status: 'requested',
        notes: validatedRideData.notes || null,
        requested_at: new Date().toISOString(),
        driver_id: null,
        accepted_at: null,
        started_at: null,
        completed_at: null,
        rating: null,
        feedback: null
      };

      // Store the ride
      pendingRides.set(rideId, ride);

      // Save ride to database
      await saveRideToDatabase(ride);

      // Find nearby available drivers
      const nearbyDrivers = await findNearbyDrivers(
        validatedRideData.pickup_latitude, 
        validatedRideData.pickup_longitude, 
        env.ride.defaultRadiusKm
      );

      logger.info({ 
        ride_id: rideId, 
        nearby_drivers: nearbyDrivers.length 
      }, 'Found nearby drivers for ride request');

      if (nearbyDrivers.length === 0) {
        // No drivers available
        socket.emit('no_drivers_available', {
          ride_id: rideId,
          message: 'No drivers available in your area',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Send ride request to nearby drivers
      let requestsSent = 0;
      nearbyDrivers.forEach(driverInfo => {
        const driver = activeDrivers.get(driverInfo.driver_id);
        if (driver && driver.isAvailable) {
          // Calculate estimated arrival time for this driver
          const estimatedArrival = Math.round(driverInfo.distance * 2); // Rough estimate: 2 minutes per km
          
          io.to(driver.socketId).emit('ride_request', {
            ...ride,
            estimated_arrival: `${estimatedArrival} minutes`,
            driver_distance: driverInfo.distance.toFixed(2)
          });
          requestsSent++;
        }
      });

      logger.info({ 
        ride_id: rideId, 
        requests_sent: requestsSent 
      }, 'Ride request sent to drivers');

      // Join passenger to ride room for real-time updates
      const rideRoom = `ride_${rideId}`;
      socket.join(rideRoom);

      // Notify passenger that request was submitted
      socket.emit('ride_request_submitted', {
        ride_id: rideId,
        status: 'submitted',
        message: `Ride request sent to ${requestsSent} nearby drivers`,
        estimated_fare: ride.fare,
        distance: ride.distance_text,
        duration: ride.duration_text,
        timestamp: new Date().toISOString()
      });

      // Set timeout for ride request
      setTimeout(() => {
        const currentRide = pendingRides.get(rideId);
        if (currentRide && currentRide.status === 'requested') {
          logger.info({ ride_id: rideId }, 'Ride request timed out - no driver accepted');
          pendingRides.delete(rideId);
          
          socket.emit('ride_timeout', {
            ride_id: rideId,
            message: 'No driver accepted your ride request',
            timestamp: new Date().toISOString()
          });
        }
      }, env.ride.requestTimeoutMs);

    } catch (error) {
      logger.error({ error }, 'Error processing ride request');
      socket.emit('error', { 
        message: 'Failed to process ride request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ========================================
  // RIDE CANCELLATION
  // ========================================

  socket.on('ride_cancel', async (data: { ride_id: string; passenger_id: string; reason?: string }) => {
    try {
      logger.info({ 
        passenger_id: data.passenger_id, 
        ride_id: data.ride_id 
      }, 'Passenger cancelling ride');
      
      const rideId = data.ride_id;
      const passengerId = data.passenger_id;
      
      const ride = pendingRides.get(rideId);
      if (!ride || ride.passenger_id !== passengerId) {
        socket.emit('error', { message: 'Invalid ride or passenger' });
        return;
      }

      // Update ride status
      ride.status = 'cancelled';
      ride.cancelled_at = new Date().toISOString();
      ride.cancellation_reason = data.reason || 'Cancelled by passenger';

      // If ride was accepted by a driver, make driver available again
      if (ride.driver_id) {
        const driver = activeDrivers.get(ride.driver_id);
        if (driver) {
          driver.isAvailable = true;
          driver.currentRide = null;
          
          // Notify driver of cancellation
          io.to(driver.socketId).emit('ride_cancelled', {
            ride_id: rideId,
            reason: ride.cancellation_reason,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Remove from pending rides
      pendingRides.delete(rideId);

      // Notify passenger of successful cancellation
      socket.emit('ride_cancelled_confirmation', {
        ride_id: rideId,
        status: 'cancelled',
        message: 'Ride cancelled successfully',
        timestamp: new Date().toISOString()
      });

      logger.info({ 
        ride_id: rideId, 
        passenger_id: passengerId 
      }, 'Ride cancelled by passenger');

    } catch (error) {
      logger.error({ error }, 'Error cancelling ride');
      socket.emit('error', { message: 'Failed to cancel ride' });
    }
  });

  // ========================================
  // CHAT MESSAGING
  // ========================================

  socket.on('passenger_message', (data, ack) => {
    try {
      const { ride_id, passenger_id, message_text, timestamp } = data || {};
      if (!ride_id || !passenger_id || !message_text) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid payload' });
        return;
      }

      const rideRoom = `ride_${ride_id}`;
      io.to(rideRoom).emit('passenger_message', {
        ride_id,
        passenger_id,
        message_text,
        timestamp: timestamp || new Date().toISOString(),
      });

      if (typeof ack === 'function') ack({ ok: true });
    } catch (error) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Server error' });
    }
  });

  // ========================================
  // RIDE RATING
  // ========================================

  socket.on('ride_rating', async (data: { ride_id: string; rating: number; feedback?: string }) => {
    try {
      logger.info({ 
        ride_id: data.ride_id, 
        rating: data.rating 
      }, 'Rating received for ride');
      
      const ride = completedRides.get(data.ride_id);
      if (!ride) {
        socket.emit('error', { message: 'Ride not found' });
        return;
      }

      // Update ride with rating
      ride.rating = data.rating;
      ride.feedback = data.feedback || null;
      // ride.rated_at = new Date().toISOString();
      
      // Update driver rating
      if (ride.driver_id) {
        const driver = activeDrivers.get(ride.driver_id);
        if (driver) {
          // Simple average calculation (in production, use more sophisticated algorithm)
          const currentRating = driver.rating;
          const totalRides = driver.totalRides;
          driver.rating = ((currentRating * (totalRides - 1)) + data.rating) / totalRides;
          
          // Notify driver of new rating
          io.to(driver.socketId).emit('new_rating', {
            ride_id: data.ride_id,
            rating: data.rating,
            feedback: data.feedback || '',
            new_average_rating: driver.rating,
            timestamp: new Date().toISOString()
          });
        }
      }

      // Update rating in database
      // await updateRideStatus(data.ride_id, ride.status, {
      //   rating: data.rating,
      //   feedback: data.feedback,
      //   rated_at: ride.rated_at
      // });

      // Notify passenger of successful rating submission
      socket.emit('rating_submitted', {
        ride_id: data.ride_id,
        rating: data.rating,
        message: 'Thank you for your feedback!',
        timestamp: new Date().toISOString()
      });

      logger.info({ 
        ride_id: data.ride_id, 
        rating: data.rating 
      }, 'Ride rating processed successfully');
      
    } catch (error) {
      logger.error({ error }, 'Error processing rating');
      socket.emit('error', { message: 'Failed to submit rating' });
    }
  });

  // ========================================
  // GET RIDE HISTORY
  // ========================================

  socket.on('get_ride_history', (data: { passenger_id: string; limit?: number }) => {
    try {
      const passengerId = data.passenger_id;
      const limit = data.limit || 10;

      // Get completed rides for this passenger
      const passengerRides = Array.from(completedRides.values())
        .filter(ride => ride.passenger_id === passengerId)
        .sort((a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime())
        .slice(0, limit);

      socket.emit('ride_history', {
        passenger_id: passengerId,
        rides: passengerRides,
        total_rides: passengerRides.length,
        timestamp: new Date().toISOString()
      });

      logger.info({ 
        passenger_id: passengerId, 
        rides_count: passengerRides.length 
      }, 'Ride history sent to passenger');

    } catch (error) {
      logger.error({ error }, 'Error getting ride history');
      socket.emit('error', { message: 'Failed to get ride history' });
    }
  });

  // ========================================
  // GET NEARBY DRIVERS
  // ========================================

  socket.on('get_nearby_drivers', async (data: { latitude: number; longitude: number; radius?: number }) => {
    try {
      const { latitude, longitude, radius = env.ride.defaultRadiusKm } = data;

      const nearbyDrivers = await findNearbyDrivers(latitude, longitude, radius);

      socket.emit('nearby_drivers', {
        latitude,
        longitude,
        radius,
        drivers: nearbyDrivers.map(driver => ({
          driver_id: driver.driver_id,
          name: driver.name,
          phone: driver.phone,
          vehicle_type: driver.vehicle_type,
          vehicle_number: driver.vehicle_number,
          rating: driver.rating,
          distance: driver.distance,
          estimated_arrival: Math.round(driver.distance * 2) // 2 minutes per km estimate
        })),
        count: nearbyDrivers.length,
        timestamp: new Date().toISOString()
      });

      logger.info({ 
        latitude, 
        longitude, 
        drivers_count: nearbyDrivers.length 
      }, 'Nearby drivers sent to passenger');

    } catch (error) {
      logger.error({ error }, 'Error getting nearby drivers');
      socket.emit('error', { message: 'Failed to get nearby drivers' });
    }
  });
}