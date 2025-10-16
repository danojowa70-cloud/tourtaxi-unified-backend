# 🗄️ Supabase Database Setup Guide

## 🚀 Quick Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login to your account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: `tourtaxi-driver-app`
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to your users
6. Click "Create new project"

### 2. Get Project Credentials

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. Create Database Tables

1. Go to **SQL Editor** in your Supabase dashboard
2. Click "New Query"
3. Copy and paste the entire content from `backend/database/schema.sql`
4. Click "Run" to execute the SQL

### 4. Update Flutter App Configuration

Update `lib/constants/app_constants.dart`:

```dart
class AppConstants {
  // Supabase Configuration
  static const String supabaseUrl = 'https://your-project-id.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  
  // ... rest of your constants
}
```

### 5. Update Backend Configuration

Create `backend/.env` file:

```env
PORT=3000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GOOGLE_MAPS_API_KEY=AIzaSyBRYPKaXlRhpzoAmM5-KrS2JaNDxAX_phw
NODE_ENV=development
```

### 6. Test Database Connection

1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Check the console for successful database connection

## 📊 Database Tables Created

### **drivers** table
- Driver profiles and information
- Vehicle details and verification
- Online/offline status
- Location tracking
- Earnings and ratings

### **rides** table
- Complete ride information
- Pickup and destination details
- Route polylines and distances
- Ride status and timestamps
- Ratings and feedback

### **earnings** table
- Driver earnings per ride
- Commission calculations
- Payment status tracking
- Financial reporting

### **driver_locations** table
- Location history for drivers
- Real-time position tracking
- Route analysis and optimization

## 🔧 Database Features

### **Indexes**
- Optimized queries for location-based searches
- Fast lookups for driver availability
- Efficient ride status filtering

### **Triggers**
- Automatic `updated_at` timestamp updates
- Data consistency maintenance

### **Views**
- `active_drivers` - Currently active drivers
- `driver_earnings_summary` - Earnings analytics

### **Security**
- Row Level Security (RLS) enabled
- Configurable access policies
- Secure API access

## 🧪 Testing the Setup

### 1. Test Driver Registration
```sql
INSERT INTO drivers (email, password_hash, name, phone, vehicle_type, vehicle_number)
VALUES ('test@driver.com', 'hashed_password', 'Test Driver', '+1234567890', 'Sedan', 'TEST-123');
```

### 2. Test Ride Creation
```sql
INSERT INTO rides (passenger_id, passenger_name, passenger_phone, pickup_latitude, pickup_longitude, pickup_address, destination_latitude, destination_longitude, destination_address, distance, duration, fare)
VALUES ('passenger_123', 'Test Passenger', '+0987654321', 37.7749, -122.4194, 'San Francisco, CA', 37.7849, -122.4094, 'Oakland, CA', 15.5, 25, 25.50);
```

### 3. Verify Data
```sql
SELECT * FROM drivers WHERE email = 'test@driver.com';
SELECT * FROM rides WHERE passenger_id = 'passenger_123';
```

## 🚨 Troubleshooting

### Connection Issues
- Verify your Supabase URL and keys
- Check if your project is active
- Ensure database is not paused

### Permission Issues
- Check RLS policies
- Verify API key permissions
- Test with service role key

### Schema Issues
- Run the schema.sql file completely
- Check for any SQL errors
- Verify all tables are created

## 📱 Next Steps

1. ✅ **Database Setup Complete**
2. 🔄 **Configure Google Maps API**
3. 🔄 **Test Backend Server**
4. 🔄 **Test Flutter App Integration**
5. 🔄 **Test Complete Ride Flow**

---

**Your Supabase database is now ready for the TourTaxi Driver App! 🚗✨**

