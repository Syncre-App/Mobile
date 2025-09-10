import 'package:flutter/material.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
import '../widgets/glass_widgets.dart';

import 'login_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _username = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _password2 = TextEditingController();
  bool _loading = false;

  Future<void> _register() async {
    final u = _username.text.trim();
    final e = _email.text.trim();
    final p = _password.text;
    final p2 = _password2.text;

    if (u.isEmpty || e.isEmpty || p.isEmpty || p2.isEmpty) {
      NotificationService.instance.show(NotificationType.warning, 'All fields are required');
      return;
    }
    if (p != p2) {
      NotificationService.instance.show(NotificationType.warning, 'Passwords do not match');
      return;
    }

    setState(() => _loading = true);
    print('📝 Starting registration for: $e (username: $u)');
    try {
      final res = await Api.post('/v1/auth/register', {'email': e, 'username': u, 'password': p});
      print('📝 Register response status: ${res.statusCode}');
      print('📝 Register response body: ${res.body}');
      
      if (res.statusCode == 200 || res.statusCode == 201) {
        print('✅ Registration successful');
  if (!mounted) return;
  NotificationService.instance.show(NotificationType.info, 'Registered — please check email');
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => VerifyScreen(email: e)));
      } else {
        print('❌ Registration failed with status: ${res.statusCode}');
  if (!mounted) return;
  NotificationService.instance.show(NotificationType.error, 'Register failed: ${res.body}');
      }
    } catch (e) {
      print('❌ Registration exception: $e');
      final msg = e.toString();
      if (!mounted) return;
      if (msg.contains('Connection refused')) {
        NotificationService.instance.show(NotificationType.error, 'Kapcsolódási hiba: a backend nem fut (${Api.baseUrl})');
      } else {
        NotificationService.instance.show(NotificationType.error, 'Error: $e');
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF03040A), Color(0xFF071026)],
              ),
            ),
          ),
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 48),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                          colors: [Color(0xFF0EA5FF), Color(0xFF2C82FF)], begin: Alignment.topCenter, end: Alignment.bottomCenter),
                      boxShadow: [BoxShadow(color: const Color(0xFF2C82FF).withAlpha((0.4 * 255).round()), blurRadius: 18, spreadRadius: 4)],
                    ),
                    child: const Center(child: Icon(Icons.menu, color: Colors.white, size: 36)),
                  ),
                  const SizedBox(height: 24),
                  GlassCard(
                    width: 360,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const SizedBox(height: 10),
                        const Text('REGISTER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 2)),
                        const SizedBox(height: 8),
                        Container(
                          width: 120,
                          height: 3,
                          decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), gradient: const LinearGradient(colors: [Color(0xFF2C82FF), Color(0xFF0EA5FF)])),
                        ),
                        const SizedBox(height: 20),
                        TransparentField(controller: _username, hint: 'Username', prefix: const Icon(Icons.person, color: Colors.white70, size: 18)),
                        const SizedBox(height: 12),
                        TransparentField(controller: _email, hint: 'Email', prefix: const Icon(Icons.email, color: Colors.white70, size: 18)),
                        const SizedBox(height: 12),
                        TransparentField(controller: _password, hint: 'Password', prefix: const Icon(Icons.lock, color: Colors.white70, size: 18), obscure: true),
                        const SizedBox(height: 12),
                        TransparentField(controller: _password2, hint: 'Confirm password', prefix: const Icon(Icons.lock, color: Colors.white70, size: 18), obscure: true),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: _loading ? null : _register,
                            style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 14), backgroundColor: Colors.transparent, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24))),
                child: Ink(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF2C82FF), Color(0xFF0EA5FF)]), borderRadius: BorderRadius.circular(24), boxShadow: [BoxShadow(color: const Color(0xFF2C82FF).withAlpha((0.3 * 255).round()), blurRadius: 14, spreadRadius: 1)]),
                              child: Container(height: 46, alignment: Alignment.center, child: _loading ? const CircularProgressIndicator() : const Text('REGISTER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton(onPressed: () => Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen())), child: const Text('Already have an account? Login', style: TextStyle(color: Colors.white70))),
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

class VerifyScreen extends StatefulWidget {
  final String email;
  const VerifyScreen({super.key, required this.email});

  @override
  State<VerifyScreen> createState() => _VerifyScreenState();
}

class _VerifyScreenState extends State<VerifyScreen> {
  final TextEditingController _code = TextEditingController();
  bool _loading = false;

  Future<void> _verify() async {
    final c = _code.text.trim();
    if (c.isEmpty) {
      NotificationService.instance.show(NotificationType.warning, 'Please enter code');
      return;
    }
    setState(() => _loading = true);
    print('✅ Starting verification for: ${widget.email} with code: $c');
    try {
      final res = await Api.post('/v1/auth/verify', {'email': widget.email, 'code': c});
      print('✅ Verify response status: ${res.statusCode}');
      print('✅ Verify response body: ${res.body}');
      
      if (res.statusCode == 200) {
        print('✅ Verification successful');
  if (!mounted) return;
  NotificationService.instance.show(NotificationType.success, 'Verified');
        Navigator.of(context).popUntil((route) => route.isFirst);
      } else {
        print('❌ Verification failed with status: ${res.statusCode}');
  if (!mounted) return;
  NotificationService.instance.show(NotificationType.error, 'Verify failed: ${res.body}');
      }
    } catch (e) {
      print('❌ Verification exception: $e');
      final msg = e.toString();
      if (!mounted) return;
      if (msg.contains('Connection refused')) {
        NotificationService.instance.show(NotificationType.error, 'Kapcsolódási hiba: a backend nem fut (${Api.baseUrl})');
      } else {
        NotificationService.instance.show(NotificationType.error, 'Error: $e');
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF03040A), Color(0xFF071026)],
              ),
            ),
          ),
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 48),
              child: GlassCard(
                width: 360,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('VERIFY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 2)),
                    const SizedBox(height: 20),
                    Text('A verification code was sent to ${widget.email}', style: const TextStyle(color: Colors.white70)),
                    const SizedBox(height: 12),
                    TransparentField(controller: _code, hint: 'Code'),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _verify,
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
                          ),
                          child: Container(
                            height: 46,
                            alignment: Alignment.center,
                            child: _loading ? const CircularProgressIndicator() : const Text('VERIFY', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
