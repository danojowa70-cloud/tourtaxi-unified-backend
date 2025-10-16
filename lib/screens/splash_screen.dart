import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../constants/app_constants.dart';
import '../services/supabase_service.dart';
import '../services/api_service.dart';
import 'auth/login_screen.dart';
import 'home/home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _navigateToNextScreen();
  }

  Future<void> _navigateToNextScreen() async {
    // Wait for splash animation to complete
    await Future.delayed(const Duration(seconds: 2));

    // Ping backend health; if fails, still allow navigation but show a dialog
    bool backendOk = false;
    try {
      backendOk = await ApiService.health();
    } catch (_) {}
    
    if (!mounted) return;

    if (!backendOk) {
      // Show non-blocking warning
      // ignore: use_build_context_synchronously
      showCupertinoDialog(
        context: context,
        builder: (_) => CupertinoAlertDialog(
          title: const Text('Server Unavailable'),
          content: const Text('Unable to reach the TourTaxi server right now. Some features may be limited.'),
          actions: [
            CupertinoDialogAction(
              isDefaultAction: true,
              child: const Text('Continue'),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      );
      await Future.delayed(const Duration(milliseconds: 300));
    }

    // Check if user is already authenticated
    final user = SupabaseService.getCurrentUser();

    if (!mounted) return;
    final navigator = Navigator.of(context);

    if (user != null) {
      navigator.pushReplacement(
        CupertinoPageRoute(builder: (context) => const HomeScreen()),
      );
    } else {
      navigator.pushReplacement(
        CupertinoPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(AppConstants.backgroundColorValue),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // App Logo/Icon placeholder
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: const Color(AppConstants.primaryColorValue),
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: const Color(AppConstants.primaryColorValue).withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: const Icon(
                CupertinoIcons.car_fill,
                size: 60,
                color: Colors.white,
              ),
            )
                .animate()
                .scale(
                  duration: AppConstants.mediumAnimation,
                  curve: Curves.elasticOut,
                )
                .fadeIn(duration: AppConstants.shortAnimation),
            
            const SizedBox(height: AppConstants.spacingXLarge),
            
            // App Name with animation
            const Text(
              'TOURTAXI',
              style: TextStyle(
                fontSize: AppConstants.fontSizeXXLarge,
                fontWeight: FontWeight.bold,
                color: Color(AppConstants.textColorValue),
                letterSpacing: 2.0,
              ),
            )
                .animate()
                .fadeIn(
                  delay: const Duration(milliseconds: 500),
                  duration: AppConstants.mediumAnimation,
                )
                .slideY(
                  begin: 0.3,
                  end: 0,
                  delay: const Duration(milliseconds: 500),
                  duration: AppConstants.mediumAnimation,
                  curve: Curves.easeOut,
                ),
            
            const SizedBox(height: AppConstants.spacingSmall),
            
            // Driver subtitle
            const Text(
              'DRIVER',
              style: TextStyle(
                fontSize: AppConstants.fontSizeLarge,
                fontWeight: FontWeight.w600,
                color: Color(AppConstants.secondaryTextColorValue),
                letterSpacing: 1.5,
              ),
            )
                .animate()
                .fadeIn(
                  delay: const Duration(milliseconds: 800),
                  duration: AppConstants.mediumAnimation,
                )
                .slideY(
                  begin: 0.3,
                  end: 0,
                  delay: const Duration(milliseconds: 800),
                  duration: AppConstants.mediumAnimation,
                  curve: Curves.easeOut,
                ),
            
            const SizedBox(height: AppConstants.spacingXLarge * 2),
            
            // Loading indicator
            const CupertinoActivityIndicator(
              radius: 15,
              color: Color(AppConstants.primaryColorValue),
            )
                .animate()
                .fadeIn(
                  delay: const Duration(milliseconds: 1200),
                  duration: AppConstants.shortAnimation,
                ),
          ],
        ),
      ),
    );
  }
}

