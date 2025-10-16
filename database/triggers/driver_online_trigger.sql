-- ============================================================================
-- Driver Online Status Trigger
-- ============================================================================
-- This trigger automatically creates entries in the ride_events table whenever
-- a driver changes their status from offline to online.
-- 
-- Usage: Run this script in your Supabase SQL editor to create the trigger
-- ============================================================================

-- Drop existing trigger and function if they exist (for updates)
DROP TRIGGER IF EXISTS driver_online_status_trigger ON drivers;
DROP FUNCTION IF EXISTS handle_driver_online_status();

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_driver_online_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the driver's online status changed from false to true
  IF (OLD.is_online = false AND NEW.is_online = true) THEN
    
    -- Insert event into ride_events table
    INSERT INTO ride_events (
      ride_id,
      actor,
      event_type,
      payload,
      created_at
    ) VALUES (
      NULL,                           -- No specific ride associated
      'driver',                       -- Actor type
      'driver:online',               -- Event type
      jsonb_build_object(
        'driver_id', NEW.id,
        'driver_name', NEW.name,
        'driver_phone', NEW.phone,
        'vehicle_type', NEW.vehicle_type,
        'vehicle_number', NEW.vehicle_number,
        'rating', NEW.rating,
        'total_rides', NEW.total_rides,
        'status', CASE WHEN NEW.is_online THEN 'online' ELSE 'offline' END,
        'timestamp', NOW()
      ),                              -- Payload with driver details
      NOW()                           -- Created at timestamp
    );
    
  END IF;
  
  -- Also log when driver goes offline for complete tracking
  IF (OLD.is_online = true AND NEW.is_online = false) THEN
    
    INSERT INTO ride_events (
      ride_id,
      actor,
      event_type,
      payload,
      created_at
    ) VALUES (
      NULL,
      'driver',
      'driver:offline',
      jsonb_build_object(
        'driver_id', NEW.id,
        'driver_name', NEW.name,
        'driver_phone', NEW.phone,
        'vehicle_type', NEW.vehicle_type,
        'vehicle_number', NEW.vehicle_number,
        'rating', NEW.rating,
        'total_rides', NEW.total_rides,
        'status', CASE WHEN NEW.is_online THEN 'online' ELSE 'offline' END,
        'timestamp', NOW()
      ),
      NOW()
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER driver_online_status_trigger
  AFTER UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION handle_driver_online_status();

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT EXECUTE ON FUNCTION handle_driver_online_status() TO authenticated;
-- GRANT EXECUTE ON FUNCTION handle_driver_online_status() TO service_role;

-- ============================================================================
-- Verification Queries (Optional - for testing)
-- ============================================================================

-- Test the trigger by updating a driver's status
-- UPDATE drivers SET is_online = true WHERE id = 'your-driver-id';

-- Check if events were created
-- SELECT * FROM ride_events WHERE event_type IN ('driver:online', 'driver:offline') ORDER BY created_at DESC LIMIT 10;

-- View driver status change events with details
-- SELECT 
--   event_type,
--   payload->>'driver_id' as driver_id,
--   payload->>'driver_name' as driver_name,
--   payload->>'status' as status,
--   created_at
-- FROM ride_events 
-- WHERE event_type IN ('driver:online', 'driver:offline')
-- ORDER BY created_at DESC;