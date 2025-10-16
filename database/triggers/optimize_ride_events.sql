-- ============================================================================
-- Ride Events Table Optimization
-- ============================================================================
-- This script creates indexes and optimizations for the ride_events table
-- to improve performance when querying driver online/offline events
-- ============================================================================

-- Index for driver status events (online/offline)
-- This will speed up queries filtering by event_type and ordering by created_at
CREATE INDEX IF NOT EXISTS idx_ride_events_driver_status 
ON ride_events (event_type, created_at DESC) 
WHERE event_type IN ('driver:online', 'driver:offline');

-- Index for driver-specific event lookups
-- This will speed up queries filtering by driver_id in the payload
CREATE INDEX IF NOT EXISTS idx_ride_events_driver_id 
ON ride_events USING GIN ((payload->>'driver_id')) 
WHERE event_type IN ('driver:online', 'driver:offline');

-- Composite index for driver events by date range
-- This will speed up queries filtering by both event_type and date
CREATE INDEX IF NOT EXISTS idx_ride_events_status_date 
ON ride_events (event_type, created_at) 
WHERE event_type IN ('driver:online', 'driver:offline');

-- Index for general event_type queries
CREATE INDEX IF NOT EXISTS idx_ride_events_event_type 
ON ride_events (event_type);

-- ============================================================================
-- Performance Analysis Queries
-- ============================================================================

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'ride_events'
ORDER BY idx_tup_read DESC;

-- Check table size and row count
SELECT 
  pg_size_pretty(pg_total_relation_size('ride_events')) as table_size,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE event_type IN ('driver:online', 'driver:offline')) as driver_status_events
FROM ride_events;

-- ============================================================================
-- Sample Optimized Queries
-- ============================================================================

-- Fast query for recent driver status changes (uses idx_ride_events_driver_status)
SELECT 
  payload->>'driver_name' as driver_name,
  event_type,
  created_at
FROM ride_events 
WHERE event_type IN ('driver:online', 'driver:offline')
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- Fast query for specific driver events (uses idx_ride_events_driver_id)
-- Replace 'driver-uuid-here' with actual driver ID
/*
SELECT 
  event_type,
  payload->>'status' as status,
  created_at
FROM ride_events 
WHERE event_type IN ('driver:online', 'driver:offline')
  AND payload->>'driver_id' = 'driver-uuid-here'
ORDER BY created_at DESC
LIMIT 10;
*/

-- Fast aggregation query (uses idx_ride_events_status_date)
SELECT 
  event_type,
  DATE(created_at) as event_date,
  COUNT(*) as count
FROM ride_events 
WHERE event_type IN ('driver:online', 'driver:offline')
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY event_type, DATE(created_at)
ORDER BY event_date DESC, event_type;

-- ============================================================================
-- Maintenance Queries
-- ============================================================================

-- Analyze the table to update query planner statistics
ANALYZE ride_events;

-- Reindex if needed (run during low traffic periods)
-- REINDEX INDEX idx_ride_events_driver_status;
-- REINDEX INDEX idx_ride_events_driver_id;

-- ============================================================================
-- Cleanup Old Events (Optional)
-- ============================================================================
-- Uncomment and modify as needed for your data retention policy

-- Delete driver status events older than 90 days
-- DELETE FROM ride_events 
-- WHERE event_type IN ('driver:online', 'driver:offline')
--   AND created_at < NOW() - INTERVAL '90 days';

-- Archive old events to a separate table (example)
-- CREATE TABLE IF NOT EXISTS ride_events_archive AS TABLE ride_events WITH NO DATA;
-- INSERT INTO ride_events_archive 
-- SELECT * FROM ride_events 
-- WHERE event_type IN ('driver:online', 'driver:offline')
--   AND created_at < NOW() - INTERVAL '90 days';

-- ============================================================================
-- Monitoring Queries
-- ============================================================================

-- Monitor daily driver activity
SELECT 
  DATE(created_at) as activity_date,
  COUNT(DISTINCT payload->>'driver_id') as unique_drivers,
  COUNT(*) FILTER (WHERE event_type = 'driver:online') as online_events,
  COUNT(*) FILTER (WHERE event_type = 'driver:offline') as offline_events
FROM ride_events 
WHERE event_type IN ('driver:online', 'driver:offline')
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY activity_date DESC;

-- Find most active drivers
SELECT 
  payload->>'driver_id' as driver_id,
  payload->>'driver_name' as driver_name,
  COUNT(*) as total_status_changes,
  COUNT(*) FILTER (WHERE event_type = 'driver:online') as online_count,
  COUNT(*) FILTER (WHERE event_type = 'driver:offline') as offline_count,
  MAX(created_at) as last_activity
FROM ride_events 
WHERE event_type IN ('driver:online', 'driver:offline')
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY payload->>'driver_id', payload->>'driver_name'
ORDER BY total_status_changes DESC
LIMIT 20;