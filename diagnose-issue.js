const axios = require('axios');

const SERVER_URL = 'https://tourtaxi-unified-backend.onrender.com';

console.log('🔍 TourTaxi Backend Diagnostics\n');
console.log('=' .repeat(60));
console.log(`Server: ${SERVER_URL}\n`);

async function runDiagnostics() {
  try {
    // 1. Check server health
    console.log('1️⃣  Checking server health...');
    const healthResponse = await axios.get(`${SERVER_URL}/health`);
    console.log('   ✅ Server is healthy');
    console.log(`   Environment: ${healthResponse.data.environment}`);
    console.log(`   Supabase Connected: ${healthResponse.data.supabaseConnected}`);
    console.log('');

    // 2. Check system status
    console.log('2️⃣  Checking system status...');
    const statusResponse = await axios.get(`${SERVER_URL}/status`);
    console.log('   ✅ System status retrieved');
    console.log(`   Active Drivers: ${statusResponse.data.stats.activeDrivers}`);
    console.log(`   Active Passengers: ${statusResponse.data.stats.activePassengers}`);
    console.log(`   Pending Rides: ${statusResponse.data.stats.pendingRides}`);
    console.log('');

    // 3. Get all drivers
    console.log('3️⃣  Fetching all active drivers...');
    const driversResponse = await axios.get(`${SERVER_URL}/api/drivers`);
    const drivers = driversResponse.data.drivers;
    console.log(`   ✅ Found ${drivers.length} driver(s)`);
    
    if (drivers.length === 0) {
      console.log('   ⚠️  NO DRIVERS ONLINE!');
      console.log('   📱 Make sure the driver app is:');
      console.log('      - Running and connected');
      console.log('      - Connected to the correct backend URL');
      console.log('      - Has internet connectivity');
      console.log('      - Location permissions enabled');
      console.log('');
      return;
    }

    // 4. Check each driver's socket status
    console.log('\n4️⃣  Checking driver socket connections...\n');
    for (const driver of drivers) {
      console.log(`   Driver: ${driver.name} (${driver.driver_id})`);
      console.log(`   - Online: ${driver.isOnline}`);
      console.log(`   - Available: ${driver.isAvailable}`);
      console.log(`   - Vehicle: ${driver.vehicle_type} (${driver.vehicle_number})`);
      console.log(`   - Rating: ${driver.rating}`);
      
      try {
        const socketStatus = await axios.get(`${SERVER_URL}/driver/${driver.driver_id}/socket-status`);
        console.log(`   - Socket ID: ${socketStatus.data.socket_id}`);
        console.log(`   - Socket Connected: ${socketStatus.data.socket_connected}`);
        console.log(`   - In Driver Room: ${socketStatus.data.in_driver_room}`);
        console.log(`   - In Available Room: ${socketStatus.data.in_available_room}`);
        console.log(`   - Rooms: ${JSON.stringify(socketStatus.data.rooms)}`);
        
        if (!socketStatus.data.socket_connected) {
          console.log('   ❌ ISSUE: Socket NOT connected!');
        } else if (!socketStatus.data.in_available_room) {
          console.log('   ⚠️  WARNING: Not in "available_drivers" room!');
        } else {
          console.log('   ✅ Socket connection looks good');
        }
      } catch (err) {
        console.log(`   ❌ Failed to get socket status: ${err.message}`);
      }
      console.log('');
    }

    // 5. Summary and recommendations
    console.log('=' .repeat(60));
    console.log('\n📊 DIAGNOSIS SUMMARY:\n');
    
    if (drivers.length === 0) {
      console.log('❌ ROOT CAUSE: No drivers are connected to the backend');
      console.log('');
      console.log('🔧 FIX:');
      console.log('   1. Open the driver app');
      console.log('   2. Ensure it connects to: ' + SERVER_URL);
      console.log('   3. Grant location permissions');
      console.log('   4. Watch the app logs for connection success');
      console.log('   5. Re-run this diagnostic script');
    } else {
      const onlineDrivers = drivers.filter(d => d.isOnline && d.isAvailable);
      console.log(`✅ ${drivers.length} driver(s) found`);
      console.log(`✅ ${onlineDrivers.length} online and available`);
      console.log('');
      console.log('🧪 NEXT STEPS:');
      console.log('   1. Run: node test-ride-request.js');
      console.log('   2. Watch driver app for ride request popup');
      console.log('   3. Check backend logs on Render dashboard');
      console.log('   4. If still not working, check driver app socket listeners');
    }
    
    console.log('');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    console.log('\n🔍 Troubleshooting:');
    console.log('   - Check if backend is deployed and running on Render');
    console.log('   - Verify the SERVER_URL is correct');
    console.log('   - Check Render dashboard for service status');
  }
}

runDiagnostics();
