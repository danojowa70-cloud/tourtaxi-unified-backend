-- Update drivers table for production-ready TourTaxi app
-- Run this in your Supabase SQL Editor

-- First, let's check if the drivers table exists and its structure
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'drivers';

-- Drop existing table to recreate with proper structure
DROP TABLE IF EXISTS drivers CASCADE;

-- Create comprehensive drivers table
CREATE TABLE drivers (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT DEFAULT 'Not Specified',
    vehicle_number TEXT DEFAULT 'Not Specified', 
    license_number TEXT DEFAULT 'Not Specified',
    profile_image TEXT,
    is_online BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT false,
    rating DECIMAL(3,2) DEFAULT 5.0,
    total_rides INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.0,
    current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    last_location_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_drivers_email ON drivers(email);
CREATE INDEX idx_drivers_phone ON drivers(phone);
CREATE INDEX idx_drivers_online ON drivers(is_online);
CREATE INDEX idx_drivers_available ON drivers(is_available);
CREATE INDEX idx_drivers_location ON drivers(current_latitude, current_longitude);

-- Create RLS (Row Level Security) policies if needed
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own driver record
CREATE POLICY "Users can read own driver data" ON drivers
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own driver record  
CREATE POLICY "Users can update own driver data" ON drivers
    FOR UPDATE USING (auth.uid() = id);

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON drivers
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT ALL ON drivers TO postgres, anon, authenticated, service_role;

-- Insert a sample driver record for testing (optional - remove in production)
-- INSERT INTO drivers (
--     id, email, name, phone, vehicle_type, vehicle_number, license_number
-- ) VALUES (
--     'ef1d1c44-74c9-4543-b970-2eee7620ed3b',
--     'test@example.com',
--     'Test Driver',
--     '1234567890',
--     'Sedan',
--     'ABC123',
--     'DL12345'
-- );

COMMENT ON TABLE drivers IS 'Driver profiles and information for TourTaxi app';
COMMENT ON COLUMN drivers.id IS 'UUID matching auth.users.id';
COMMENT ON COLUMN drivers.email IS 'Driver email address';
COMMENT ON COLUMN drivers.name IS 'Full name of the driver';
COMMENT ON COLUMN drivers.phone IS 'Phone number for contact';
COMMENT ON COLUMN drivers.vehicle_type IS 'Type of vehicle (Sedan, SUV, etc.)';
COMMENT ON COLUMN drivers.vehicle_number IS 'License plate number';
COMMENT ON COLUMN drivers.license_number IS 'Driver license number';
COMMENT ON COLUMN drivers.is_online IS 'Whether driver is currently online';
COMMENT ON COLUMN drivers.is_available IS 'Whether driver is available for rides';
COMMENT ON COLUMN drivers.rating IS 'Average driver rating (1-5)';
COMMENT ON COLUMN drivers.current_latitude IS 'Current GPS latitude';
COMMENT ON COLUMN drivers.current_longitude IS 'Current GPS longitude';