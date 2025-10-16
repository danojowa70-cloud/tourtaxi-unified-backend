import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../constants/app_constants.dart';
import '../../services/supabase_service.dart';
import '../../widgets/custom_text_field.dart';
import '../../widgets/custom_button.dart';
import 'create_account_screen.dart';
import '../home/home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // Capture navigator before async gap to avoid using BuildContext afterwards
      final navigator = Navigator.of(context);
      final response = await SupabaseService.signIn(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      // Navigate if we have a user or a valid session
      final hasUser = response.user != null || SupabaseService.getCurrentUser() != null;
      if (hasUser) {
        if (!mounted) return;
        navigator.pushReplacement(
          MaterialPageRoute(
            builder: (context) => const HomeScreen(),
          ),
        );
        return;
      }
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
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppConstants.spacingLarge),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppConstants.spacingXLarge * 2),
                
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
                      'Welcome Back',
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
                      'Sign in to continue',
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
                
                const SizedBox(height: AppConstants.spacingXLarge * 2),
                
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
                      return 'Please enter your password';
                    }
                    if (value.length < 6) {
                      return 'Password must be at least 6 characters';
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
                
                const SizedBox(height: AppConstants.spacingLarge),
                
                // Sign In Button
                CustomButton(
                  text: 'Sign In',
                  onPressed: _isLoading ? null : _signIn,
                  isLoading: _isLoading,
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1100),
                      duration: AppConstants.mediumAnimation,
                    )
                    .slideY(
                      begin: 0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 1100),
                      duration: AppConstants.mediumAnimation,
                    ),
                
                const SizedBox(height: AppConstants.spacingLarge),
                
                // Create Account Link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      "Don't have an account? ",
                      style: TextStyle(
                        fontSize: AppConstants.fontSizeMedium,
                        color: Color(AppConstants.secondaryTextColorValue),
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => const CreateAccountScreen(),
                          ),
                        );
                      },
                      child: const Text(
                        'Create Account',
                        style: TextStyle(
                          fontSize: AppConstants.fontSizeMedium,
                          color: Color(AppConstants.primaryColorValue),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1300),
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
