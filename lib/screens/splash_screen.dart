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
    return Scaffold(
      backgroundColor: Colors.black, // Uber-style black background
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Top spacer to push content to center
              const Spacer(flex: 2),
              
              // TourTaxi Logo (Square)
              Container(
                width: MediaQuery.of(context).size.width * 0.6, // 60% of screen width
                height: MediaQuery.of(context).size.width * 0.6, // Square aspect ratio
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.orange.withValues(alpha: 0.3),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    color: Colors.white, // White background for logo
                    padding: const EdgeInsets.all(20),
                    child: Image.asset(
                      'assets/images/tourtaxi_logo_new.jpg',
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              )
                  .animate()
                  .scale(
                    duration: const Duration(milliseconds: 800),
                    curve: Curves.elasticOut,
                  )
                  .fadeIn(
                    duration: const Duration(milliseconds: 600),
                  ),
              
              // Middle spacer
              const Spacer(flex: 1),
              
              // Loading indicator with text
              Column(
                children: [
                  // Loading spinner
                  const SizedBox(
                    width: 30,
                    height: 30,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                      .animate()
                      .fadeIn(
                        delay: const Duration(milliseconds: 1000),
                        duration: const Duration(milliseconds: 400),
                      ),
                  
                  const SizedBox(height: 20),
                  
                  // Loading text
                  const Text(
                    'Starting your journey...',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 16,
                      fontWeight: FontWeight.w400,
                      letterSpacing: 0.5,
                    ),
                  )
                      .animate()
                      .fadeIn(
                        delay: const Duration(milliseconds: 1200),
                        duration: const Duration(milliseconds: 400),
                      )
                      .slideY(
                        begin: 0.3,
                        end: 0,
                        delay: const Duration(milliseconds: 1200),
                        duration: const Duration(milliseconds: 500),
                        curve: Curves.easeOut,
                      ),
                ],
              ),
              
              // Bottom spacer
              const Spacer(flex: 1),
              
              // App version at bottom (optional)
              Padding(
                padding: const EdgeInsets.only(bottom: 30),
                child: const Text(
                  'v${AppConstants.appVersion}',
                  style: TextStyle(
                    color: Colors.white30,
                    fontSize: 12,
                    fontWeight: FontWeight.w300,
                  ),
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1500),
                      duration: const Duration(milliseconds: 300),
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

