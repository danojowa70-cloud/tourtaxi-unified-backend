import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/driver_model.dart';
import '../models/ride_model.dart';
import 'package:tour_taxi_driver/services/api_service.dart';

class SupabaseService {
  static final SupabaseClient _client = Supabase.instance.client;

  // Normalize potential backend JSON to match Ride.fromJson expectations
  static Map<String, dynamic> _normalizeRideJson(Map input) {
    final m = Map<String, dynamic>.from(input);
    if (!m.containsKey('driver_id') && m['driverId'] != null) m['driver_id'] = m['driverId'];
    if (!m.containsKey('passenger_id') && m['passengerId'] != null) m['passenger_id'] = m['passengerId'];
    if (!m.containsKey('pickup_latitude') && m['pickupLatitude'] != null) m['pickup_latitude'] = m['pickupLatitude'];
    if (!m.containsKey('pickup_longitude') && m['pickupLongitude'] != null) m['pickup_longitude'] = m['pickupLongitude'];
    if (!m.containsKey('destination_latitude') && m['destinationLatitude'] != null) m['destination_latitude'] = m['destinationLatitude'];
    if (!m.containsKey('destination_longitude') && m['destinationLongitude'] != null) m['destination_longitude'] = m['destinationLongitude'];
    if (!m.containsKey('requested_at') && m['requestedAt'] != null) m['requested_at'] = m['requestedAt'];
    if (!m.containsKey('accepted_at') && m['acceptedAt'] != null) m['accepted_at'] = m['acceptedAt'];
    if (!m.containsKey('started_at') && m['startedAt'] != null) m['started_at'] = m['startedAt'];
    if (!m.containsKey('completed_at') && m['completedAt'] != null) m['completed_at'] = m['completedAt'];
    if (!m.containsKey('route_polyline') && m['routePolyline'] != null) m['route_polyline'] = m['routePolyline'];
    if (!m.containsKey('driver_to_pickup_polyline') && m['driverToPickupPolyline'] != null) m['driver_to_pickup_polyline'] = m['driverToPickupPolyline'];
    if (!m.containsKey('driver_to_pickup_distance') && m['driverToPickupDistance'] != null) m['driver_to_pickup_distance'] = m['driverToPickupDistance'];
    if (!m.containsKey('driver_to_pickup_duration') && m['driverToPickupDuration'] != null) m['driver_to_pickup_duration'] = m['driverToPickupDuration'];
    return m;
  }

  // Authentication Methods
  static Future<AuthResponse> signUp({
    required String email,
    required String password,
    required String name,
    required String phone,
  }) async {
    try {
      final response = await _client.auth.signUp(
        email: email,
        password: password,
        data: {
          'name': name,
          'phone': phone,
        },
      );

      if (response.user != null) {
        // Create driver profile
        await createDriverProfile(
          driverId: response.user!.id,
          email: email,
          name: name,
          phone: phone,
        );
      }

      return response;
    } catch (e) {
      throw Exception('Sign up failed: $e');
    }
  }

  static Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) async {
    try {
      return await _client.auth.signInWithPassword(
        email: email,
        password: password,
      );
    } catch (e) {
      throw Exception('Sign in failed: $e');
    }
  }

  static Future<void> signOut() async {
    try {
      await _client.auth.signOut();
    } catch (e) {
      throw Exception('Sign out failed: $e');
    }
  }

  static User? getCurrentUser() {
    try {
      return _client.auth.currentUser;
    } catch (e) {
      // Return null if there's an error accessing current user
      return null;
    }
  }

  static Stream<AuthState> get authStateChanges {
    return _client.auth.onAuthStateChange;
  }

  // Driver Profile Methods
  static Future<void> createDriverProfile({
    required String driverId,
    required String email,
    required String name,
    required String phone,
  }) async {
    try {
      await _client.from('drivers').insert({
        'id': driverId,
        'email': email,
        'name': name,
        'phone': phone,
        'is_online': false,
        'total_rides': 0,
        'total_earnings': 0.0,
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      throw Exception('Failed to create driver profile: $e');
    }
  }

  static Future<Driver?> getDriverProfile(String driverId) async {
    try {
      // Try to find in active drivers from backend
      final drivers = await ApiService.getActiveDrivers();
      final match = drivers.cast<Map>().firstWhere(
        (d) => (d['id'] ?? d['driver_id']) == driverId,
        orElse: () => {},
      );
      if (match.isNotEmpty) {
        return Driver(
          id: (match['id'] ?? match['driver_id']) ?? driverId,
          email: match['email'] ?? '',
          name: match['name'] ?? '',
          phone: match['phone'] ?? '',
          profileImage: match['profile_image'],
          vehicleType: match['vehicle_type'],
          vehicleNumber: match['vehicle_number'],
          licenseNumber: match['license_number'],
          isOnline: (match['is_online'] ?? match['online'] ?? true) == true,
          rating: (match['rating'] as num?)?.toDouble(),
          totalRides: (match['total_rides'] as num?)?.toInt() ?? 0,
          totalEarnings: (match['total_earnings'] as num?)?.toDouble() ?? 0.0,
          createdAt: DateTime.tryParse(match['created_at'] ?? '') ?? DateTime.now(),
          updatedAt: DateTime.tryParse(match['updated_at'] ?? '') ?? DateTime.now(),
        );
      }

      // If not active, build minimal profile from auth metadata
      final user = _client.auth.currentUser;
      return Driver(
        id: driverId,
        email: user?.email ?? '',
        name: (user?.userMetadata?['name'] as String?) ?? '',
        phone: (user?.userMetadata?['phone'] as String?) ?? '',
        isOnline: false,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
    } catch (e) {
      throw Exception('Failed to get driver profile: $e');
    }
  }

  static Future<void> updateDriverProfile({
    required String driverId,
    String? name,
    String? phone,
    String? profileImage,
    String? vehicleType,
    String? vehicleNumber,
    String? licenseNumber,
    bool? isOnline,
  }) async {
    // Writes are handled by backend via Socket.IO only per current API contract
    return;
  }

  // Ride Methods
  static Future<List<Ride>> getDriverRides(String driverId) async {
    try {
      final pending = await ApiService.getPendingRides();
      final completed = await ApiService.getCompletedRides();
      final all = [...pending, ...completed];
      return all
          .whereType<Map>()
          .where((r) => (r['driver_id'] ?? r['driverId']) == driverId)
          .map((r) => Ride.fromJson(_normalizeRideJson(r)))
          .toList();
    } catch (e) {
      throw Exception('Failed to get driver rides: $e');
    }
  }

  static Future<Ride?> getCurrentRide(String driverId) async {
    try {
      final pending = await ApiService.getPendingRides();
      final match = pending.whereType<Map>().firstWhere(
        (r) => (r['driver_id'] ?? r['driverId']) == driverId,
        orElse: () => {},
      );
      if (match.isNotEmpty) return Ride.fromJson(_normalizeRideJson(match));
      return null;
    } catch (e) {
      throw Exception('Failed to get current ride: $e');
    }
  }

  static Future<void> updateRideStatus({
    required String rideId,
    required String status,
    DateTime? acceptedAt,
    DateTime? startedAt,
    DateTime? completedAt,
  }) async {
    // Updates handled by backend via Socket.IO; no direct API for writes per spec
    return;
  }

  // Earnings Methods
  static Future<Map<String, dynamic>> getDriverEarnings(String driverId) async {
    try {
      final completed = await ApiService.getCompletedRides();
      final my = completed.whereType<Map>().where((r) => (r['driver_id'] ?? r['driverId']) == driverId);
      double total = 0;
      for (final r in my) {
        total += (r['fare'] as num?)?.toDouble() ?? 0.0;
      }
      // Basic breakdown (today/week/month require date fields; fallback to total)
      return {
        'total': total,
        'today': total,
        'week': total,
        'month': total,
      };
    } catch (e) {
      throw Exception('Failed to get driver earnings: $e');
    }
  }
}
