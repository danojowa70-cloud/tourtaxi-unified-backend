import { z } from 'zod';

// Driver Types
export const DriverSchema = z.object({
  driver_id: z.string(),
  socketId: z.string(),
  name: z.string(),
  phone: z.string(),
  vehicle_type: z.string().default('Sedan'),
  vehicle_number: z.string(),
  rating: z.number().default(4.5),
  latitude: z.number(),
  longitude: z.number(),
  isOnline: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  currentRide: z.string().nullable().default(null),
  totalRides: z.number().default(0),
  totalEarnings: z.number().default(0),
  lastLocationUpdate: z.string(),
  connectedAt: z.string(),
  profile_image: z.string().optional(),
});

export type Driver = z.infer<typeof DriverSchema>;

// Passenger Types
export const PassengerSchema = z.object({
  passenger_id: z.string(),
  socketId: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  connectedAt: z.string(),
});

export type Passenger = z.infer<typeof PassengerSchema>;

// Location Types
export const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export type Location = z.infer<typeof LocationSchema>;

// Ride Types
export const RideStatusSchema = z.enum([
  'requested',
  'accepted', 
  'driver_arriving',
  'driver_arrived',
  'started',
  'completed',
  'cancelled'
]);

export type RideStatus = z.infer<typeof RideStatusSchema>;

export const RideSchema = z.object({
  ride_id: z.string(),
  passenger_id: z.string(),
  passenger_name: z.string(),
  passenger_phone: z.string(),
  passenger_image: z.string().nullable().optional(),
  pickup_latitude: z.number(),
  pickup_longitude: z.number(),
  pickup_address: z.string(),
  destination_latitude: z.number(),
  destination_longitude: z.number(),
  destination_address: z.string(),
  distance: z.string(),
  distance_text: z.string(),
  duration: z.number(),
  duration_text: z.string(),
  fare: z.string(),
  actual_fare: z.string().nullable().optional(),
  route_polyline: z.string().nullable().optional(),
  route_steps: z.array(z.any()).nullable().optional(),
  status: RideStatusSchema,
  notes: z.string().nullable().optional(),
  requested_at: z.string(),
  driver_id: z.string().nullable().optional(),
  driver_name: z.string().optional(),
  driver_phone: z.string().optional(),
  driver_vehicle: z.string().optional(),
  driver_rating: z.number().optional(),
  driver_vehicle_number: z.string().optional(),
  driver_latitude: z.number().optional(),
  driver_longitude: z.number().optional(),
  driver_to_pickup_polyline: z.string().nullable().optional(),
  driver_to_pickup_distance: z.string().nullable().optional(),
  driver_to_pickup_duration: z.string().nullable().optional(),
  accepted_at: z.string().nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  cancelled_at: z.string().nullable().optional(),
  cancellation_reason: z.string().nullable().optional(),
  rating: z.number().nullable().optional(),
  feedback: z.string().nullable().optional(),
});

export type Ride = z.infer<typeof RideSchema>;

// Request Types
export const RideRequestSchema = z.object({
  passenger_id: z.string(),
  passenger_name: z.string(),
  passenger_phone: z.string(),
  passenger_image: z.string().optional(),
  pickup_latitude: z.number(),
  pickup_longitude: z.number(),
  pickup_address: z.string(),
  destination_latitude: z.number(),
  destination_longitude: z.number(),
  destination_address: z.string(),
  notes: z.string().optional(),
  fare: z.string().optional(),
  ride_id: z.string().optional(),
});

export type RideRequest = z.infer<typeof RideRequestSchema>;

// Driver Connection
export const DriverConnectionSchema = z.object({
  driver_id: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
  vehicle_type: z.string().optional(),
  vehicle_number: z.string().optional(),
  rating: z.number().optional(),
  latitude: z.number(),
  longitude: z.number(),
  total_rides: z.number().optional(),
  total_earnings: z.number().optional(),
});

export type DriverConnection = z.infer<typeof DriverConnectionSchema>;

// Passenger Connection
export const PassengerConnectionSchema = z.object({
  passenger_id: z.string(),
  name: z.string().optional(),
  phone: z.string().optional(),
});

export type PassengerConnection = z.infer<typeof PassengerConnectionSchema>;

// Distance Info
export interface DistanceInfo {
  distance: number;
  duration: number;
  distanceText: string;
  durationText: string;
}

// Route Info
export interface RouteInfo {
  polyline: string;
  distance: number;
  duration: number;
  distanceText: string;
  durationText: string;
  steps: Array<{
    instruction: string;
    distance: string;
    duration: string;
    start_location: { lat: number; lng: number };
    end_location: { lat: number; lng: number };
  }>;
}

// Driver to Pickup Route
export interface DriverToPickupRoute {
  polyline: string;
  distance: number;
  duration: number;
  distanceText: string;
  durationText: string;
  estimated_arrival: number;
}

// Nearby Driver Info
export interface NearbyDriverInfo {
  driver_id: string;
  distance: number;
  rating: number;
  vehicle_type: string;
  name: string;
  phone: string;
  vehicle_number: string;
}

// Socket Event Types
export interface ServerToClientEvents {
  // Driver Events
  driver_connected: (data: { status: string; message: string; driver_id: string; timestamp: string }) => void;
  driver_online: (data: { driver_id: string; name: string; vehicle_type: string; latitude: number; longitude: number; rating: number; timestamp: string }) => void;
  driver_offline: (data: { driver_id: string; timestamp: string }) => void;
  driver_location_update: (data: { driver_id: string; name: string; latitude: number; longitude: number; timestamp: string; isAvailable: boolean }) => void;
  driver_available_confirmation: (data: { status: string; message: string; timestamp: string }) => void;
  
  // Passenger Events
  passenger_connected: (data: { status: string; passenger_id: string; timestamp: string }) => void;
  
  // Ride Events
  ride_request: (data: Ride & { estimated_arrival: string; driver_distance: string }) => void;
  ride_accepted: (data: any) => void;
  ride_accepted_confirmation: (data: any) => void;
  ride_rejected_confirmation: (data: { ride_id: string; status: string; message: string; timestamp: string }) => void;
  ride_started: (data: any) => void;
  ride_started_confirmation: (data: any) => void;
  ride_completed: (data: any) => void;
  ride_completed_confirmation: (data: any) => void;
  ride_cancelled: (data: { ride_id: string; reason: string; timestamp: string }) => void;
  ride_timeout: (data: { ride_id: string; message: string; timestamp: string }) => void;
  ride_driver_location: (data: { ride_id: string; driver_id: string; latitude: number; longitude: number; timestamp: string }) => void;
  ride_room_joined: (data: { ride_id: string; members: number }) => void;
  no_drivers_available: (data: { ride_id: string; message: string; timestamp: string }) => void;
  
  // Chat Events
  driver_message: (data: { ride_id: string; driver_id: string; message_text: string; timestamp: string }) => void;
  passenger_message: (data: { ride_id: string; passenger_id: string; message_text: string; timestamp: string }) => void;
  
  // Rating Events
  new_rating: (data: { ride_id: string; rating: number; feedback: string; new_average_rating: number; timestamp: string }) => void;
  rating_submitted: (data: { ride_id: string; rating: number; feedback?: string; message: string; timestamp: string }) => void;
  
  // Additional Ride Events (flexible types)
  ride_request_submitted: (data: { ride_id: string; message: string; status: string; timestamp: string; [key: string]: any }) => void;
  ride_cancelled_confirmation: (data: { ride_id: string; status: string; message: string; timestamp: string; [key: string]: any }) => void;
  
  // History Events
  ride_history: (data: { rides: any[]; passenger_id: string; timestamp: string; [key: string]: any }) => void;
  
  // Driver Discovery Events
  nearby_drivers: (data: { drivers: any[]; count: number; timestamp: string; [key: string]: any }) => void;
  
  // Error Events
  error: (data: { message: string; error?: string }) => void;
}

export interface ClientToServerEvents {
  // Driver Events
  connect_driver: (data: DriverConnection) => void;
  location_update: (data: { latitude: number; longitude: number; timestamp?: string }) => void;
  driver_offline: (data: { driver_id: string }) => void;
  driver_available: (data: { driver_id: string }) => void;
  ride_accept: (data: { driver_id: string; ride_id: string }) => void;
  ride_reject: (data: { driver_id: string; ride_id: string }) => void;
  ride_start: (data: { driver_id: string; ride_id: string }) => void;
  ride_complete: (data: { driver_id: string; ride_id: string; fare?: string }) => void;
  
  // Passenger Events
  connect_passenger: (data: PassengerConnection) => void;
  ride_request: (data: RideRequest) => void;
  ride_cancel: (data: { ride_id: string; passenger_id: string; reason?: string }) => void;
  get_ride_history: (data: { passenger_id: string; limit?: number }) => void;
  get_nearby_drivers: (data: { latitude: number; longitude: number; radius?: number }) => void;
  
  // Chat Events
  driver_message: (data: { ride_id: string; driver_id: string; message_text: string; timestamp?: string }, ack?: (response: { ok: boolean; error?: string }) => void) => void;
  passenger_message: (data: { ride_id: string; passenger_id: string; message_text: string; timestamp?: string }, ack?: (response: { ok: boolean; error?: string }) => void) => void;
  
  // Rating Events
  ride_rating: (data: { ride_id: string; rating: number; feedback?: string }) => void;
}