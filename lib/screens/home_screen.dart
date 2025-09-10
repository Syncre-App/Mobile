import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
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
  
  // New state for friend search and chats
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  List<Map<String, dynamic>> _chats = [];
  bool _isSearching = false;
  bool _loadingChats = false;

  @override
  void initState() {
    super.initState();
    user = widget.user;
    if (user == null) {
      _loadMe();
    } else {
      _checkAndShowWelcomeDialog();
      _loadChats();
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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

      final meRes = await Api.get('/user/me', headers: Api.authHeaders(token));
      print('🏠 Me response status: ${meRes.statusCode}');
      print('🏠 Me response body: ${meRes.body}');
      
      if (meRes.statusCode == 200) {
        final userData = jsonDecode(meRes.body);
        print('🏠 User data loaded successfully');
        if (!mounted) return;
        setState(() {
          user = userData;
          loading = false;
        });
        _checkAndShowWelcomeDialog();
        _loadChats();
      } else {
        print('❌ Failed to load user data');
        if (!mounted) return;
        setState(() {
          error = 'Failed to load user data';
          loading = false;
        });
      }
    } catch (e) {
      print('❌ Exception loading user data: $e');
      if (!mounted) return;
      setState(() {
        error = 'Error: $e';
        loading = false;
      });
    }
  }

  // Load user's chats
  Future<void> _loadChats() async {
    setState(() => _loadingChats = true);
    
    try {
      print('💬 Loading chats...');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) {
        print('❌ No auth token for chats');
        return;
      }
      
      final response = await Api.get('/chat/', headers: Api.authHeaders(token));
      print('💬 Chats response status: ${response.statusCode}');
      print('💬 Chats response body: ${response.body}');
      
      if (response.statusCode == 200) {
        final List<dynamic> chatsData = jsonDecode(response.body);
        if (!mounted) return;
        setState(() {
          _chats = chatsData.cast<Map<String, dynamic>>();
          _loadingChats = false;
        });
        print('💬 Loaded ${_chats.length} chats');
      } else {
        print('❌ Failed to load chats');
        if (!mounted) return;
        setState(() => _loadingChats = false);
        NotificationService.instance.show(NotificationType.error, 'Failed to load chats');
      }
    } catch (e) {
      print('❌ Exception loading chats: $e');
      if (!mounted) return;
      setState(() => _loadingChats = false);
      NotificationService.instance.show(NotificationType.error, 'Error loading chats: $e');
    }
  }

  // Search for users/friends
  Future<void> _searchUsers(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _isSearching = false;
      });
      return;
    }
    
    setState(() => _isSearching = true);
    
    try {
      print('🔍 Searching users with query: $query');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) {
        print('❌ No auth token for search');
        return;
      }
      
      final response = await Api.get('/user/search?q=${Uri.encodeComponent(query)}', headers: Api.authHeaders(token));
      print('🔍 Search response status: ${response.statusCode}');
      print('🔍 Search response body: ${response.body}');
      
      if (response.statusCode == 200) {
        final List<dynamic> searchData = jsonDecode(response.body);
        if (!mounted) return;
        setState(() {
          _searchResults = searchData.cast<Map<String, dynamic>>();
          _isSearching = false;
        });
        print('🔍 Found ${_searchResults.length} users');
      } else {
        print('❌ Search failed');
        if (!mounted) return;
        setState(() => _isSearching = false);
        NotificationService.instance.show(NotificationType.error, 'Search failed');
      }
    } catch (e) {
      print('❌ Exception during search: $e');
      if (!mounted) return;
      setState(() => _isSearching = false);
      NotificationService.instance.show(NotificationType.error, 'Search error: $e');
    }
  }

  // Add friend
  Future<void> _addFriend(int friendId) async {
    try {
      print('👥 Adding friend with ID: $friendId');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) {
        print('❌ No auth token for adding friend');
        return;
      }
      
      final response = await Api.post('/user/add', {'friendId': friendId}, headers: Api.authHeaders(token));
      print('👥 Add friend response status: ${response.statusCode}');
      print('👥 Add friend response body: ${response.body}');
      
      if (response.statusCode == 200) {
        if (!mounted) return;
        NotificationService.instance.show(NotificationType.success, 'Friend added successfully!');
        _loadChats(); // Reload chats after adding friend
        // Clear search after adding
        _searchController.clear();
        setState(() {
          _searchResults = [];
        });
      } else {
        print('❌ Failed to add friend');
        if (!mounted) return;
        String errorMessage = 'Failed to add friend';
        try {
          final errorBody = jsonDecode(response.body);
          if (errorBody['message'] != null) {
            errorMessage = errorBody['message'];
          }
        } catch (e) {
          // Keep default message
        }
        NotificationService.instance.show(NotificationType.error, errorMessage);
      }
    } catch (e) {
      print('❌ Exception adding friend: $e');
      if (!mounted) return;
      NotificationService.instance.show(NotificationType.error, 'Error adding friend: $e');
    }
  }

  Future<void> _checkAndShowWelcomeDialog() async {
    if (mounted) {
      await WelcomeDialog.showIfFirstTime(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF03040A), Color(0xFF071026)],
            ),
          ),
          child: const Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (error != null) {
      return Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF03040A), Color(0xFF071026)],
            ),
          ),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(error!, style: const TextStyle(color: Colors.red, fontSize: 16)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () async {
                    final prefs = await SharedPreferences.getInstance();
                    await prefs.remove('auth_token');
                    if (!mounted) return;
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                      (route) => false,
                    );
                  },
                  child: const Text('Login Again'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('No user data')),
      );
    }

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF03040A), Color(0xFF071026)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              // Header with profile picture and logout
              Padding(
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
                        backgroundImage: user!['profile_picture'] != null 
                          ? NetworkImage(user!['profile_picture']) 
                          : null,
                        child: user!['profile_picture'] == null 
                          ? Text(
                              (user!['username'] ?? user!['email'] ?? 'U')[0].toUpperCase(),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                            )
                          : null,
                      ),
                    ),
                  ],
                ),
              ),
              
              // Search bar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.2)),
                  ),
                  child: TextField(
                    controller: _searchController,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: 'Search for friends...',
                      hintStyle: TextStyle(color: Colors.white54),
                      prefixIcon: Icon(Icons.search, color: Colors.white54),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                    onChanged: (value) {
                      // Debounce search
                      Future.delayed(const Duration(milliseconds: 500), () {
                        if (_searchController.text == value) {
                          _searchUsers(value);
                        }
                      });
                    },
                  ),
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Search results or chats
              Expanded(
                child: _searchController.text.isNotEmpty 
                  ? _buildSearchResults()
                  : _buildChatsList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSearchResults() {
    if (_isSearching) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_searchResults.isEmpty) {
      return const Center(
        child: Text(
          'No users found',
          style: TextStyle(color: Colors.white54),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _searchResults.length,
      itemBuilder: (context, index) {
        final userResult = _searchResults[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.2)),
            ),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: Colors.purple.withOpacity(0.3),
                backgroundImage: userResult['profile_picture'] != null 
                  ? NetworkImage(userResult['profile_picture']) 
                  : null,
                child: userResult['profile_picture'] == null 
                  ? Text(
                      (userResult['username'] ?? 'U')[0].toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    )
                  : null,
              ),
              title: Text(
                userResult['username'] ?? 'Unknown',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                userResult['email'] ?? '',
                style: const TextStyle(color: Colors.white54),
              ),
              trailing: IconButton(
                icon: const Icon(Icons.person_add, color: Colors.green),
                onPressed: () => _addFriend(userResult['id']),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildChatsList() {
    if (_loadingChats) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_chats.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline, size: 64, color: Colors.white54),
            SizedBox(height: 16),
            Text(
              'No chats yet',
              style: TextStyle(color: Colors.white54, fontSize: 18),
            ),
            SizedBox(height: 8),
            Text(
              'Search for friends to start chatting',
              style: TextStyle(color: Colors.white38, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _chats.length,
      itemBuilder: (context, index) {
        final chat = _chats[index];
        // TODO: Extract friend info from chat users array
        final chatName = chat['name'] ?? 'Chat';
        
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.2)),
            ),
            child: ListTile(
              leading: CircleAvatar(
                backgroundColor: Colors.purple.withOpacity(0.3),
                child: Text(
                  chatName[0].toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              title: Text(
                chatName,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
              ),
              subtitle: Text(
                'Last message...', // TODO: Get last message
                style: const TextStyle(color: Colors.white54),
              ),
              onTap: () {
                // TODO: Navigate to chat screen
                NotificationService.instance.show(NotificationType.info, 'Chat screen coming soon!');
              },
            ),
          ),
        );
      },
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
                backgroundImage: user!['profile_picture'] != null 
                  ? NetworkImage(user!['profile_picture']) 
                  : null,
                child: user!['profile_picture'] == null 
                  ? Text(
                      (user!['username'] ?? user!['email'] ?? 'U')[0].toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 24),
                    )
                  : null,
              ),
              
              const SizedBox(height: 16),
              
              Text(
                user!['username'] ?? user!['email'] ?? 'User',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
              ),
              
              Text(
                user!['email'] ?? '',
                style: const TextStyle(color: Colors.white54, fontSize: 14),
              ),
              
              const SizedBox(height: 32),
              
              ListTile(
                leading: const Icon(Icons.logout, color: Colors.red),
                title: const Text('Logout', style: TextStyle(color: Colors.red)),
                onTap: () async {
                  Navigator.pop(context);
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.remove('auth_token');
                  if (!mounted) return;
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
