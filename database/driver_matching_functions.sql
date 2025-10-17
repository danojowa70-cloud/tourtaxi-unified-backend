-- Create the missing get_nearby_drivers function that uses active_drivers view
-- This function finds nearby online and available drivers

CREATE OR REPLACE FUNCTION get_nearby_drivers(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10.0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  rating NUMERIC,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_plate TEXT,
  vehicle_info TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  is_online BOOLEAN,
  is_available BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id,
    ad.name,
    ad.phone,
    ad.email,
    ad.rating,
    ad.vehicle_make,
    ad.vehicle_model,
    ad.vehicle_plate,
    ad.vehicle_info,
    dl.latitude,
    dl.longitude,
    ST_Distance(
      ST_MakePoint(lng, lat)::geography,
      ST_MakePoint(dl.longitude, dl.latitude)::geography
    ) / 1000.0 as distance_km,
    ad.is_online,
    ad.is_available,
    ad.last_seen
  FROM active_drivers ad
  JOIN driver_locations dl ON ad.id = dl.driver_id
  WHERE
    ad.is_online = TRUE
    AND ad.is_available = TRUE
    AND ad.last_seen > NOW() - INTERVAL '10 minutes'  -- Driver was active in last 10 minutes
    AND ST_DWithin(
      ST_MakePoint(lng, lat)::geography,
      ST_MakePoint(dl.longitude, dl.latitude)::geography,
      radius_km * 1000  -- Convert km to meters
    )
  ORDER BY distance_km ASC
  LIMIT 20;  -- Return up to 20 nearest drivers
END;
$$ LANGUAGE plpgsql;

-- Create an index for better performance on active_drivers queries
CREATE INDEX IF NOT EXISTS idx_active_drivers_online_available 
ON active_drivers (is_online, is_available, last_seen) 
WHERE is_online = TRUE AND is_available = TRUE;

-- Create an index for better performance on driver_locations
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id 
ON driver_locations (driver_id);

-- Create a spatial index for better geographic queries
CREATE INDEX IF NOT EXISTS idx_driver_locations_geom 
ON driver_locations USING GIST (ST_MakePoint(longitude, latitude));

-- Function to get driver count in an area (useful for analytics)
CREATE OR REPLACE FUNCTION get_driver_count_in_area(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10.0
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM active_drivers ad
    JOIN driver_locations dl ON ad.id = dl.driver_id
    WHERE
      ad.is_online = TRUE
      AND ad.is_available = TRUE
      AND ad.last_seen > NOW() - INTERVAL '10 minutes'
      AND ST_DWithin(
        ST_MakePoint(lng, lat)::geography,
        ST_MakePoint(dl.longitude, dl.latitude)::geography,
        radius_km * 1000
      )
  );
END;
$$ LANGUAGE plpgsql;

-- Function for drivers to update their online status
CREATE OR REPLACE FUNCTION update_driver_online_status(
  driver_id UUID,
  online_status BOOLEAN,
  available_status BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
BEGIN
  -- Update the active_drivers view/table
  UPDATE active_drivers 
  SET 
    is_online = online_status,
    is_available = available_status,
    last_seen = NOW(),
    updated_at = NOW()
  WHERE id = driver_id;
  
  -- If no record exists, insert one (in case the driver isn't in active_drivers yet)
  IF NOT FOUND THEN
    INSERT INTO active_drivers (id, is_online, is_available, last_seen, created_at, updated_at)
    VALUES (driver_id, online_status, available_status, NOW(), NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      is_online = online_status,
      is_available = available_status,
      last_seen = NOW(),
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update driver location and keep them active
CREATE OR REPLACE FUNCTION update_driver_location_and_status(
  driver_id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  heading_val DOUBLE PRECISION DEFAULT 0.0,
  speed_val DOUBLE PRECISION DEFAULT 0.0
)
RETURNS VOID AS $$
BEGIN
  -- Update driver location
  INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed, updated_at)
  VALUES (driver_id, lat, lng, heading_val, speed_val, NOW())
  ON CONFLICT (driver_id) DO UPDATE SET
    latitude = lat,
    longitude = lng,
    heading = heading_val,
    speed = speed_val,
    updated_at = NOW();
  
  -- Update last_seen in active_drivers to keep them active
  UPDATE active_drivers 
  SET 
    last_seen = NOW(),
    updated_at = NOW()
  WHERE id = driver_id;
END;
$$ LANGUAGE plpgsql;