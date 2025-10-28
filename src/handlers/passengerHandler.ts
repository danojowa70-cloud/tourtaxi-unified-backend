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
  RideStatus,
  RideStatusSchema,
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

// Helper to log passenger events into Supabase ride_events
async function logPassengerEvent(
  type: 'passenger:connected' | 'passenger:disconnected' | 'ride:requested' | 'ride:cancelled',
  data: { passenger_id: string; name?: string; ride_id?: string; location?: { lat: number; lng: number }; [key: string]: any }
): Promise<void> {
  try {
    const { default: supabase } = await import('../config/supabase');
    await supabase.from('ride_events').insert({
      ride_id: data.ride_id || null,
      actor: 'passenger',
      event_type: type,
      payload: {
        passenger_id: data.passenger_id,
        passenger_name: data.name || '',
        location: data.location || null,
        timestamp: new Date().toISOString(),
        ...data
      },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ e }, 'ride_events insert failed for passenger');
  }
}

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

  socket.on('connect_passenger', async (data: PassengerConnection) => {
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

      // Log passenger connection event
      await logPassengerEvent('passenger:connected', {
        passenger_id: validatedData.passenger_id,
        name: validatedData.name || 'Passenger'
      });

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
      
      // Generate a UUID ride ID (ignore client-provided ID to satisfy DB uuid type)
      const rideId = generateRideId();
      
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
      
      // Convert fare to string if it's a number
      let fareValue = calculatedFare.toFixed(2);
      if (validatedRideData.fare) {
        fareValue = typeof validatedRideData.fare === 'number' 
          ? validatedRideData.fare.toFixed(2) 
          : validatedRideData.fare;
      }
      
      // Normalize and validate status to match RideStatus type
      const statusParsed = RideStatusSchema.safeParse(validatedRideData.status);
      const rideStatus: RideStatus = statusParsed.success ? statusParsed.data : 'requested';

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
        fare: fareValue,
        route_polyline: routeInfo ? routeInfo.polyline : null,
        route_steps: routeInfo ? routeInfo.steps : null,
        status: rideStatus,
        notes: validatedRideData.notes || null,
        requested_at: validatedRideData.requested_at || new Date().toISOString(),
        driver_id: null,
        accepted_at: null,
        started_at: null,
        completed_at: null,
        rating: null,
        feedback: null
      };

      // Store the ride
      pendingRides.set(rideId, ride);

      // Log ride request event with location
      await logPassengerEvent('ride:requested', {
        passenger_id: validatedRideData.passenger_id,
        name: validatedRideData.passenger_name,
        ride_id: rideId,
        location: {
          lat: validatedRideData.pickup_latitude,
          lng: validatedRideData.pickup_longitude
        },
        pickup_address: validatedRideData.pickup_address,
        destination_address: validatedRideData.destination_address,
        fare: ride.fare,
        distance: ride.distance_text
      });

      // Save ride to database - critical step, must succeed before proceeding
      try {
        await saveRideToDatabase(ride);
        logger.info({ ride_id: rideId }, 'Ride successfully saved to database, proceeding with driver notifications');
      } catch (dbError) {
        logger.error({ error: dbError, ride_id: rideId }, 'Failed to save ride to database, aborting ride request');
        
        // Remove from in-memory store since DB save failed
        pendingRides.delete(rideId);
        
        // Notify passenger of failure
        socket.emit('ride_request_failed', {
          ride_id: rideId,
          message: 'Failed to create ride request. Please try again.',
          error: 'DATABASE_ERROR',
          timestamp: new Date().toISOString()
        });
        
        return; // Stop processing
      }

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

      // Send ride request to nearby drivers using ENHANCED TRIPLE APPROACH for maximum reliability
      let requestsSent = 0;
      let successfulDeliveries = 0;
      const rideRequestPayload = {
        ...ride,
        timestamp: new Date().toISOString()
      };
      
      // CRITICAL FIX: Filter nearbyDrivers to only include drivers in activeDrivers AND available
      const availableNearbyDrivers = nearbyDrivers.filter(driverInfo => {
        const driver = activeDrivers.get(driverInfo.driver_id);
        if (!driver || !driver.isAvailable || !driver.isOnline) {
          logger.warn({ 
            driver_id: driverInfo.driver_id, 
            driverExists: !!driver,
            isAvailable: driver?.isAvailable,
            isOnline: driver?.isOnline,
            ride_id: rideId
          }, 'Driver from database not in activeDrivers or not available');
          return false;
        }
        return true;
      });
      
      logger.info({ 
        databaseDrivers: nearbyDrivers.length,
        connectedDrivers: availableNearbyDrivers.length,
        ride_id: rideId
      }, 'Filtered drivers - only sending to connected drivers');
      
      // First pass: Send to specific drivers
      for (const driverInfo of availableNearbyDrivers) {
        const driver = activeDrivers.get(driverInfo.driver_id);
        if (!driver) {
          logger.error({ driver_id: driverInfo.driver_id, ride_id: rideId }, 'Driver disappeared from activeDrivers!');
          continue;
        }
        if (driver && driver.isAvailable) {
          // Calculate estimated arrival time for this driver
          const estimatedArrival = Math.round(driverInfo.distance * 2); // Rough estimate: 2 minutes per km
          
          const driverSpecificPayload = {
            ...rideRequestPayload,
            estimated_arrival: `${estimatedArrival} minutes`,
            driver_distance: driverInfo.distance.toFixed(2)
          };
          
          try {
            // TRIPLE APPROACH: Three delivery methods for maximum reliability
            // Emit BOTH legacy ('ride:request') and new ('ride_request') event names
            // Method 1: Driver-specific room
            io.to(`driver_${driverInfo.driver_id}`).emit('ride_request', driverSpecificPayload);
            io.to(`driver_${driverInfo.driver_id}`).emit('ride:request', driverSpecificPayload);
            
            // Method 2: Direct socket ID
            io.to(driver.socketId).emit('ride_request', driverSpecificPayload);
            io.to(driver.socketId).emit('ride:request', driverSpecificPayload);
            
            // Method 3: Backup available_drivers room broadcast (will be filtered by driver)
            io.to('available_drivers').emit('ride_request', {
              ...driverSpecificPayload,
              target_driver_id: driverInfo.driver_id // Add target for filtering
            });
            io.to('available_drivers').emit('ride:request', {
              ...driverSpecificPayload,
              target_driver_id: driverInfo.driver_id // Add target for filtering
            });
            
            requestsSent++;
            successfulDeliveries++;
            
            logger.info({ 
              driver_id: driverInfo.driver_id, 
              ride_id: rideId, 
              socket_id: driver.socketId,
              distance: driverInfo.distance,
              delivery_methods: {
                driver_room: `driver_${driverInfo.driver_id}`,
                socket_id: driver.socketId,
                backup_room: 'available_drivers'
              },
              estimated_arrival: estimatedArrival
            }, 'Ride request sent to driver via triple delivery (dual event names)');
            
          } catch (emissionError) {
            logger.error({ 
              error: emissionError, 
              driver_id: driverInfo.driver_id, 
              ride_id: rideId 
            }, 'Failed to emit ride request to driver');
          }
        } else {
          logger.warn({ 
            driver_id: driverInfo.driver_id, 
            driver_found: !!driver, 
            is_available: driver?.isAvailable,
            ride_id: rideId
          }, 'Driver not available for ride request');
        }
      }
      
      // Global broadcast to ensure legacy driver apps receive it regardless of room membership
      io.emit('ride_request', { 
        ...rideRequestPayload, 
        estimated_arrival: '5-10 minutes', 
        driver_distance: '0.0', 
        is_global_broadcast: true 
      });
      io.emit('ride:request', { 
        ...rideRequestPayload, 
        estimated_arrival: '5-10 minutes', 
        driver_distance: '0.0', 
        is_global_broadcast: true 
      });
      
      // Additional fallback: General broadcast to all available drivers if specific targeting had issues
      if (successfulDeliveries === 0 && nearbyDrivers.length > 0) {
        logger.warn({ 
          ride_id: rideId, 
          nearby_drivers_count: nearbyDrivers.length 
        }, 'No specific deliveries successful, using general broadcast fallback');
        
        io.to('available_drivers').emit('ride_request', {
          ...rideRequestPayload,
          estimated_arrival: '5-10 minutes',
          driver_distance: '0.0',
          is_fallback_broadcast: true
        });
        io.to('available_drivers').emit('ride:request', {
          ...rideRequestPayload,
          estimated_arrival: '5-10 minutes',
          driver_distance: '0.0',
          is_fallback_broadcast: true
        });
      }

      logger.info({ 
        ride_id: rideId, 
        requests_sent: requestsSent,
        successful_deliveries: successfulDeliveries,
        nearby_drivers_found: nearbyDrivers.length,
        delivery_success_rate: nearbyDrivers.length > 0 ? (successfulDeliveries / nearbyDrivers.length * 100).toFixed(1) + '%' : '0%'
      }, 'Ride request delivery summary');

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

      // Retry mechanism: Send ride requests again after 10 seconds if no response
      setTimeout(async () => {
        const currentRide = pendingRides.get(rideId);
        if (currentRide && currentRide.status === 'requested') {
          logger.info({ ride_id: rideId }, 'Retry: Sending ride request again after 10 seconds');
          
          // Find drivers again and retry
          const retryDrivers = await findNearbyDrivers(
            validatedRideData.pickup_latitude, 
            validatedRideData.pickup_longitude, 
            env.ride.defaultRadiusKm
          );
          
          let retryCount = 0;
          for (const driverInfo of retryDrivers) {
            const driver = activeDrivers.get(driverInfo.driver_id);
            if (driver && driver.isAvailable) {
              const estimatedArrival = Math.round(driverInfo.distance * 2);
              const retryPayload = {
                ...rideRequestPayload,
                estimated_arrival: `${estimatedArrival} minutes`,
                driver_distance: driverInfo.distance.toFixed(2),
                is_retry: true,
                retry_attempt: 1
              };
              
              // Triple delivery for retry (emit both legacy and new event names)
              io.to(`driver_${driverInfo.driver_id}`).emit('ride_request', retryPayload);
              io.to(`driver_${driverInfo.driver_id}`).emit('ride:request', retryPayload);
              io.to(driver.socketId).emit('ride_request', retryPayload);
              io.to(driver.socketId).emit('ride:request', retryPayload);
              io.to('available_drivers').emit('ride_request', {
                ...retryPayload,
                target_driver_id: driverInfo.driver_id
              });
              io.to('available_drivers').emit('ride:request', {
                ...retryPayload,
                target_driver_id: driverInfo.driver_id
              });
              
              retryCount++;
            }
          }
          
          logger.info({ ride_id: rideId, retry_count: retryCount }, 'Ride request retry sent to drivers');
        }
      }, 10000); // 10 seconds retry
      
      // Final timeout for ride request
      setTimeout(() => {
        const currentRide = pendingRides.get(rideId);
        if (currentRide && currentRide.status === 'requested') {
          logger.info({ ride_id: rideId }, 'Ride request timed out - no driver accepted after retry');
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

      // Log ride cancellation event
      await logPassengerEvent('ride:cancelled', {
        passenger_id: passengerId,
        ride_id: rideId,
        reason: data.reason || 'Cancelled by passenger'
      });

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