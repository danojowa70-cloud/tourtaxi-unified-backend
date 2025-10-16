import 'dart:async';
import 'dart:developer' as dev;
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:permission_handler/permission_handler.dart';

class LocationService {
  static StreamSubscription<Position>? _positionStream;
  static final StreamController<Position> _locationController = StreamController<Position>.broadcast();
  static final StreamController<String> _addressController = StreamController<String>.broadcast();

  static Stream<Position> get locationStream => _locationController.stream;
  static Stream<String> get addressStream => _addressController.stream;

  static Future<bool> requestLocationPermission() async {
    try {
      final status = await Permission.location.request();
      return status == PermissionStatus.granted;
    } catch (e) {
      dev.log('Error requesting location permission: $e', name: 'LocationService');
      return false;
    }
  }

  static Future<bool> isLocationServiceEnabled() async {
    try {
      return await Geolocator.isLocationServiceEnabled();
    } catch (e) {
      dev.log('Error checking location service: $e', name: 'LocationService');
      return false;
    }
  }

  static Future<Position?> getCurrentPosition() async {
    try {
      final hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        throw Exception('Location permission denied');
      }

      final isEnabled = await isLocationServiceEnabled();
      if (!isEnabled) {
        throw Exception('Location service is disabled');
      }

      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (e) {
      dev.log('Error getting current position: $e', name: 'LocationService');
      return null;
    }
  }

  static Future<String> getAddressFromCoordinates({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final placemarks = await placemarkFromCoordinates(latitude, longitude);
      if (placemarks.isNotEmpty) {
        final placemark = placemarks.first;
        return '${placemark.street}, ${placemark.locality}, ${placemark.administrativeArea}';
      }
      return 'Unknown location';
    } catch (e) {
      dev.log('Error getting address: $e', name: 'LocationService');
      return 'Unknown location';
    }
  }

  static Future<void> startLocationTracking() async {
    try {
      final hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        throw Exception('Location permission denied');
      }

      final isEnabled = await isLocationServiceEnabled();
      if (!isEnabled) {
        throw Exception('Location service is disabled');
      }

      const locationSettings = LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 10, // Update every 10 meters
      );

      _positionStream = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen(
        (Position position) {
          _locationController.add(position);
          _getAddressForPosition(position);
        },
        onError: (error) {
          dev.log('Location tracking error: $error', name: 'LocationService');
        },
      );
    } catch (e) {
      dev.log('Error starting location tracking: $e', name: 'LocationService');
    }
  }

  static Future<void> stopLocationTracking() async {
    try {
      await _positionStream?.cancel();
      _positionStream = null;
    } catch (e) {
      dev.log('Error stopping location tracking: $e', name: 'LocationService');
    }
  }

  static Future<void> _getAddressForPosition(Position position) async {
    try {
      final address = await getAddressFromCoordinates(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      _addressController.add(address);
    } catch (e) {
      dev.log('Error getting address for position: $e', name: 'LocationService');
    }
  }

  static double calculateDistance({
    required double startLatitude,
    required double startLongitude,
    required double endLatitude,
    required double endLongitude,
  }) {
    return Geolocator.distanceBetween(
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    );
  }

  static void dispose() {
    _positionStream?.cancel();
    _locationController.close();
    _addressController.close();
  }
}

