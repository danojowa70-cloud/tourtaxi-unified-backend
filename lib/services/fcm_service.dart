import 'dart:async';
import 'dart:developer' as dev;
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import '../firebase_options.dart';
import 'api_service.dart';

class FCMService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  static String? _fcmToken;
  static bool _isInitialized = false;

  // Initialize FCM Service
  static Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize Firebase with options
      await Firebase.initializeApp(
        options: DefaultFirebaseOptions.currentPlatform,
      );
      
      // Request permission for notifications
      await _requestNotificationPermissions();
      
      // Initialize local notifications
      await _initializeLocalNotifications();
      
      // Get FCM token
      _fcmToken = await _firebaseMessaging.getToken();
      dev.log('FCM Token obtained: ${_fcmToken?.substring(0, 20)}...', name: 'FCMService');
      
      // Listen for token refresh
      _firebaseMessaging.onTokenRefresh.listen((token) {
        _fcmToken = token;
        dev.log('FCM Token refreshed: ${token.substring(0, 20)}...', name: 'FCMService');
        // TODO: Send updated token to your server
      });
      
      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      
      // Handle background messages
      FirebaseMessaging.onBackgroundMessage(_handleBackgroundMessage);
      
      // Handle notification taps when app is terminated or in background
      FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageOpenedApp);
      
      // Check if app was opened from a terminated state via notification
      RemoteMessage? initialMessage = await _firebaseMessaging.getInitialMessage();
      if (initialMessage != null) {
        _handleMessageOpenedApp(initialMessage);
      }
      
      _isInitialized = true;
      dev.log('FCM Service initialized successfully', name: 'FCMService');
      
    } catch (e) {
      dev.log('FCM Service initialization failed: $e', name: 'FCMService');
    }
  }

  // Request notification permissions
  static Future<void> _requestNotificationPermissions() async {
    if (Platform.isIOS) {
      await _firebaseMessaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        announcement: false,
      );
    }
    
    // Request notification permission using permission_handler
    PermissionStatus status = await Permission.notification.request();
    if (status.isDenied) {
      dev.log('Notification permission denied', name: 'FCMService');
    }
  }

  // Initialize local notifications
  static Future<void> _initializeLocalNotifications() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');
        
    const DarwinInitializationSettings initializationSettingsIOS = 
        DarwinInitializationSettings(
          requestSoundPermission: true,
          requestBadgePermission: true,
          requestAlertPermission: true,
        );
        
    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsIOS,
    );
    
    await _localNotifications.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );
    
    // Create notification channel for Android
    if (Platform.isAndroid) {
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'ride_notifications',
        'Ride Notifications',
        description: 'Notifications for ride requests and updates',
        importance: Importance.high,
      );
      
      await _localNotifications
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
          ?.createNotificationChannel(channel);
    }
  }

  // Handle foreground messages
  static Future<void> _handleForegroundMessage(RemoteMessage message) async {
    dev.log('Foreground message received: ${message.messageId}', name: 'FCMService');
    
    // Show local notification for foreground messages
    await _showLocalNotification(message);
  }

  // Handle background messages (must be top-level function)
  static Future<void> _handleBackgroundMessage(RemoteMessage message) async {
    dev.log('Background message received: ${message.messageId}', name: 'FCMService');
    // Handle background logic here
  }

  // Handle message when app is opened from notification
  static void _handleMessageOpenedApp(RemoteMessage message) {
    dev.log('App opened from notification: ${message.messageId}', name: 'FCMService');
    
    // Navigate to appropriate screen based on message data
    if (message.data.containsKey('ride_id')) {
      // Navigate to ride screen
      dev.log('Opening ride: ${message.data['ride_id']}', name: 'FCMService');
    }
  }

  // Handle notification tap
  static void _onNotificationTapped(NotificationResponse response) {
    dev.log('Notification tapped: ${response.payload}', name: 'FCMService');
    
    // Parse payload and navigate accordingly
    if (response.payload != null) {
      // Navigate based on payload data
    }
  }

  // Show local notification
  static Future<void> _showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidNotificationDetails = AndroidNotificationDetails(
      'ride_notifications',
      'Ride Notifications',
      channelDescription: 'Notifications for ride requests and updates',
      importance: Importance.max,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
      largeIcon: DrawableResourceAndroidBitmap('@mipmap/ic_launcher'),
    );
    
    const DarwinNotificationDetails iosNotificationDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    
    const NotificationDetails notificationDetails = NotificationDetails(
      android: androidNotificationDetails,
      iOS: iosNotificationDetails,
    );
    
    await _localNotifications.show(
      message.hashCode,
      message.notification?.title ?? 'TourTaxi',
      message.notification?.body ?? 'New notification',
      notificationDetails,
      payload: message.data.toString(),
    );
  }

  // Get FCM token
  static String? get fcmToken => _fcmToken;

  // Subscribe to topic
  static Future<void> subscribeToTopic(String topic) async {
    await _firebaseMessaging.subscribeToTopic(topic);
    dev.log('Subscribed to topic: $topic', name: 'FCMService');
  }

  // Unsubscribe from topic
  static Future<void> unsubscribeFromTopic(String topic) async {
    await _firebaseMessaging.unsubscribeFromTopic(topic);
    dev.log('Unsubscribed from topic: $topic', name: 'FCMService');
  }

  // Subscribe driver to ride notifications
  static Future<void> subscribeDriverToNotifications(String driverId) async {
    await subscribeToTopic('driver_$driverId');
    await subscribeToTopic('all_drivers');
  }

  // Unsubscribe driver from notifications
  static Future<void> unsubscribeDriverFromNotifications(String driverId) async {
    await unsubscribeFromTopic('driver_$driverId');
    await unsubscribeFromTopic('all_drivers');
  }

  // Send token to server
  static Future<void> sendTokenToServer(String driverId) async {
    if (_fcmToken != null) {
      try {
        // TODO: Send FCM token to your backend server
        dev.log('Sending FCM token to server for driver: $driverId', name: 'FCMService');
        dev.log('Token: ${_fcmToken?.substring(0, 20)}...', name: 'FCMService');
        
        // Send token to backend
        await ApiService.updateDriverFCMToken(
          driverId: driverId,
          fcmToken: _fcmToken!,
        );
      } catch (e) {
        dev.log('Failed to send FCM token to server: $e', name: 'FCMService');
      }
    }
  }
}

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  dev.log('Background message handled: ${message.messageId}', name: 'FCMService');
}
