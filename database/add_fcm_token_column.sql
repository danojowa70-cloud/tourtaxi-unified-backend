-- Add FCM token column to drivers table
-- Run this in your Supabase SQL editor

-- Add fcm_token column to drivers table
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Create index for FCM token lookups
CREATE INDEX IF NOT EXISTS idx_drivers_fcm_token ON drivers(fcm_token);

-- Update the drivers table comment
COMMENT ON COLUMN drivers.fcm_token IS 'Firebase Cloud Messaging token for push notifications';