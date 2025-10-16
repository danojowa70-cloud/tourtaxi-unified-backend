// =============================================================================
// Driver Status Service - Backend Integration
// =============================================================================
// This service handles driver online/offline status changes and automatically
// logs them to the Supabase ride_events table
// =============================================================================

const { createClient } = require('@supabase/supabase-js');

class DriverStatusService {
  constructor(supabaseUrl, supabaseKey) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Log driver status change to ride_events table
   * @param {Object} driverData - Driver information
   * @param {string} status - 'online' or 'offline'
   * @returns {Promise<Object>} Result of the operation
   */
  async logDriverStatusChange(driverData, status) {
    try {
      const eventType = `driver:${status}`;
      
      // Create the event payload with driver information
      const payload = {
        driver_id: driverData.id || driverData.driver_id,
        driver_name: driverData.name,
        driver_phone: driverData.phone,
        vehicle_type: driverData.vehicle_type || driverData.vehicleType,
        vehicle_number: driverData.vehicle_number || driverData.vehicleNumber,
        rating: driverData.rating || 4.5,
        total_rides: driverData.total_rides || driverData.totalRides || 0,
        total_earnings: driverData.total_earnings || driverData.totalEarnings || 0,
        status: status,
        timestamp: new Date().toISOString(),
        location: driverData.location ? {
          latitude: driverData.location.latitude || driverData.latitude,
          longitude: driverData.location.longitude || driverData.longitude
        } : null
      };

      // Insert event into ride_events table
      const { data, error } = await this.supabase
        .from('ride_events')
        .insert({
          ride_id: null, // Not associated with a specific ride
          actor: 'driver',
          event_type: eventType,
          payload: payload,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error logging driver status change:', error);
        throw error;
      }

      console.log(`Successfully logged driver ${status} event for driver: ${driverData.name || driverData.id}`);
      return { success: true, data };

    } catch (error) {
      console.error('Failed to log driver status change:', error);
      throw error;
    }
  }

  /**
   * Update driver status in the drivers table and log the change
   * @param {string} driverId - Driver ID
   * @param {boolean} isOnline - Online status
   * @param {Object} additionalData - Additional driver data for logging
   * @returns {Promise<Object>} Result of the operation
   */
  async updateDriverStatus(driverId, isOnline, additionalData = {}) {
    try {
      // First, get current driver data
      const { data: currentDriver, error: fetchError } = await this.supabase
        .from('drivers')
        .select('*')
        .eq('id', driverId)
        .single();

      if (fetchError) {
        console.error('Error fetching driver data:', fetchError);
        throw fetchError;
      }

      const wasOnline = currentDriver.is_online;
      const nowOnline = isOnline;

      // Only proceed if status actually changed
      if (wasOnline === nowOnline) {
        return { success: true, message: 'No status change detected' };
      }

      // Update driver status in database
      const { data: updatedDriver, error: updateError } = await this.supabase
        .from('drivers')
        .update({ 
          is_online: isOnline,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating driver status:', updateError);
        throw updateError;
      }

      // Merge current driver data with any additional data provided
      const driverData = {
        ...currentDriver,
        ...additionalData,
        id: driverId,
        is_online: isOnline
      };

      // Log the status change
      const status = isOnline ? 'online' : 'offline';
      await this.logDriverStatusChange(driverData, status);

      return { 
        success: true, 
        driver: updatedDriver,
        statusChanged: true,
        previousStatus: wasOnline,
        newStatus: nowOnline
      };

    } catch (error) {
      console.error('Failed to update driver status:', error);
      throw error;
    }
  }

  /**
   * Get recent driver status events
   * @param {string} driverId - Optional driver ID to filter by
   * @param {number} limit - Number of events to return
   * @returns {Promise<Array>} Array of status events
   */
  async getDriverStatusEvents(driverId = null, limit = 10) {
    try {
      let query = this.supabase
        .from('ride_events')
        .select('*')
        .in('event_type', ['driver:online', 'driver:offline'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (driverId) {
        query = query.eq('payload->>driver_id', driverId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching driver status events:', error);
        throw error;
      }

      return data;

    } catch (error) {
      console.error('Failed to fetch driver status events:', error);
      throw error;
    }
  }

  /**
   * Get driver activity analytics
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Object>} Analytics data
   */
  async getDriverActivityAnalytics(days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await this.supabase
        .from('ride_events')
        .select('payload, created_at')
        .in('event_type', ['driver:online', 'driver:offline'])
        .gte('created_at', startDate.toISOString());

      if (error) {
        console.error('Error fetching driver analytics:', error);
        throw error;
      }

      // Process the data to get useful analytics
      const analytics = {
        total_status_changes: data.length,
        unique_drivers: new Set(data.map(event => event.payload.driver_id)).size,
        online_events: data.filter(event => event.payload.status === 'online').length,
        offline_events: data.filter(event => event.payload.status === 'offline').length,
        most_active_drivers: {},
        daily_activity: {}
      };

      // Count events per driver
      data.forEach(event => {
        const driverId = event.payload.driver_id;
        const driverName = event.payload.driver_name;
        
        if (!analytics.most_active_drivers[driverId]) {
          analytics.most_active_drivers[driverId] = {
            name: driverName,
            count: 0
          };
        }
        analytics.most_active_drivers[driverId].count++;
      });

      // Count events per day
      data.forEach(event => {
        const date = new Date(event.created_at).toDateString();
        if (!analytics.daily_activity[date]) {
          analytics.daily_activity[date] = { online: 0, offline: 0 };
        }
        analytics.daily_activity[date][event.payload.status]++;
      });

      return analytics;

    } catch (error) {
      console.error('Failed to fetch driver analytics:', error);
      throw error;
    }
  }
}

module.exports = DriverStatusService;