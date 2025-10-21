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
};
