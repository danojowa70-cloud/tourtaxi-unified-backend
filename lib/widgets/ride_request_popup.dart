import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../constants/app_constants.dart';
import '../models/ride_model.dart';
import '../widgets/custom_button.dart';

class RideRequestPopup extends StatelessWidget {
  final Ride ride;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  const RideRequestPopup({
    super.key,
    required this.ride,
    required this.onAccept,
    required this.onReject,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(AppConstants.backgroundColorValue),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(AppConstants.borderRadius * 2),
          topRight: Radius.circular(AppConstants.borderRadius * 2),
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppConstants.spacingLarge),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Handle bar
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(AppConstants.borderColorValue),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              
              const SizedBox(height: AppConstants.spacingLarge),
              
              // Title
              const Text(
                'New Ride Request',
                style: TextStyle(
                  fontSize: AppConstants.fontSizeXLarge,
                  fontWeight: FontWeight.bold,
                  color: Color(AppConstants.textColorValue),
                ),
                textAlign: TextAlign.center,
              )
                  .animate()
                  .fadeIn(duration: AppConstants.shortAnimation)
                  .slideY(
                    begin: 0.3,
                    end: 0,
                    duration: AppConstants.shortAnimation,
                  ),
              
              const SizedBox(height: AppConstants.spacingLarge),
              
              // Passenger info
              Container(
                padding: const EdgeInsets.all(AppConstants.spacingMedium),
                decoration: BoxDecoration(
                  color: const Color(AppConstants.borderColorValue).withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(AppConstants.borderRadius),
                ),
                child: Row(
                  children: [
                    // Passenger avatar
                    Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        color: const Color(AppConstants.primaryColorValue),
                        borderRadius: BorderRadius.circular(25),
                      ),
                      child: ride.passengerImage != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(25),
                              child: Image.network(
                                ride.passengerImage!,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return const Icon(
                                    CupertinoIcons.person_fill,
                                    color: Colors.white,
                                    size: 25,
                                  );
                                },
                              ),
                            )
                          : const Icon(
                              CupertinoIcons.person_fill,
                              color: Colors.white,
                              size: 25,
                            ),
                    ),
                    
                    const SizedBox(width: AppConstants.spacingMedium),
                    
                    // Passenger details
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            ride.passengerName,
                            style: const TextStyle(
                              fontSize: AppConstants.fontSizeLarge,
                              fontWeight: FontWeight.w600,
                              color: Color(AppConstants.textColorValue),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            ride.passengerPhone,
                            style: const TextStyle(
                              fontSize: AppConstants.fontSizeMedium,
                              color: Color(AppConstants.secondaryTextColorValue),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
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
                            ride.pickupAddress,
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
                            ride.destinationAddress,
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
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Distance: ${ride.distance.toStringAsFixed(1)} km',
                              style: const TextStyle(
                                fontSize: AppConstants.fontSizeMedium,
                                color: Color(AppConstants.secondaryTextColorValue),
                              ),
                            ),
                            if (ride.duration != null)
                              Text(
                                'Duration: ${ride.duration!.toStringAsFixed(0)} mins',
                                style: const TextStyle(
                                  fontSize: AppConstants.fontSizeSmall,
                                  color: Color(AppConstants.secondaryTextColorValue),
                                ),
                              ),
                          ],
                        ),
                        Text(
                          'Fare: \$${ride.fare.toStringAsFixed(2)}',
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
              
              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: CustomButton(
                      text: 'Reject',
                      onPressed: onReject,
                      backgroundColor: const Color(AppConstants.errorColorValue),
                    ),
                  ),
                  
                  const SizedBox(width: AppConstants.spacingMedium),
                  
                  Expanded(
                    child: CustomButton(
                      text: 'Accept',
                      onPressed: onAccept,
                      backgroundColor: const Color(AppConstants.successColorValue),
                    ),
                  ),
                ],
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
    );
  }
}
