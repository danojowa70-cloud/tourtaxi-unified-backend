import 'dart:developer' as dev;
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../constants/app_constants.dart';
import '../../services/supabase_service.dart';
import '../../models/ride_model.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  Map<String, double> _earnings = {};
  List<Ride> _recentRides = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadEarningsData();
  }

  Future<void> _loadEarningsData() async {
    try {
      final user = SupabaseService.getCurrentUser();
      if (user != null) {
        // Load earnings
        final earnings = await SupabaseService.getDriverEarnings(user.id);
        final earningsMap = earnings.cast<String, double>();
        
        // Load recent rides
        final rides = await SupabaseService.getDriverRides(user.id);
        
        setState(() {
          _earnings = earningsMap;
          _recentRides = rides.take(10).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      dev.log('Error loading earnings data: $e', name: 'EarningsScreen');
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(AppConstants.backgroundColorValue),
      navigationBar: const CupertinoNavigationBar(
        backgroundColor: Color(AppConstants.backgroundColorValue),
        border: null,
        middle: Text(
          'Earnings',
          style: TextStyle(
            fontSize: AppConstants.fontSizeLarge,
            fontWeight: FontWeight.w600,
            color: Color(AppConstants.textColorValue),
          ),
        ),
      ),
      child: _isLoading
          ? const Center(
              child: CupertinoActivityIndicator(
                radius: 20,
                color: Color(AppConstants.primaryColorValue),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(AppConstants.spacingLarge),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Earnings summary cards
                  _buildEarningsSummary()
                      .animate()
                      .fadeIn(duration: AppConstants.shortAnimation)
                      .slideY(
                        begin: -0.3,
                        end: 0,
                        duration: AppConstants.shortAnimation,
                      ),

                  const SizedBox(height: AppConstants.spacingLarge),

                  // Recent rides section
                  const Text(
                    'Recent Rides',
                    style: TextStyle(
                      fontSize: AppConstants.fontSizeXLarge,
                      fontWeight: FontWeight.bold,
                      color: Color(AppConstants.textColorValue),
                    ),
                  )
                      .animate()
                      .fadeIn(
                        delay: const Duration(milliseconds: 200),
                        duration: AppConstants.shortAnimation,
                      ),

                  const SizedBox(height: AppConstants.spacingMedium),

                  // Recent rides list
                  _buildRecentRidesList()
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
                ],
              ),
            ),
    );
  }

  Widget _buildEarningsSummary() {
    return Column(
      children: [
        // Total earnings card
        Container(
          padding: const EdgeInsets.all(AppConstants.spacingLarge),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [
                Color(AppConstants.primaryColorValue),
                Color(0xFF0056CC),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppConstants.borderRadius * 2),
            boxShadow: [
              BoxShadow(
                color: const Color(AppConstants.primaryColorValue).withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            children: [
              const Text(
                'Total Earnings',
                style: TextStyle(
                  fontSize: AppConstants.fontSizeLarge,
                  color: Colors.white,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: AppConstants.spacingSmall),
              Text(
                '\$${_earnings['total']?.toStringAsFixed(2) ?? '0.00'}',
                style: const TextStyle(
                  fontSize: AppConstants.fontSizeXXLarge,
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: AppConstants.spacingMedium),

        // Period earnings row
        Row(
          children: [
            Expanded(
              child: _buildEarningsCard(
                title: 'Today',
                amount: _earnings['today'] ?? 0.0,
                icon: CupertinoIcons.calendar,
              ),
            ),
            const SizedBox(width: AppConstants.spacingMedium),
            Expanded(
              child: _buildEarningsCard(
                title: 'This Week',
                amount: _earnings['week'] ?? 0.0,
                icon: CupertinoIcons.calendar_today,
              ),
            ),
          ],
        ),

        const SizedBox(height: AppConstants.spacingMedium),

        Row(
          children: [
            Expanded(
              child: _buildEarningsCard(
                title: 'This Month',
                amount: _earnings['month'] ?? 0.0,
                icon: CupertinoIcons.calendar_badge_plus,
              ),
            ),
            const SizedBox(width: AppConstants.spacingMedium),
            Expanded(
              child: _buildEarningsCard(
                title: 'Total Rides',
                amount: _recentRides.length.toDouble(),
                icon: CupertinoIcons.car,
                isCount: true,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildEarningsCard({
    required String title,
    required double amount,
    required IconData icon,
    bool isCount = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppConstants.spacingMedium),
      decoration: BoxDecoration(
        color: const Color(AppConstants.backgroundColorValue),
        borderRadius: BorderRadius.circular(AppConstants.borderRadius),
        border: Border.all(
          color: const Color(AppConstants.borderColorValue),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(
            icon,
            color: const Color(AppConstants.primaryColorValue),
            size: 24,
          ),
          const SizedBox(height: AppConstants.spacingSmall),
          Text(
            title,
            style: const TextStyle(
              fontSize: AppConstants.fontSizeSmall,
              color: Color(AppConstants.secondaryTextColorValue),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: AppConstants.spacingSmall),
          Text(
            isCount ? amount.toInt().toString() : '\$${amount.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: AppConstants.fontSizeLarge,
              color: Color(AppConstants.textColorValue),
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentRidesList() {
    if (_recentRides.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(AppConstants.spacingXLarge),
        decoration: BoxDecoration(
          color: const Color(AppConstants.borderColorValue).withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(AppConstants.borderRadius),
        ),
        child: const Column(
          children: [
            Icon(
              CupertinoIcons.car,
              size: 50,
              color: Color(AppConstants.secondaryTextColorValue),
            ),
            SizedBox(height: AppConstants.spacingMedium),
            Text(
              'No rides yet',
              style: TextStyle(
                fontSize: AppConstants.fontSizeLarge,
                color: Color(AppConstants.secondaryTextColorValue),
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: AppConstants.spacingSmall),
            Text(
              'Start driving to see your earnings here',
              style: TextStyle(
                fontSize: AppConstants.fontSizeMedium,
                color: Color(AppConstants.secondaryTextColorValue),
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return Column(
      children: _recentRides.map((ride) => _buildRideItem(ride)).toList(),
    );
  }

  Widget _buildRideItem(Ride ride) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppConstants.spacingMedium),
      padding: const EdgeInsets.all(AppConstants.spacingMedium),
      decoration: BoxDecoration(
        color: const Color(AppConstants.backgroundColorValue),
        borderRadius: BorderRadius.circular(AppConstants.borderRadius),
        border: Border.all(
          color: const Color(AppConstants.borderColorValue),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          // Status indicator
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: _getStatusColor(ride.status),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: AppConstants.spacingMedium),
          
          // Ride details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ride.passengerName,
                  style: const TextStyle(
                    fontSize: AppConstants.fontSizeMedium,
                    fontWeight: FontWeight.w600,
                    color: Color(AppConstants.textColorValue),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${ride.distance.toStringAsFixed(1)} km • ${_formatDate(ride.requestedAt)}',
                  style: const TextStyle(
                    fontSize: AppConstants.fontSizeSmall,
                    color: Color(AppConstants.secondaryTextColorValue),
                  ),
                ),
              ],
            ),
          ),
          
          // Fare amount
          Text(
            '\$${ride.fare.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: AppConstants.fontSizeLarge,
              fontWeight: FontWeight.bold,
              color: Color(AppConstants.primaryColorValue),
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(RideStatus status) {
    switch (status) {
      case RideStatus.completed:
        return const Color(AppConstants.successColorValue);
      case RideStatus.cancelled:
        return const Color(AppConstants.errorColorValue);
      default:
        return const Color(AppConstants.warningColorValue);
    }
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);
    
    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }
}
