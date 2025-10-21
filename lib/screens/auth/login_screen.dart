import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../constants/app_constants.dart';
import '../../services/supabase_service.dart';
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
    return Scaffold(
      backgroundColor: const Color(AppConstants.systemGray6Value), // Light gray background
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              children: [
                const SizedBox(height: 60),
                
                // Logo Section
                Column(
                  children: [
                    // Square TourTaxi Logo
                    Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(30), // Apple-style rounded corners
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Image.asset(
                          'assets/images/tourtaxi_logo_new.jpg',
                          fit: BoxFit.contain,
                        ),
                      ),
                    )
                        .animate()
                        .scale(
                          duration: const Duration(milliseconds: 800),
                          curve: Curves.elasticOut,
                        )
                        .fadeIn(duration: const Duration(milliseconds: 600)),
                    
                    const SizedBox(height: 32),
                    
                    // Welcome Text
                    const Text(
                      'Welcome Back',
                      style: TextStyle(
                        fontSize: 34, // iOS Large Title size
                        fontWeight: FontWeight.w700,
                        color: Color(AppConstants.textColorValue),
                        letterSpacing: -0.5,
                      ),
                    )
                        .animate()
                        .fadeIn(
                          delay: const Duration(milliseconds: 400),
                          duration: const Duration(milliseconds: 600),
                        )
                        .slideY(
                          begin: 0.3,
                          end: 0,
                          delay: const Duration(milliseconds: 400),
                          duration: const Duration(milliseconds: 600),
                        ),
                    
                    const SizedBox(height: 8),
                    
                    // Subtitle
                    const Text(
                      'Sign in to your TourTaxi account',
                      style: TextStyle(
                        fontSize: 17, // iOS Body size
                        fontWeight: FontWeight.w400,
                        color: Color(AppConstants.secondaryTextColorValue),
                      ),
                    )
                        .animate()
                        .fadeIn(
                          delay: const Duration(milliseconds: 600),
                          duration: const Duration(milliseconds: 600),
                        ),
                  ],
                ),
                
                const SizedBox(height: 48),
                
                // Login Form Card
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20), // Apple-style rounded corners
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Email Field
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(AppConstants.systemGray5Value),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: TextFormField(
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w400,
                                color: Color(AppConstants.textColorValue),
                              ),
                              decoration: const InputDecoration(
                                hintText: 'Email',
                                hintStyle: TextStyle(
                                  color: Color(AppConstants.secondaryTextColorValue),
                                ),
                                prefixIcon: Icon(
                                  CupertinoIcons.mail,
                                  color: Color(AppConstants.secondaryTextColorValue),
                                ),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 16,
                                ),
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Please enter your email';
                                }
                                if (!value.contains('@')) {
                                  return 'Please enter a valid email';
                                }
                                return null;
                              },
                            ),
                          )
                              .animate()
                              .fadeIn(
                                delay: const Duration(milliseconds: 800),
                                duration: const Duration(milliseconds: 600),
                              )
                              .slideY(
                                begin: 0.2,
                                end: 0,
                                delay: const Duration(milliseconds: 800),
                                duration: const Duration(milliseconds: 600),
                              ),
                          
                          const SizedBox(height: 16),
                          
                          // Password Field
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(AppConstants.systemGray5Value),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: TextFormField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w400,
                                color: Color(AppConstants.textColorValue),
                              ),
                              decoration: InputDecoration(
                                hintText: 'Password',
                                hintStyle: const TextStyle(
                                  color: Color(AppConstants.secondaryTextColorValue),
                                ),
                                prefixIcon: const Icon(
                                  CupertinoIcons.lock,
                                  color: Color(AppConstants.secondaryTextColorValue),
                                ),
                                suffixIcon: GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _obscurePassword = !_obscurePassword;
                                    });
                                  },
                                  child: Icon(
                                    _obscurePassword
                                        ? CupertinoIcons.eye_slash
                                        : CupertinoIcons.eye,
                                    color: const Color(AppConstants.secondaryTextColorValue),
                                  ),
                                ),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 16,
                                ),
                              ),
                              validator: (value) {
                                if (value == null || value.isEmpty) {
                                  return 'Please enter your password';
                                }
                                if (value.length < 6) {
                                  return 'Password must be at least 6 characters';
                                }
                                return null;
                              },
                            ),
                          )
                              .animate()
                              .fadeIn(
                                delay: const Duration(milliseconds: 1000),
                                duration: const Duration(milliseconds: 600),
                              )
                              .slideY(
                                begin: 0.2,
                                end: 0,
                                delay: const Duration(milliseconds: 1000),
                                duration: const Duration(milliseconds: 600),
                              ),
                          
                          const SizedBox(height: 24),
                          
                          // Sign In Button
                          Container(
                            width: double.infinity,
                            height: 50,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [
                                  Color(AppConstants.primaryColorValue),
                                  Color(0xFF0056CC), // Darker blue
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(AppConstants.primaryColorValue).withValues(alpha: 0.3),
                                  blurRadius: 20,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                borderRadius: BorderRadius.circular(12),
                                onTap: _isLoading ? null : _signIn,
                                child: Center(
                                  child: _isLoading
                                      ? const CupertinoActivityIndicator(
                                          color: Colors.white,
                                          radius: 12,
                                        )
                                      : const Text(
                                          'Sign In',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 17,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                ),
                              ),
                            ),
                          )
                              .animate()
                              .fadeIn(
                                delay: const Duration(milliseconds: 1200),
                                duration: const Duration(milliseconds: 600),
                              )
                              .slideY(
                                begin: 0.2,
                                end: 0,
                                delay: const Duration(milliseconds: 1200),
                                duration: const Duration(milliseconds: 600),
                              ),
                        ],
                      ),
                    ),
                  ),
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 800),
                      duration: const Duration(milliseconds: 600),
                    )
                    .slideY(
                      begin: 0.3,
                      end: 0,
                      delay: const Duration(milliseconds: 800),
                      duration: const Duration(milliseconds: 600),
                    ),
                
                const SizedBox(height: 32),
                
                // Create Account Link
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      "Don't have an account? ",
                      style: TextStyle(
                        fontSize: 17,
                        color: Color(AppConstants.secondaryTextColorValue),
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        Navigator.of(context).push(
                          CupertinoPageRoute(
                            builder: (context) => const CreateAccountScreen(),
                          ),
                        );
                      },
                      child: const Text(
                        'Sign Up',
                        style: TextStyle(
                          fontSize: 17,
                          color: Color(AppConstants.primaryColorValue),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                )
                    .animate()
                    .fadeIn(
                      delay: const Duration(milliseconds: 1400),
                      duration: const Duration(milliseconds: 600),
                    ),
                
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
