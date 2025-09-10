import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _notificationsEnabled = true;
  bool _darkModeEnabled = false;
  String _selectedLanguage = 'English';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFF03040A),
              Color(0xFF071026),
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Settings',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Settings List
              Expanded(
                child: Container(
                  margin: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withOpacity(0.2),
                      width: 1,
                    ),
                  ),
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Notifications Section
                      const Text(
                        'Notifications',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: SwitchListTile(
                          title: const Text(
                            'Push Notifications',
                            style: TextStyle(color: Colors.white70),
                          ),
                          subtitle: const Text(
                            'Receive notifications for new messages',
                            style: TextStyle(color: Colors.white54, fontSize: 12),
                          ),
                          value: _notificationsEnabled,
                          onChanged: (value) {
                            setState(() {
                              _notificationsEnabled = value;
                            });
                            // TODO: Implement notification settings
                          },
                          activeColor: Colors.blue,
                        ),
                      ),
                      
                      const SizedBox(height: 32),
                      
                      // Appearance Section
                      const Text(
                        'Appearance',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: SwitchListTile(
                          title: const Text(
                            'Dark Mode',
                            style: TextStyle(color: Colors.white70),
                          ),
                          subtitle: const Text(
                            'Use dark theme (Coming soon)',
                            style: TextStyle(color: Colors.white54, fontSize: 12),
                          ),
                          value: _darkModeEnabled,
                          onChanged: (value) {
                            setState(() {
                              _darkModeEnabled = value;
                            });
                            // TODO: Implement dark mode
                          },
                          activeColor: Colors.blue,
                        ),
                      ),
                      
                      const SizedBox(height: 32),
                      
                      // Language Section
                      const Text(
                        'Language',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: ListTile(
                          title: const Text(
                            'Language',
                            style: TextStyle(color: Colors.white70),
                          ),
                          subtitle: Text(
                            _selectedLanguage,
                            style: const TextStyle(color: Colors.white54, fontSize: 12),
                          ),
                          trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 16),
                          onTap: () {
                            _showLanguageSelector();
                          },
                        ),
                      ),
                      
                      const SizedBox(height: 32),
                      
                      // Account Section
                      const Text(
                        'Account',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            ListTile(
                              leading: const Icon(Icons.privacy_tip, color: Colors.white70),
                              title: const Text(
                                'Privacy Policy',
                                style: TextStyle(color: Colors.white70),
                              ),
                              trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 16),
                              onTap: () {
                                // TODO: Show privacy policy
                              },
                            ),
                            const Divider(color: Colors.white24, height: 1),
                            ListTile(
                              leading: const Icon(Icons.description, color: Colors.white70),
                              title: const Text(
                                'Terms of Service',
                                style: TextStyle(color: Colors.white70),
                              ),
                              trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 16),
                              onTap: () {
                                // TODO: Show terms of service
                              },
                            ),
                            const Divider(color: Colors.white24, height: 1),
                            ListTile(
                              leading: const Icon(Icons.info, color: Colors.white70),
                              title: const Text(
                                'About',
                                style: TextStyle(color: Colors.white70),
                              ),
                              trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 16),
                              onTap: () {
                                _showAboutDialog();
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showLanguageSelector() {
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
              const Text(
                'Select Language',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 16),
              
              _buildLanguageOption('English'),
              _buildLanguageOption('Magyar'),
              _buildLanguageOption('Deutsch'),
              _buildLanguageOption('Français'),
              
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLanguageOption(String language) {
    return ListTile(
      title: Text(
        language,
        style: const TextStyle(color: Colors.white70),
      ),
      trailing: _selectedLanguage == language 
        ? const Icon(Icons.check, color: Colors.blue)
        : null,
      onTap: () {
        setState(() {
          _selectedLanguage = language;
        });
        Navigator.pop(context);
        // TODO: Implement language change
      },
    );
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1B2E),
        title: const Text(
          'About Syncre',
          style: TextStyle(color: Colors.white),
        ),
        content: const Text(
          'Syncre Chat App\nVersion 1.0.0\n\nA modern chat application built with Flutter.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'OK',
              style: TextStyle(color: Colors.blue),
            ),
          ),
        ],
      ),
    );
  }
}
