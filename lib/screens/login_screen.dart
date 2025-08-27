import 'dart:ui';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import '../services/api.dart';
import 'register_screen.dart';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../widgets/glass_widgets.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _remember = true;
  bool _obscurePassword = true;
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();

  void _handleLogin() {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill in both email and password')));
      return;
    }

    // Simple email check
    final emailValid = RegExp(r"^[^@\s]+@[^@\s]+\.[^@\s]+$").hasMatch(email);
    if (!emailValid) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid email')));
      return;
    }

    // Call backend login
    _performLogin(email, password);
  }

  Future<void> _performLogin(String email, String password) async {
    try {
      final res = await Api.post('/v1/auth/login', {'email': email, 'password': password});
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        final token = body['token'] as String?;
    if (token != null) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('auth_token', token);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Login success')));
          // fetch user
          final meRes = await Api.get('/v1/user/me', headers: Api.authHeaders(token));
          if (meRes.statusCode == 200) {
            final user = jsonDecode(meRes.body);
            // In real app, navigate to home with user
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => HomeScreen(user: user)));
          }
        } else {
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('No token in response')));
        }
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Login failed: ${res.body}')));
      }
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('Connection refused')) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Kapcsolódási hiba: a backend nem fut (http://localhost:3000)')));
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background gradient
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF03040A), Color(0xFF071026)],
              ),
            ),
          ),

          // Center content
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 48),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Neon badge / logo
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0EA5FF), Color(0xFF2C82FF)],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF2C82FF).withAlpha((0.4 * 255).round()),
                          blurRadius: 18,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Icon(
                        Icons.menu,
                        color: Colors.white,
                        size: 36,
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Frosted glass card
                  GlassCard(
                    width: 360,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(height: 10),
                        const Text(
                          'LOGIN',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                          ),
                        ),
                        const SizedBox(height: 8),
                        // Accent underline
                        Container(
                          width: 120,
                          height: 3,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(2),
                            gradient: const LinearGradient(
                              colors: [Color(0xFF2C82FF), Color(0xFF0EA5FF)],
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Email field
                        TransparentField(
                          controller: _emailController,
                          hint: 'Email or username',
                          prefix: const Icon(Icons.person, color: Colors.white70, size: 18),
                        ),
                        const SizedBox(height: 12),
                        // Password field
                        TransparentField(
                          controller: _passwordController,
                          hint: 'Password',
                          prefix: const Icon(Icons.lock, color: Colors.white70, size: 18),
                          obscure: _obscurePassword,
                          suffix: IconButton(
                            icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off, color: Colors.white70, size: 18),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                        ),

                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: Row(
                                children: [
                                  CupertinoSwitch(
                                    value: _remember,
                                    activeTrackColor: const Color(0xFF2C82FF),
                                    onChanged: (v) => setState(() => _remember = v),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text('Remember me', style: TextStyle(color: Colors.white70)),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: () {},
                              child: const Text('Forgot?', style: TextStyle(color: Colors.white70)),
                            ),
                          ],
                        ),

                        const SizedBox(height: 12),
                        // Login button (neon)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _handleLogin,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              backgroundColor: Colors.transparent,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                            ),
                            child: Ink(
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(colors: [Color(0xFF2C82FF), Color(0xFF0EA5FF)]),
                                borderRadius: BorderRadius.circular(24),
                                boxShadow: [BoxShadow(color: const Color(0xFF2C82FF).withAlpha((0.3 * 255).round()), blurRadius: 14, spreadRadius: 1)],
                              ),
                              child: Container(
                                height: 46,
                                alignment: Alignment.center,
                                child: const Text('LOGIN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 14),
                        Row(children: const [Expanded(child: Divider(color: Colors.white12)), Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Text('OR', style: TextStyle(color: Colors.white54))), Expanded(child: Divider(color: Colors.white12))]),
                        const SizedBox(height: 10),
                        // Social login removed per request
                        TextButton(
                          onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
                          child: const Text('Don\'t have an account? Register', style: TextStyle(color: Colors.white70)),
                        ),
                        const SizedBox(height: 12),
                        const Text('By continuing you agree to our Terms', style: TextStyle(color: Colors.white38, fontSize: 12)),
                        const SizedBox(height: 10),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}


// uses shared GlassCard / TransparentField from widgets/glass_widgets.dart