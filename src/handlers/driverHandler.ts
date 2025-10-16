import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { getDistance } from 'geolib';
import axios from 'axios';
import cron from 'node-cron';

import { logger } from '../utils/logger';
import { env } from '../config/env';
import supabase from '../config/supabase';
import { 
  Driver, 
  DriverConnection, 
  DriverConnectionSchema,
  Ride,
  DistanceInfo,
  RouteInfo,
  DriverToPickupRoute,
  NearbyDriverInfo,
  ClientToServerEvents,
  ServerToClientEvents
} from '../types/index';

// Helper to log driver status events into Supabase ride_events
async function logDriverEvent(
  type: 'driver:online' | 'driver:offline',
  data: { driver_id: string; name?: string }
): Promise<void> {
  try {
    await supabase.from('ride_events').insert({
      ride_id: null,
      actor: 'driver',
      event_type: type,
      payload: {
        driver_id: data.driver_id,
        driver_name: data.name ?? '',
        status: type === 'driver:online' ? 'online' : 'offline',
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.error({ e }, 'ride_events insert failed');
  }
}

// In-memory storage for real-time features
export const activeDrivers = new Map<string, Driver>();
export const pendingRides = new Map<string, Ride>();
export const completedRides = new Map<string, Ride>();
export const driverSessions = new Map<string, string>(); // socket_id -> driver_id
export const rideAssignments = new Map<string, string>(); // ride_id -> driver_id

// ========================================
// SUPABASE HELPER FUNCTIONS
// ========================================

export async function saveDriverToDatabase(driverData: Driver): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .upsert({
        id: driverData.driver_id,
        name: driverData.name,
        phone: driverData.phone,
        vehicle_type: driverData.vehicle_type,
        vehicle_number: driverData.vehicle_number,
        rating: driverData.rating,
        total_rides: driverData.totalRides,
        total_earnings: driverData.totalEarnings,
        is_online: true,
        is_available: true,
        current_latitude: driverData.latitude,
        current_longitude: driverData.longitude,
        last_location_update: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error({ error }, 'Error saving driver to database');
    return null;
  }
}

export async function updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString()
      })
      .eq('id', driverId);

    if (error) throw error;

    // Also save to location history
    await supabase
      .from('driver_locations')
      .insert({
        driver_id: driverId,
        latitude: latitude,
        longitude: longitude,
        timestamp: new Date().toISOString()
      });

  } catch (error) {
    logger.error({ error }, 'Error updating driver location');
  }
}

export async function saveRideToDatabase(rideData: Ride): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('rides')
      .insert({
        id: rideData.ride_id,
        driver_id: rideData.driver_id,
        passenger_id: rideData.passenger_id,
        passenger_name: rideData.passenger_name,
        passenger_phone: rideData.passenger_phone,
        passenger_image: rideData.passenger_image,
        pickup_latitude: rideData.pickup_latitude,
        pickup_longitude: rideData.pickup_longitude,
        pickup_address: rideData.pickup_address,
        destination_latitude: rideData.destination_latitude,
        destination_longitude: rideData.destination_longitude,
        destination_address: rideData.destination_address,
        distance: parseFloat(rideData.distance),
        distance_text: rideData.distance_text,
        duration: rideData.duration,
        duration_text: rideData.duration_text,
        fare: parseFloat(rideData.fare),
        actual_fare: rideData.actual_fare ? parseFloat(rideData.actual_fare) : null,
        route_polyline: rideData.route_polyline,
        driver_to_pickup_polyline: rideData.driver_to_pickup_polyline,
        driver_to_pickup_distance: rideData.driver_to_pickup_distance,
        driver_to_pickup_duration: rideData.driver_to_pickup_duration,
        status: rideData.status,
        notes: rideData.notes,
        rating: rideData.rating,
        feedback: rideData.feedback,
        requested_at: rideData.requested_at,
        accepted_at: rideData.accepted_at,
        started_at: rideData.started_at,
        completed_at: rideData.completed_at,
        cancelled_at: rideData.cancelled_at,
        cancellation_reason: rideData.cancellation_reason
      });

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error({ error }, 'Error saving ride to database');
    return null;
  }
}

export async function updateRideStatus(rideId: string, status: string, additionalData: any = {}): Promise<boolean> {
  try {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    const { error } = await supabase
      .from('rides')
      .update(updateData)
      .eq('id', rideId);

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error({ error }, 'Error updating ride status');
    return false;
  }
}

export async function saveEarningsToDatabase(driverId: string, rideId: string, amount: number, commission: number = 0): Promise<any> {
  try {
    const netAmount = amount - commission;
    
    const { data, error } = await supabase
      .from('earnings')
      .insert({
        driver_id: driverId,
        ride_id: rideId,
        amount: amount,
        commission: commission,
        net_amount: netAmount,
        payment_status: 'pending'
      });

    if (error) throw error;

    // Update driver's total earnings
    await supabase.rpc('increment_driver_earnings', {
      driver_id: driverId,
      amount: netAmount
    });

    return data;
  } catch (error) {
    logger.error({ error }, 'Error saving earnings');
    return null;
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

export async function calculateAccurateDistance(originLat: number, originLng: number, destLat: number, destLng: number): Promise<DistanceInfo> {
  try {
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: origin,
        destinations: destination,
        units: 'metric',
        key: env.googleMaps.apiKey
      }
    });

    if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
      const element = response.data.rows[0].elements[0];
      return {
        distance: element.distance.value / 1000, // Convert to kilometers
        duration: element.duration.value / 60, // Convert to minutes
        distanceText: element.distance.text,
        durationText: element.duration.text
      };
    } else {
      // Fallback to straight-line distance
      const straightDistance = getDistance(
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng }
      ) / 1000;
      
      return {
        distance: straightDistance,
        duration: straightDistance * 2, // Rough estimate: 2 minutes per km
        distanceText: `${straightDistance.toFixed(1)} km`,
        durationText: `${Math.round(straightDistance * 2)} mins`
      };
    }
  } catch (error) {
    logger.error({ error }, 'Error calculating distance');
    // Fallback to straight-line distance
    const straightDistance = getDistance(
      { latitude: originLat, longitude: originLng },
      { latitude: destLat, longitude: destLng }
    ) / 1000;
    
    return {
      distance: straightDistance,
      duration: straightDistance * 2,
      distanceText: `${straightDistance.toFixed(1)} km`,
      durationText: `${Math.round(straightDistance * 2)} mins`
    };
  }
}

export async function getRoutePolyline(originLat: number, originLng: number, destLat: number, destLng: number): Promise<RouteInfo | null> {
  try {
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: origin,
        destination: destination,
        mode: 'driving',
        key: env.googleMaps.apiKey
      }
    });

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const leg = route.legs[0];
      
      return {
        polyline: route.overview_polyline.points,
        distance: leg.distance.value / 1000, // Convert to kilometers
        duration: leg.duration.value / 60, // Convert to minutes
        distanceText: leg.distance.text,
        durationText: leg.duration.text,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
          distance: step.distance.text,
          duration: step.duration.text,
          start_location: {
            lat: step.start_location.lat,
            lng: step.start_location.lng
          },
          end_location: {
            lat: step.end_location.lat,
            lng: step.end_location.lng
          }
        }))
      };
    } else {
      throw new Error('No route found');
    }
  } catch (error) {
    logger.error({ error }, 'Error getting route polyline');
    return null;
  }
}

export async function getDriverToPickupRoute(driverLat: number, driverLng: number, pickupLat: number, pickupLng: number): Promise<DriverToPickupRoute | null> {
  try {
    const origin = `${driverLat},${driverLng}`;
    const destination = `${pickupLat},${pickupLng}`;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: origin,
        destination: destination,
        mode: 'driving',
        key: env.googleMaps.apiKey
      }
    });

    if (response.data.status === 'OK' && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const leg = route.legs[0];
      
      return {
        polyline: route.overview_polyline.points,
        distance: leg.distance.value / 1000,
        duration: leg.duration.value / 60,
        distanceText: leg.distance.text,
        durationText: leg.duration.text,
        estimated_arrival: Math.round(leg.duration.value / 60)
      };
    } else {
      throw new Error('No route found');
    }
  } catch (error) {
    logger.error({ error }, 'Error getting driver to pickup route');
    return null;
  }
}

export function calculateFare(distance: number, duration: number): number {
  const fare = env.fare.baseFare + (distance * env.fare.perKmRate) + (duration * env.fare.perMinuteRate);
  return Math.max(fare, env.fare.minimumFare);
}

export function findNearbyDrivers(lat: number, lng: number, radiusKm: number = env.ride.defaultRadiusKm): NearbyDriverInfo[] {
  const nearbyDrivers: NearbyDriverInfo[] = [];
  
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
          rating: driver.rating,
          vehicle_type: driver.vehicle_type,
          name: driver.name,
          phone: driver.phone,
          vehicle_number: driver.vehicle_number
        });
      }
    }
  });
  
  // Sort by distance (closest first)
  return nearbyDrivers.sort((a, b) => a.distance - b.distance);
}

export function generateRideId(): string {
  return `ride_${Date.now()}_${uuidv4().substring(0, 8)}`;
}

export function validateRideData(rideData: any): void {
  const required = ['passenger_id', 'passenger_name', 'passenger_phone', 
                   'pickup_latitude', 'pickup_longitude', 'pickup_address',
                   'destination_latitude', 'destination_longitude', 'destination_address'];
  
  for (const field of required) {
    if (!rideData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

// ========================================
// DRIVER SOCKET HANDLERS
// ========================================

export function registerDriverHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
): void {

  // ========================================
  // DRIVER CONNECTION & AUTHENTICATION
  // ========================================
  
  socket.on('connect_driver', async (data: DriverConnection) => {
    try {
      logger.info({ driver_id: data.driver_id }, 'Driver connecting');
      
      // Validate driver data
      const validatedData = DriverConnectionSchema.parse(data);
      
      if (!validatedData.driver_id || !validatedData.latitude || !validatedData.longitude) {
        socket.emit('error', { message: 'Invalid driver data' });
        return;
      }

      // Store driver information
      const driverInfo: Driver = {
        socketId: socket.id,
        driver_id: validatedData.driver_id,
        name: validatedData.name || 'Driver',
        phone: validatedData.phone || '',
        vehicle_type: validatedData.vehicle_type || 'Sedan',
        vehicle_number: validatedData.vehicle_number || '',
        rating: validatedData.rating || 4.5,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        isOnline: true,
        isAvailable: true,
        currentRide: null,
        totalRides: validatedData.total_rides || 0,
        totalEarnings: validatedData.total_earnings || 0,
        lastLocationUpdate: new Date().toISOString(),
        connectedAt: new Date().toISOString()
      };

      activeDrivers.set(validatedData.driver_id, driverInfo);

      // Save driver to database
      await saveDriverToDatabase(driverInfo);

      // Store session mapping
      driverSessions.set(socket.id, validatedData.driver_id);
      (socket as any).driverId = validatedData.driver_id;

      // Log driver online event
      await logDriverEvent('driver:online', { driver_id: validatedData.driver_id, name: validatedData.name });

      // Notify driver of successful connection
      socket.emit('driver_connected', {
        status: 'success',
        message: 'Successfully connected to TourTaxi',
        driver_id: validatedData.driver_id,
        timestamp: new Date().toISOString()
      });

      // Broadcast to all clients that a driver is online
      io.emit('driver_online', {
        driver_id: validatedData.driver_id,
        name: validatedData.name || 'Driver',
        vehicle_type: validatedData.vehicle_type || 'Sedan',
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        rating: validatedData.rating || 4.5,
        timestamp: new Date().toISOString()
      });

      logger.info({ driver_id: validatedData.driver_id }, 'Driver connected successfully');
      
    } catch (error) {
      logger.error({ error }, 'Error connecting driver');
      socket.emit('error', { message: 'Failed to connect driver' });
    }
  });

  // ========================================
  // LOCATION TRACKING
  // ========================================
  
  socket.on('location_update', async (data) => {
    try {
      const driverId = (socket as any).driverId;
      if (!driverId || !activeDrivers.has(driverId)) {
        return;
      }

      const driver = activeDrivers.get(driverId)!;
      
      // Update driver location
      driver.latitude = data.latitude;
      driver.longitude = data.longitude;
      driver.lastLocationUpdate = new Date().toISOString();

      // Update location in database
      await updateDriverLocation(driverId, data.latitude, data.longitude);

      // Broadcast location update to all clients
      io.emit('driver_location_update', {
        driver_id: driverId,
        name: driver.name,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp || new Date().toISOString(),
        isAvailable: driver.isAvailable
      });

      // If driver is on a ride, update ride location
      if (driver.currentRide) {
        const ride = pendingRides.get(driver.currentRide);
        if (ride) {
          ride.driver_latitude = data.latitude;
          ride.driver_longitude = data.longitude;
          // ride.driver_location_updated_at = new Date().toISOString();
          
          // Notify passenger of driver location
          const rideRoom = `ride_${driver.currentRide}`;
          io.to(rideRoom).emit('ride_driver_location', {
            ride_id: driver.currentRide,
            driver_id: driverId,
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      logger.error({ error }, 'Error updating location');
    }
  });

  // ========================================
  // RIDE ACCEPTANCE
  // ========================================
  
  socket.on('ride_accept', async (data) => {
    try {
      logger.info({ driver_id: data.driver_id, ride_id: data.ride_id }, 'Driver accepting ride');
      
      const driverId = data.driver_id;
      const rideId = data.ride_id;
      
      // Validate driver and ride
      if (!activeDrivers.has(driverId)) {
        socket.emit('error', { message: 'Driver not found' });
        return;
      }
      
      const ride = pendingRides.get(rideId);
      if (!ride) {
        socket.emit('error', { message: 'Ride not found or expired' });
        return;
      }
      
      if (ride.status !== 'requested') {
        socket.emit('error', { message: 'Ride already processed' });
        return;
      }

      const driver = activeDrivers.get(driverId)!;
      
      // Get route from driver to pickup location
      const driverToPickupRoute = await getDriverToPickupRoute(
        driver.latitude, driver.longitude,
        ride.pickup_latitude, ride.pickup_longitude
      );

      // Update ride status
      ride.status = 'accepted';
      ride.driver_id = driverId;
      ride.accepted_at = new Date().toISOString();
      ride.driver_name = driver.name;
      ride.driver_phone = driver.phone;
      ride.driver_vehicle = driver.vehicle_type;
      ride.driver_rating = driver.rating;
      ride.driver_vehicle_number = driver.vehicle_number;
      ride.driver_latitude = driver.latitude;
      ride.driver_longitude = driver.longitude;
      ride.driver_to_pickup_polyline = driverToPickupRoute ? driverToPickupRoute.polyline : null;
      ride.driver_to_pickup_distance = driverToPickupRoute ? driverToPickupRoute.distanceText : null;
      ride.driver_to_pickup_duration = driverToPickupRoute ? driverToPickupRoute.durationText : null;

      // Update driver status
      driver.isAvailable = false;
      driver.currentRide = rideId;

      // Store ride assignment
      rideAssignments.set(rideId, driverId);

      // Update ride status in database
      await updateRideStatus(rideId, 'accepted', {
        driver_id: driverId,
        accepted_at: ride.accepted_at,
        driver_latitude: driver.latitude,
        driver_longitude: driver.longitude,
        driver_to_pickup_polyline: ride.driver_to_pickup_polyline,
        driver_to_pickup_distance: ride.driver_to_pickup_distance,
        driver_to_pickup_duration: ride.driver_to_pickup_duration
      });

      // Join both driver and passenger to a per-ride room
      const rideRoom = `ride_${rideId}`;
      socket.join(rideRoom);

      // Notify passenger that ride was accepted with driver details
      const acceptedPayload = {
        ride_id: rideId,
        driver_id: driverId,
        driver_name: driver.name,
        driver_phone: driver.phone,
        driver_vehicle: driver.vehicle_type,
        driver_vehicle_number: driver.vehicle_number,
        driver_rating: driver.rating,
        driver_image: driver.profile_image || null,
        driver_latitude: driver.latitude,
        driver_longitude: driver.longitude,
        estimated_arrival: driverToPickupRoute ? `${driverToPickupRoute.estimated_arrival} minutes` : '5-10 minutes',
        pickup_address: ride.pickup_address,
        destination_address: ride.destination_address,
        fare: ride.fare,
        distance: ride.distance_text,
        duration: ride.duration_text,
        route_polyline: ride.route_polyline,
        driver_to_pickup_polyline: ride.driver_to_pickup_polyline,
        driver_to_pickup_distance: ride.driver_to_pickup_distance,
        driver_to_pickup_duration: ride.driver_to_pickup_duration,
        timestamp: new Date().toISOString()
      };
      
      io.to(rideRoom).emit('ride_accepted', acceptedPayload);
      io.to(rideRoom).emit('ride_room_joined', { ride_id: rideId, members: 2 });

      // Notify driver of successful acceptance
      socket.emit('ride_accepted_confirmation', {
        ride_id: rideId,
        status: 'success',
        message: 'Ride accepted successfully',
        passenger_name: ride.passenger_name,
        passenger_phone: ride.passenger_phone,
        pickup_address: ride.pickup_address,
        destination_address: ride.destination_address,
        fare: ride.fare,
        distance: ride.distance_text,
        duration: ride.duration_text,
        timestamp: new Date().toISOString()
      });

      logger.info({ ride_id: rideId, driver_id: driverId }, 'Ride accepted by driver');

    } catch (error) {
      logger.error({ error }, 'Error accepting ride');
      socket.emit('error', { message: 'Failed to accept ride' });
    }
  });

  // ========================================
  // RIDE REJECTION
  // ========================================
  
  socket.on('ride_reject', (data) => {
    try {
      logger.info({ driver_id: data.driver_id, ride_id: data.ride_id }, 'Driver rejecting ride');
      
      const driverId = data.driver_id;
      const rideId = data.ride_id;
      
      const ride = pendingRides.get(rideId);
      if (ride && ride.status === 'requested') {
        // Find other nearby drivers and send the request to them
        const nearbyDrivers = findNearbyDrivers(
          ride.pickup_latitude, 
          ride.pickup_longitude, 
          env.ride.defaultRadiusKm
        ).filter(driverInfo => driverInfo.driver_id !== driverId);

        let requestsSent = 0;
        nearbyDrivers.forEach(driverInfo => {
          const driver = activeDrivers.get(driverInfo.driver_id);
          if (driver && driver.isAvailable) {
            const estimatedArrival = Math.round(driverInfo.distance * 2);
            io.to(driver.socketId).emit('ride_request', {
              ...ride,
              estimated_arrival: `${estimatedArrival} minutes`,
              driver_distance: driverInfo.distance.toFixed(2)
            });
            requestsSent++;
          }
        });

        logger.info({ ride_id: rideId, requests_sent: requestsSent }, 'Ride request forwarded to other drivers');
      }

      // Notify driver of rejection
      socket.emit('ride_rejected_confirmation', {
        ride_id: rideId,
        status: 'success',
        message: 'Ride rejected successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error({ error }, 'Error rejecting ride');
      socket.emit('error', { message: 'Failed to reject ride' });
    }
  });

  // ========================================
  // RIDE START
  // ========================================
  
  socket.on('ride_start', (data) => {
    try {
      logger.info({ driver_id: data.driver_id, ride_id: data.ride_id }, 'Driver starting ride');
      
      const driverId = data.driver_id;
      const rideId = data.ride_id;
      
      const ride = pendingRides.get(rideId);
      if (!ride || ride.driver_id !== driverId) {
        socket.emit('error', { message: 'Invalid ride or driver' });
        return;
      }
      
      if (ride.status !== 'accepted') {
        socket.emit('error', { message: 'Ride not accepted yet' });
        return;
      }

      // Update ride status
      ride.status = 'started';
      ride.started_at = new Date().toISOString();

      // Notify passenger that ride has started
      const rideRoom = `ride_${rideId}`;
      io.to(rideRoom).emit('ride_started', {
        ride_id: rideId,
        driver_id: driverId,
        driver_name: ride.driver_name,
        driver_phone: ride.driver_phone,
        driver_vehicle: ride.driver_vehicle,
        driver_vehicle_number: ride.driver_vehicle_number,
        started_at: ride.started_at,
        estimated_duration: ride.duration_text,
        destination_address: ride.destination_address,
        timestamp: new Date().toISOString()
      });

      // Notify driver of successful start
      socket.emit('ride_started_confirmation', {
        ride_id: rideId,
        status: 'success',
        message: 'Ride started successfully',
        destination_address: ride.destination_address,
        estimated_duration: ride.duration_text,
        timestamp: new Date().toISOString()
      });

      logger.info({ ride_id: rideId, driver_id: driverId }, 'Ride started by driver');

    } catch (error) {
      logger.error({ error }, 'Error starting ride');
      socket.emit('error', { message: 'Failed to start ride' });
    }
  });

  // ========================================
  // RIDE COMPLETION
  // ========================================
  
  socket.on('ride_complete', async (data) => {
    try {
      logger.info({ driver_id: data.driver_id, ride_id: data.ride_id }, 'Driver completing ride');
      
      const driverId = data.driver_id;
      const rideId = data.ride_id;
      
      const ride = pendingRides.get(rideId);
      if (!ride || ride.driver_id !== driverId) {
        socket.emit('error', { message: 'Invalid ride or driver' });
        return;
      }
      
      if (ride.status !== 'started') {
        socket.emit('error', { message: 'Ride not started yet' });
        return;
      }

      const driver = activeDrivers.get(driverId)!;
      
      // Update ride status
      ride.status = 'completed';
      ride.completed_at = new Date().toISOString();
      ride.actual_fare = data.fare || ride.fare;

      // Update driver statistics
      driver.totalRides += 1;
      driver.totalEarnings += parseFloat(ride.actual_fare);
      driver.isAvailable = true;
      driver.currentRide = null;

      // Move ride to completed rides
      completedRides.set(rideId, ride);
      pendingRides.delete(rideId);
      rideAssignments.delete(rideId);

      // Update ride status in database
      await updateRideStatus(rideId, 'completed', {
        completed_at: ride.completed_at,
        actual_fare: ride.actual_fare
      });

      // Save earnings to database
      const commission = parseFloat(ride.actual_fare) * env.fare.commissionRate;
      await saveEarningsToDatabase(driverId, rideId, parseFloat(ride.actual_fare), commission);

      // Notify passenger that ride is completed
      const rideRoom = `ride_${rideId}`;
      io.to(rideRoom).emit('ride_completed', {
        ride_id: rideId,
        driver_id: driverId,
        driver_name: ride.driver_name,
        completed_at: ride.completed_at,
        fare: ride.actual_fare,
        distance: ride.distance_text,
        duration: ride.duration_text,
        rating_request: true,
        timestamp: new Date().toISOString()
      });

      // Notify driver of successful completion
      socket.emit('ride_completed_confirmation', {
        ride_id: rideId,
        status: 'success',
        message: 'Ride completed successfully',
        fare: ride.actual_fare,
        total_earnings: driver.totalEarnings,
        total_rides: driver.totalRides,
        timestamp: new Date().toISOString()
      });

      logger.info({ ride_id: rideId, driver_id: driverId, fare: ride.actual_fare }, 'Ride completed by driver');

    } catch (error) {
      logger.error({ error }, 'Error completing ride');
      socket.emit('error', { message: 'Failed to complete ride' });
    }
  });

  // ========================================
  // CHAT MESSAGING
  // ========================================

  socket.on('driver_message', (data, ack) => {
    try {
      const { ride_id, driver_id, message_text, timestamp } = data || {};
      if (!ride_id || !driver_id || !message_text) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid payload' });
        return;
      }

      const rideRoom = `ride_${ride_id}`;
      io.to(rideRoom).emit('driver_message', {
        ride_id,
        driver_id,
        message_text,
        timestamp: timestamp || new Date().toISOString(),
      });

      if (typeof ack === 'function') ack({ ok: true });
    } catch (error) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Server error' });
    }
  });

  // ========================================
  // DRIVER STATUS MANAGEMENT
  // ========================================
  
  socket.on('driver_offline', (data) => {
    try {
      logger.info({ driver_id: data.driver_id }, 'Driver going offline');
      
      const driverId = data.driver_id;
      const driver = activeDrivers.get(driverId);
      
      if (driver) {
        driver.isOnline = false;
        driver.isAvailable = false;
        // driver.wentOfflineAt = new Date().toISOString();
        
        // If driver is on a ride, handle it
        if (driver.currentRide) {
          const ride = pendingRides.get(driver.currentRide);
          if (ride) {
            ride.status = 'cancelled';
            ride.cancelled_at = new Date().toISOString();
            ride.cancellation_reason = 'Driver went offline';
            
            // Notify passenger
            io.emit('ride_cancelled', {
              ride_id: driver.currentRide,
              reason: 'Driver went offline',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      
      // Broadcast driver offline status
      io.emit('driver_offline', {
        driver_id: driverId,
        timestamp: new Date().toISOString()
      });

      // Log driver offline event
      await logDriverEvent('driver:offline', { driver_id: driverId, name: driver?.name });
      
    } catch (error) {
      logger.error({ error }, 'Error setting driver offline');
    }
  });

  socket.on('driver_available', (data) => {
    try {
      const driverId = data.driver_id;
      const driver = activeDrivers.get(driverId);
      
      if (driver && driver.isOnline) {
        driver.isAvailable = true;
        driver.currentRide = null;
        
        logger.info({ driver_id: driverId }, 'Driver is now available');
        
        socket.emit('driver_available_confirmation', {
          status: 'success',
          message: 'You are now available for new rides',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      logger.error({ error }, 'Error setting driver available');
    }
  });
}

// ========================================
// CRON JOBS FOR MAINTENANCE
// ========================================

// Clean up old completed rides every hour
cron.schedule('0 * * * *', () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let cleaned = 0;
  
  completedRides.forEach((ride, rideId) => {
    if (ride.completed_at && new Date(ride.completed_at) < oneDayAgo) {
      completedRides.delete(rideId);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    logger.info({ cleaned_rides: cleaned }, 'Cleaned up old completed rides');
  }
});

// Update driver statistics every 5 minutes
cron.schedule('*/5 * * * *', () => {
  logger.info({
    active_drivers: activeDrivers.size,
    pending_rides: pendingRides.size,
    completed_rides: completedRides.size
  }, 'System status update');
});