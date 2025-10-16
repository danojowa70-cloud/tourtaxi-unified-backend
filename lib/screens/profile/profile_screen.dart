import 'dart:developer' as dev;
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../constants/app_constants.dart';
import '../../services/supabase_service.dart';
import '../../models/driver_model.dart';
import '../../widgets/custom_button.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Driver? _driver;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDriverProfile();
  }

  Future<void> _loadDriverProfile() async {
    try {
      final user = SupabaseService.getCurrentUser();
      if (user != null) {
        final driver = await SupabaseService.getDriverProfile(user.id);
        setState(() {
          _driver = driver;
          _isLoading = false;
        });
      }
    } catch (e) {
      dev.log('Error loading driver profile: $e', name: 'ProfileScreen');
      setState(() {
        _isLoading = false;
      });
    }
  }

  Future<void> _signOut() async {
    showCupertinoDialog(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          CupertinoDialogAction(
            child: const Text('Cancel'),
            onPressed: () => Navigator.of(context).pop(),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            child: const Text('Sign Out'),
            onPressed: () async {
              Navigator.of(context).pop();
              await SupabaseService.signOut();
              if (!context.mounted) return;
              Navigator.of(context).pushReplacementNamed('/login');
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(AppConstants.backgroundColorValue),
      navigationBar: const CupertinoNavigationBar(
        backgroundColor: Color(AppConstants.backgroundColorValue),
        border: null,
        middle: Text(
          'Profile',
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
                  // Profile header
                  _buildProfileHeader()
                      .animate()
                      .fadeIn(duration: AppConstants.shortAnimation)
                      .slideY(
                        begin: -0.3,
                        end: 0,
                        duration: AppConstants.shortAnimation,
                      ),

                  const SizedBox(height: AppConstants.spacingLarge),

                  // Profile information
                  _buildProfileInfo()
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

                  // Vehicle information
                  _buildVehicleInfo()
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

                  // Statistics
                  _buildStatistics()
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

                  const SizedBox(height: AppConstants.spacingXLarge),

                  // Sign out button
                  CustomButton(
                    text: 'Sign Out',
                    onPressed: _signOut,
                    backgroundColor: const Color(AppConstants.errorColorValue),
                  )
                      .animate()
                      .fadeIn(
                        delay: const Duration(milliseconds: 800),
                        duration: AppConstants.shortAnimation,
                      )
                      .slideY(
                        begin: 0.3,
                        end: 0,
                        delay: const Duration(milliseconds: 800),
                        duration: AppConstants.shortAnimation,
                      ),
                ],
              ),
            ),
    );
  }

  Widget _buildProfileHeader() {
    return Container(
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
          // Profile image
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(50),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: _driver?.profileImage != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(50),
                    child: Image.network(
                      _driver!.profileImage!,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return const Icon(
                          CupertinoIcons.person_fill,
                          color: Color(AppConstants.primaryColorValue),
                          size: 50,
                        );
                      },
                    ),
                  )
                : const Icon(
                    CupertinoIcons.person_fill,
                    color: Color(AppConstants.primaryColorValue),
                    size: 50,
                  ),
          ),
          
          const SizedBox(height: AppConstants.spacingMedium),
          
          // Driver name
          Text(
            _driver?.name ?? 'Driver',
            style: const TextStyle(
              fontSize: AppConstants.fontSizeXLarge,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
          
          const SizedBox(height: AppConstants.spacingSmall),
          
          // Driver email
          Text(
            _driver?.email ?? '',
            style: const TextStyle(
              fontSize: AppConstants.fontSizeMedium,
              color: Colors.white70,
            ),
          ),
          
          const SizedBox(height: AppConstants.spacingMedium),
          
          // Online status
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppConstants.spacingMedium,
              vertical: AppConstants.spacingSmall,
            ),
            decoration: BoxDecoration(
              color: (_driver?.isOnline ?? false)
                  ? const Color(AppConstants.successColorValue)
                  : const Color(AppConstants.errorColorValue),
              borderRadius: BorderRadius.circular(AppConstants.borderRadius),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: AppConstants.spacingSmall),
                Text(
                  (_driver?.isOnline ?? false) ? 'Online' : 'Offline',
                  style: const TextStyle(
                    fontSize: AppConstants.fontSizeMedium,
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileInfo() {
    return Container(
      padding: const EdgeInsets.all(AppConstants.spacingLarge),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Profile Information',
            style: TextStyle(
              fontSize: AppConstants.fontSizeLarge,
              fontWeight: FontWeight.bold,
              color: Color(AppConstants.textColorValue),
            ),
          ),
          const SizedBox(height: AppConstants.spacingMedium),
          _buildInfoRow(
            icon: CupertinoIcons.person,
            label: 'Name',
            value: _driver?.name ?? 'Not set',
          ),
          _buildInfoRow(
            icon: CupertinoIcons.mail,
            label: 'Email',
            value: _driver?.email ?? 'Not set',
          ),
          _buildInfoRow(
            icon: CupertinoIcons.phone,
            label: 'Phone',
            value: _driver?.phone ?? 'Not set',
          ),
        ],
      ),
    );
  }

  Widget _buildVehicleInfo() {
    return Container(
      padding: const EdgeInsets.all(AppConstants.spacingLarge),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Vehicle Information',
            style: TextStyle(
              fontSize: AppConstants.fontSizeLarge,
              fontWeight: FontWeight.bold,
              color: Color(AppConstants.textColorValue),
            ),
          ),
          const SizedBox(height: AppConstants.spacingMedium),
          _buildInfoRow(
            icon: CupertinoIcons.car,
            label: 'Vehicle Type',
            value: _driver?.vehicleType ?? 'Not set',
          ),
          _buildInfoRow(
            icon: CupertinoIcons.number,
            label: 'Vehicle Number',
            value: _driver?.vehicleNumber ?? 'Not set',
          ),
          _buildInfoRow(
            icon: CupertinoIcons.doc_text,
            label: 'License Number',
            value: _driver?.licenseNumber ?? 'Not set',
          ),
        ],
      ),
    );
  }

  Widget _buildStatistics() {
    return Container(
      padding: const EdgeInsets.all(AppConstants.spacingLarge),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Statistics',
            style: TextStyle(
              fontSize: AppConstants.fontSizeLarge,
              fontWeight: FontWeight.bold,
              color: Color(AppConstants.textColorValue),
            ),
          ),
          const SizedBox(height: AppConstants.spacingMedium),
          Row(
            children: [
              Expanded(
                child: _buildStatItem(
                  icon: CupertinoIcons.car,
                  label: 'Total Rides',
                  value: _driver?.totalRides.toString() ?? '0',
                ),
              ),
              const SizedBox(width: AppConstants.spacingMedium),
              Expanded(
                child: _buildStatItem(
                  icon: CupertinoIcons.money_dollar,
                  label: 'Total Earnings',
                  value: '\$${_driver?.totalEarnings.toStringAsFixed(2) ?? '0.00'}',
                ),
              ),
            ],
          ),
          const SizedBox(height: AppConstants.spacingMedium),
          _buildStatItem(
            icon: CupertinoIcons.star_fill,
            label: 'Rating',
            value: _driver?.rating?.toStringAsFixed(1) ?? 'N/A',
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppConstants.spacingMedium),
      child: Row(
        children: [
          Icon(
            icon,
            color: const Color(AppConstants.primaryColorValue),
            size: 20,
          ),
          const SizedBox(width: AppConstants.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: AppConstants.fontSizeSmall,
                    color: Color(AppConstants.secondaryTextColorValue),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: AppConstants.fontSizeMedium,
                    color: Color(AppConstants.textColorValue),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppConstants.spacingMedium),
      decoration: BoxDecoration(
        color: const Color(AppConstants.borderColorValue).withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(AppConstants.borderRadius),
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
            value,
            style: const TextStyle(
              fontSize: AppConstants.fontSizeLarge,
              fontWeight: FontWeight.bold,
              color: Color(AppConstants.textColorValue),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: AppConstants.fontSizeSmall,
              color: Color(AppConstants.secondaryTextColorValue),
            ),
          ),
        ],
      ),
    );
  }
}

