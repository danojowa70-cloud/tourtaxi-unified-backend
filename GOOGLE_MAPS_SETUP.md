# 🗺️ Google Maps API Setup Guide

## 🚀 Quick Setup Instructions

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click "Select a project" → "New Project"
4. Enter project details:
   - **Project name**: `TourTaxi Driver App`
   - **Organization**: (optional)
   - **Location**: (optional)
5. Click "Create"

### 2. Enable Required APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable these APIs:
   - **Maps JavaScript API** - For Flutter Google Maps
   - **Directions API** - For route calculation and polylines
   - **Distance Matrix API** - For accurate distance calculations
   - **Geocoding API** - For address conversion
   - **Places API** - For location search (optional)

### 3. Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "API Key"
3. Copy the generated API key
4. Click "Restrict Key" to secure it:
   - **Application restrictions**: HTTP referrers
   - **API restrictions**: Select the APIs you enabled
   - **Website restrictions**: Add your domain (for production)

### 4. Configure API Key

#### For Flutter App:
Update `android/app/src/main/AndroidManifest.xml`:
```xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY" />
```

Update `ios/Runner/AppDelegate.swift`:
```swift
import GoogleMaps

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    GMSServices.provideAPIKey("YOUR_GOOGLE_MAPS_API_KEY")
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

#### For Backend Server:
Create `backend/.env` file:
```env
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

### 5. Test API Key

#### Test Directions API:
```bash
curl "https://maps.googleapis.com/maps/api/directions/json?origin=37.7749,-122.4194&destination=37.7849,-122.4094&key=YOUR_API_KEY"
```

#### Test Distance Matrix API:
```bash
curl "https://maps.googleapis.com/maps/api/distancematrix/json?origins=37.7749,-122.4194&destinations=37.7849,-122.4094&key=YOUR_API_KEY"
```

## 🔧 API Configuration Details

### **Maps JavaScript API**
- **Purpose**: Display Google Maps in Flutter app
- **Usage**: Map rendering, markers, polylines
- **Quota**: 25,000 map loads per day (free tier)

### **Directions API**
- **Purpose**: Calculate routes and generate polylines
- **Usage**: Driver navigation, route visualization
- **Quota**: 2,500 requests per day (free tier)

### **Distance Matrix API**
- **Purpose**: Calculate accurate distances and travel times
- **Usage**: Fare calculation, ETA estimation
- **Quota**: 100 elements per day (free tier)

### **Geocoding API**
- **Purpose**: Convert addresses to coordinates
- **Usage**: Address search, location lookup
- **Quota**: 40,000 requests per day (free tier)

## 💰 Pricing Information

### **Free Tier Limits:**
- Maps JavaScript API: 25,000 map loads/month
- Directions API: 2,500 requests/month
- Distance Matrix API: 100 elements/month
- Geocoding API: 40,000 requests/month

### **Paid Tier Pricing:**
- Maps JavaScript API: $7 per 1,000 loads
- Directions API: $5 per 1,000 requests
- Distance Matrix API: $5 per 1,000 elements
- Geocoding API: $5 per 1,000 requests

## 🛡️ Security Best Practices

### **API Key Restrictions:**
1. **Application Restrictions**:
   - HTTP referrers (for web)
   - Android apps (for Android)
   - iOS apps (for iOS)

2. **API Restrictions**:
   - Only enable required APIs
   - Disable unused APIs

3. **Usage Quotas**:
   - Set daily quotas
   - Monitor usage regularly

### **Production Security:**
```javascript
// Backend: Use environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Frontend: Use restricted keys
// Never expose unrestricted keys in client code
```

## 🧪 Testing Your Setup

### **1. Test Flutter App:**
```bash
flutter run
# Check if map loads correctly
# Verify location permissions
# Test marker placement
```

### **2. Test Backend Server:**
```bash
cd backend
npm run dev
# Check console for API connection
# Test route calculation endpoints
```

### **3. Test API Endpoints:**
```bash
# Test server status
curl http://localhost:3000

# Test route calculation
curl "http://localhost:3000/api/route?origin=37.7749,-122.4194&destination=37.7849,-122.4094"
```

## 🚨 Troubleshooting

### **Common Issues:**

#### **"This page can't load Google Maps correctly"**
- Check API key is correct
- Verify Maps JavaScript API is enabled
- Check API key restrictions

#### **"REQUEST_DENIED" Error**
- Verify API key has correct permissions
- Check if required APIs are enabled
- Verify billing is set up (for paid usage)

#### **"OVER_QUERY_LIMIT" Error**
- Check if you've exceeded free tier limits
- Set up billing for higher quotas
- Implement request caching

#### **Map Not Loading in Flutter**
- Verify API key in AndroidManifest.xml
- Check iOS configuration in AppDelegate.swift
- Ensure location permissions are granted

### **Debug Steps:**
1. Check Google Cloud Console for API usage
2. Verify API key restrictions
3. Test API endpoints directly
4. Check Flutter app logs
5. Verify network connectivity

## 📱 Flutter Integration

### **Required Dependencies:**
```yaml
dependencies:
  google_maps_flutter: ^2.5.0
  geolocator: ^10.1.0
  geocoding: ^2.1.1
```

### **Location Permissions:**
```xml
<!-- Android: android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

```xml
<!-- iOS: ios/Runner/Info.plist -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to show your position on the map</string>
```

## 🎯 Next Steps

1. ✅ **Google Maps API Setup Complete**
2. 🔄 **Test Backend Server**
3. 🔄 **Test Flutter App Integration**
4. 🔄 **Test Complete Ride Flow**
5. 🔄 **Test Polyline Route Visualization**

---

**Your Google Maps API is now configured for the TourTaxi Driver App! 🚗✨**

