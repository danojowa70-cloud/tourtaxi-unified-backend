#!/usr/bin/env node

const io = require('socket.io-client');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'https://tourtaxi-unified-backend.onrender.com';
// For local testing, use: const SERVER_URL = 'http://localhost:10000';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        🚕 TourTaxi Test Passenger App                     ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`📡 Connecting to: ${SERVER_URL}`);
console.log('');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let socket;
let passengerId = uuidv4(); // Generate a valid UUID
let isConnected = false;

// Connect to backend
socket = io(SERVER_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Socket event handlers
socket.on('connect', () => {
  console.log('✅ Connected to backend');
  console.log(`   Socket ID: ${socket.id}`);
  console.log('');
  
  // Connect as passenger
  console.log('📱 Connecting as passenger...');
  socket.emit('connect_passenger', {
    passenger_id: passengerId,
    name: 'Test Passenger',
    phone: '+1234567890',
    email: 'test@passenger.com'
  });
});

socket.on('passenger_connected', (data) => {
  console.log('✅ Passenger connected successfully!');
  console.log(`   Passenger ID: ${data.passenger_id}`);
  console.log('');
  isConnected = true;
  showMenu();
});

socket.on('ride_request_submitted', (data) => {
  console.log('');
  console.log('✅ RIDE REQUEST SUBMITTED!');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`   Ride ID: ${data.ride_id}`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Message: ${data.message}`);
  console.log(`   Fare: ₹${data.estimated_fare}`);
  console.log(`   Distance: ${data.distance}`);
  console.log(`   Duration: ${data.duration}`);
  console.log('═════════════════════════════════════════════════════════');
  console.log('');
  console.log('👀 Now check the driver app for ride request notification!');
  console.log('');
  setTimeout(() => showMenu(), 1000);
});

socket.on('ride_request_failed', (data) => {
  console.log('');
  console.log('❌ RIDE REQUEST FAILED!');
  console.log(`   Error: ${data.error}`);
  console.log(`   Message: ${data.message}`);
  console.log('');
  setTimeout(() => showMenu(), 1000);
});

socket.on('no_drivers_available', (data) => {
  console.log('');
  console.log('⚠️  NO DRIVERS AVAILABLE');
  console.log(`   Message: ${data.message}`);
  console.log('');
  console.log('💡 Make sure:');
  console.log('   1. Driver app is running and connected');
  console.log('   2. Driver status is "Online" and "Available"');
  console.log('   3. Driver is within 5km of pickup location');
  console.log('');
  setTimeout(() => showMenu(), 1000);
});

socket.on('ride_accepted', (data) => {
  console.log('');
  console.log('🎉 RIDE ACCEPTED BY DRIVER!');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`   Driver: ${data.driver_name}`);
  console.log(`   Phone: ${data.driver_phone}`);
  console.log(`   Vehicle: ${data.driver_vehicle} (${data.driver_vehicle_number})`);
  console.log(`   Rating: ${data.driver_rating} ⭐`);
  console.log(`   ETA: ${data.driver_to_pickup_duration || 'Calculating...'}`);
  console.log('═════════════════════════════════════════════════════════');
  console.log('');
});

socket.on('error', (error) => {
  console.log('❌ Error:', error.message || error);
});

socket.on('disconnect', (reason) => {
  console.log(`\n🔌 Disconnected: ${reason}`);
  isConnected = false;
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
  console.log('');
  console.log('🔍 Troubleshooting:');
  console.log('   - Check if backend is running');
  console.log('   - Verify SERVER_URL is correct');
  console.log('   - Check internet connection');
});

// Menu system
function showMenu() {
  if (!isConnected) {
    console.log('⏳ Waiting for connection...');
    return;
  }
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  MENU - Choose an action:                                 ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  1. Send test ride request (Delhi to Noida)               ║');
  console.log('║  2. Send custom ride request                              ║');
  console.log('║  3. Get nearby drivers                                    ║');
  console.log('║  4. Exit                                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  rl.question('Enter your choice (1-4): ', (answer) => {
    console.log('');
    handleMenuChoice(answer.trim());
  });
}

function handleMenuChoice(choice) {
  switch(choice) {
    case '1':
      sendTestRideRequest();
      break;
    case '2':
      sendCustomRideRequest();
      break;
    case '3':
      getNearbyDrivers();
      break;
    case '4':
      console.log('👋 Goodbye!');
      socket.disconnect();
      process.exit(0);
      break;
    default:
      console.log('❌ Invalid choice. Please try again.\n');
      showMenu();
  }
}

function sendTestRideRequest() {
  console.log('📤 Sending test ride request...');
  console.log('   Pickup: Connaught Place, New Delhi (28.6139, 77.2090)');
  console.log('   Destination: Sector 18, Noida (28.5355, 77.3910)');
  console.log('');
  
  const rideRequest = {
    passenger_id: passengerId,
    passenger_name: 'Test Passenger',
    passenger_phone: '+1234567890',
    passenger_email: 'test@passenger.com',
    pickup_latitude: 28.6139,
    pickup_longitude: 77.2090,
    pickup_address: 'Connaught Place, New Delhi, Delhi 110001, India',
    destination_latitude: 28.5355,
    destination_longitude: 77.3910,
    destination_address: 'Sector 18, Noida, Uttar Pradesh 201301, India',
    notes: 'Test ride request from test passenger app',
    // No vehicle_type specified = matches any driver
  };
  
  socket.emit('ride_request', rideRequest);
}

function sendCustomRideRequest() {
  console.log('📝 Custom Ride Request');
  console.log('');
  
  rl.question('Pickup Latitude (e.g., 28.6139): ', (pickupLat) => {
    rl.question('Pickup Longitude (e.g., 77.2090): ', (pickupLng) => {
      rl.question('Pickup Address: ', (pickupAddr) => {
        rl.question('Destination Latitude (e.g., 28.5355): ', (destLat) => {
          rl.question('Destination Longitude (e.g., 77.3910): ', (destLng) => {
            rl.question('Destination Address: ', (destAddr) => {
              rl.question('Vehicle Type (car/bike/suv or press Enter for any): ', (vehicleType) => {
                console.log('');
                console.log('📤 Sending custom ride request...');
                
                const rideRequest = {
                  passenger_id: passengerId,
                  passenger_name: 'Test Passenger',
                  passenger_phone: '+1234567890',
                  passenger_email: 'test@passenger.com',
                  pickup_latitude: parseFloat(pickupLat),
                  pickup_longitude: parseFloat(pickupLng),
                  pickup_address: pickupAddr,
                  destination_latitude: parseFloat(destLat),
                  destination_longitude: parseFloat(destLng),
                  destination_address: destAddr,
                  notes: 'Custom ride request from test passenger app'
                };
                
                if (vehicleType.trim()) {
                  rideRequest.vehicle_type = vehicleType.trim();
                }
                
                socket.emit('ride_request', rideRequest);
              });
            });
          });
        });
      });
    });
  });
}

function getNearbyDrivers() {
  console.log('🔍 Finding nearby drivers...');
  console.log('   Location: Connaught Place, New Delhi (28.6139, 77.2090)');
  console.log('   Radius: 5 km');
  console.log('');
  
  socket.emit('get_nearby_drivers', {
    latitude: 28.6139,
    longitude: 77.2090,
    radius: 5.0
  });
  
  socket.once('nearby_drivers', (data) => {
    console.log(`✅ Found ${data.count} nearby driver(s):`);
    console.log('');
    
    if (data.count === 0) {
      console.log('   No drivers available in this area.');
      console.log('');
      showMenu();
      return;
    }
    
    data.drivers.forEach((driver, index) => {
      console.log(`   ${index + 1}. ${driver.name}`);
      console.log(`      Vehicle: ${driver.vehicle_type} (${driver.vehicle_number})`);
      console.log(`      Rating: ${driver.rating} ⭐`);
      console.log(`      Distance: ${driver.distance.toFixed(2)} km`);
      console.log(`      ETA: ~${driver.estimated_arrival} minutes`);
      console.log('');
    });
    
    showMenu();
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Disconnecting...');
  socket.disconnect();
  rl.close();
  process.exit(0);
});

// Auto-cleanup after 5 minutes of inactivity
setTimeout(() => {
  console.log('\n⏱️  Session timeout (5 minutes). Disconnecting...');
  socket.disconnect();
  process.exit(0);
}, 5 * 60 * 1000);
