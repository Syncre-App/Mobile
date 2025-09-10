import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';
import '../services/api.dart';
import '../widgets/welcome_dialog.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, dynamic>? user;
  const HomeScreen({super.key, this.user});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? user;
  String? error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    user = widget.user;
    if (user == null) {
      _loadMe();
    } else {
      _checkAndShowWelcomeDialog();
    }
  }

  Future<void> _loadMe() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      print('🏠 Loading user data...');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      print('🏠 Token found: ${token != null ? "✅ Yes" : "❌ No"}');
      
      if (token == null) {
        print('❌ No auth token found');
        if (!mounted) return;
        setState(() {
          error = 'No auth token found. Please log in.';
          loading = false;
        });
        return;
      }

      final res = await Api.get('/user/me', headers: Api.authHeaders(token));
      print('🏠 User data response status: ${res.statusCode}');
      print('🏠 User data response body: ${res.body}');
      
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        print('🏠 Parsed user data: $body');
        if (!mounted) return;
        setState(() {
          user = body;
          loading = false;
        });
        _checkAndShowWelcomeDialog();
      } else {
        print('❌ Failed to fetch user data');
        if (!mounted) return;
        setState(() {
          error = 'Failed to fetch user: ${res.statusCode} ${res.body}';
          loading = false;
        });
      }
    } catch (e) {
      print('❌ Home screen exception: $e');
      if (!mounted) return;
      setState(() {
        error = e.toString();
        loading = false;
      });
    }
  }

  Future<void> _checkAndShowWelcomeDialog() async {
    if (mounted) {
      await WelcomeDialog.showIfFirstTime(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (error != null) {
      body = Center(child: Text(error!, style: const TextStyle(color: Colors.red)));
    } else if (user != null) {
      final name = user!['username'] ?? user!['email'] ?? 'User';
      final email = user!['email'] ?? '';
      body = Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Welcome, $name', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Email: $email'),
            const SizedBox(height: 16),
            Text('Raw user data:', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Expanded(child: SingleChildScrollView(child: Text(jsonEncode(user), style: const TextStyle(fontFamily: 'monospace')))),
          ],
        ),
      );
    } else {
      body = const Center(child: Text('No user data'));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (String value) async {
              final navigator = Navigator.of(context);
              final prefs = await SharedPreferences.getInstance();
              
              if (value == 'logout') {
                await prefs.remove('auth_token');
                if (!mounted) return;
                navigator.pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                  (route) => false,
                );
              } else if (value == 'reset_welcome') {
                await WelcomeDialog.resetWelcomeDialog();
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Welcome dialog reset! Restart app to see it again.')),
                );
              }
            },
            itemBuilder: (BuildContext context) => [
              const PopupMenuItem<String>(
                value: 'reset_welcome',
                child: Row(
                  children: [
                    Icon(Icons.refresh, color: Colors.white70),
                    SizedBox(width: 8),
                    Text('Reset Welcome'),
                  ],
                ),
              ),
              const PopupMenuItem<String>(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: Colors.white70),
                    SizedBox(width: 8),
                    Text('Logout'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: body,
    );
  }
}
