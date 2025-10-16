import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants/app_constants.dart';

class ApiService {
  static String get _base => AppConstants.apiBaseUrl;

  static Future<bool> health() async {
    final uri = Uri.parse('$_base/health');
    final res = await http.get(uri);
    return res.statusCode == 200;
  }

  static Future<Map<String, dynamic>> status() async {
    final uri = Uri.parse('$_base/status');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Status failed ${res.statusCode}');
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  static Future<List<dynamic>> getActiveDrivers() async {
    final uri = Uri.parse('$_base/api/drivers');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Drivers fetch failed ${res.statusCode}');
    final body = jsonDecode(res.body);
    if (body is Map && body['drivers'] is List) return body['drivers'] as List<dynamic>;
    if (body is List) return body;
    return [];
  }

  static Future<List<dynamic>> getActivePassengers() async {
    final uri = Uri.parse('$_base/api/passengers');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Passengers fetch failed ${res.statusCode}');
    final body = jsonDecode(res.body);
    if (body is Map && body['passengers'] is List) return body['passengers'] as List<dynamic>;
    if (body is List) return body;
    return [];
  }

  static Future<List<dynamic>> getPendingRides() async {
    final uri = Uri.parse('$_base/api/rides');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Rides fetch failed ${res.statusCode}');
    final body = jsonDecode(res.body);
    if (body is Map && body['rides'] is List) return body['rides'] as List<dynamic>;
    if (body is List) return body;
    return [];
  }

  static Future<List<dynamic>> getCompletedRides() async {
    final uri = Uri.parse('$_base/api/completed-rides');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Completed rides fetch failed ${res.statusCode}');
    final body = jsonDecode(res.body);
    if (body is Map && body['rides'] is List) return body['rides'] as List<dynamic>;
    if (body is List) return body;
    return [];
  }

  /// Update driver online/offline status in database
  static Future<bool> updateDriverStatus({
    required String driverId,
    required bool isOnline,
  }) async {
    try {
      final uri = Uri.parse('$_base/driver/status');
      print('📡 API URL: $uri');
      print('📤 Request payload: {"driver_id": "$driverId", "is_online": $isOnline, "is_available": $isOnline}');
      
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'driver_id': driverId,
          'is_online': isOnline,
          'is_available': isOnline, // When online, driver is available for rides
        }),
      );
      
      print('📥 Response status: ${response.statusCode}');
      print('📥 Response body: ${response.body}');
      
      if (response.statusCode == 200) {
        final responseBody = jsonDecode(response.body);
        final data = responseBody['data'] as Map<String, dynamic>?;
        
        if (data != null) {
          print('🔍 Backend response data:');
          print('   driver_id: ${data['driver_id']}');
          print('   is_online: ${data['is_online']}');
          print('   is_available: ${data['is_available']}');
          print('   updated_at: ${data['updated_at']}');
        } else {
          print('⚠️  No data returned in response');
        }
        
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ API Error: $e');
      throw Exception('Failed to update driver status: $e');
    }
  }
  
  /// Update driver FCM token in database
  static Future<bool> updateDriverFCMToken({
    required String driverId,
    required String fcmToken,
  }) async {
    try {
      final uri = Uri.parse('$_base/driver/fcm-token');
      print('📡 API URL: $uri');
      print('📤 Request payload: {"driver_id": "$driverId", "fcm_token": "${fcmToken.substring(0, 20)}..."}');
      
      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'driver_id': driverId,
          'fcm_token': fcmToken,
        }),
      );
      
      print('📥 Response status: ${response.statusCode}');
      print('📥 Response body: ${response.body}');
      
      if (response.statusCode == 200) {
        return true;
      }
      
      return false;
    } catch (e) {
      print('❌ FCM Token API Error: $e');
      throw Exception('Failed to update FCM token: $e');
    }
  }
}
