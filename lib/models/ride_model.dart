// import 'driver_model.dart'; // Not needed for RideStatus enum

enum RideStatus {
  requested,
  accepted,
  started,
  completed,
  cancelled,
}

class Ride {
  final String id;
  final String driverId;
  final String passengerId;
  final String passengerName;
  final String passengerPhone;
  final String? passengerImage;
  final double pickupLatitude;
  final double pickupLongitude;
  final String pickupAddress;
  final double destinationLatitude;
  final double destinationLongitude;
  final String destinationAddress;
  final double distance;
  final double fare;
  final double? duration; // Estimated ride duration in minutes
  final RideStatus status;
  final DateTime requestedAt;
  final DateTime? acceptedAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final String? notes;
  final double? rating;
  final String? feedback;
  final String? routePolyline;
  final String? driverToPickupPolyline;
  final String? driverToPickupDistance;
  final String? driverToPickupDuration;
  final double? driverLatitude;
  final double? driverLongitude;

  Ride({
    required this.id,
    required this.driverId,
    required this.passengerId,
    required this.passengerName,
    required this.passengerPhone,
    this.passengerImage,
    required this.pickupLatitude,
    required this.pickupLongitude,
    required this.pickupAddress,
    required this.destinationLatitude,
    required this.destinationLongitude,
    required this.destinationAddress,
    required this.distance,
    required this.fare,
    this.duration,
    required this.status,
    required this.requestedAt,
    this.acceptedAt,
    this.startedAt,
    this.completedAt,
    this.notes,
    this.rating,
    this.feedback,
    this.routePolyline,
    this.driverToPickupPolyline,
    this.driverToPickupDistance,
    this.driverToPickupDuration,
    this.driverLatitude,
    this.driverLongitude,
  });

  factory Ride.fromJson(Map<String, dynamic> json) {
    return Ride(
      id: json['id'] ?? '',
      driverId: json['driver_id'] ?? '',
      passengerId: json['passenger_id'] ?? '',
      passengerName: json['passenger_name'] ?? '',
      passengerPhone: json['passenger_phone'] ?? '',
      passengerImage: json['passenger_image'],
      pickupLatitude: (json['pickup_latitude'] ?? 0.0).toDouble(),
      pickupLongitude: (json['pickup_longitude'] ?? 0.0).toDouble(),
      pickupAddress: json['pickup_address'] ?? '',
      destinationLatitude: (json['destination_latitude'] ?? 0.0).toDouble(),
      destinationLongitude: (json['destination_longitude'] ?? 0.0).toDouble(),
      destinationAddress: json['destination_address'] ?? '',
      distance: (json['distance'] ?? 0.0).toDouble(),
      fare: (json['fare'] ?? 0.0).toDouble(),
      duration: json['duration']?.toDouble(),
      status: RideStatus.values.firstWhere(
        (e) => e.name == json['status'],
        orElse: () => RideStatus.requested,
      ),
      requestedAt: DateTime.parse(json['requested_at']),
      acceptedAt: json['accepted_at'] != null 
          ? DateTime.parse(json['accepted_at']) 
          : null,
      startedAt: json['started_at'] != null 
          ? DateTime.parse(json['started_at']) 
          : null,
      completedAt: json['completed_at'] != null 
          ? DateTime.parse(json['completed_at']) 
          : null,
      notes: json['notes'],
      rating: json['rating']?.toDouble(),
      feedback: json['feedback'],
      routePolyline: json['route_polyline'],
      driverToPickupPolyline: json['driver_to_pickup_polyline'],
      driverToPickupDistance: json['driver_to_pickup_distance'],
      driverToPickupDuration: json['driver_to_pickup_duration'],
      driverLatitude: json['driver_latitude']?.toDouble(),
      driverLongitude: json['driver_longitude']?.toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'driver_id': driverId,
      'passenger_id': passengerId,
      'passenger_name': passengerName,
      'passenger_phone': passengerPhone,
      'passenger_image': passengerImage,
      'pickup_latitude': pickupLatitude,
      'pickup_longitude': pickupLongitude,
      'pickup_address': pickupAddress,
      'destination_latitude': destinationLatitude,
      'destination_longitude': destinationLongitude,
      'destination_address': destinationAddress,
      'distance': distance,
      'fare': fare,
      'duration': duration,
      'status': status.name,
      'requested_at': requestedAt.toIso8601String(),
      'accepted_at': acceptedAt?.toIso8601String(),
      'started_at': startedAt?.toIso8601String(),
      'completed_at': completedAt?.toIso8601String(),
      'notes': notes,
      'rating': rating,
      'feedback': feedback,
      'route_polyline': routePolyline,
      'driver_to_pickup_polyline': driverToPickupPolyline,
      'driver_to_pickup_distance': driverToPickupDistance,
      'driver_to_pickup_duration': driverToPickupDuration,
      'driver_latitude': driverLatitude,
      'driver_longitude': driverLongitude,
    };
  }

  Ride copyWith({
    String? id,
    String? driverId,
    String? passengerId,
    String? passengerName,
    String? passengerPhone,
    String? passengerImage,
    double? pickupLatitude,
    double? pickupLongitude,
    String? pickupAddress,
    double? destinationLatitude,
    double? destinationLongitude,
    String? destinationAddress,
    double? distance,
    double? fare,
    double? duration,
    RideStatus? status,
    DateTime? requestedAt,
    DateTime? acceptedAt,
    DateTime? startedAt,
    DateTime? completedAt,
    String? notes,
    double? rating,
    String? feedback,
    String? routePolyline,
    String? driverToPickupPolyline,
    String? driverToPickupDistance,
    String? driverToPickupDuration,
    double? driverLatitude,
    double? driverLongitude,
  }) {
    return Ride(
      id: id ?? this.id,
      driverId: driverId ?? this.driverId,
      passengerId: passengerId ?? this.passengerId,
      passengerName: passengerName ?? this.passengerName,
      passengerPhone: passengerPhone ?? this.passengerPhone,
      passengerImage: passengerImage ?? this.passengerImage,
      pickupLatitude: pickupLatitude ?? this.pickupLatitude,
      pickupLongitude: pickupLongitude ?? this.pickupLongitude,
      pickupAddress: pickupAddress ?? this.pickupAddress,
      destinationLatitude: destinationLatitude ?? this.destinationLatitude,
      destinationLongitude: destinationLongitude ?? this.destinationLongitude,
      destinationAddress: destinationAddress ?? this.destinationAddress,
      distance: distance ?? this.distance,
      fare: fare ?? this.fare,
      duration: duration ?? this.duration,
      status: status ?? this.status,
      requestedAt: requestedAt ?? this.requestedAt,
      acceptedAt: acceptedAt ?? this.acceptedAt,
      startedAt: startedAt ?? this.startedAt,
      completedAt: completedAt ?? this.completedAt,
      notes: notes ?? this.notes,
      rating: rating ?? this.rating,
      feedback: feedback ?? this.feedback,
      routePolyline: routePolyline ?? this.routePolyline,
      driverToPickupPolyline: driverToPickupPolyline ?? this.driverToPickupPolyline,
      driverToPickupDistance: driverToPickupDistance ?? this.driverToPickupDistance,
      driverToPickupDuration: driverToPickupDuration ?? this.driverToPickupDuration,
      driverLatitude: driverLatitude ?? this.driverLatitude,
      driverLongitude: driverLongitude ?? this.driverLongitude,
    );
  }
}
