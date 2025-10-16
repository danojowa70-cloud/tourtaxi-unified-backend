class AppConstants {
  // Supabase Configuration
  static const String supabaseUrl = 'https://vojjpvxhpofudvpexrjb.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvampwdnhocG9mdWR2cGV4cmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MjQ3NzIsImV4cCI6MjA3NTAwMDc3Mn0.AYgP9ww5Lg_VqfqcN_zN3kf4j-otQbAgbYKlQIbE3yc';
  
  // Socket.io / API Configuration
  static const String socketUrl = 'https://tourtaxi-unified-backend.onrender.com'; // Production server (Socket.IO)
  static const String apiBaseUrl = 'https://tourtaxi-unified-backend.onrender.com'; // REST API base
  
  // Google Maps Configuration
  static const String googleMapsApiKey = 'AIzaSyBRYPKaXlRhpzoAmM5-KrS2JaNDxAX_phw';
  
  // App Configuration
  static const String appName = 'TourTaxi Driver';
  static const String appVersion = '1.0.0';
  
  // Animation Durations
  static const Duration shortAnimation = Duration(milliseconds: 300);
  static const Duration mediumAnimation = Duration(milliseconds: 500);
  static const Duration longAnimation = Duration(milliseconds: 800);
  
  // UI Constants (Apple-style)
  static const double borderRadius = 10.0; // iOS standard corner radius
  static const double borderRadiusLarge = 16.0; // Large cards/containers
  static const double borderRadiusSmall = 8.0; // Small elements
  static const double buttonHeight = 50.0; // iOS standard button height
  static const double cardElevation = 1.0; // Subtle shadow for depth
  static const double separatorHeight = 0.5; // iOS separator thickness
  
  // Colors (Apple-style)
  static const int primaryColorValue = 0xFF007AFF; // iOS Blue
  static const int backgroundColorValue = 0xFFFFFFFF; // Pure White
  static const int textColorValue = 0xFF000000; // Pure Black
  static const int secondaryTextColorValue = 0xFF8E8E93; // iOS Gray
  static const int borderColorValue = 0xFFE5E5EA; // Light Gray Border
  static const int successColorValue = 0xFF34C759; // iOS Green
  static const int errorColorValue = 0xFFFF3B30; // iOS Red
  static const int warningColorValue = 0xFFFF9500; // iOS Orange
  
  // Additional Apple-style colors
  static const int cardBackgroundColorValue = 0xFFFAFAFA; // Off-white for cards
  static const int separatorColorValue = 0xFFC6C6C8; // iOS separator
  static const int placeholderTextColorValue = 0xFFC7C7CD; // Placeholder text
  static const int systemGray2Value = 0xFFAEAEB2; // iOS System Gray 2
  static const int systemGray3Value = 0xFFC7C7CC; // iOS System Gray 3
  static const int systemGray4Value = 0xFFD1D1D6; // iOS System Gray 4
  static const int systemGray5Value = 0xFFE5E5EA; // iOS System Gray 5
  static const int systemGray6Value = 0xFFF2F2F7; // iOS System Gray 6
  
  // Font Sizes (Apple Human Interface Guidelines)
  static const double fontSizeCaption = 12.0; // Caption text
  static const double fontSizeSmall = 14.0; // Footnote
  static const double fontSizeMedium = 16.0; // Subhead
  static const double fontSizeBody = 17.0; // Body (iOS standard)
  static const double fontSizeLarge = 20.0; // Title 3
  static const double fontSizeXLarge = 22.0; // Title 2
  static const double fontSizeXXLarge = 28.0; // Title 1
  static const double fontSizeDisplay = 34.0; // Large Title
  
  // Spacing (Apple 8-point grid system)
  static const double spacingXXSmall = 4.0; // Minimal spacing
  static const double spacingXSmall = 6.0; // Very small elements
  static const double spacingSmall = 8.0; // Standard small spacing
  static const double spacingMedium = 16.0; // Standard spacing
  static const double spacingLarge = 24.0; // Large spacing
  static const double spacingXLarge = 32.0; // Extra large spacing
  static const double spacingXXLarge = 40.0; // Maximum spacing
}
