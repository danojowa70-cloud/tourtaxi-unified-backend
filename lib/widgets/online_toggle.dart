import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../constants/app_constants.dart';

class OnlineToggle extends StatelessWidget {
  final bool isOnline;
  final Function(bool) onToggle;

  const OnlineToggle({
    super.key,
    required this.isOnline,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppConstants.spacingMedium,
        vertical: AppConstants.spacingSmall,
      ),
      decoration: BoxDecoration(
        color: const Color(AppConstants.backgroundColorValue),
        borderRadius: BorderRadius.circular(AppConstants.borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Status indicator
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: isOnline
                  ? const Color(AppConstants.successColorValue)
                  : const Color(AppConstants.errorColorValue),
              shape: BoxShape.circle,
            ),
          )
              .animate(target: isOnline ? 1 : 0)
              .scale(
                duration: AppConstants.shortAnimation,
                curve: Curves.elasticOut,
              ),
          
          const SizedBox(width: AppConstants.spacingSmall),
          
          // Status text
          Text(
            isOnline ? 'Online' : 'Offline',
            style: TextStyle(
              fontSize: AppConstants.fontSizeMedium,
              fontWeight: FontWeight.w600,
              color: isOnline
                  ? const Color(AppConstants.successColorValue)
                  : const Color(AppConstants.errorColorValue),
            ),
          ),
          
          const SizedBox(width: AppConstants.spacingMedium),
          
          // Toggle switch
          CupertinoSwitch(
            value: isOnline,
            onChanged: onToggle,
            activeTrackColor: const Color(AppConstants.successColorValue),
            inactiveTrackColor: const Color(AppConstants.borderColorValue),
          ),
        ],
      ),
    );
  }
}

