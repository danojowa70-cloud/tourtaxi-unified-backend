import supabase from '../config/supabase';

export const RidesService = {
  async createRide(passengerId: string, pickup: string, drop: string, pickupLat?: number, pickupLng?: number): Promise<any> {
    // Create the ride first
    const { data: ride, error } = await supabase
      .from('rides')
      .insert({ 
        passenger_id: passengerId, 
        driver_id: null, 
        pickup_location: pickup, 
        drop_location: drop, 
        pickup_latitude: pickupLat,
        pickup_longitude: pickupLng,
        status: 'requested' 
      })
      .select()
      .single();
    if (error) throw error;

    // If we have coordinates, try to find nearby drivers
    if (pickupLat && pickupLng) {
      try {
        const nearbyDrivers = await this.getNearbyDrivers(pickupLat, pickupLng, 10);
        console.log(`Found ${nearbyDrivers.length} nearby drivers for ride ${ride.id}`);
        
        // Here you would typically notify drivers via Socket.IO or push notifications
        // For now, we'll just log that drivers were found
        if (nearbyDrivers.length === 0) {
          console.warn('No drivers available in the area');
        }
      } catch (driverError) {
        console.error('Error finding nearby drivers:', driverError);
      }
    }

    return ride;
  },

  async updateRideStatus(rideId: string, status: string, updates: any = {}): Promise<any> {
    const { data, error } = await supabase
      .from('rides')
      .update({ status, ...updates })
      .eq('id', rideId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPassengerHistory(passengerId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('rides')
      .select(`
        *,
        drivers(
          id,
          name,
          phone,
          vehicle_type,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          vehicle_plate,
          rating,
          is_online,
          is_available
        )
      `)
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []);
  },

  async getRideWithDriver(rideId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('rides')
      .select(`
        *,
        drivers(
          id,
          name,
          phone,
          vehicle_type,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          vehicle_plate,
          rating,
          is_online,
          is_available
        )
      `)
      .eq('id', rideId)
      .single();
    if (error) return null;
    return data;
  },

  async getNearbyDrivers(lat: number, lng: number, radiusKm: number = 10): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_nearby_drivers', {
        lat,
        lng,
        radius_km: radiusKm
      });
    if (error) throw error;
    return data || [];
  },

  async acceptRide(rideId: string, driverId: string): Promise<{ success: boolean; message?: string; ride?: any; driver?: any }> {
    try {
      // Get driver details first
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .single();

      if (driverError || !driverData) {
        return { success: false, message: 'Driver not found' };
      }

      // Check if driver is available
      if (!driverData.is_online || !driverData.is_available) {
        return { success: false, message: 'Driver is not available' };
      }

      // Update ride status and assign driver
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .update({
          driver_id: driverId,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', rideId)
        .eq('status', 'requested') // Only accept if still in requested state
        .select()
        .single();

      if (rideError || !rideData) {
        return { success: false, message: 'Failed to update ride or ride already accepted' };
      }

      // Create ride event for real-time updates to passenger app
      await supabase.from('ride_events').insert({
        ride_id: rideId,
        actor: 'driver',
        event_type: 'ride:accepted',
        payload: {
          driver_id: driverId,
          driver_name: driverData.name || 'Driver',
          driver_phone: driverData.phone || '',
          driver_car: `${driverData.vehicle_make || ''} ${driverData.vehicle_model || ''}`.trim(),
          vehicle_type: driverData.vehicle_type || '',
          vehicle_number: driverData.vehicle_number || '',
          vehicle_plate: driverData.vehicle_plate || '',
          driver_rating: driverData.rating || 4.5,
          driver_data: {
            id: driverId,
            name: driverData.name || 'Driver',
            phone: driverData.phone || '',
            vehicle_make: driverData.vehicle_make || '',
            vehicle_model: driverData.vehicle_model || '',
            vehicle_type: driverData.vehicle_type || '',
            vehicle_number: driverData.vehicle_number || '',
            vehicle_plate: driverData.vehicle_plate || '',
            rating: driverData.rating || 4.5,
          },
        },
      });

      // Generate OTP and persist/broadcast via event
      try {
        const otp = Math.floor(Math.random() * 10000).toString().padStart(4, '0').replace(/^0000$/, '0001');
        await supabase.from('rides').update({ trip_otp: otp }).eq('id', rideId);
        await supabase.from('ride_events').insert({
          ride_id: rideId,
          actor: 'system',
          event_type: 'ride:otp_issued',
          payload: { otp, driver_id: driverId },
          created_at: new Date().toISOString(),
        });
      } catch (_) {}

      // Update driver availability
      await supabase.from('drivers').update({
        is_available: false,
      }).eq('id', driverId);

      return {
        success: true,
        ride: rideData,
        driver: driverData,
      };
    } catch (error: any) {
      console.error('Error accepting ride:', error);
      return { success: false, message: error.message || 'Internal server error' };
    }
  },
};
