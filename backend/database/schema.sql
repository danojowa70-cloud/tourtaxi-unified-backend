-- TourTaxi Driver App Database Schema
-- Run this in your Supabase SQL editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    profile_image TEXT,
    vehicle_type VARCHAR(50) DEFAULT 'Sedan',
    vehicle_number VARCHAR(20),
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    license_number VARCHAR(50),
    license_expiry DATE,
    insurance_number VARCHAR(50),
    insurance_expiry DATE,
    rating DECIMAL(3,2) DEFAULT 4.5,
    total_rides INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT FALSE,
    current_latitude DECIMAL(10,8),
    current_longitude DECIMAL(11,8),
    last_location_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rides table
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    passenger_id VARCHAR(255) NOT NULL,
    passenger_name VARCHAR(255) NOT NULL,
    passenger_phone VARCHAR(20) NOT NULL,
    passenger_image TEXT,
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    pickup_address TEXT NOT NULL,
    destination_latitude DECIMAL(10,8) NOT NULL,
    destination_longitude DECIMAL(11,8) NOT NULL,
    destination_address TEXT NOT NULL,
    distance DECIMAL(8,2) NOT NULL,
    distance_text VARCHAR(50),
    duration INTEGER NOT NULL,
    duration_text VARCHAR(50),
    fare DECIMAL(8,2) NOT NULL,
    actual_fare DECIMAL(8,2),
    route_polyline TEXT,
    driver_to_pickup_polyline TEXT,
    driver_to_pickup_distance VARCHAR(50),
    driver_to_pickup_duration VARCHAR(50),
    status VARCHAR(20) DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'started', 'completed', 'cancelled')),
    notes TEXT,
    cancellation_reason TEXT,
    rating DECIMAL(3,2),
    feedback TEXT,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create earnings table
CREATE TABLE IF NOT EXISTS earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    amount DECIMAL(8,2) NOT NULL,
    commission DECIMAL(8,2) DEFAULT 0.00,
    net_amount DECIMAL(8,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
    payment_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create driver_locations table for location history
CREATE TABLE IF NOT EXISTS driver_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    accuracy DECIMAL(8,2),
    speed DECIMAL(8,2),
    heading DECIMAL(8,2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers(email);
CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(is_online);
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(is_available);
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(current_latitude, current_longitude);

CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_passenger_id ON rides(passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON rides(created_at);
CREATE INDEX IF NOT EXISTS idx_rides_requested_at ON rides(requested_at);

CREATE INDEX IF NOT EXISTS idx_earnings_driver_id ON earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_earnings_ride_id ON earnings(ride_id);
CREATE INDEX IF NOT EXISTS idx_earnings_created_at ON earnings(created_at);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_timestamp ON driver_locations(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample driver for testing
INSERT INTO drivers (
    email, 
    password_hash, 
    name, 
    phone, 
    vehicle_type, 
    vehicle_number,
    rating,
    total_rides,
    total_earnings,
    is_verified,
    is_active
) VALUES (
    'driver@tourtaxi.com',
    '$2a$10$example_hash_here', -- Replace with actual hash
    'John Doe',
    '+1234567890',
    'Sedan',
    'ABC-123',
    4.8,
    150,
    2500.00,
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- Create views for common queries
CREATE OR REPLACE VIEW active_drivers AS
SELECT 
    id,
    name,
    phone,
    vehicle_type,
    vehicle_number,
    rating,
    total_rides,
    total_earnings,
    is_online,
    is_available,
    current_latitude,
    current_longitude,
    last_location_update
FROM drivers 
WHERE is_active = true;

CREATE OR REPLACE VIEW driver_earnings_summary AS
SELECT 
    d.id,
    d.name,
    d.phone,
    COUNT(e.id) as total_rides,
    COALESCE(SUM(e.net_amount), 0) as total_earnings,
    COALESCE(AVG(e.net_amount), 0) as average_earnings_per_ride,
    MAX(e.created_at) as last_earning_date
FROM drivers d
LEFT JOIN earnings e ON d.id = e.driver_id
WHERE d.is_active = true
GROUP BY d.id, d.name, d.phone;

-- Enable Row Level Security (RLS)
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth requirements)
-- For now, allowing all operations - customize based on your needs
CREATE POLICY "Allow all operations on drivers" ON drivers FOR ALL USING (true);
CREATE POLICY "Allow all operations on rides" ON rides FOR ALL USING (true);
CREATE POLICY "Allow all operations on earnings" ON earnings FOR ALL USING (true);
CREATE POLICY "Allow all operations on driver_locations" ON driver_locations FOR ALL USING (true);

-- Create function to increment driver earnings
CREATE OR REPLACE FUNCTION increment_driver_earnings(driver_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
    UPDATE drivers 
    SET 
        total_earnings = total_earnings + amount,
        total_rides = total_rides + 1,
        updated_at = NOW()
    WHERE id = driver_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to update driver rating
CREATE OR REPLACE FUNCTION update_driver_rating(driver_id UUID, new_rating DECIMAL)
RETURNS VOID AS $$
DECLARE
    current_rating DECIMAL;
    total_rides_count INTEGER;
BEGIN
    SELECT rating, total_rides INTO current_rating, total_rides_count
    FROM drivers WHERE id = driver_id;
    
    -- Calculate new average rating
    UPDATE drivers 
    SET 
        rating = ((current_rating * (total_rides_count - 1)) + new_rating) / total_rides_count,
        updated_at = NOW()
    WHERE id = driver_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get nearby drivers
CREATE OR REPLACE FUNCTION get_nearby_drivers(
    lat DECIMAL,
    lng DECIMAL,
    radius_km DECIMAL DEFAULT 5.0
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    phone VARCHAR,
    vehicle_type VARCHAR,
    vehicle_number VARCHAR,
    rating DECIMAL,
    distance_km DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.name,
        d.phone,
        d.vehicle_type,
        d.vehicle_number,
        d.rating,
        (6371 * acos(
            cos(radians(lat)) * 
            cos(radians(d.current_latitude)) * 
            cos(radians(d.current_longitude) - radians(lng)) + 
            sin(radians(lat)) * 
            sin(radians(d.current_latitude))
        )) AS distance_km
    FROM drivers d
    WHERE 
        d.is_active = true 
        AND d.is_online = true 
        AND d.is_available = true
        AND d.current_latitude IS NOT NULL 
        AND d.current_longitude IS NOT NULL
        AND (6371 * acos(
            cos(radians(lat)) * 
            cos(radians(d.current_latitude)) * 
            cos(radians(d.current_longitude) - radians(lng)) + 
            sin(radians(lat)) * 
            sin(radians(d.current_latitude))
        )) <= radius_km
    ORDER BY distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
