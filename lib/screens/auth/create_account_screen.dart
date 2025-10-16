import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../constants/app_constants.dart';
import '../../services/supabase_service.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/custom_button.dart';
import '../home/home_screen.dart';

class CreateAccountScreen extends StatefulWidget {
  const CreateAccountScreen({super.key});

  @override
  State<CreateAccountScreen> createState() => _CreateAccountScreenState();
}

class _CreateAccountScreenState extends State<CreateAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _createAccount() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // Capture navigator before async gap to avoid using BuildContext afterwards
      final navigator = Navigator.of(context);
      final response = await SupabaseService.signUp(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        name: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
      );

      // If email confirmations are enabled, Supabase may return user == null here.
      if (response.user == null) {
        if (!context.mounted) return;
        _showErrorDialog('Account created. Please check your email to verify your account before logging in.');
        return;
      }

      if (!mounted) return;
      navigator.pushReplacement(
        MaterialPageRoute(
          builder: (context) => const HomeScreen(),
        ),
      );
    } catch (e) {
      if (!context.mounted) return;
      _showErrorDialog(e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _showErrorDialog(String message) {
    showCupertinoDialog(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('Error'),
        content: Text(message),
        actions: [
          CupertinoDialogAction(
            child: const Text('OK'),
            onPressed: () => Navigator.of(context).pop(),
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
          'Create Account',
          style: TextStyle(
            fontSize: AppConstants.fontSizeLarge,
            fontWeight: FontWeight.w600,
            color: Color(AppConstants.textColorValue),
          ),
        ),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppConstants.spacingLarge),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppConstants.spacingLarge),
                
                // Logo and Title
                Column(
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        color: const Color(AppConstants.primaryColorValue),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        CupertinoIcons.car_fill,
                        size: 40,
                        color: Colors.white,
                      ),
                    )
                        .animate()
                        .scale(
                          duration: AppConstants.mediumAnimation,
                          curve: Curves.elasticOut,
                        )
                        .fadeIn(duration: AppConstants.shortAnimation),
                    
                    const SizedBox(height: AppConstants.spacingLarge),
                    
                    const Text(
                      'Join TourTaxi',
                      style: TextStyle(
                        fontSize: AppConstants.fontSizeXLarge,
                        fontWeight: FontWeight.bold,
                        color: Color(AppConstants.textColorValue),
                      ),
                    )
                        .animate()
                        .fadeIn(
                          delay: const Duration(milliseconds: 300),
                          duration: AppConstants.mediumAnimation,
                        )
                        .slideY(
                          begin: 0.3,
                          end: 0,
                          delay: const Duration(milliseconds: 300),
                          duration: AppConstants.mediumAnimation,
                        ),
                    
                    const SizedBox(height: AppConstants.spacingSmall),
                    
                    const Text(
                      'Create your driver account',
                      style: TextStyle(
                        fontSize: AppConstants.fontSizeMedium,
                        color: Color(AppConstants.secondaryTextColorValue),
                      ),
                    )
                        .animate()
                        .fadeIn(
                          delay: const Duration(milliseconds: 500),
                          duration: AppConstants.mediumAnimation,
                        ),
                  ],
                ),
                
                const SizedBox(height: AppConstants.spacingXLarge),
                
                // Name Field
                CustomTextField(
                  controller: _nameController,
                  placeholder: 'Full Name',
                  prefixIcon: CupertinoIcons.person,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your full name';
                    }
                    return null;
                  },
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 700),
                      duration: AppConstants.mediumAnimation,
                    )
                    .slideX(
                      begin: -0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 700),
                      duration: AppConstants.mediumAnimation,
                    ),
                
                const SizedBox(height: AppConstants.spacingMedium),
                
                // Email Field
                CustomTextField(
                  controller: _emailController,
                  placeholder: 'Email',
                  keyboardType: TextInputType.emailAddress,
                  prefixIcon: CupertinoIcons.mail,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your email';
                    }
                    if (!value.contains('@')) {
                      return 'Please enter a valid email';
                    }
                    return null;
                  },
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 900),
                      duration: AppConstants.mediumAnimation,
                    )
                    .slideX(
                      begin: -0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 900),
                      duration: AppConstants.mediumAnimation,
                    ),
                
                const SizedBox(height: AppConstants.spacingMedium),
                
                // Phone Field
                CustomTextField(
                  controller: _phoneController,
                  placeholder: 'Phone Number',
                  keyboardType: TextInputType.phone,
                  prefixIcon: CupertinoIcons.phone,
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your phone number';
                    }
                    return null;
                  },
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1100),
                      duration: AppConstants.mediumAnimation,
                    )
                    .slideX(
                      begin: -0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 1100),
                      duration: AppConstants.mediumAnimation,
                    ),
                
                const SizedBox(height: AppConstants.spacingMedium),
                
                // Password Field
                CustomTextField(
                  controller: _passwordController,
                  placeholder: 'Password',
                  obscureText: _obscurePassword,
                  prefixIcon: CupertinoIcons.lock,
                  suffixIcon: _obscurePassword
                      ? CupertinoIcons.eye_slash
                      : CupertinoIcons.eye,
                  onSuffixIconTap: () {
                    setState(() {
                      _obscurePassword = !_obscurePassword;
                    });
                  },
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter a password';
                    }
                    if (value.length < 6) {
                      return 'Password must be at least 6 characters';
                    }
                    return null;
                  },
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1300),
                      duration: AppConstants.mediumAnimation,
                    )
                    .slideX(
                      begin: -0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 1300),
                      duration: AppConstants.mediumAnimation,
                    ),
                
                const SizedBox(height: AppConstants.spacingMedium),
                
                // Confirm Password Field
                CustomTextField(
                  controller: _confirmPasswordController,
                  placeholder: 'Confirm Password',
                  obscureText: _obscureConfirmPassword,
                  prefixIcon: CupertinoIcons.lock,
                  suffixIcon: _obscureConfirmPassword
                      ? CupertinoIcons.eye_slash
                      : CupertinoIcons.eye,
                  onSuffixIconTap: () {
                    setState(() {
                      _obscureConfirmPassword = !_obscureConfirmPassword;
                    });
                  },
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please confirm your password';
                    }
                    if (value != _passwordController.text) {
                      return 'Passwords do not match';
                    }
                    return null;
                  },
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1500),
                      duration: AppConstants.mediumAnimation,
                    )
                    .slideX(
                      begin: -0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 1500),
                      duration: AppConstants.mediumAnimation,
                    ),
                
                const SizedBox(height: AppConstants.spacingLarge),
                
                // Create Account Button
                CustomButton(
                  text: 'Create Account',
                  onPressed: _isLoading ? null : _createAccount,
                  isLoading: _isLoading,
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1700),
                      duration: AppConstants.mediumAnimation,
                    )
                    .slideY(
                      begin: 0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 1700),
                      duration: AppConstants.mediumAnimation,
                    ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

