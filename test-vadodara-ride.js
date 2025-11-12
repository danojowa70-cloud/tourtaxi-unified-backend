const io = require('socket.io-client');
const { v4: uuidv4 } = require('uuid');

const passengerId = uuidv4();

console.log('🚀 Testing Ride Request for Vadodara Driver...\n');
console.log(`   Passenger ID: ${passengerId}`);
console.log(`   Driver Location: 22.2778737, 73.237282\n`);

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
    phone: '+919876543210',
    email: 'test@passenger.com'
  });
});

socket.on('passenger_connected', (data) => {
  console.log('✅ Passenger connected successfully');
  console.log(`   Data:`, data);
  console.log('');
  
  // Step 2: Wait 2 seconds then send ride request
  setTimeout(() => {
    console.log('🚕 Step 2: Sending ride request NEAR DRIVER LOCATION...');
    console.log('   Pickup: 22.2778737, 73.237282 (Driver location)');
    console.log('   Destination: 22.2870, 73.2470 (1km away)');
    console.log('');
    
    socket.emit('ride_request', {
      passenger_id: passengerId,
      passenger_name: 'Test Passenger',
      passenger_phone: '+919876543210',
      passenger_email: 'test@passenger.com',
      pickup_latitude: 22.2778737,
      pickup_longitude: 73.237282,
      pickup_address: 'Near Driver Location, Vadodara, Gujarat',
      destination_latitude: 22.2870,
      destination_longitude: 73.2470,
      destination_address: 'Destination Point, Vadodara, Gujarat',
      notes: 'Test ride request near driver location (22.2778737, 73.237282)'
      // No vehicle_type filter - should match any driver
    });
  }, 2000);
});

socket.on('ride_request_submitted', (data) => {
  console.log('✅ RIDE REQUEST SUBMITTED SUCCESSFULLY!');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`   Ride ID: ${data.ride_id}`);
  console.log(`   Message: ${data.message}`);
  console.log(`   Fare: ₹${data.estimated_fare}`);
  console.log(`   Distance: ${data.distance}`);
  console.log(`   Duration: ${data.duration}`);
  console.log('═════════════════════════════════════════════════════════');
  console.log('');
  console.log('👀 CHECK DRIVER APP NOW!');
  console.log('   The driver should receive a ride request notification!');
  console.log('');
  
  // Keep connection open for 30 seconds to receive acceptance
  setTimeout(() => {
    console.log('⏱️  Test complete. Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 30000);
});

socket.on('ride_request_failed', (data) => {
  console.log('❌ RIDE REQUEST FAILED!');
  console.log(`   Ride ID: ${data.ride_id}`);
  console.log(`   Error: ${data.error}`);
  console.log(`   Message: ${data.message}`);
  console.log('');
  console.log('🔍 Check backend logs for detailed error');
  socket.disconnect();
  process.exit(1);
});

socket.on('no_drivers_available', (data) => {
  console.log('⚠️  NO DRIVERS AVAILABLE');
  console.log(`   Ride ID: ${data.ride_id}`);
  console.log(`   Message: ${data.message}`);
  console.log('');
  console.log('🔍 This means:');
  console.log('   1. Driver is not online/connected to backend, OR');
  console.log('   2. Driver is outside 5km radius, OR');
  console.log('   3. Driver is busy with another ride');
  console.log('');
  console.log('✅ Next steps:');
  console.log('   - Make sure driver app is running');
  console.log('   - Check driver status is "Online" and "Available"');
  console.log('   - Verify driver location is 22.2778737, 73.237282');
  console.log('   - Run: curl https://tourtaxi-unified-backend.onrender.com/api/drivers');
  console.log('');
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('ride_accepted', (data) => {
  console.log('');
  console.log('🎉🎉🎉 RIDE ACCEPTED BY DRIVER! 🎉🎉🎉');
  console.log('═════════════════════════════════════════════════════════');
  console.log(`   Driver: ${data.driver_name}`);
  console.log(`   Phone: ${data.driver_phone}`);
  console.log(`   Vehicle: ${data.driver_vehicle} (${data.driver_vehicle_number})`);
  console.log(`   Rating: ${data.driver_rating} ⭐`);
  console.log(`   ETA: ${data.driver_to_pickup_duration || 'Calculating...'}`);
  console.log('═════════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ SUCCESS! The fix is working!');
  console.log('');
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 5000);
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

// Timeout after 40 seconds
setTimeout(() => {
  console.log('\n⏱️  Test timeout - no response after 40 seconds');
  console.log('🔍 Check if backend is running and driver is connected');
  socket.disconnect();
  process.exit(1);
}, 40000);
