import 'dart:async';
import 'dart:developer' as dev;
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import '../../constants/app_constants.dart';
import '../../services/location_service.dart';
import '../../services/socket_service.dart';
import '../../services/supabase_service.dart';
import '../../services/api_service.dart';
import '../../services/connectivity_service.dart';
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
  Timer? _locationRefreshTimer;
  
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

      // Get driver profile - this is critical, so show progress
      _driver = await SupabaseService.getDriverProfile(user.id);
      if (_driver == null) {
        _navigateToLogin();
        return;
      }

      // Show UI immediately after getting driver profile
      setState(() {
        _isLoading = false;
        _currentLocation = _defaultLocation; // Always start with fallback location
      });
      
      // Start all service initializations asynchronously (non-blocking)
      _initializeServicesAsync();
      
      dev.log('App initialization complete', name: 'HomeScreen');
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
  
  Future<void> _initializeServicesAsync() async {
    try {
      // Start all services in parallel without blocking UI
      final futures = [
        _checkLocationServices(),
        ConnectivityService.initialize(),
        SocketService.initialize(),
      ];
      
      // Wait for basic services with timeout
      await Future.wait(futures).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          dev.log('Service initialization timed out, continuing with defaults', name: 'HomeScreen');
          return <void>[];
        },
      );
      
      // Try to get actual location with timeout
      _getCurrentLocation().timeout(
        const Duration(seconds: 8),
        onTimeout: () {
          dev.log('Location fetch timed out, using default location', name: 'HomeScreen');
          if (mounted) {
            setState(() {
              _locationError = 'Location unavailable - using default';
            });
          }
        },
      ).catchError((e) {
        dev.log('Location error: $e', name: 'HomeScreen');
        if (mounted) {
          setState(() {
            _locationError = 'Location error: ${e.toString()}';
          });
        }
      });
      
      // Check connectivity
      ConnectivityService.checkConnectivity().then((hasInternet) {
        if (!hasInternet && mounted) {
          setState(() {
            _locationError = 'No internet connection';
          });
        }
      }).catchError((e) {
        dev.log('Connectivity check error: $e', name: 'HomeScreen');
      });
      
      // Set up listeners (non-blocking)
      _setupListeners();
      
    } catch (e) {
      dev.log('Error in async service initialization: $e', name: 'HomeScreen');
    }
  }
  
  void _setupListeners() {
    try {
      // Listen to location updates with error handling
      LocationService.locationStream.listen(
        (position) {
          _updateLocation(position);
        },
        onError: (error) {
          dev.log('Location stream error: $error', name: 'HomeScreen');
          if (mounted) {
            setState(() {
              _locationError = 'Location tracking error: $error';
            });
          }
          // Try to restart location tracking
          Future.delayed(const Duration(seconds: 5), () {
            if (mounted && _hasLocationPermission && _isLocationServiceEnabled) {
              _refreshLocation();
            }
          });
        },
      );

      // Listen to connectivity changes
      ConnectivityService.connectionStatusStream.listen((hasConnection) {
        if (mounted) {
          setState(() {
            if (!hasConnection) {
              _locationError = 'No internet connection';
              _isOnline = false; // Force offline when no internet
            } else if (_locationError == 'No internet connection') {
              _locationError = null; // Clear error when connection restored
            }
          });
        }
      });
      
      // Listen to ride requests with comprehensive debugging
      SocketService.rideRequestStream.listen(
        (ride) {
          dev.log('=== RIDE REQUEST RECEIVED IN HOME SCREEN ===', name: 'HomeScreen');
          dev.log('Ride ID: ${ride.id}', name: 'HomeScreen');
          dev.log('Passenger: ${ride.passengerName}', name: 'HomeScreen');
          dev.log('Pickup: ${ride.pickupAddress}', name: 'HomeScreen');
          dev.log('Destination: ${ride.destinationAddress}', name: 'HomeScreen');
          dev.log('Status: ${ride.status}', name: 'HomeScreen');
          dev.log('Driver is online: $_isOnline', name: 'HomeScreen');
          dev.log('Current ride: $_currentRide', name: 'HomeScreen');
          
          if (_isOnline && _currentRide == null) {
            dev.log('Showing ride request popup...', name: 'HomeScreen');
            _showRideRequestPopup(ride);
          } else {
            dev.log('NOT showing popup - Online: $_isOnline, Current ride: $_currentRide', name: 'HomeScreen');
          }
        },
        onError: (error) {
          dev.log('ERROR in ride request stream: $error', name: 'HomeScreen');
        },
      );

      // Start periodic location refresh every 30 seconds for accuracy
      _locationRefreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
        if (mounted && _hasLocationPermission && _isLocationServiceEnabled) {
          _refreshLocation();
        }
      });
      
    } catch (e) {
      dev.log('Error setting up listeners: $e', name: 'HomeScreen');
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
      final newLocation = LatLng(position.latitude, position.longitude);
      
      setState(() {
        _currentLocation = newLocation;
        _locationError = null; // Clear any previous errors
      });

      dev.log('Updated location: ${position.latitude}, ${position.longitude} (accuracy: ${position.accuracy}m)', name: 'HomeScreen');

      // Update location on server if online
      if (_isOnline && _driver != null) {
        SocketService.updateLocation(
          driverId: _driver!.id,
          latitude: position.latitude,
          longitude: position.longitude,
          heading: position.heading.isNaN ? null : position.heading,
        );
      }

      // Animate camera to new location with smooth transition
      if (_mapController != null) {
        _mapController!.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(
              target: newLocation,
              zoom: 17.0, // Higher zoom for better detail
              bearing: position.heading, // Use GPS heading for better orientation
            ),
          ),
        );
      }
    }
  }


  void _toggleOnlineStatus(bool isOnline) async {
    dev.log('=== TOGGLE STATUS DEBUG START ===', name: 'HomeScreen');
    dev.log('Toggle function called with isOnline: $isOnline', name: 'HomeScreen');
    dev.log('Current _isOnline state: $_isOnline', name: 'HomeScreen');
    
    // Check if driver is loaded
    if (_driver == null) {
      dev.log('ERROR: Driver is null, cannot toggle status', name: 'HomeScreen');
      _showErrorSnackBar('Profile not loaded. Please restart the app.');
      return;
    }
    
    // Ensure services are initialized if going online
    if (isOnline) {
      dev.log('Ensuring services are ready for going online...', name: 'HomeScreen');
      
      // Check/initialize location services
      if (!_hasLocationPermission || !_isLocationServiceEnabled) {
        dev.log('Location services not ready, initializing...', name: 'HomeScreen');
        await _checkLocationServices();
        
        if (!_hasLocationPermission) {
          _showErrorSnackBar('Location permission is required to go online.');
          return;
        }
        
        if (!_isLocationServiceEnabled) {
          _showErrorSnackBar('Please enable location services to go online.');
          return;
        }
      }
      
      // Ensure we have a location (try to get it if we don't)
      if (_currentLocation == null || _currentLocation == _defaultLocation) {
        dev.log('Getting actual location before going online...', name: 'HomeScreen');
        _showErrorSnackBar('Getting your location...');
        
        try {
          await _getCurrentLocation().timeout(const Duration(seconds: 10));
        } catch (e) {
          dev.log('Failed to get location: $e', name: 'HomeScreen');
          _showErrorSnackBar('Unable to get your location. Using default location.');
          // Continue with default location
        }
      }
    }
    
    dev.log('Driver loaded - ID: ${_driver!.id}, Name: ${_driver!.name}, Email: ${_driver!.email}', name: 'HomeScreen');
    
    // Check location availability for going online
    if (isOnline && _currentLocation == null) {
      dev.log('ERROR: Location is null, cannot go online', name: 'HomeScreen');
      _showErrorSnackBar('Location not available. Please enable GPS and try again.');
      return;
    }
    
    // Check internet connectivity first
    if (isOnline) {
      dev.log('Checking internet connectivity before going online', name: 'HomeScreen');
      
      try {
        // Ensure ConnectivityService is initialized
        await ConnectivityService.initialize().timeout(const Duration(seconds: 5));
        
        // Check basic connectivity (not server reachability) to avoid timeout issues
        final hasBasicInternet = await ConnectivityService.hasInternetConnection();
        
        if (!hasBasicInternet) {
          dev.log('ERROR: No basic internet connection available', name: 'HomeScreen');
          _showErrorSnackBar('No internet connection. Please check your network and try again.');
          return;
        }
        
        dev.log('Basic internet connectivity confirmed', name: 'HomeScreen');
      } catch (e) {
        dev.log('Connectivity check failed: $e', name: 'HomeScreen');
        // Don't block the toggle for connectivity issues - let it proceed
        dev.log('Proceeding with toggle despite connectivity check failure', name: 'HomeScreen');
      }
      
      // Check socket connection for going online (non-blocking approach)
      try {
        // Ensure SocketService is initialized
        await SocketService.initialize().timeout(const Duration(seconds: 3));
        
        if (!SocketService.isConnected) {
          dev.log('WARNING: Socket not connected, will attempt to connect during API call...', name: 'HomeScreen');
          // Don't block the toggle - let it proceed and handle connection during API call
        } else {
          dev.log('Socket already connected', name: 'HomeScreen');
        }
      } catch (e) {
        dev.log('Socket initialization warning: $e - proceeding with toggle', name: 'HomeScreen');
        // Don't block the toggle for socket issues - the API call will handle connectivity
      }
    }
    
    dev.log('Pre-checks passed. Current location: $_currentLocation', name: 'HomeScreen');
    dev.log('Socket connected: ${SocketService.isConnected}', name: 'HomeScreen');
    
    // Update UI immediately to show loading state
    setState(() {
      _isOnline = isOnline;
    });

    try {
      dev.log('Step 1: Calling API to update driver status to: $isOnline', name: 'HomeScreen');
      dev.log('API URL will be: ${AppConstants.apiBaseUrl}/driver/status', name: 'HomeScreen');
      
      // 1. Update status in database via REST API
      final success = await ApiService.updateDriverStatus(
        driverId: _driver!.id,
        isOnline: isOnline,
      );
      
      dev.log('Step 1 Complete: API call result: $success', name: 'HomeScreen');

      if (!success) {
        dev.log('ERROR: Failed to update driver status in database', name: 'HomeScreen');
        // Revert UI state if database update failed
        setState(() {
          _isOnline = !isOnline;
        });
        _showErrorSnackBar('Failed to update status. Please try again.');
        return;
      }

      // 2. Handle Socket.IO and location tracking
      if (isOnline) {
        dev.log('Step 2: Going ONLINE - connecting socket and starting location tracking', name: 'HomeScreen');
        
        // Connect driver to socket for real-time features
        if (_currentLocation != null) {
          dev.log('Step 2a: Connecting driver to socket with location: ${_currentLocation!.latitude}, ${_currentLocation!.longitude}', name: 'HomeScreen');
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
            heading: null, // No heading available during initial connect
          );
          dev.log('Step 2a Complete: Driver connected to socket', name: 'HomeScreen');
        } else {
          dev.log('WARNING: Location is null when going online', name: 'HomeScreen');
        }

        // Start location tracking
        dev.log('Step 2b: Starting location tracking', name: 'HomeScreen');
        await LocationService.startLocationTracking();
        dev.log('Step 2b Complete: Location tracking started', name: 'HomeScreen');

        // Ensure driver is marked as available after going online
        dev.log('Step 2c: Setting driver as available', name: 'HomeScreen');
        await SocketService.setDriverAvailable(driverId: _driver!.id);
        dev.log('Step 2c Complete: Driver set as available', name: 'HomeScreen');
        
        dev.log('SUCCESS: Driver is now ONLINE - database and socket updated', name: 'HomeScreen');
        _showSuccessSnackBar('You are now online and ready to receive ride requests!');
      } else {
        dev.log('Step 2: Going OFFLINE - disconnecting socket and stopping location tracking', name: 'HomeScreen');
        
        // Disconnect driver from socket
        dev.log('Step 2a: Disconnecting driver from socket', name: 'HomeScreen');
        await SocketService.setDriverOffline(driverId: _driver!.id);
        dev.log('Step 2a Complete: Driver disconnected from socket', name: 'HomeScreen');

        // Stop location tracking
        dev.log('Step 2b: Stopping location tracking', name: 'HomeScreen');
        await LocationService.stopLocationTracking();
        dev.log('Step 2b Complete: Location tracking stopped', name: 'HomeScreen');

        dev.log('SUCCESS: Driver is now OFFLINE - database and socket updated', name: 'HomeScreen');
        _showSuccessSnackBar('You are now offline.');
      }
    } catch (e, stackTrace) {
      dev.log('ERROR: Exception in _toggleOnlineStatus: $e', name: 'HomeScreen');
      dev.log('Stack trace: $stackTrace', name: 'HomeScreen');
      
      // Revert UI state on error
      setState(() {
        _isOnline = !isOnline;
      });
      
      _showErrorSnackBar('Error: ${e.toString()}');
    }
    
    dev.log('=== TOGGLE STATUS DEBUG END ===', name: 'HomeScreen');
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

  void _showErrorSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: const Color(AppConstants.errorColorValue),
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  void _showSuccessSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: const Color(AppConstants.successColorValue),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  // TEMPORARY: Debug method to test ride request popup
  void _debugTestRideRequest() {
    dev.log('=== DEBUG: Testing ride request popup ===', name: 'HomeScreen');
    if (_currentLocation != null) {
      final testRide = Ride(
        id: 'test_${DateTime.now().millisecondsSinceEpoch}',
        driverId: _driver?.id ?? 'test_driver',
        passengerId: 'test_passenger',
        passengerName: 'Test Passenger',
        passengerPhone: '+1234567890',
        pickupLatitude: _currentLocation!.latitude + 0.001,
        pickupLongitude: _currentLocation!.longitude + 0.001,
        pickupAddress: 'Test Pickup Location',
        destinationLatitude: _currentLocation!.latitude + 0.005,
        destinationLongitude: _currentLocation!.longitude + 0.005,
        destinationAddress: 'Test Destination',
        distance: 2.5,
        duration: 10.0,
        fare: 15.0,
        status: RideStatus.requested,
        requestedAt: DateTime.now(),
      );
      _showRideRequestPopup(testRide);
    } else {
      _showErrorSnackBar('Location not available for test');
    }
  }


  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _locationRefreshTimer?.cancel();
    LocationService.dispose();
    SocketService.dispose();
    ConnectivityService.dispose();
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
                zoom: _hasLocationPermission && _isLocationServiceEnabled ? 17.0 : 12.0,
                bearing: 0.0,
                tilt: 0.0,
              ),
              onMapCreated: (GoogleMapController controller) async {
                _mapController = controller;
                
                // Enable location tracking immediately after map is created
                if (_hasLocationPermission && _isLocationServiceEnabled && !_isOnline) {
                  // Start location tracking even when offline for map updates
                  await LocationService.startLocationTracking();
                }
                
                dev.log('Map controller initialized', name: 'HomeScreen');
              },
              myLocationEnabled: _hasLocationPermission && _isLocationServiceEnabled,
              myLocationButtonEnabled: false,
              compassEnabled: true,
              rotateGesturesEnabled: true,
              scrollGesturesEnabled: true,
              tiltGesturesEnabled: true,
              zoomGesturesEnabled: true,
              zoomControlsEnabled: false,
              mapType: MapType.normal,
              markers: _buildMarkers(),
              polylines: _buildPolylines(),
              onCameraMove: (CameraPosition position) {
                // Optional: Log camera movements for debugging
                dev.log('Camera moved to: ${position.target}', name: 'HomeScreen');
              },
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
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_locationError != null)
            FloatingActionButton(
              heroTag: "location",
              onPressed: _refreshLocation,
              backgroundColor: const Color(AppConstants.primaryColorValue),
              tooltip: 'Refresh Location',
              child: const Icon(Icons.my_location, color: Colors.white),
            ),
          if (_locationError != null) const SizedBox(height: 10),
          // TEMPORARY: Debug button to test ride request popup
          FloatingActionButton(
            heroTag: "debug",
            onPressed: _debugTestRideRequest,
            backgroundColor: Colors.orange,
            tooltip: 'Test Ride Request',
            child: const Icon(Icons.bug_report, color: Colors.white),
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
