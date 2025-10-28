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
    // First, save basic driver info to drivers table
    const { data: driverData_result, error: driverError } = await supabase
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

    if (driverError) throw driverError;

    // Update driver status in active_drivers table using database function
    const { error: statusError } = await supabase.rpc('update_driver_online_status', {
      available_status: true,
      driver_id: driverData.driver_id,
      online_status: true
    });

    if (statusError) {
      logger.error({ error: statusError }, 'Error updating driver status in active_drivers');
    }

    // Update location using database function
    const { error: locationError } = await supabase.rpc('update_driver_location_and_status', {
      driver_id: driverData.driver_id,
      lat: driverData.latitude,
      lng: driverData.longitude,
      heading_val: 0.0,
      speed_val: 0.0
    });

    if (locationError) {
      logger.error({ error: locationError }, 'Error updating driver location');
    }

    return driverData_result;
  } catch (error) {
    logger.error({ error }, 'Error saving driver to database');
    return null;
  }
}

export async function updateDriverLocation(driverId: string, latitude: number, longitude: number, heading?: number, speed?: number): Promise<void> {
  try {
    // Update driver basic info
    const { error } = await supabase
      .from('drivers')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString()
      })
      .eq('id', driverId);

    if (error) throw error;

    // Use database function to update location and keep driver active
    const { error: locationError } = await supabase.rpc('update_driver_location_and_status', {
      driver_id: driverId,
      lat: latitude,
      lng: longitude,
      heading_val: heading || 0.0,
      speed_val: speed || 0.0
    });

    if (locationError) {
      logger.error({ error: locationError }, 'Error updating driver location via function');
    }

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

    if (error) {
      logger.error({ error, ride_id: rideData.ride_id }, 'Supabase error saving ride to database');
      throw error;
    }
    
    logger.info({ ride_id: rideData.ride_id }, 'Ride saved to database successfully');
    return data;
  } catch (error) {
    logger.error({ error, ride_id: rideData.ride_id }, 'Error saving ride to database');
    throw error; // Re-throw so caller can handle it
  }
}

export async function updateRideStatus(rideId: string, status: string, additionalData: any = {}): Promise<boolean> {
  try {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString(),
      ...additionalData
    };

    const { data, error } = await supabase
      .from('rides')
      .update(updateData)
      .eq('id', rideId)
      .select();

    if (error) {
      logger.error({ error, rideId }, 'Supabase error updating ride status');
      throw error;
    }
    
    // Check if any rows were actually updated
    if (!data || data.length === 0) {
      logger.error({ rideId, status }, 'No ride found with this ID to update');
      throw new Error(`Ride ${rideId} not found in database`);
    }
    
    logger.info({ rideId, status }, 'Ride status updated successfully in database');
    return true;
  } catch (error) {
    logger.error({ error, rideId, status }, 'Error updating ride status');
    throw error; // Re-throw so caller can handle it
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

export async function findNearbyDrivers(lat: number, lng: number, radiusKm: number = env.ride.defaultRadiusKm): Promise<NearbyDriverInfo[]> {
  try {
    // Use database function to get nearby online and available drivers
    const { data: nearbyDriversData, error } = await supabase.rpc('get_nearby_drivers', {
      lat: lat,
      lng: lng,
      radius_km: radiusKm
    });

    if (error) {
      logger.error({ error }, 'Error fetching nearby drivers from database');
      // Fallback to in-memory search
      return findNearbyDriversInMemory(lat, lng, radiusKm);
    }

    if (!nearbyDriversData || nearbyDriversData.length === 0) {
      // Important: DB may be stale or empty during cold starts - fallback to in-memory drivers
      logger.warn({ lat, lng, radiusKm }, 'No nearby drivers found in DB, falling back to in-memory search');
      return findNearbyDriversInMemory(lat, lng, radiusKm);
    }

    // Transform database results to NearbyDriverInfo format
    const nearbyDrivers: NearbyDriverInfo[] = nearbyDriversData.map((driver: any) => ({
      driver_id: driver.id,
      distance: driver.distance_km,
      rating: driver.rating || 4.5,
      vehicle_type: `${driver.vehicle_make || ''} ${driver.vehicle_model || driver.vehicle_type || 'Vehicle'}`.trim(),
      name: driver.name || 'Driver',
      phone: driver.phone || '',
      vehicle_number: driver.vehicle_plate || driver.vehicle_number || 'Unknown'
    }));

    logger.info({ count: nearbyDrivers.length, lat, lng, radiusKm }, 'Found nearby drivers from database');
    return nearbyDrivers;

  } catch (error) {
    logger.error({ error }, 'Error in findNearbyDrivers');
    // Fallback to in-memory search
    return findNearbyDriversInMemory(lat, lng, radiusKm);
  }
}

// Fallback in-memory search function
function findNearbyDriversInMemory(lat: number, lng: number, radiusKm: number): NearbyDriverInfo[] {
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
      
      // Check if driver is already connected (reconnection scenario)
      const existingDriver = activeDrivers.get(validatedData.driver_id);
      if (existingDriver) {
        logger.info({ 
          driver_id: validatedData.driver_id,
          old_socket: existingDriver.socketId,
          new_socket: socket.id
        }, 'Driver reconnecting - updating socket ID');
        
        // Update existing driver with new socket ID
        existingDriver.socketId = socket.id;
        existingDriver.isOnline = true;
        existingDriver.isAvailable = true;
        existingDriver.latitude = validatedData.latitude;
        existingDriver.longitude = validatedData.longitude;
        existingDriver.lastLocationUpdate = new Date().toISOString();
        
        // Update session mapping
        driverSessions.set(socket.id, validatedData.driver_id);
        (socket as any).driverId = validatedData.driver_id;
        
        // Rejoin socket rooms
        await socket.join(`driver_${validatedData.driver_id}`);
        await socket.join('available_drivers');
        await socket.join('online_drivers');
        
        // Send immediate reconnection confirmation
        socket.emit('driver_connected', {
          status: 'reconnected',
          message: 'Successfully reconnected to TourTaxi',
          driver_id: validatedData.driver_id,
          timestamp: new Date().toISOString()
        });
        
        return; // Skip creating new driver object
      }

      // Store driver information in memory FIRST
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

      // Add to activeDrivers Map IMMEDIATELY to avoid race conditions
      activeDrivers.set(validatedData.driver_id, driverInfo);

      // Store session mapping
      driverSessions.set(socket.id, validatedData.driver_id);
      (socket as any).driverId = validatedData.driver_id;

      // Join driver to necessary socket rooms synchronously
      await socket.join(`driver_${validatedData.driver_id}`);
      await socket.join('available_drivers'); // Room for all available drivers
      await socket.join('online_drivers'); // Additional backup room
      
      // Verify room membership for debugging
      const rooms = Array.from(socket.rooms);
      logger.info({ 
        driver_id: validatedData.driver_id, 
        socket_id: socket.id,
        rooms: rooms,
        total_rooms: rooms.length,
        joined_rooms: {
          driver_specific: `driver_${validatedData.driver_id}`,
          available_drivers: 'available_drivers',
          online_drivers: 'online_drivers'
        }
      }, 'Driver joined socket rooms successfully');
      
      // Confirm driver is in activeDrivers map and verify room membership
      const isInAvailableRoom = socket.rooms.has('available_drivers');
      const isInDriverRoom = socket.rooms.has(`driver_${validatedData.driver_id}`);
      
      logger.info({ 
        driver_id: validatedData.driver_id,
        in_memory: activeDrivers.has(validatedData.driver_id),
        is_online: driverInfo.isOnline,
        is_available: driverInfo.isAvailable,
        latitude: driverInfo.latitude,
        longitude: driverInfo.longitude,
        room_membership: {
          available_drivers: isInAvailableRoom,
          driver_specific: isInDriverRoom,
          total_rooms: socket.rooms.size,
          all_rooms: Array.from(socket.rooms)
        }
      }, 'Driver status and room membership confirmed');
      
      // Save driver to database (asynchronously, don't block connection)
      saveDriverToDatabase(driverInfo).catch(error => {
        logger.error({ error, driver_id: validatedData.driver_id }, 'Failed to save driver to database');
      });

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

      // Start keep-alive ping for this driver
      const keepAlivePing = setInterval(() => {
        if (socket.connected && activeDrivers.has(validatedData.driver_id)) {
          socket.emit('server_ping', { timestamp: new Date().toISOString() });
        } else {
          clearInterval(keepAlivePing);
        }
      }, 45000); // Every 45 seconds
      
      // Store the interval ID for cleanup
      (socket as any).keepAlivePing = keepAlivePing;

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
        logger.warn({ 
          socket_id: socket.id, 
          driver_id: driverId,
          has_driver: activeDrivers.has(driverId)
        }, 'Location update from unknown or disconnected driver');
        return;
      }

      const driver = activeDrivers.get(driverId)!;
      
      // Verify socket connection is still valid
      if (driver.socketId !== socket.id) {
        logger.warn({ 
          driver_id: driverId,
          expected_socket: driver.socketId,
          actual_socket: socket.id
        }, 'Socket ID mismatch - updating driver socket ID');
        driver.socketId = socket.id;
      }
      
      // Update driver location and connection status
      driver.latitude = data.latitude;
      driver.longitude = data.longitude;
      driver.lastLocationUpdate = new Date().toISOString();
      driver.isOnline = true; // Confirm driver is online when receiving location updates
      
      // If driver was marked as unavailable due to stale connection, make them available again
      if (!driver.isAvailable && !driver.currentRide) {
        driver.isAvailable = true;
        logger.info({ driver_id: driverId }, 'Driver reconnected - marked as available');
      }

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
      logger.info({ driver_id: data.driver_id, ride_id: data.ride_id, driver_details: data }, 'Driver accepting ride with full details');
      
      const driverId = data.driver_id;
      const rideId = data.ride_id;
      
      // Validate driver and ride
      if (!activeDrivers.has(driverId)) {
        logger.error({ driverId }, 'Driver not found in activeDrivers map');
        socket.emit('error', { message: 'Driver not found' });
        return;
      }
      
      const ride = pendingRides.get(rideId);
      if (!ride) {
        logger.error({ rideId, pendingRidesSize: pendingRides.size }, 'Ride not found in pendingRides map');
        socket.emit('error', { message: 'Ride not found or expired' });
        return;
      }
      
      if (ride.status !== 'requested') {
        logger.error({ rideId, currentStatus: ride.status }, 'Ride already processed');
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
      
      // Remove driver from available_drivers room since they're now busy
      await socket.leave('available_drivers');

      // Store ride assignment
      rideAssignments.set(rideId, driverId);

      // Update ride status in database
      try {
        await updateRideStatus(rideId, 'accepted', {
          driver_id: driverId,
          accepted_at: ride.accepted_at,
          driver_latitude: driver.latitude,
          driver_longitude: driver.longitude,
          driver_to_pickup_polyline: ride.driver_to_pickup_polyline,
          driver_to_pickup_distance: ride.driver_to_pickup_distance,
          driver_to_pickup_duration: ride.driver_to_pickup_duration
        });
        logger.info({ rideId, driverId }, 'Database updated successfully');
      } catch (dbError) {
        logger.error({ dbError, rideId, driverId }, 'Failed to update ride in database');
        socket.emit('error', { message: 'Failed to accept ride in database' });
        // Rollback in-memory state
        ride.status = 'requested';
        ride.driver_id = null;
        driver.isAvailable = true;
        driver.currentRide = null;
        rideAssignments.delete(rideId);
        return;
      }

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
  
  socket.on('ride_reject', async (data) => {
    try {
      logger.info({ driver_id: data.driver_id, ride_id: data.ride_id }, 'Driver rejecting ride');
      
      const driverId = data.driver_id;
      const rideId = data.ride_id;
      
      const ride = pendingRides.get(rideId);
      if (ride && ride.status === 'requested') {
        // Find other nearby drivers and send the request to them
        const nearbyDrivers = (await findNearbyDrivers(
          ride.pickup_latitude, 
          ride.pickup_longitude, 
          env.ride.defaultRadiusKm
        )).filter(driverInfo => driverInfo.driver_id !== driverId);

        let requestsSent = 0;
        for (const driverInfo of nearbyDrivers) {
          const driver = activeDrivers.get(driverInfo.driver_id);
          if (driver && driver.isAvailable) {
            const estimatedArrival = Math.round(driverInfo.distance * 2);
            const rideRequestPayload = {
              ...ride,
              estimated_arrival: `${estimatedArrival} minutes`,
              driver_distance: driverInfo.distance.toFixed(2)
            };
            
            try {
              // Use triple approach for maximum reliability
              io.to(`driver_${driverInfo.driver_id}`).emit('ride_request', rideRequestPayload);
              io.to(driver.socketId).emit('ride_request', rideRequestPayload);
              io.to('available_drivers').emit('ride_request', {
                ...rideRequestPayload,
                target_driver_id: driverInfo.driver_id
              });
              requestsSent++;
              
              logger.info({
                driver_id: driverInfo.driver_id,
                ride_id: rideId,
                rejection_forwarding: true
              }, 'Ride request forwarded to alternative driver after rejection');
              
            } catch (error) {
              logger.error({
                error,
                driver_id: driverInfo.driver_id,
                ride_id: rideId
              }, 'Failed to forward ride request to alternative driver');
            }
          }
        };

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
      
      // Rejoin available_drivers room since ride is complete
      await socket.join('available_drivers');

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
  
  socket.on('driver_offline', async (data) => {
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

  socket.on('driver_available', async (data) => {
    try {
      const driverId = data.driver_id;
      const driver = activeDrivers.get(driverId);
      
      if (driver && driver.isOnline) {
        driver.isAvailable = true;
        driver.currentRide = null;
        
        // Join available_drivers room to receive ride requests
        await socket.join('available_drivers');
        
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

  // Driver heartbeat/ping for connection health monitoring
  socket.on('driver_ping', async (data, ack) => {
    try {
      const driverId = (socket as any).driverId || data?.driver_id;
      
      if (driverId && activeDrivers.has(driverId)) {
        const driver = activeDrivers.get(driverId)!;
        driver.lastLocationUpdate = new Date().toISOString();
        driver.isOnline = true;
        
        // Recovery: If driver was marked as unavailable but is now pinging us,
        // mark them as available again if they're not on a ride
        if (!driver.isAvailable && !driver.currentRide) {
          driver.isAvailable = true;
          logger.info({ driver_id: driverId }, 'Driver restored to available state via ping');
          
          // Make sure they're in the available_drivers room
          if (!socket.rooms.has('available_drivers')) {
            await socket.join('available_drivers');
            logger.info({ driver_id: driverId }, 'Re-added driver to available_drivers room');
          }
          
          // Verify they're in the driver-specific room
          if (!socket.rooms.has(`driver_${driverId}`)) {
            await socket.join(`driver_${driverId}`);
            logger.info({ driver_id: driverId }, 'Re-added driver to driver-specific room');
          }
        }
        
        // Update database to ensure consistency
        if (!driver.isOnline || !driver.isAvailable) {
          try {
            await supabase
              .from('drivers')
              .update({
                is_online: driver.isOnline,
                is_available: driver.isAvailable,
                updated_at: new Date().toISOString()
              })
              .eq('id', driverId);
          } catch (dbError) {
            logger.error({ error: dbError, driver_id: driverId }, 'Failed to update driver status in database');
          }
        }
        
        // Acknowledge the ping
        if (typeof ack === 'function') {
          ack({ 
            status: 'ok', 
            timestamp: new Date().toISOString(),
            driver_status: {
              isOnline: driver.isOnline,
              isAvailable: driver.isAvailable,
              currentRide: driver.currentRide,
              recovery_performed: !driver.isAvailable
            }
          });
        }
        
        logger.debug({ driver_id: driverId }, 'Driver ping received');
      } else if (driverId) {
        // Driver has a driver_id but not in activeDrivers - could be a stale session
        // Try to recover from database
        try {
          const { data: driverData } = await supabase
            .from('drivers')
            .select('*')
            .eq('id', driverId)
            .single();
          
          if (driverData) {
            logger.warn({ 
              driver_id: driverId, 
              socket_id: socket.id 
            }, 'Driver not in memory but found in database - recovering');
            
            // Create a new driver object for this driver
            const recoveredDriver: Driver = {
              socketId: socket.id,
              driver_id: driverId,
              name: driverData.name || 'Driver',
              phone: driverData.phone || '',
              vehicle_type: driverData.vehicle_type || 'Sedan',
              vehicle_number: driverData.vehicle_number || '',
              rating: driverData.rating || 4.5,
              latitude: driverData.current_latitude || 0,
              longitude: driverData.current_longitude || 0,
              isOnline: true,
              isAvailable: true,
              currentRide: null,
              totalRides: driverData.total_rides || 0,
              totalEarnings: driverData.total_earnings || 0,
              lastLocationUpdate: new Date().toISOString(),
              connectedAt: new Date().toISOString()
            };
            
            activeDrivers.set(driverId, recoveredDriver);
            driverSessions.set(socket.id, driverId);
            (socket as any).driverId = driverId;
            
            // Add to socket rooms
            await socket.join(`driver_${driverId}`);
            await socket.join('available_drivers');
            await socket.join('online_drivers');
            
            // Update database
            await supabase
              .from('drivers')
              .update({
                is_online: true,
                is_available: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', driverId);
            
            if (typeof ack === 'function') {
              ack({ 
                status: 'recovered', 
                timestamp: new Date().toISOString(),
                message: 'Driver session recovered',
                driver_status: {
                  isOnline: true,
                  isAvailable: true,
                  currentRide: null
                }
              });
            }
            return;
          }
        } catch (dbError) {
          logger.error({ error: dbError, driver_id: driverId }, 'Failed to recover driver from database');
        }
        
        logger.warn({ 
          driver_id: driverId, 
          socket_id: socket.id 
        }, 'Ping from unknown driver - not in memory or database');
        
        if (typeof ack === 'function') {
          ack({ 
            status: 'error', 
            message: 'Driver not found - please reconnect',
            needs_reconnect: true
          });
        }
      } else {
        logger.warn({ socket_id: socket.id }, 'Ping with no driver ID');
        
        if (typeof ack === 'function') {
          ack({ status: 'error', message: 'No driver ID provided' });
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error handling driver ping');
      if (typeof ack === 'function') {
        ack({ status: 'error', message: 'Server error' });
      }
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

// Aggressive connection monitoring and recovery every 1 minute
cron.schedule('*/1 * * * *', async () => {
  const now = new Date();
  const staleThreshold = 2 * 60 * 1000; // Reduced to 2 minutes for faster detection
  const disconnectedThreshold = 30 * 1000; // 30 seconds for disconnected status
  let cleanedDrivers = 0;
  let recoveredDrivers = 0;
  
  // Check for stale driver connections and attempt recovery
  for (const [driverId, driver] of activeDrivers) {
    try {
      const lastUpdate = new Date(driver.lastLocationUpdate || driver.connectedAt);
      const timeDiff = now.getTime() - lastUpdate.getTime();
      
      if (timeDiff > staleThreshold) {
        // Driver connection is stale, mark as offline but keep in memory for recovery
        if (driver.isOnline) {
          logger.warn({ 
            driver_id: driverId, 
            last_update: driver.lastLocationUpdate,
            time_diff_minutes: Math.round(timeDiff / 60000)
          }, 'Driver connection stale - marking offline but keeping for recovery');
          
          // Mark as offline in memory but don't remove
          driver.isOnline = false;
          driver.isAvailable = false;
          
          // Update database to reflect offline status
          await supabase
            .from('drivers')
            .update({
              is_online: false,
              is_available: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', driverId);
            
          // Update active_drivers table
          await supabase.rpc('update_driver_online_status', {
            available_status: false,
            driver_id: driverId,
            online_status: false
          });
          
          cleanedDrivers++;
        }
      } else if (timeDiff < disconnectedThreshold && !driver.isOnline) {
        // Driver has recent activity but is marked offline - recover them
        logger.info({ 
          driver_id: driverId,
          last_update: driver.lastLocationUpdate
        }, 'Auto-recovering driver with recent activity');
        
        driver.isOnline = true;
        driver.isAvailable = true;
        
        // Update database
        await supabase
          .from('drivers')
          .update({
            is_online: true,
            is_available: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', driverId);
          
        await supabase.rpc('update_driver_online_status', {
          available_status: true,
          driver_id: driverId,
          online_status: true
        });
        
        recoveredDrivers++;
      }
    } catch (error) {
      logger.error({ error, driver_id: driverId }, 'Error in driver status monitoring');
    }
  }
  
  logger.info({
    active_drivers: activeDrivers.size,
    pending_rides: pendingRides.size,
    completed_rides: completedRides.size,
    cleaned_stale_drivers: cleanedDrivers,
    recovered_drivers: recoveredDrivers,
    online_drivers: Array.from(activeDrivers.values()).filter(d => d.isOnline).length,
    available_drivers: Array.from(activeDrivers.values()).filter(d => d.isAvailable).length
  }, 'Enhanced system status with recovery stats');
});

// ========================================
// REST API FUNCTIONS FOR DRIVER STATUS
// ========================================

import { Request, Response } from 'express';

export async function updateDriverStatus(req: Request, res: Response) {
  const { driver_id, is_online, is_available } = req.body;

  // Validate required fields
  if (!driver_id || typeof is_online !== 'boolean') {
    return res.status(400).json({ 
      error: 'Missing required fields: driver_id and is_online (boolean)' 
    });
  }

  // Default is_available to is_online if not provided
  const availableStatus = typeof is_available === 'boolean' ? is_available : is_online;

  try {
    // Update in drivers table
    const { error: driverError } = await supabase
      .from('drivers')
      .update({
        is_online,
        is_available: availableStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', driver_id);

    if (driverError) {
      logger.error({ error: driverError, driver_id }, 'Failed to update driver status in drivers table');
      return res.status(400).json({ error: driverError.message });
    }

    // Update in active_drivers table using database function
    const { error: statusError } = await supabase.rpc('update_driver_online_status', {
      available_status: availableStatus,
      driver_id: driver_id,
      online_status: is_online
    });

    if (statusError) {
      logger.error({ error: statusError, driver_id }, 'Failed to update driver status in active_drivers');
      // Don't return error here, as the drivers table was updated successfully
    }

    // Also update in-memory active drivers if exists
    const driver = activeDrivers.get(driver_id);
    if (driver) {
      driver.isOnline = is_online;
      driver.isAvailable = availableStatus;
      if (!is_online) {
        driver.isAvailable = false;
      }
    }

    // Log the status change event
    await logDriverEvent(
      is_online ? 'driver:online' : 'driver:offline', 
      { driver_id, name: driver?.name || 'Unknown Driver' }
    );

    logger.info({ driver_id, is_online, is_available: availableStatus }, `Driver status updated: ${is_online ? 'online' : 'offline'}`);
    
    return res.status(200).json({ 
      success: true, 
      data: {
        driver_id,
        is_online,
        is_available: availableStatus,
        updated_at: new Date().toISOString()
      }
    });
    
  } catch (err) {
    logger.error({ error: err, driver_id }, 'Internal server error updating driver status');
    return res.status(500).json({ error: 'Internal server error' });
  }
}
