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
}
