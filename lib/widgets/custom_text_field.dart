import 'package:flutter/cupertino.dart';
import '../constants/app_constants.dart';

class CustomTextField extends StatelessWidget {
  final TextEditingController controller;
  final String placeholder;
  final IconData? prefixIcon;
  final IconData? suffixIcon;
  final bool obscureText;
  final TextInputType keyboardType;
  final String? Function(String?)? validator;
  final VoidCallback? onSuffixIconTap;
  final bool enabled;

  const CustomTextField({
    super.key,
    required this.controller,
    required this.placeholder,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.keyboardType = TextInputType.text,
    this.validator,
    this.onSuffixIconTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(AppConstants.backgroundColorValue),
        borderRadius: BorderRadius.circular(AppConstants.borderRadius),
        border: Border.all(
          color: const Color(AppConstants.borderColorValue),
          width: 1.5,
        ),
      ),
      child: CupertinoTextField(
        controller: controller,
        placeholder: placeholder,
        placeholderStyle: const TextStyle(
          color: Color(AppConstants.secondaryTextColorValue),
          fontSize: AppConstants.fontSizeMedium,
        ),
        style: const TextStyle(
          color: Color(AppConstants.textColorValue),
          fontSize: AppConstants.fontSizeMedium,
        ),
        obscureText: obscureText,
        keyboardType: keyboardType,
        enabled: enabled,
        padding: const EdgeInsets.symmetric(
          horizontal: AppConstants.spacingMedium,
          vertical: AppConstants.spacingMedium,
        ),
        prefix: prefixIcon != null
            ? Padding(
                padding: const EdgeInsets.only(left: AppConstants.spacingMedium),
                child: Icon(
                  prefixIcon,
                  color: const Color(AppConstants.secondaryTextColorValue),
                  size: 20,
                ),
              )
            : null,
        suffix: suffixIcon != null
            ? GestureDetector(
                onTap: onSuffixIconTap,
                child: Padding(
                  padding: const EdgeInsets.only(right: AppConstants.spacingMedium),
                  child: Icon(
                    suffixIcon,
                    color: const Color(AppConstants.secondaryTextColorValue),
                    size: 20,
                  ),
                ),
              )
            : null,
        decoration: const BoxDecoration(),
      ),
    );
  }
}
