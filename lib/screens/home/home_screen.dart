import 'dart:developer' as dev;
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import '../../constants/app_constants.dart';
import '../../services/location_service.dart';
import '../../services/socket_service.dart';
import '../../services/supabase_service.dart';
import '../../models/driver_model.dart';
import '../../models/ride_model.dart';
import '../../widgets/online_toggle.dart';
import '../../widgets/ride_request_popup.dart';
import '../ride/ride_in_progress_screen.dart';
import '../earnings/earnings_screen.dart';
import '../profile/profile_screen.dart';
import '../../utils/polyline_utils.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  GoogleMapController? _mapController;
  LatLng? _currentLocation;
  Driver? _driver;
  Ride? _currentRide;
  bool _isOnline = false;
  bool _isLoading = true;
  bool _hasLocationPermission = false;
  bool _isLocationServiceEnabled = false;
  String? _locationError;
  
  // Default fallback location (New Delhi, India)
  static const LatLng _defaultLocation = LatLng(28.6139, 77.2090);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeApp();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // Refresh location when app comes back to foreground
      _refreshLocation();
    } else if (state == AppLifecycleState.paused) {
      // Optionally pause location tracking to save battery
      if (!_isOnline) {
        LocationService.stopLocationTracking();
      }
    }
  }

  Future<void> _initializeApp() async {
    try {
      // Get current user
      final user = SupabaseService.getCurrentUser();
      if (user == null) {
        _navigateToLogin();
        return;
      }

      // Get driver profile
      _driver = await SupabaseService.getDriverProfile(user.id);
      if (_driver == null) {
        _navigateToLogin();
        return;
      }

      // Check location permissions and services
      await _checkLocationServices();
      
      // Get current location (with fallback)
      await _getCurrentLocation();

      // Initialize socket service
      await SocketService.initialize();

      // Listen to location updates
      LocationService.locationStream.listen((position) {
        _updateLocation(position);
      });

      // Listen to ride requests
      SocketService.rideRequestStream.listen((ride) {
        _showRideRequestPopup(ride);
      });

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      dev.log('Error initializing app: $e', name: 'HomeScreen');
      setState(() {
        _isLoading = false;
        _locationError = 'Failed to initialize: ${e.toString()}';
        // Use fallback location to show map
        _currentLocation = _defaultLocation;
      });
    }
  }

  Future<void> _checkLocationServices() async {
    try {
      _hasLocationPermission = await LocationService.requestLocationPermission();
      _isLocationServiceEnabled = await LocationService.isLocationServiceEnabled();
      
      if (!_hasLocationPermission) {
        _locationError = 'Location permission denied';
      } else if (!_isLocationServiceEnabled) {
        _locationError = 'Location services disabled';
      } else {
        _locationError = null;
      }
    } catch (e) {
      dev.log('Error checking location services: $e', name: 'HomeScreen');
      _locationError = 'Error checking location services';
    }
  }
  
  Future<void> _getCurrentLocation() async {
    try {
      if (_hasLocationPermission && _isLocationServiceEnabled) {
        final position = await LocationService.getCurrentPosition();
        if (position != null) {
          setState(() {
            _currentLocation = LatLng(position.latitude, position.longitude);
            _locationError = null;
          });

          if (_mapController != null) {
            _mapController!.animateCamera(
              CameraUpdate.newLatLng(_currentLocation!),
            );
          }
          return;
        }
      }
      
      // Fallback to default location if we can't get current location
      setState(() {
        _currentLocation = _defaultLocation;
        if (!_hasLocationPermission || !_isLocationServiceEnabled) {
          _locationError = !_hasLocationPermission 
            ? 'Location permission required' 
            : 'Location services disabled';
        }
      });
      
    } catch (e) {
      dev.log('Error getting current location: $e', name: 'HomeScreen');
      setState(() {
        _currentLocation = _defaultLocation;
        _locationError = 'Unable to get location';
      });
    }
  }
  
  Future<void> _refreshLocation() async {
    if (mounted) {
      await _checkLocationServices();
      await _getCurrentLocation();
    }
  }
  
  void _updateLocation(Position position) {
    if (mounted && _hasLocationPermission && _isLocationServiceEnabled) {
      setState(() {
        _currentLocation = LatLng(position.latitude, position.longitude);
        _locationError = null; // Clear any previous errors
      });

      // Update location on server if online
      if (_isOnline && _driver != null) {
        SocketService.updateLocation(
          driverId: _driver!.id,
          latitude: position.latitude,
          longitude: position.longitude,
        );
      }

      // Animate camera to new location
      if (_mapController != null) {
        _mapController!.animateCamera(
          CameraUpdate.newLatLng(_currentLocation!),
        );
      }
    }
  }


  void _toggleOnlineStatus(bool isOnline) async {
    setState(() {
      _isOnline = isOnline;
    });

    if (isOnline) {
      // Connect driver to socket
      if (_currentLocation != null) {
        await SocketService.connectDriver(
          driverId: _driver!.id,
          name: _driver!.name,
          phone: _driver!.phone,
          vehicleType: _driver!.vehicleType ?? 'Sedan',
          vehicleNumber: _driver!.vehicleNumber ?? 'N/A',
          rating: _driver!.rating ?? 4.5,
          totalRides: _driver!.totalRides,
          totalEarnings: _driver!.totalEarnings,
          latitude: _currentLocation!.latitude,
          longitude: _currentLocation!.longitude,
        );
      }

      // Start location tracking
      await LocationService.startLocationTracking();

      // Status is handled by backend via Socket.IO
    } else {
      // Disconnect driver from socket
      await SocketService.setDriverOffline(driverId: _driver!.id);

      // Stop location tracking
      await LocationService.stopLocationTracking();

      // Status is handled by backend via Socket.IO
    }
  }

  void _showRideRequestPopup(Ride ride) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => RideRequestPopup(
        ride: ride,
        onAccept: () => _acceptRide(ride),
        onReject: () => _rejectRide(ride),
      ),
    );
  }

  Future<void> _acceptRide(Ride ride) async {
    try {
      // Accept ride via socket
      await SocketService.acceptRide(
        rideId: ride.id,
        driverId: _driver!.id,
      );

      // Ride status update handled by backend via Socket.IO

      setState(() {
        _currentRide = ride;
      });

      // Navigate to ride in progress screen
      if (mounted) {
        Navigator.of(context).push(
          CupertinoPageRoute(
            builder: (context) => RideInProgressScreen(ride: ride),
          ),
        );
      }
    } catch (e) {
      dev.log('Error accepting ride: $e', name: 'HomeScreen');
    }
  }

  Future<void> _rejectRide(Ride ride) async {
    try {
      // Reject ride via socket
      await SocketService.rejectRide(
        rideId: ride.id,
        driverId: _driver!.id,
      );
    } catch (e) {
      dev.log('Error rejecting ride: $e', name: 'HomeScreen');
    }
  }

  void _navigateToLogin() {
    Navigator.of(context).pushReplacementNamed('/login');
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    LocationService.dispose();
    SocketService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(AppConstants.backgroundColorValue),
        body: Center(
          child: CircularProgressIndicator(
            color: Color(AppConstants.primaryColorValue),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(AppConstants.backgroundColorValue),
      appBar: AppBar(
        backgroundColor: const Color(AppConstants.backgroundColorValue),
        elevation: 0,
        title: const Text(
          'TourTaxi Driver',
          style: TextStyle(
            fontSize: AppConstants.fontSizeLarge,
            fontWeight: FontWeight.w600,
            color: Color(AppConstants.textColorValue),
          ),
        ),
        actions: [
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const ProfileScreen(),
                ),
              );
            },
            child: Container(
              width: 35,
              height: 35,
              margin: const EdgeInsets.only(right: 16),
              decoration: BoxDecoration(
                color: const Color(AppConstants.primaryColorValue),
                borderRadius: BorderRadius.circular(17.5),
              ),
              child: const Icon(
                Icons.person,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Google Map
          if (_currentLocation != null)
            GoogleMap(
              initialCameraPosition: CameraPosition(
                target: _currentLocation!,
                zoom: _hasLocationPermission && _isLocationServiceEnabled ? 15.0 : 12.0,
              ),
              onMapCreated: (GoogleMapController controller) {
                _mapController = controller;
              },
              myLocationEnabled: _hasLocationPermission && _isLocationServiceEnabled,
              myLocationButtonEnabled: false,
              markers: _buildMarkers(),
              polylines: _buildPolylines(),
            )
          else
            const Center(
              child: CircularProgressIndicator(
                color: Color(AppConstants.primaryColorValue),
              ),
            ),

          // Location Error Banner
          if (_locationError != null)
            Positioned(
              top: 80,
              left: 20,
              right: 20,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(AppConstants.errorColorValue),
                  borderRadius: BorderRadius.circular(AppConstants.borderRadius),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.warning,
                      color: Colors.white,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _locationError!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: AppConstants.fontSizeSmall,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: _refreshLocation,
                      child: const Text(
                        'Retry',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: AppConstants.fontSizeSmall,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Online/Offline Toggle
          Positioned(
            top: 20,
            left: 20,
            right: 20,
            child: OnlineToggle(
              isOnline: _isOnline,
              onToggle: _toggleOnlineStatus,
            ),
          ),

          // Bottom Navigation
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Color(AppConstants.backgroundColorValue),
                border: Border(
                  top: BorderSide(
                    color: Color(AppConstants.borderColorValue),
                    width: 0.5,
                  ),
                ),
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppConstants.spacingLarge,
                    vertical: AppConstants.spacingMedium,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildNavItem(
                        icon: Icons.home,
                        label: 'Home',
                        isSelected: true,
                        onTap: () {},
                      ),
                      _buildNavItem(
                        icon: Icons.attach_money,
                        label: 'Earnings',
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (context) => const EarningsScreen(),
                            ),
                          );
                        },
                      ),
                      _buildNavItem(
                        icon: Icons.person,
                        label: 'Profile',
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (context) => const ProfileScreen(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Set<Marker> _buildMarkers() {
    Set<Marker> markers = {};

    if (_currentLocation != null) {
      markers.add(
        Marker(
          markerId: const MarkerId('driver_location'),
          position: _currentLocation!,
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueBlue),
          infoWindow: const InfoWindow(
            title: 'Your Location',
          ),
        ),
      );
    }

    // Add ride markers if there's a current ride
    if (_currentRide != null) {
      // Pickup marker
      markers.add(
        Marker(
          markerId: const MarkerId('pickup'),
          position: LatLng(_currentRide!.pickupLatitude, _currentRide!.pickupLongitude),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
          infoWindow: const InfoWindow(title: 'Pickup Location'),
        ),
      );

      // Destination marker
      markers.add(
        Marker(
          markerId: const MarkerId('destination'),
          position: LatLng(_currentRide!.destinationLatitude, _currentRide!.destinationLongitude),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
          infoWindow: const InfoWindow(title: 'Destination'),
        ),
      );
    }

    return markers;
  }

  Set<Polyline> _buildPolylines() {
    Set<Polyline> polylines = {};

    if (_currentRide != null) {
      // Add route polyline (pickup to destination)
      if (_currentRide!.routePolyline != null && _currentRide!.routePolyline!.isNotEmpty) {
        polylines.add(PolylineUtils.createRoutePolyline(_currentRide!.routePolyline!));
      }

      // Add driver to pickup polyline
      if (_currentRide!.driverToPickupPolyline != null && _currentRide!.driverToPickupPolyline!.isNotEmpty) {
        polylines.add(PolylineUtils.createDriverToPickupPolyline(_currentRide!.driverToPickupPolyline!));
      }
    }

    return polylines;
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isSelected = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isSelected
                ? const Color(AppConstants.primaryColorValue)
                : const Color(AppConstants.secondaryTextColorValue),
            size: 24,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: AppConstants.fontSizeSmall,
              color: isSelected
                  ? const Color(AppConstants.primaryColorValue)
                  : const Color(AppConstants.secondaryTextColorValue),
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}
