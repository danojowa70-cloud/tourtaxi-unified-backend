const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const { getDistance, isPointWithinRadius } = require('geolib');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*", // In production, specify your Flutter app's origin
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// ========================================
// SUPABASE CONFIGURATION
// ========================================
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// ========================================
// DATA STORAGE (In-memory for real-time features)
// ========================================
const activeDrivers = new Map(); // driver_id -> driver data
const pendingRides = new Map(); // ride_id -> ride data
const completedRides = new Map(); // ride_id -> completed ride data
const driverSessions = new Map(); // socket_id -> driver_id
const rideAssignments = new Map(); // ride_id -> driver_id

// ========================================
// GOOGLE MAPS API CONFIGURATION
// ========================================
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBRYPKaXlRhpzoAmM5-KrS2JaNDxAX_phw';

// ========================================
// SUPABASE HELPER FUNCTIONS
// ========================================

// Save driver to database
async function saveDriverToDatabase(driverData) {
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
        total_rides: driverData.total_rides || 0,
        total_earnings: driverData.total_earnings || 0,
        is_online: true,
        is_available: true,
        current_latitude: driverData.latitude,
        current_longitude: driverData.longitude,
        last_location_update: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving driver to database:', error);
    return null;
  }
}

// Update driver location in database
async function updateDriverLocation(driverId, latitude, longitude) {
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
    console.error('Error updating driver location:', error);
  }
}

// Save ride to database
async function saveRideToDatabase(rideData) {
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
    console.error('Error saving ride to database:', error);
    return null;
  }
}

// Update ride status in database
async function updateRideStatus(rideId, status, additionalData = {}) {
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
    console.error('Error updating ride status:', error);
    return false;
  }
}

// Save earnings to database
async function saveEarningsToDatabase(driverId, rideId, amount, commission = 0) {
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
    console.error('Error saving earnings:', error);
    return null;
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

// Calculate accurate distance using Google Maps Distance Matrix API
async function calculateAccurateDistance(originLat, originLng, destLat, destLng) {
  try {
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: origin,
        destinations: destination,
        units: 'metric',
        key: GOOGLE_MAPS_API_KEY
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
    console.error('Error calculating distance:', error);
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

// Get route polyline using Google Maps Directions API
async function getRoutePolyline(originLat, originLng, destLat, destLng) {
  try {
    const origin = `${originLat},${originLng}`;
    const destination = `${destLat},${destLng}`;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: origin,
        destination: destination,
        mode: 'driving',
        key: GOOGLE_MAPS_API_KEY
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
        steps: leg.steps.map(step => ({
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
    console.error('Error getting route polyline:', error);
    return null;
  }
}

// Get route from driver to passenger pickup location
async function getDriverToPickupRoute(driverLat, driverLng, pickupLat, pickupLng) {
  try {
    const origin = `${driverLat},${driverLng}`;
    const destination = `${pickupLat},${pickupLng}`;
    
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: origin,
        destination: destination,
        mode: 'driving',
        key: GOOGLE_MAPS_API_KEY
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
    console.error('Error getting driver to pickup route:', error);
    return null;
  }
}

// Calculate fare based on distance and duration
function calculateFare(distance, duration) {
  const baseFare = 3.00; // Base fare
  const perKmRate = 1.80; // Per kilometer rate
  const perMinuteRate = 0.30; // Per minute rate (for traffic)
  const minimumFare = 8.00; // Minimum fare
  
  const fare = baseFare + (distance * perKmRate) + (duration * perMinuteRate);
  return Math.max(fare, minimumFare);
}

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
          vehicle_type: driver.vehicle_type || 'Sedan',
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

// Generate unique ride ID
function generateRideId() {
  return `ride_${Date.now()}_${uuidv4().substring(0, 8)}`;
}

// Validate ride data
function validateRideData(rideData) {
  const required = ['passenger_id', 'passenger_name', 'passenger_phone', 
                   'pickup_latitude', 'pickup_longitude', 'pickup_address',
                   'destination_latitude', 'destination_longitude', 'destination_address'];
  
  for (const field of required) {
    if (!rideData[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  return true;
}

// ========================================
// SOCKET.IO EVENT HANDLERS
// ========================================

io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // ========================================
  // DRIVER CONNECTION & AUTHENTICATION
  // ========================================
  
  socket.on('connect_driver', (data) => {
    try {
      console.log(`🚗 Driver connecting: ${data.driver_id}`);
      
      // Validate driver data
      if (!data.driver_id || !data.latitude || !data.longitude) {
        socket.emit('error', { message: 'Invalid driver data' });
        return;
      }

      // Store driver information
      const driverInfo = {
        socketId: socket.id,
        driver_id: data.driver_id,
        name: data.name || 'Driver',
        phone: data.phone || '',
        vehicle_type: data.vehicle_type || 'Sedan',
        vehicle_number: data.vehicle_number || '',
        rating: data.rating || 4.5,
        latitude: data.latitude,
        longitude: data.longitude,
        isOnline: true,
        isAvailable: true,
        currentRide: null,
        totalRides: data.total_rides || 0,
        totalEarnings: data.total_earnings || 0,
        lastLocationUpdate: new Date().toISOString(),
        connectedAt: new Date().toISOString()
      };

      activeDrivers.set(data.driver_id, driverInfo);

      // Save driver to database
      await saveDriverToDatabase(driverInfo);

      // Store session mapping
      driverSessions.set(socket.id, data.driver_id);
      socket.driverId = data.driver_id;

      // Notify driver of successful connection
      socket.emit('driver_connected', {
        status: 'success',
        message: 'Successfully connected to TourTaxi',
        driver_id: data.driver_id,
        timestamp: new Date().toISOString()
      });

      // Broadcast to all clients that a driver is online
      io.emit('driver_online', {
        driver_id: data.driver_id,
        name: data.name || 'Driver',
        vehicle_type: data.vehicle_type || 'Sedan',
        latitude: data.latitude,
        longitude: data.longitude,
        rating: data.rating || 4.5,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Driver ${data.driver_id} connected successfully`);
      
    } catch (error) {
      console.error('Error connecting driver:', error);
      socket.emit('error', { message: 'Failed to connect driver' });
    }
  });

  // ========================================
  // LOCATION TRACKING
  // ========================================
  
  socket.on('location_update', (data) => {
    try {
      const driverId = socket.driverId;
      if (!driverId || !activeDrivers.has(driverId)) {
        return;
      }

      const driver = activeDrivers.get(driverId);
      
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
          ride.driver_location_updated_at = new Date().toISOString();
          
          // Notify passenger of driver location
          io.emit('ride_driver_location', {
            ride_id: driver.currentRide,
            driver_id: driverId,
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      console.error('Error updating location:', error);
    }
  });

  // ========================================
  // RIDE REQUEST HANDLING
  // ========================================
  
  socket.on('ride_request', async (rideData) => {
    try {
      console.log(`🚖 New ride request from passenger: ${rideData.passenger_name}`);
      
      // Validate ride data
      validateRideData(rideData);
      
      // Generate unique ride ID
      const rideId = rideData.ride_id || generateRideId();
      
      // Calculate accurate distance and duration
      const distanceInfo = await calculateAccurateDistance(
        rideData.pickup_latitude, rideData.pickup_longitude,
        rideData.destination_latitude, rideData.destination_longitude
      );
      
      // Get route polyline for the ride
      const routeInfo = await getRoutePolyline(
        rideData.pickup_latitude, rideData.pickup_longitude,
        rideData.destination_latitude, rideData.destination_longitude
      );
      
      // Calculate fare
      const calculatedFare = calculateFare(distanceInfo.distance, distanceInfo.duration);
      
      // Create ride object
      const ride = {
        ride_id: rideId,
        passenger_id: rideData.passenger_id,
        passenger_name: rideData.passenger_name,
        passenger_phone: rideData.passenger_phone,
        passenger_image: rideData.passenger_image || null,
        pickup_latitude: rideData.pickup_latitude,
        pickup_longitude: rideData.pickup_longitude,
        pickup_address: rideData.pickup_address,
        destination_latitude: rideData.destination_latitude,
        destination_longitude: rideData.destination_longitude,
        destination_address: rideData.destination_address,
        distance: distanceInfo.distance.toFixed(2),
        distance_text: distanceInfo.distanceText,
        duration: Math.round(distanceInfo.duration),
        duration_text: distanceInfo.durationText,
        fare: rideData.fare || calculatedFare.toFixed(2),
        route_polyline: routeInfo ? routeInfo.polyline : null,
        route_steps: routeInfo ? routeInfo.steps : null,
        status: 'requested',
        notes: rideData.notes || null,
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
      const nearbyDrivers = findNearbyDrivers(
        rideData.pickup_latitude, 
        rideData.pickup_longitude, 
        5.0 // 5km radius
      );

      console.log(`📍 Found ${nearbyDrivers.length} nearby drivers`);

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
          const driverDistance = driverInfo.distance;
          const estimatedArrival = Math.round(driverDistance * 2); // Rough estimate: 2 minutes per km
          
          io.to(driver.socketId).emit('ride_request', {
            ...ride,
            estimated_arrival: `${estimatedArrival} minutes`,
            driver_distance: driverDistance.toFixed(2)
          });
          requestsSent++;
        }
      });

      console.log(`📤 Ride request sent to ${requestsSent} drivers`);

      // Set timeout for ride request (5 minutes)
      setTimeout(() => {
        const currentRide = pendingRides.get(rideId);
        if (currentRide && currentRide.status === 'requested') {
          console.log(`⏰ Ride ${rideId} timed out - no driver accepted`);
          pendingRides.delete(rideId);
          
          socket.emit('ride_timeout', {
            ride_id: rideId,
            message: 'No driver accepted your ride request',
            timestamp: new Date().toISOString()
          });
        }
      }, 5 * 60 * 1000); // 5 minutes

    } catch (error) {
      console.error('Error processing ride request:', error);
      socket.emit('error', { 
        message: 'Failed to process ride request',
        error: error.message 
      });
    }
  });

  // ========================================
  // RIDE ACCEPTANCE
  // ========================================
  
  socket.on('ride_accept', (data) => {
    try {
      console.log(`✅ Driver ${data.driver_id} accepting ride ${data.ride_id}`);
      
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

      const driver = activeDrivers.get(driverId);
      
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

      // Notify passenger that ride was accepted with driver details
      io.emit('ride_accepted', {
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
      });

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

      console.log(`✅ Ride ${rideId} accepted by driver ${driverId}`);

    } catch (error) {
      console.error('Error accepting ride:', error);
      socket.emit('error', { message: 'Failed to accept ride' });
    }
  });

  // ========================================
  // RIDE REJECTION
  // ========================================
  
  socket.on('ride_reject', (data) => {
    try {
      console.log(`❌ Driver ${data.driver_id} rejecting ride ${data.ride_id}`);
      
      const driverId = data.driver_id;
      const rideId = data.ride_id;
      
      const ride = pendingRides.get(rideId);
      if (ride && ride.status === 'requested') {
        // Find other nearby drivers and send the request to them
        const nearbyDrivers = findNearbyDrivers(
          ride.pickup_latitude, 
          ride.pickup_longitude, 
          5.0
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

        console.log(`📤 Ride request forwarded to ${requestsSent} other drivers`);
      }

      // Notify driver of rejection
      socket.emit('ride_rejected_confirmation', {
        ride_id: rideId,
        status: 'success',
        message: 'Ride rejected successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error rejecting ride:', error);
      socket.emit('error', { message: 'Failed to reject ride' });
    }
  });

  // ========================================
  // RIDE START
  // ========================================
  
  socket.on('ride_start', (data) => {
    try {
      console.log(`🚗 Driver ${data.driver_id} starting ride ${data.ride_id}`);
      
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
      io.emit('ride_started', {
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

      console.log(`🚗 Ride ${rideId} started by driver ${driverId}`);

    } catch (error) {
      console.error('Error starting ride:', error);
      socket.emit('error', { message: 'Failed to start ride' });
    }
  });

  // ========================================
  // RIDE COMPLETION
  // ========================================
  
  socket.on('ride_complete', (data) => {
    try {
      console.log(`🏁 Driver ${data.driver_id} completing ride ${data.ride_id}`);
      
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

      const driver = activeDrivers.get(driverId);
      
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
      const commission = parseFloat(ride.actual_fare) * 0.15; // 15% commission
      await saveEarningsToDatabase(driverId, rideId, parseFloat(ride.actual_fare), commission);

      // Notify passenger that ride is completed
      io.emit('ride_completed', {
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

      console.log(`🏁 Ride ${rideId} completed by driver ${driverId} - Fare: $${ride.actual_fare}`);

    } catch (error) {
      console.error('Error completing ride:', error);
      socket.emit('error', { message: 'Failed to complete ride' });
    }
  });

  // ========================================
  // RIDE RATING
  // ========================================
  
  socket.on('ride_rating', (data) => {
    try {
      console.log(`⭐ Rating received for ride ${data.ride_id}: ${data.rating} stars`);
      
      const ride = completedRides.get(data.ride_id);
      if (ride) {
        ride.rating = data.rating;
        ride.feedback = data.feedback || null;
        ride.rated_at = new Date().toISOString();
        
        // Update driver rating
        const driver = activeDrivers.get(ride.driver_id);
        if (driver) {
          // Simple average calculation (in production, use more sophisticated algorithm)
          const currentRating = driver.rating || 4.5;
          const totalRides = driver.totalRides;
          driver.rating = ((currentRating * (totalRides - 1)) + data.rating) / totalRides;
        }
        
        // Notify driver of new rating
        io.to(driver.socketId).emit('new_rating', {
          ride_id: data.ride_id,
          rating: data.rating,
          feedback: data.feedback,
          new_average_rating: driver.rating,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error processing rating:', error);
    }
  });

  // ========================================
  // DRIVER STATUS MANAGEMENT
  // ========================================
  
  socket.on('driver_offline', (data) => {
    try {
      console.log(`🔴 Driver ${data.driver_id} going offline`);
      
      const driverId = data.driver_id;
      const driver = activeDrivers.get(driverId);
      
      if (driver) {
        driver.isOnline = false;
        driver.isAvailable = false;
        driver.wentOfflineAt = new Date().toISOString();
        
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
      
    } catch (error) {
      console.error('Error setting driver offline:', error);
    }
  });

  socket.on('driver_available', (data) => {
    try {
      const driverId = data.driver_id;
      const driver = activeDrivers.get(driverId);
      
      if (driver && driver.isOnline) {
        driver.isAvailable = true;
        driver.currentRide = null;
        
        console.log(`🟢 Driver ${driverId} is now available`);
        
        socket.emit('driver_available_confirmation', {
          status: 'success',
          message: 'You are now available for new rides',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error setting driver available:', error);
    }
  });

  // ========================================
  // CONNECTION CLEANUP
  // ========================================
  
  socket.on('disconnect', () => {
    try {
      const driverId = driverSessions.get(socket.id);
      
      if (driverId) {
        console.log(`🔌 Driver ${driverId} disconnected`);
        
        const driver = activeDrivers.get(driverId);
        if (driver) {
          driver.isOnline = false;
          driver.isAvailable = false;
          driver.disconnectedAt = new Date().toISOString();
          
          // If driver was on a ride, handle cancellation
          if (driver.currentRide) {
            const ride = pendingRides.get(driver.currentRide);
            if (ride) {
              ride.status = 'cancelled';
              ride.cancelled_at = new Date().toISOString();
              ride.cancellation_reason = 'Driver disconnected';
              
              io.emit('ride_cancelled', {
                ride_id: driver.currentRide,
                reason: 'Driver disconnected',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
        
        // Clean up session
        driverSessions.delete(socket.id);
        
        // Broadcast driver offline
        io.emit('driver_offline', {
          driver_id: driverId,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// ========================================
// CRON JOBS FOR MAINTENANCE
// ========================================

// Clean up old completed rides every hour
cron.schedule('0 * * * *', () => {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let cleaned = 0;
  
  completedRides.forEach((ride, rideId) => {
    if (new Date(ride.completed_at) < oneDayAgo) {
      completedRides.delete(rideId);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} old completed rides`);
  }
});

// Update driver statistics every 5 minutes
cron.schedule('*/5 * * * *', () => {
  console.log(`📊 System Status: ${activeDrivers.size} active drivers, ${pendingRides.size} pending rides, ${completedRides.size} completed rides`);
});

// ========================================
// API ROUTES
// ========================================

app.get('/', (req, res) => {
  res.json({
    message: 'TourTaxi Backend Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    stats: {
      activeDrivers: activeDrivers.size,
      pendingRides: pendingRides.size,
      completedRides: completedRides.size,
      totalConnections: io.engine.clientsCount
    }
  });
});

app.get('/drivers', (req, res) => {
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
    connectedAt: data.connectedAt
  }));
  
  res.json({
    drivers: drivers,
    count: drivers.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/rides', (req, res) => {
  const rides = Array.from(pendingRides.entries()).map(([id, data]) => ({
    ride_id: id,
    ...data
  }));
  
  res.json({
    rides: rides,
    count: rides.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/completed-rides', (req, res) => {
  const rides = Array.from(completedRides.entries()).map(([id, data]) => ({
    ride_id: id,
    ...data
  }));
  
  res.json({
    rides: rides,
    count: rides.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/driver/:driverId', (req, res) => {
  const driverId = req.params.driverId;
  const driver = activeDrivers.get(driverId);
  
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }
  
  res.json({
    driver_id: driverId,
    ...driver
  });
});

app.get('/ride/:rideId', (req, res) => {
  const rideId = req.params.rideId;
  const ride = pendingRides.get(rideId) || completedRides.get(rideId);
  
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found' });
  }
  
  res.json({
    ride_id: rideId,
    ...ride
  });
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🚗 TourTaxi Backend Server Started');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}`);
  console.log(`🔌 Socket.io ready for connections`);
  console.log(`⏰ Cron jobs scheduled for maintenance`);
  console.log(`🗺️  Google Maps API configured for accurate distances`);
  console.log('=====================================');
});