import 'dart:developer' as dev;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../constants/app_constants.dart';
import '../../models/ride_model.dart';
import '../../services/socket_service.dart';
import '../../services/supabase_service.dart';
import '../../widgets/custom_button.dart';
import '../../utils/polyline_utils.dart';

class RideInProgressScreen extends StatefulWidget {
  final Ride ride;

  const RideInProgressScreen({
    super.key,
    required this.ride,
  });

  @override
  State<RideInProgressScreen> createState() => _RideInProgressScreenState();
}

class _RideInProgressScreenState extends State<RideInProgressScreen> {
  RideStatus _currentStatus = RideStatus.accepted;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.ride.status;
  }

  Future<void> _startRide() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Start ride via socket
      await SocketService.startRide(
        rideId: widget.ride.id,
        driverId: widget.ride.driverId,
      );

      // Update ride status in database
      await SupabaseService.updateRideStatus(
        rideId: widget.ride.id,
        status: 'started',
        startedAt: DateTime.now(),
      );

      setState(() {
        _currentStatus = RideStatus.started;
      });
    } catch (e) {
      dev.log('Error starting ride: $e', name: 'RideInProgressScreen');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _completeRide() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Complete ride via socket
      await SocketService.completeRide(
        rideId: widget.ride.id,
        driverId: widget.ride.driverId,
      );

      // Update ride status in database
      await SupabaseService.updateRideStatus(
        rideId: widget.ride.id,
        status: 'completed',
        completedAt: DateTime.now(),
      );

      // Navigate back to home
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      dev.log('Error completing ride: $e', name: 'RideInProgressScreen');
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(AppConstants.backgroundColorValue),
      appBar: AppBar(
        backgroundColor: const Color(AppConstants.backgroundColorValue),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(AppConstants.textColorValue)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          _getStatusTitle(),
          style: const TextStyle(
            fontSize: AppConstants.fontSizeLarge,
            fontWeight: FontWeight.w600,
            color: Color(AppConstants.textColorValue),
          ),
        ),
      ),
      body: Stack(
        children: [
          // Google Map
          GoogleMap(
            initialCameraPosition: CameraPosition(
              target: LatLng(
                widget.ride.pickupLatitude,
                widget.ride.pickupLongitude,
              ),
              zoom: 15.0,
            ),
            onMapCreated: (GoogleMapController controller) {
              // Map controller ready
            },
            myLocationEnabled: true,
            myLocationButtonEnabled: false,
            markers: _buildMarkers(),
            polylines: _buildPolylines(),
          ),

          // Ride details card
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Color(AppConstants.backgroundColorValue),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(AppConstants.borderRadius * 2),
                  topRight: Radius.circular(AppConstants.borderRadius * 2),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 10,
                    offset: Offset(0, -5),
                  ),
                ],
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(AppConstants.spacingLarge),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Status indicator
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppConstants.spacingMedium,
                          vertical: AppConstants.spacingSmall,
                        ),
                        decoration: BoxDecoration(
                          color: _getStatusColor().withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppConstants.borderRadius),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: _getStatusColor(),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: AppConstants.spacingSmall),
                            Text(
                              _getStatusTitle(),
                              style: TextStyle(
                                fontSize: AppConstants.fontSizeMedium,
                                fontWeight: FontWeight.w600,
                                color: _getStatusColor(),
                              ),
                            ),
                          ],
                        ),
                      )
                          .animate()
                          .fadeIn(duration: AppConstants.shortAnimation)
                          .scale(
                            duration: AppConstants.shortAnimation,
                            curve: Curves.elasticOut,
                          ),

                      const SizedBox(height: AppConstants.spacingLarge),

                      // Passenger info
                      Row(
                        children: [
                          Container(
                            width: 50,
                            height: 50,
                            decoration: BoxDecoration(
                              color: const Color(AppConstants.primaryColorValue),
                              borderRadius: BorderRadius.circular(25),
                            ),
                            child: widget.ride.passengerImage != null
                                ? ClipRRect(
                                    borderRadius: BorderRadius.circular(25),
                                    child: Image.network(
                                      widget.ride.passengerImage!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (context, error, stackTrace) {
                                        return const Icon(
                                          Icons.person,
                                          color: Colors.white,
                                          size: 25,
                                        );
                                      },
                                    ),
                                  )
                                : const Icon(
                                    Icons.person,
                                    color: Colors.white,
                                    size: 25,
                                  ),
                          ),
                          const SizedBox(width: AppConstants.spacingMedium),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.ride.passengerName,
                                  style: const TextStyle(
                                    fontSize: AppConstants.fontSizeLarge,
                                    fontWeight: FontWeight.w600,
                                    color: Color(AppConstants.textColorValue),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.ride.passengerPhone,
                                  style: const TextStyle(
                                    fontSize: AppConstants.fontSizeMedium,
                                    color: Color(AppConstants.secondaryTextColorValue),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              // TODO: Implement call functionality
                            },
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: const Color(AppConstants.successColorValue),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Icon(
                                Icons.phone,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                        ],
                      )
                          .animate()
                          .fadeIn(
                            delay: const Duration(milliseconds: 200),
                            duration: AppConstants.shortAnimation,
                          )
                          .slideX(
                            begin: -0.3,
                            end: 0,
                            delay: const Duration(milliseconds: 200),
                            duration: AppConstants.shortAnimation,
                          ),

                      const SizedBox(height: AppConstants.spacingLarge),

                      // Ride details
                      Container(
                        padding: const EdgeInsets.all(AppConstants.spacingMedium),
                        decoration: BoxDecoration(
                          color: const Color(AppConstants.borderColorValue).withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(AppConstants.borderRadius),
                        ),
                        child: Column(
                          children: [
                            // Pickup location
                            Row(
                              children: [
                                Container(
                                  width: 12,
                                  height: 12,
                                  decoration: const BoxDecoration(
                                    color: Color(AppConstants.successColorValue),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: AppConstants.spacingMedium),
                                Expanded(
                                  child: Text(
                                    widget.ride.pickupAddress,
                                    style: const TextStyle(
                                      fontSize: AppConstants.fontSizeMedium,
                                      color: Color(AppConstants.textColorValue),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppConstants.spacingMedium),
                            // Destination
                            Row(
                              children: [
                                Container(
                                  width: 12,
                                  height: 12,
                                  decoration: const BoxDecoration(
                                    color: Color(AppConstants.errorColorValue),
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: AppConstants.spacingMedium),
                                Expanded(
                                  child: Text(
                                    widget.ride.destinationAddress,
                                    style: const TextStyle(
                                      fontSize: AppConstants.fontSizeMedium,
                                      color: Color(AppConstants.textColorValue),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppConstants.spacingMedium),
                            // Distance and fare
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Distance: ${widget.ride.distance.toStringAsFixed(1)} km',
                                  style: const TextStyle(
                                    fontSize: AppConstants.fontSizeMedium,
                                    color: Color(AppConstants.secondaryTextColorValue),
                                  ),
                                ),
                                Text(
                                  'Fare: \$${widget.ride.fare.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    fontSize: AppConstants.fontSizeLarge,
                                    fontWeight: FontWeight.bold,
                                    color: Color(AppConstants.primaryColorValue),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      )
                          .animate()
                          .fadeIn(
                            delay: const Duration(milliseconds: 400),
                            duration: AppConstants.shortAnimation,
                          )
                          .slideX(
                            begin: 0.3,
                            end: 0,
                            delay: const Duration(milliseconds: 400),
                            duration: AppConstants.shortAnimation,
                          ),

                      const SizedBox(height: AppConstants.spacingLarge),

                      // Action button
                      CustomButton(
                        text: _getActionButtonText(),
                        onPressed: _isLoading ? null : _handleAction,
                        isLoading: _isLoading,
                        backgroundColor: _getActionButtonColor(),
                      )
                          .animate()
                          .fadeIn(
                            delay: const Duration(milliseconds: 600),
                            duration: AppConstants.shortAnimation,
                          )
                          .slideY(
                            begin: 0.3,
                            end: 0,
                            delay: const Duration(milliseconds: 600),
                            duration: AppConstants.shortAnimation,
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

    // Pickup marker
    markers.add(
      Marker(
        markerId: const MarkerId('pickup'),
        position: LatLng(
          widget.ride.pickupLatitude,
          widget.ride.pickupLongitude,
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
        infoWindow: const InfoWindow(title: 'Pickup Location'),
      ),
    );

    // Destination marker
    markers.add(
      Marker(
        markerId: const MarkerId('destination'),
        position: LatLng(
          widget.ride.destinationLatitude,
          widget.ride.destinationLongitude,
        ),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
        infoWindow: const InfoWindow(title: 'Destination'),
      ),
    );

    return markers;
  }

  Set<Polyline> _buildPolylines() {
    Set<Polyline> polylines = {};

    // Add route polyline (pickup to destination)
    if (widget.ride.routePolyline != null && widget.ride.routePolyline!.isNotEmpty) {
      polylines.add(PolylineUtils.createRoutePolyline(widget.ride.routePolyline!));
    }

    // Add driver to pickup polyline
    if (widget.ride.driverToPickupPolyline != null && widget.ride.driverToPickupPolyline!.isNotEmpty) {
      polylines.add(PolylineUtils.createDriverToPickupPolyline(widget.ride.driverToPickupPolyline!));
    }

    return polylines;
  }

  String _getStatusTitle() {
    switch (_currentStatus) {
      case RideStatus.accepted:
        return 'Ride Accepted';
      case RideStatus.started:
        return 'Ride In Progress';
      case RideStatus.completed:
        return 'Ride Completed';
      default:
        return 'Ride Status';
    }
  }

  Color _getStatusColor() {
    switch (_currentStatus) {
      case RideStatus.accepted:
        return const Color(AppConstants.warningColorValue);
      case RideStatus.started:
        return const Color(AppConstants.primaryColorValue);
      case RideStatus.completed:
        return const Color(AppConstants.successColorValue);
      default:
        return const Color(AppConstants.secondaryTextColorValue);
    }
  }

  String _getActionButtonText() {
    switch (_currentStatus) {
      case RideStatus.accepted:
        return 'Start Ride';
      case RideStatus.started:
        return 'Complete Ride';
      default:
        return 'Continue';
    }
  }

  Color _getActionButtonColor() {
    switch (_currentStatus) {
      case RideStatus.accepted:
        return const Color(AppConstants.primaryColorValue);
      case RideStatus.started:
        return const Color(AppConstants.successColorValue);
      default:
        return const Color(AppConstants.primaryColorValue);
    }
  }

  void _handleAction() {
    switch (_currentStatus) {
      case RideStatus.accepted:
        _startRide();
        break;
      case RideStatus.started:
        _completeRide();
        break;
      default:
        break;
    }
  }
}
