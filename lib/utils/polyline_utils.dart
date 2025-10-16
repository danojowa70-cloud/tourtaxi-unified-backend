import 'dart:math' as math;
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:flutter/material.dart';

class PolylineUtils {
  // Decode Google Maps polyline string to list of LatLng points
  static List<LatLng> decodePolyline(String polyline) {
    List<LatLng> points = [];
    int index = 0;
    int lat = 0;
    int lng = 0;

    while (index < polyline.length) {
      int b, shift = 0, result = 0;
      do {
        b = polyline.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = polyline.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.add(LatLng(lat / 1E5, lng / 1E5));
    }

    return points;
  }

  // Create polyline from encoded string
  static Polyline createPolyline({
    required String polylineId,
    required String encodedPolyline,
    Color color = const Color(0xFF007AFF),
    int width = 4,
    bool geodesic = true,
  }) {
    return Polyline(
      polylineId: PolylineId(polylineId),
      points: decodePolyline(encodedPolyline),
      color: color,
      width: width,
      geodesic: geodesic,
    );
  }

  // Create route polyline (pickup to destination)
  static Polyline createRoutePolyline(String encodedPolyline) {
    return createPolyline(
      polylineId: 'route_polyline',
      encodedPolyline: encodedPolyline,
      color: const Color(0xFF007AFF), // Blue for main route
      width: 5,
    );
  }

  // Create driver to pickup polyline
  static Polyline createDriverToPickupPolyline(String encodedPolyline) {
    return createPolyline(
      polylineId: 'driver_to_pickup_polyline',
      encodedPolyline: encodedPolyline,
      color: const Color(0xFF34C759), // Green for driver route
      width: 4,
    );
  }

  // Create multiple polylines from encoded strings
  static Set<Polyline> createPolylines({
    String? routePolyline,
    String? driverToPickupPolyline,
  }) {
    Set<Polyline> polylines = {};

    if (routePolyline != null && routePolyline.isNotEmpty) {
      polylines.add(createRoutePolyline(routePolyline));
    }

    if (driverToPickupPolyline != null && driverToPickupPolyline.isNotEmpty) {
      polylines.add(createDriverToPickupPolyline(driverToPickupPolyline));
    }

    return polylines;
  }

  // Get bounds from polyline points
  static LatLngBounds getBounds(List<LatLng> points) {
    if (points.isEmpty) {
      return LatLngBounds(
        southwest: const LatLng(0, 0),
        northeast: const LatLng(0, 0),
      );
    }

    double minLat = points.first.latitude;
    double maxLat = points.first.latitude;
    double minLng = points.first.longitude;
    double maxLng = points.first.longitude;

    for (LatLng point in points) {
      minLat = minLat < point.latitude ? minLat : point.latitude;
      maxLat = maxLat > point.latitude ? maxLat : point.latitude;
      minLng = minLng < point.longitude ? minLng : point.longitude;
      maxLng = maxLng > point.longitude ? maxLng : point.longitude;
    }

    return LatLngBounds(
      southwest: LatLng(minLat, minLng),
      northeast: LatLng(maxLat, maxLng),
    );
  }

  // Get bounds from encoded polyline
  static LatLngBounds getBoundsFromPolyline(String encodedPolyline) {
    List<LatLng> points = decodePolyline(encodedPolyline);
    return getBounds(points);
  }

  // Calculate distance between two points
  static double calculateDistance(LatLng point1, LatLng point2) {
    const double earthRadius = 6371000; // Earth's radius in meters
    
    double lat1Rad = point1.latitude * (math.pi / 180);
    double lat2Rad = point2.latitude * (math.pi / 180);
    double deltaLatRad = (point2.latitude - point1.latitude) * (math.pi / 180);
    double deltaLngRad = (point2.longitude - point1.longitude) * (math.pi / 180);

    double a = math.sin(deltaLatRad / 2) * math.sin(deltaLatRad / 2) +
        math.cos(lat1Rad) * math.cos(lat2Rad) *
        math.sin(deltaLngRad / 2) * math.sin(deltaLngRad / 2);
    double c = 2 * math.asin(math.sqrt(a));

    return earthRadius * c;
  }

  // Get center point from polyline
  static LatLng getCenterPoint(List<LatLng> points) {
    if (points.isEmpty) {
      return const LatLng(0, 0);
    }

    double totalLat = 0;
    double totalLng = 0;

    for (LatLng point in points) {
      totalLat += point.latitude;
      totalLng += point.longitude;
    }

    return LatLng(
      totalLat / points.length,
      totalLng / points.length,
    );
  }

  // Get center point from encoded polyline
  static LatLng getCenterPointFromPolyline(String encodedPolyline) {
    List<LatLng> points = decodePolyline(encodedPolyline);
    return getCenterPoint(points);
  }
}

