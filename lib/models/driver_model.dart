class Driver {
  final String id;
  final String email;
  final String name;
  final String phone;
  final String? profileImage;
  final String? vehicleType;
  final String? vehicleNumber;
  final String? licenseNumber;
  final String? vehicleModel;
  final String? vehicleColor;
  final String? licenseExpiry;
  final String? insuranceNumber;
  final String? insuranceExpiry;
  final bool isOnline;
  final bool isAvailable;
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
    this.vehicleModel,
    this.vehicleColor,
    this.licenseExpiry,
    this.insuranceNumber,
    this.insuranceExpiry,
    this.isOnline = false,
    this.isAvailable = false,
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
      vehicleModel: json['vehicle_model'],
      vehicleColor: json['vehicle_color'],
      licenseExpiry: json['license_expiry'],
      insuranceNumber: json['insurance_number'],
      insuranceExpiry: json['insurance_expiry'],
      isOnline: json['is_online'] ?? false,
      isAvailable: json['is_available'] ?? false,
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
      'vehicle_model': vehicleModel,
      'vehicle_color': vehicleColor,
      'license_expiry': licenseExpiry,
      'insurance_number': insuranceNumber,
      'insurance_expiry': insuranceExpiry,
      'is_online': isOnline,
      'is_available': isAvailable,
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
    String? vehicleModel,
    String? vehicleColor,
    String? licenseExpiry,
    String? insuranceNumber,
    String? insuranceExpiry,
    bool? isOnline,
    bool? isAvailable,
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
      vehicleModel: vehicleModel ?? this.vehicleModel,
      vehicleColor: vehicleColor ?? this.vehicleColor,
      licenseExpiry: licenseExpiry ?? this.licenseExpiry,
      insuranceNumber: insuranceNumber ?? this.insuranceNumber,
      insuranceExpiry: insuranceExpiry ?? this.insuranceExpiry,
      isOnline: isOnline ?? this.isOnline,
      isAvailable: isAvailable ?? this.isAvailable,
      rating: rating ?? this.rating,
      totalRides: totalRides ?? this.totalRides,
      totalEarnings: totalEarnings ?? this.totalEarnings,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

