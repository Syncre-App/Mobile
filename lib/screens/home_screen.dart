import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
import '../widgets/friend_search_widget.dart';
import '../widgets/chat_list_widget.dart';
import '../widgets/profile_header_widget.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;
  List<Map<String, dynamic>> _chats = [];
  bool _loadingChats = false;

  @override
  void initState() {
    super.initState();
    _loadMe();
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

  void _onFriendAdded() {
    _loadChats(); // Reload chats when friend is added
  }

  Future<void> _checkAndShowWelcomeDialog() async {
    // Welcome dialog functionality can be added later
    if (mounted) {
      print('Welcome dialog would show here');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    
    if (error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text(error!),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadMe,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

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
              // Profile Header
              if (user != null) ProfileHeaderWidget(user: user!),
              
              // Friend Search Widget
              FriendSearchWidget(
                onFriendAdded: _onFriendAdded,
              ),
              
              // Chat List
              Expanded(
                child: ChatListWidget(
                  chats: _chats,
                  isLoading: _loadingChats,
                  onRefresh: _loadChats,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
