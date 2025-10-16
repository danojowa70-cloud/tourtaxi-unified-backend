import 'dart:developer' as dev;
import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'constants/app_constants.dart';
import 'firebase_options.dart';
import 'services/fcm_service.dart';
import 'screens/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase and FCM
  try {
    // Set background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    
    // Initialize FCM Service
    await FCMService.initialize();
    dev.log('Firebase and FCM initialized successfully', name: 'TourTaxiDriver');
  } catch (e) {
    dev.log('Firebase/FCM initialization failed: $e', name: 'TourTaxiDriver');
  }
  
  // Initialize Supabase
  try {
    await Supabase.initialize(
      url: AppConstants.supabaseUrl,
      anonKey: AppConstants.supabaseAnonKey,
    );
    dev.log('Supabase initialized successfully', name: 'TourTaxiDriver');
  } catch (e) {
    dev.log('Supabase initialization failed: $e', name: 'TourTaxiDriver');
  }
  
  runApp(const TourTaxiDriverApp());
}

class TourTaxiDriverApp extends StatelessWidget {
  const TourTaxiDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appName,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(AppConstants.primaryColorValue),
          brightness: Brightness.light,
          surface: const Color(AppConstants.backgroundColorValue),
          onSurface: const Color(AppConstants.textColorValue),
        ),
        scaffoldBackgroundColor: const Color(AppConstants.backgroundColorValue),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(AppConstants.backgroundColorValue),
          foregroundColor: Color(AppConstants.textColorValue),
          elevation: 0,
          iconTheme: IconThemeData(color: Color(AppConstants.textColorValue)),
          titleTextStyle: TextStyle(
            color: Color(AppConstants.textColorValue),
            fontSize: AppConstants.fontSizeLarge,
            fontWeight: FontWeight.w600,
          ),
        ),
        iconTheme: const IconThemeData(color: Color(AppConstants.textColorValue)),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Color(AppConstants.textColorValue)),
          bodyMedium: TextStyle(color: Color(AppConstants.textColorValue)),
          bodySmall: TextStyle(color: Color(AppConstants.textColorValue)),
          titleLarge: TextStyle(color: Color(AppConstants.textColorValue)),
          titleMedium: TextStyle(color: Color(AppConstants.textColorValue)),
          titleSmall: TextStyle(color: Color(AppConstants.textColorValue)),
        ),
      ),
      home: const SplashScreen(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const HomeScreen(),
      },
      debugShowCheckedModeBanner: false,
    );
  }
}