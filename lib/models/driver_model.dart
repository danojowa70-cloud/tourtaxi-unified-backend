class Driver {
  final String id;
  final String email;
  final String name;
  final String phone;
  final String? profileImage;
  final String? vehicleType;
  final String? vehicleNumber;
  final String? licenseNumber;
  final bool isOnline;
  final double? rating;
  final int totalRides;
  final double totalEarnings;
  final DateTime createdAt;
  final DateTime updatedAt;

  Driver({
    required this.id,
    required this.email,
    required this.name,
    required this.phone,
    this.profileImage,
    this.vehicleType,
    this.vehicleNumber,
    this.licenseNumber,
    this.isOnline = false,
    this.rating,
    this.totalRides = 0,
    this.totalEarnings = 0.0,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Driver.fromJson(Map<String, dynamic> json) {
    return Driver(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'] ?? '',
      profileImage: json['profile_image'],
      vehicleType: json['vehicle_type'],
      vehicleNumber: json['vehicle_number'],
      licenseNumber: json['license_number'],
      isOnline: json['is_online'] ?? false,
      rating: json['rating']?.toDouble(),
      totalRides: json['total_rides'] ?? 0,
      totalEarnings: (json['total_earnings'] ?? 0.0).toDouble(),
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'name': name,
      'phone': phone,
      'profile_image': profileImage,
      'vehicle_type': vehicleType,
      'vehicle_number': vehicleNumber,
      'license_number': licenseNumber,
      'is_online': isOnline,
      'rating': rating,
      'total_rides': totalRides,
      'total_earnings': totalEarnings,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  Driver copyWith({
    String? id,
    String? email,
    String? name,
    String? phone,
    String? profileImage,
    String? vehicleType,
    String? vehicleNumber,
    String? licenseNumber,
    bool? isOnline,
    double? rating,
    int? totalRides,
    double? totalEarnings,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Driver(
      id: id ?? this.id,
      email: email ?? this.email,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      profileImage: profileImage ?? this.profileImage,
      vehicleType: vehicleType ?? this.vehicleType,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      licenseNumber: licenseNumber ?? this.licenseNumber,
      isOnline: isOnline ?? this.isOnline,
      rating: rating ?? this.rating,
      totalRides: totalRides ?? this.totalRides,
      totalEarnings: totalEarnings ?? this.totalEarnings,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

