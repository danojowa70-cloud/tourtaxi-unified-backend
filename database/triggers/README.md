# Driver Online Status Trigger

This directory contains the SQL trigger that automatically logs driver online/offline status changes to the `ride_events` table for real-time monitoring and synchronization between driver and passenger apps.

## Overview

When a driver changes their status from offline to online (or vice versa), an entry is automatically created in the `ride_events` table with:
- `ride_id`: NULL (not associated with a specific ride)
- `actor`: 'driver'
- `event_type`: 'driver:online' or 'driver:offline'
- `payload`: JSON object containing driver details and status
- `created_at`: Current timestamp

## Installation

### Step 1: Run the SQL Script

1. Open your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the content of `driver_online_trigger.sql`
4. Execute the script

### Step 2: Verify Installation

Run this query to check if the trigger was created successfully:

```sql
-- Check if the function exists
SELECT proname FROM pg_proc WHERE proname = 'handle_driver_online_status';

-- Check if the trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'driver_online_status_trigger';
```

## Testing

### Test the Trigger

1. Find a driver ID from your drivers table:
```sql
SELECT id, name, is_online FROM drivers LIMIT 1;
```

2. Update the driver's online status:
```sql
UPDATE drivers SET is_online = true WHERE id = 'your-driver-id-here';
```

3. Check if the event was logged:
```sql
SELECT * FROM ride_events 
WHERE event_type = 'driver:online' 
ORDER BY created_at DESC LIMIT 5;
```

### Expected Output

When a driver goes online, you should see an entry like:

```json
{
  "ride_id": null,
  "actor": "driver",
  "event_type": "driver:online",
  "payload": {
    "driver_id": "uuid-here",
    "driver_name": "John Doe",
    "driver_phone": "+1234567890",
    "vehicle_type": "Sedan",
    "vehicle_number": "ABC-123",
    "rating": 4.5,
    "total_rides": 42,
    "status": "online",
    "timestamp": "2024-01-01T12:00:00.000Z"
  },
  "created_at": "2024-01-01T12:00:00.000Z"
}
```

## Integration with Your Backend

### Real-time Notifications

Your backend can listen for these events and broadcast them to passenger apps:

```javascript
// Example Node.js/Socket.io implementation
supabase
  .from('ride_events')
  .on('INSERT', (payload) => {
    if (payload.new.event_type === 'driver:online') {
      // Broadcast to passenger apps that a new driver is online
      io.emit('driver:status:change', {
        type: 'online',
        driver: payload.new.payload
      });
    }
  })
  .subscribe();
```

### Monitoring and Analytics

Query driver activity patterns:

```sql
-- Count online/offline events by driver
SELECT 
  payload->>'driver_id' as driver_id,
  payload->>'driver_name' as driver_name,
  event_type,
  COUNT(*) as event_count
FROM ride_events 
WHERE event_type IN ('driver:online', 'driver:offline')
GROUP BY payload->>'driver_id', payload->>'driver_name', event_type
ORDER BY event_count DESC;

-- Get driver activity for today
SELECT 
  payload->>'driver_name' as driver_name,
  event_type,
  created_at
FROM ride_events 
WHERE event_type IN ('driver:online', 'driver:offline')
  AND DATE(created_at) = CURRENT_DATE
ORDER BY created_at DESC;
```

## Customization

### Modify Payload Data

To include additional driver information in the payload, edit the `jsonb_build_object` calls in the trigger function:

```sql
jsonb_build_object(
  'driver_id', NEW.id,
  'driver_name', NEW.name,
  -- Add more fields here
  'location_lat', NEW.current_latitude,
  'location_lng', NEW.current_longitude,
  'custom_field', NEW.custom_field
)
```

### Add More Event Types

You can extend the trigger to log other driver state changes:

```sql
-- Example: Log when driver updates their location
IF (OLD.current_latitude != NEW.current_latitude OR OLD.current_longitude != NEW.current_longitude) THEN
  INSERT INTO ride_events (...) VALUES (..., 'driver:location_update', ...);
END IF;
```

## Troubleshooting

### Trigger Not Firing

1. Check if the trigger exists:
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'driver_online_status_trigger';
```

2. Verify the function exists:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'handle_driver_online_status';
```

### Permission Issues

If you get permission errors, grant the necessary permissions:

```sql
GRANT EXECUTE ON FUNCTION handle_driver_online_status() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_driver_online_status() TO service_role;
```

### Debug the Trigger

Add logging to the trigger function:

```sql
-- Add at the beginning of the function
RAISE NOTICE 'Trigger fired for driver: %, old status: %, new status: %', 
  NEW.id, OLD.is_online, NEW.is_online;
```

## Performance Considerations

- The trigger adds minimal overhead to driver status updates
- Consider adding an index on `ride_events(event_type, created_at)` for better query performance:

```sql
CREATE INDEX idx_ride_events_driver_status 
ON ride_events(event_type, created_at) 
WHERE event_type IN ('driver:online', 'driver:offline');
```

## Security

- The trigger runs with `SECURITY DEFINER`, ensuring it has the necessary permissions
- The trigger only logs status changes, it doesn't modify other data
- Consider Row Level Security (RLS) policies on the `ride_events` table if needed

## Maintenance

- Monitor the size of the `ride_events` table over time
- Consider implementing data archiving for old events
- Review trigger performance periodically as your driver base grows