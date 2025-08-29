import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'services/notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final hasToken = prefs.getString('auth_token') != null;
  runApp(MainApp(startAtHome: hasToken));
}

class MainApp extends StatelessWidget {
  final bool startAtHome;
  const MainApp({super.key, required this.startAtHome});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0D0D12),
      ),
      home: startAtHome ? const HomeScreen() : const LoginScreen(),
      builder: (context, child) {
        return NotificationProvider(child: child ?? const SizedBox());
      },
    );
  }
}
