import 'dart:async';
import 'dart:developer' as dev;
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../constants/app_constants.dart';
import '../models/ride_model.dart';

class SocketService {
  static io.Socket? _socket;
  static Timer? _reconnectTimer;
  static Timer? _heartbeatTimer;
  static bool _isReconnecting = false;
  static int _reconnectAttempts = 0;
  static const int _maxReconnectAttempts = 5;
  
  static final StreamController<Ride> _rideRequestController = StreamController<Ride>.broadcast();
  static final StreamController<Map<String, dynamic>> _locationUpdateController = StreamController<Map<String, dynamic>>.broadcast();
  static final StreamController<String> _connectionStatusController = StreamController<String>.broadcast();

  static Stream<Ride> get rideRequestStream => _rideRequestController.stream;
  static Stream<Map<String, dynamic>> get locationUpdateStream => _locationUpdateController.stream;
  static Stream<String> get connectionStatusStream => _connectionStatusController.stream;

  static bool get isConnected => _socket?.connected ?? false;

  static Future<void> initialize() async {
    try {
      _socket = io.io(AppConstants.socketUrl, <String, dynamic>{
        'transports': ['websocket', 'polling'], // Allow fallback to polling
        'autoConnect': false,
        'timeout': 20000, // 20 second timeout
        'connectTimeout': 20000, // 20 second connection timeout
        'reconnection': true,
        'reconnectionDelay': 2000, // 2 seconds between reconnect attempts
        'reconnectionDelayMax': 10000, // Maximum 10 seconds between attempts
        'reconnectionAttempts': _maxReconnectAttempts,
        'forceNew': true,
      });

      _setupEventListeners();
      await connect();
      _startHeartbeat();
    } catch (e) {
      dev.log('Socket initialization failed: $e', name: 'SocketService');
      _scheduleReconnect();
    }
  }

  static void _setupEventListeners() {
    _socket?.on('connect', (_) {
      dev.log('Socket connected successfully', name: 'SocketService');
      _connectionStatusController.add('connected');
      _reconnectAttempts = 0;
      _isReconnecting = false;
      _cancelReconnectTimer();
    });

    _socket?.on('disconnect', (reason) {
      dev.log('Socket disconnected: $reason', name: 'SocketService');
      _connectionStatusController.add('disconnected');
      if (reason != 'io client disconnect') {
        _scheduleReconnect();
      }
    });

    _socket?.on('connect_error', (error) {
      dev.log('Socket connection error: $error', name: 'SocketService');
      _connectionStatusController.add('error');
      _scheduleReconnect();
    });

    _socket?.on('connect_timeout', (_) {
      dev.log('Socket connection timeout', name: 'SocketService');
      _connectionStatusController.add('timeout');
      _scheduleReconnect();
    });

    // Heartbeat response
    _socket?.on('pong', (_) {
      dev.log('Received pong from server', name: 'SocketService');
    });

    _socket?.on('ride_request', (data) {
      dev.log('Received ride request: $data', name: 'SocketService');
      try {
        final ride = Ride.fromJson(data);
        _rideRequestController.add(ride);
      } catch (e) {
        dev.log('Error parsing ride request: $e', name: 'SocketService');
      }
    });

    _socket?.on('location_update', (data) {
      dev.log('Received location update: $data', name: 'SocketService');
      _locationUpdateController.add(data);
    });

    _socket?.on('ride_accepted', (data) {
      dev.log('Ride accepted: $data', name: 'SocketService');
    });

    _socket?.on('ride_started', (data) {
      dev.log('Ride started: $data', name: 'SocketService');
    });

    _socket?.on('ride_completed', (data) {
      dev.log('Ride completed: $data', name: 'SocketService');
    });

    _socket?.on('driver_offline', (data) {
      dev.log('Driver offline: $data', name: 'SocketService');
    });
  }

  static void _startHeartbeat() {
    _heartbeatTimer = Timer.periodic(Duration(seconds: 30), (timer) {
      if (isConnected) {
        _socket?.emit('ping');
        dev.log('Sent ping to server', name: 'SocketService');
      }
    });
  }

  static void _scheduleReconnect() {
    if (_isReconnecting || _reconnectAttempts >= _maxReconnectAttempts) {
      if (_reconnectAttempts >= _maxReconnectAttempts) {
        dev.log('Max reconnection attempts reached', name: 'SocketService');
        _connectionStatusController.add('failed');
      }
      return;
    }

    _isReconnecting = true;
    _reconnectAttempts++;
    
    final delay = Duration(seconds: 2 * _reconnectAttempts); // Exponential backoff
    dev.log('Scheduling reconnection attempt $_reconnectAttempts in ${delay.inSeconds} seconds', name: 'SocketService');
    
    _reconnectTimer = Timer(delay, () {
      dev.log('Attempting to reconnect...', name: 'SocketService');
      connect();
    });
  }

  static void _cancelReconnectTimer() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  static Future<void> connect() async {
    try {
      if (!isConnected) {
        _socket?.connect();
        dev.log('Attempting socket connection...', name: 'SocketService');
      }
    } catch (e) {
      dev.log('Socket connection failed: $e', name: 'SocketService');
      _scheduleReconnect();
    }
  }

  static Future<void> disconnect() async {
    try {
      _cancelReconnectTimer();
      _heartbeatTimer?.cancel();
      _socket?.disconnect();
      dev.log('Socket disconnected manually', name: 'SocketService');
    } catch (e) {
      dev.log('Socket disconnection failed: $e', name: 'SocketService');
    }
  }

  static Future<void> connectDriver({
    required String driverId,
    required String name,
    required String phone,
    required String vehicleType,
    required String vehicleNumber,
    required double rating,
    required int totalRides,
    required double totalEarnings,
    required double latitude,
    required double longitude,
  }) async {
    try {
      _socket?.emit('connect_driver', {
        'driver_id': driverId,
        'name': name,
        'phone': phone,
        'vehicle_type': vehicleType,
        'vehicle_number': vehicleNumber,
        'rating': rating,
        'total_rides': totalRides,
        'total_earnings': totalEarnings,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      dev.log('Failed to connect driver: $e', name: 'SocketService');
    }
  }

  static Future<void> updateLocation({
    required String driverId,
    required double latitude,
    required double longitude,
  }) async {
    try {
      _socket?.emit('location_update', {
        'driver_id': driverId,
        'latitude': latitude,
        'longitude': longitude,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      dev.log('Failed to update location: $e', name: 'SocketService');
    }
  }

  static Future<void> acceptRide({
    required String rideId,
    required String driverId,
  }) async {
    try {
      _socket?.emit('ride_accept', {
        'ride_id': rideId,
        'driver_id': driverId,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      dev.log('Failed to accept ride: $e', name: 'SocketService');
    }
  }

  static Future<void> rejectRide({
    required String rideId,
    required String driverId,
  }) async {
    try {
      _socket?.emit('ride_reject', {
        'ride_id': rideId,
        'driver_id': driverId,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      dev.log('Failed to reject ride: $e', name: 'SocketService');
    }
  }

  static Future<void> startRide({
    required String rideId,
    required String driverId,
  }) async {
    try {
      _socket?.emit('ride_start', {
        'ride_id': rideId,
        'driver_id': driverId,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      dev.log('Failed to start ride: $e', name: 'SocketService');
    }
  }

  static Future<void> completeRide({
    required String rideId,
    required String driverId,
  }) async {
    try {
      _socket?.emit('ride_complete', {
        'ride_id': rideId,
        'driver_id': driverId,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      dev.log('Failed to complete ride: $e', name: 'SocketService');
    }
  }

  static Future<void> setDriverOffline({
    required String driverId,
  }) async {
    try {
      _socket?.emit('driver_offline', {
        'driver_id': driverId,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      dev.log('Failed to set driver offline: $e', name: 'SocketService');
    }
  }

  static void dispose() {
    _cancelReconnectTimer();
    _heartbeatTimer?.cancel();
    _rideRequestController.close();
    _locationUpdateController.close();
    _connectionStatusController.close();
    _socket?.dispose();
  }
}
