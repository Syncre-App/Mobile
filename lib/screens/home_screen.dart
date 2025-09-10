import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api.dart';
import '../services/notification_service.dart';
import '../services/websocket_service.dart';
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
  final WebSocketService _wsService = WebSocketService();
  Map<String, String> _userStatuses = {};

  @override
  void initState() {
    super.initState();
    _loadMe();
    _initializeWebSocket();
  }

  @override
  void dispose() {
    _wsService.disconnect();
    super.dispose();
  }

  Future<void> _initializeWebSocket() async {
    print('🌐 Initializing WebSocket connection...');
    
    // Listen to status changes
    _wsService.statusStream.listen((statuses) {
      if (mounted) {
        setState(() {
          _userStatuses = statuses;
        });
        print('👤 User statuses updated: ${statuses.length} users');
      }
    });

    // Connect to WebSocket
    await _wsService.connect();
  }

  Future<void> _loadMe() async {
    if (!mounted) return;
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
      
      if (!mounted) return;
      
      if (meRes.statusCode == 200) {
        final userData = jsonDecode(meRes.body);
        print('🏠 User data loaded successfully');
        setState(() {
          user = userData;
          loading = false;
        });
        _checkAndShowWelcomeDialog();
        _loadChats();
      } else {
        print('❌ Failed to load user data');
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
    if (!mounted) return;
    setState(() => _loadingChats = true);
    
    try {
      print('💬 Loading chats...');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) {
        print('❌ No auth token for chats');
        if (!mounted) return;
        setState(() => _loadingChats = false);
        return;
      }
      
      final response = await Api.get('/chat/', headers: Api.authHeaders(token));
      print('💬 Chats response status: ${response.statusCode}');
      print('💬 Chats response body: ${response.body}');
      
      if (!mounted) return;
      
      if (response.statusCode == 200) {
        final responseData = jsonDecode(response.body);
        List<dynamic> chatsData;
        
        // Handle both array response and object with chats property
        if (responseData is List) {
          chatsData = responseData;
        } else if (responseData is Map && responseData['chats'] != null) {
          chatsData = responseData['chats'];
        } else {
          chatsData = [];
        }
        
        setState(() {
          _chats = chatsData.cast<Map<String, dynamic>>();
          _loadingChats = false;
        });
        if (_chats.isEmpty) {
          print('💬 No chats found - user has no conversations yet');
        } else {
          print('💬 Loaded ${_chats.length} chats successfully');
        }
      } else {
        print('❌ Failed to load chats - HTTP ${response.statusCode}');
        setState(() => _loadingChats = false);
        NotificationService.instance.show(NotificationType.error, 'Failed to load chats');
      }
    } catch (e) {
      print('❌ Network error loading chats: $e');
      if (!mounted) return;
      setState(() => _loadingChats = false);
      
      // Only show user notification for actual network errors, not empty results
      if (e.toString().contains('timeout')) {
        print('⏰ Chat loading timed out - this might be normal if server is slow');
        // Don't show error notification for timeout, just log it
      } else if (e.toString().contains('Connection refused')) {
        NotificationService.instance.show(NotificationType.error, 'Server unavailable - please try again later');
      } else {
        NotificationService.instance.show(NotificationType.error, 'Unable to load chats');
      }
    }
  }

  void _onFriendAdded() {
    if (mounted) {
      // Add a small delay to ensure server has processed the friend addition
      Future.delayed(const Duration(milliseconds: 500), () {
        if (mounted) {
          _loadChats(); // Reload chats when friend is added
        }
      });
    }
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
              if (user != null) ProfileHeaderWidget(
                user: user!,
                userStatuses: _userStatuses,
              ),
              
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
                  userStatuses: _userStatuses,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
