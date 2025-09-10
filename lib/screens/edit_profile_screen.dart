import 'package:flutter/material.dart';
import '../services/notification_service.dart';

class EditProfileScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  
  const EditProfileScreen({Key? key, required this.user}) : super(key: key);

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _usernameController;
  late TextEditingController _emailController;
  late TextEditingController _bioController;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _usernameController = TextEditingController(text: widget.user['username'] ?? '');
    _emailController = TextEditingController(text: widget.user['email'] ?? '');
    _bioController = TextEditingController(text: widget.user['bio'] ?? '');
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _bioController.dispose();
    super.dispose();
  }

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
                    const Expanded(
                      child: Text(
                        'Edit Profile',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: _loading ? null : _saveProfile,
                      child: Text(
                        'Save',
                        style: TextStyle(
                          color: _loading ? Colors.white38 : Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              
              // Profile Form
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
                  child: Form(
                    key: _formKey,
                    child: ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        // Profile Picture Section
                        Center(
                          child: Stack(
                            children: [
                              CircleAvatar(
                                radius: 60,
                                backgroundColor: Colors.purple.withOpacity(0.3),
                                backgroundImage: widget.user['profile_picture'] != null 
                                  ? NetworkImage(widget.user['profile_picture']) 
                                  : null,
                                child: widget.user['profile_picture'] == null 
                                  ? Text(
                                      (widget.user['username'] ?? widget.user['email'] ?? 'U')[0].toUpperCase(),
                                      style: const TextStyle(
                                        color: Colors.white, 
                                        fontWeight: FontWeight.bold,
                                        fontSize: 36,
                                      ),
                                    )
                                  : null,
                              ),
                              Positioned(
                                bottom: 0,
                                right: 0,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.blue,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(color: Colors.white, width: 2),
                                  ),
                                  child: IconButton(
                                    icon: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                                    onPressed: () {
                                      _showImagePickerOptions();
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        
                        const SizedBox(height: 32),
                        
                        // Username Field
                        _buildInputField(
                          controller: _usernameController,
                          label: 'Username',
                          icon: Icons.person,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Username cannot be empty';
                            }
                            if (value.length < 3) {
                              return 'Username must be at least 3 characters';
                            }
                            return null;
                          },
                        ),
                        
                        const SizedBox(height: 20),
                        
                        // Email Field
                        _buildInputField(
                          controller: _emailController,
                          label: 'Email',
                          icon: Icons.email,
                          keyboardType: TextInputType.emailAddress,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Email cannot be empty';
                            }
                            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
                              return 'Please enter a valid email';
                            }
                            return null;
                          },
                        ),
                        
                        const SizedBox(height: 20),
                        
                        // Bio Field
                        _buildInputField(
                          controller: _bioController,
                          label: 'Bio',
                          icon: Icons.description,
                          maxLines: 3,
                          validator: (value) {
                            if (value != null && value.length > 200) {
                              return 'Bio cannot exceed 200 characters';
                            }
                            return null;
                          },
                        ),
                        
                        const SizedBox(height: 32),
                        
                        // Additional Options
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            children: [
                              ListTile(
                                leading: const Icon(Icons.lock, color: Colors.white70),
                                title: const Text(
                                  'Change Password',
                                  style: TextStyle(color: Colors.white70),
                                ),
                                trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 16),
                                onTap: () {
                                  _showChangePasswordDialog();
                                },
                              ),
                              const Divider(color: Colors.white24, height: 1),
                              ListTile(
                                leading: const Icon(Icons.delete_forever, color: Colors.red),
                                title: const Text(
                                  'Delete Account',
                                  style: TextStyle(color: Colors.red),
                                ),
                                trailing: const Icon(Icons.arrow_forward_ios, color: Colors.white54, size: 16),
                                onTap: () {
                                  _showDeleteAccountDialog();
                                },
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType? keyboardType,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Colors.white.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        maxLines: maxLines,
        validator: validator,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: Colors.white70),
          prefixIcon: Icon(icon, color: Colors.white70),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.all(16),
          counterStyle: const TextStyle(color: Colors.white54),
        ),
        maxLength: label == 'Bio' ? 200 : null,
      ),
    );
  }

  void _showImagePickerOptions() {
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
                'Change Profile Picture',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 16),
              
              ListTile(
                leading: const Icon(Icons.camera_alt, color: Colors.white70),
                title: const Text('Take Photo', style: TextStyle(color: Colors.white70)),
                onTap: () {
                  Navigator.pop(context);
                  // TODO: Implement camera capture
                  _showNotImplemented();
                },
              ),
              
              ListTile(
                leading: const Icon(Icons.photo_library, color: Colors.white70),
                title: const Text('Choose from Gallery', style: TextStyle(color: Colors.white70)),
                onTap: () {
                  Navigator.pop(context);
                  // TODO: Implement gallery selection
                  _showNotImplemented();
                },
              ),
              
              if (widget.user['profile_picture'] != null)
                ListTile(
                  leading: const Icon(Icons.delete, color: Colors.red),
                  title: const Text('Remove Photo', style: TextStyle(color: Colors.red)),
                  onTap: () {
                    Navigator.pop(context);
                    // TODO: Implement photo removal
                    _showNotImplemented();
                  },
                ),
              
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  void _showChangePasswordDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1B2E),
        title: const Text('Change Password', style: TextStyle(color: Colors.white)),
        content: const Text(
          'Password change functionality will be implemented soon.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK', style: TextStyle(color: Colors.blue)),
          ),
        ],
      ),
    );
  }

  void _showDeleteAccountDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1B2E),
        title: const Text('Delete Account', style: TextStyle(color: Colors.red)),
        content: const Text(
          'Are you sure you want to delete your account? This action cannot be undone.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: Colors.white70)),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _showNotImplemented();
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  void _showNotImplemented() {
    NotificationService.instance.show(
      NotificationType.info, 
      'This feature will be implemented soon'
    );
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _loading = true;
    });

    try {
      // TODO: Implement actual profile update API call
      await Future.delayed(const Duration(seconds: 1)); // Simulate API call
      
      if (!mounted) return;
      
      NotificationService.instance.show(
        NotificationType.success, 
        'Profile updated successfully (Demo - not actually saved)'
      );
      
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      
      NotificationService.instance.show(
        NotificationType.error, 
        'Failed to update profile: $e'
      );
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }
}
