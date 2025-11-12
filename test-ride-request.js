const io = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

const passengerId = uuidv4();

console.log('🚀 Starting Ride Request Test...\n');
console.log(`   Passenger ID: ${passengerId}\n`);

// Connect to backend
const socket = io('https://tourtaxi-unified-backend.onrender.com', {
  transports: ['websocket', 'polling'],
  reconnection: true
});

socket.on('connect', () => {
  console.log('✅ Connected to backend');
  console.log(`   Socket ID: ${socket.id}\n`);
  
  // Step 1: Connect as passenger
  console.log('📱 Step 1: Connecting as passenger...');
  socket.emit('connect_passenger', {
    passenger_id: passengerId,
    name: 'Test Passenger',
    phone: '+1234567890',
    email: 'test@passenger.com'
  });
});

socket.on('passenger_connected', (data) => {
  console.log('✅ Passenger connected successfully');
  console.log(`   Data:`, data);
  console.log('');
  
  // Step 2: Wait 2 seconds then send ride request
  setTimeout(() => {
    console.log('🚕 Step 2: Sending ride request...');
    console.log('   Pickup: 28.6139, 77.2090 (Delhi)');
    console.log('   Destination: 28.5355, 77.3910 (Noida)');
    console.log('');
    
    socket.emit('ride_request', {
      passenger_id: passengerId,
      passenger_name: 'Test Passenger',
      passenger_phone: '+1234567890',
      passenger_email: 'test@passenger.com',
      pickup_latitude: 28.6139,
      pickup_longitude: 77.2090,
      pickup_address: '123 Test Street, Connaught Place, New Delhi',
      destination_latitude: 28.5355,
      destination_longitude: 77.3910,
      destination_address: '456 Dest Avenue, Sector 18, Noida',
      notes: 'Test ride request from script'
      // No vehicle_type filter - should match any driver
    });
  }, 2000);
});

socket.on('ride_request_submitted', (data) => {
  console.log('✅ Ride request submitted successfully!');
  console.log(`   Ride ID: ${data.ride_id}`);
  console.log(`   Message: ${data.message}`);
  console.log(`   Fare: ${data.estimated_fare}`);
  console.log(`   Distance: ${data.distance}`);
  console.log(`   Duration: ${data.duration}`);
  console.log('');
  console.log('✅ TEST PASSED: Ride request was processed by backend');
  console.log('');
  console.log('📊 Now check:');
  console.log('   1. Render logs for "Ride request sent to driver"');
  console.log('   2. Driver app should receive ride request popup');
  console.log('   3. GET https://tourtaxi-unified-backend.onrender.com/api/drivers');
  console.log('   4. GET https://tourtaxi-unified-backend.onrender.com/api/rides');
  console.log('');
  
  // Keep connection open for 10 seconds
  setTimeout(() => {
    console.log('⏱️  Test complete. Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 10000);
});

socket.on('ride_request_failed', (data) => {
  console.log('❌ Ride request failed!');
  console.log(`   Ride ID: ${data.ride_id}`);
  console.log(`   Error: ${data.error}`);
  console.log(`   Message: ${data.message}`);
  console.log('');
  console.log('🔍 Check backend logs for detailed error');
  socket.disconnect();
  process.exit(1);
});

socket.on('no_drivers_available', (data) => {
  console.log('⚠️  No drivers available');
  console.log(`   Ride ID: ${data.ride_id}`);
  console.log(`   Message: ${data.message}`);
  console.log('');
  console.log('🔍 This means:');
  console.log('   1. No drivers are online, OR');
  console.log('   2. No drivers within 5km radius, OR');
  console.log('   3. Drivers are in database but not in activeDrivers memory');
  console.log('');
  console.log('✅ Check:');
  console.log('   - GET https://tourtaxi-unified-backend.onrender.com/api/drivers');
  console.log('   - Ensure driver app is online and connected to Render backend');
  console.log('   - Check Render logs for driver connection');
  console.log('');
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('error', (error) => {
  console.log('❌ Socket error:', error);
});

socket.on('disconnect', (reason) => {
  console.log(`\n🔌 Disconnected: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
  console.log('');
  console.log('🔍 Make sure:');
  console.log('   - Backend is running on https://tourtaxi-unified-backend.onrender.com');
  console.log('   - Render service is active and not sleeping');
  console.log('   - Check Render dashboard for service status');
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Test timeout - no response after 30 seconds');
  console.log('🔍 Check if backend is running and passenger events are being processed');
  socket.disconnect();
  process.exit(1);
}, 30000);
