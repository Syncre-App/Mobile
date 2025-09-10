import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../screens/login_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/edit_profile_screen.dart';

class ProfileHeaderWidget extends StatelessWidget {
  final Map<String, dynamic> user;
  
  const ProfileHeaderWidget({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Chats',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
          GestureDetector(
            onTap: () => _showProfileMenu(context),
            child: CircleAvatar(
              radius: 20,
              backgroundColor: Colors.purple.withOpacity(0.3),
              backgroundImage: user['profile_picture'] != null 
                ? NetworkImage(user['profile_picture']) 
                : null,
              child: user['profile_picture'] == null 
                ? Text(
                    (user['username'] ?? user['email'] ?? 'U')[0].toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  )
                : null,
            ),
          ),
        ],
      ),
    );
  }

  void _showProfileMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1A1B2E).withOpacity(0.95),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              
              CircleAvatar(
                radius: 40,
                backgroundColor: Colors.purple.withOpacity(0.3),
                backgroundImage: user['profile_picture'] != null 
                  ? NetworkImage(user['profile_picture']) 
                  : null,
                child: user['profile_picture'] == null 
                  ? Text(
                      (user['username'] ?? user['email'] ?? 'U')[0].toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 24),
                    )
                  : null,
              ),
              
              const SizedBox(height: 16),
              
              Text(
                user['username'] ?? user['email'] ?? 'User',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
              ),
              
              Text(
                user['email'] ?? '',
                style: const TextStyle(color: Colors.white54, fontSize: 14),
              ),
              
              const SizedBox(height: 32),
              
              ListTile(
                leading: const Icon(Icons.person, color: Colors.white70),
                title: const Text('Edit Profile', style: TextStyle(color: Colors.white70)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => EditProfileScreen(user: user),
                    ),
                  );
                },
              ),
              
              ListTile(
                leading: const Icon(Icons.settings, color: Colors.white70),
                title: const Text('Settings', style: TextStyle(color: Colors.white70)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const SettingsScreen(),
                    ),
                  );
                },
              ),
              
              const Divider(color: Colors.white24),
              
              ListTile(
                leading: const Icon(Icons.logout, color: Colors.red),
                title: const Text('Logout', style: TextStyle(color: Colors.red)),
                onTap: () async {
                  Navigator.pop(context);
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.remove('auth_token');
                  if (!context.mounted) return;
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                    (route) => false,
                  );
                },
              ),
              
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
