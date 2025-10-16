# TourTaxi Driver App

A complete Flutter driver app for TourTaxi with real-time ride tracking, Supabase authentication, and Socket.io integration.

## Features

- 🚗 **Driver Authentication** - Secure login and registration with Supabase
- 🗺️ **Google Maps Integration** - Real-time location tracking and navigation
- 📱 **Apple-style UI** - Clean, modern interface with Cupertino design
- 🔄 **Real-time Communication** - Socket.io integration for live updates
- 💰 **Earnings Tracking** - Complete earnings history and statistics
- 📊 **Ride Management** - Accept, start, and complete rides
- 👤 **Profile Management** - Driver profile and vehicle information

## Screens

- **Splash Screen** - Animated app launch with "TOURTAXI DRIVER" text
- **Authentication** - Login and create account screens
- **Home Screen** - Google Maps with online/offline toggle
- **Ride Request Popup** - Accept or reject incoming ride requests
- **Ride In Progress** - Start and complete ride functionality
- **Earnings Screen** - View earnings history and statistics
- **Profile Screen** - Driver profile and settings

## Setup Instructions

### 1. Prerequisites

- Flutter SDK (3.9.2 or higher)
- Android Studio / Xcode
- Supabase account
- Google Maps API key
- Node.js server with Socket.io (for backend)

### 2. Configuration

#### Supabase Setup
1. Create a new Supabase project
2. Update `lib/constants/app_constants.dart`:
   ```dart
   static const String supabaseUrl = 'YOUR_SUPABASE_URL';
   static const String supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';
   ```

#### Google Maps Setup
1. Get a Google Maps API key from Google Cloud Console
2. Update `lib/constants/app_constants.dart`:
   ```dart
   static const String googleMapsApiKey = 'YOUR_GOOGLE_MAPS_API_KEY';
   ```
3. Update `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data
       android:name="com.google.android.geo.API_KEY"
       android:value="YOUR_GOOGLE_MAPS_API_KEY" />
   ```

#### Socket.io Backend
1. Set up a Node.js server with Socket.io
2. Update `lib/constants/app_constants.dart`:
   ```dart
   static const String socketUrl = 'YOUR_SOCKET_SERVER_URL';
   ```

### 3. Database Schema

Create the following tables in Supabase:

#### Drivers Table
```sql
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  profile_image TEXT,
  vehicle_type TEXT,
  vehicle_number TEXT,
  license_number TEXT,
  is_online BOOLEAN DEFAULT false,
  rating DECIMAL(3,2),
  total_rides INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Rides Table
```sql
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id),
  passenger_id UUID NOT NULL,
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  passenger_image TEXT,
  pickup_latitude DECIMAL(10,8) NOT NULL,
  pickup_longitude DECIMAL(11,8) NOT NULL,
  pickup_address TEXT NOT NULL,
  destination_latitude DECIMAL(10,8) NOT NULL,
  destination_longitude DECIMAL(11,8) NOT NULL,
  destination_address TEXT NOT NULL,
  distance DECIMAL(8,2) NOT NULL,
  fare DECIMAL(8,2) NOT NULL,
  status TEXT DEFAULT 'requested',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  rating DECIMAL(3,2),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   flutter pub get
   ```
3. Run the app:
   ```bash
   flutter run
   ```

### 5. Socket.io Events

The app listens for and emits the following Socket.io events:

#### Incoming Events
- `ride_request` - New ride request from passenger
- `location_update` - Location updates from other drivers
- `ride_accepted` - Ride acceptance confirmation
- `ride_started` - Ride start confirmation
- `ride_completed` - Ride completion confirmation
- `driver_offline` - Driver goes offline

#### Outgoing Events
- `connect_driver` - Driver connects to the system
- `location_update` - Driver location updates
- `ride_accept` - Accept a ride request
- `ride_reject` - Reject a ride request
- `ride_start` - Start a ride
- `ride_complete` - Complete a ride
- `driver_offline` - Driver goes offline

## Project Structure

```
lib/
├── constants/
│   └── app_constants.dart
├── models/
│   ├── driver_model.dart
│   └── ride_model.dart
├── services/
│   ├── supabase_service.dart
│   ├── socket_service.dart
│   └── location_service.dart
├── screens/
│   ├── splash_screen.dart
│   ├── auth/
│   │   ├── login_screen.dart
│   │   └── create_account_screen.dart
│   ├── home/
│   │   └── home_screen.dart
│   ├── ride/
│   │   └── ride_in_progress_screen.dart
│   ├── earnings/
│   │   └── earnings_screen.dart
│   └── profile/
│       └── profile_screen.dart
├── widgets/
│   ├── custom_text_field.dart
│   ├── custom_button.dart
│   ├── online_toggle.dart
│   └── ride_request_popup.dart
└── main.dart
```

## Dependencies

- `supabase_flutter` - Authentication and database
- `socket_io_client` - Real-time communication
- `google_maps_flutter` - Maps integration
- `geolocator` - Location services
- `geocoding` - Address geocoding
- `permission_handler` - Permission management
- `provider` - State management
- `flutter_animate` - Animations
- `cupertino_icons` - iOS-style icons

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.