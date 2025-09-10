import 'dart:convert';
import 'dart:async';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();
  factory WebSocketService() => _instance;
  WebSocketService._internal();

  WebSocketChannel? _channel;
  StreamController<Map<String, dynamic>>? _messageController;
  Timer? _pingTimer;
  bool _isConnected = false;
  String? _currentToken;

  // User status tracking
  final Map<String, String> _userStatuses = {}; // userId -> status
  final StreamController<Map<String, String>> _statusController = StreamController.broadcast();

  Stream<Map<String, dynamic>> get messageStream => _messageController?.stream ?? const Stream.empty();
  Stream<Map<String, String>> get statusStream => _statusController.stream;
  bool get isConnected => _isConnected;
  Map<String, String> get userStatuses => Map.unmodifiable(_userStatuses);

  Future<void> connect() async {
    if (_isConnected) {
      print('🌐 WebSocket already connected');
      return;
    }

    try {
      print('🌐 Connecting to WebSocket...');
      
      // Get auth token
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) {
        print('❌ No auth token found for WebSocket');
        return;
      }

      _currentToken = token;
      
      // Connect to WebSocket
      _channel = WebSocketChannel.connect(
        Uri.parse('wss://api.syncre.xyz/ws'),
      );

      _messageController = StreamController<Map<String, dynamic>>.broadcast();
      
      // Listen to messages
      _channel!.stream.listen(
        _handleMessage,
        onError: _handleError,
        onDone: _handleDisconnect,
      );

      print('🌐 WebSocket connected, authenticating...');

      // Authenticate within 5 seconds
      _authenticate();

    } catch (e) {
      print('❌ WebSocket connection error: $e');
      _handleDisconnect();
    }
  }

  void _authenticate() {
    if (_currentToken != null && _channel != null) {
      final authMessage = {
        'type': 'auth',
        'token': _currentToken,
      };
      
      print('🔐 Sending authentication...');
      _channel?.sink.add(jsonEncode(authMessage));
    }
  }

  void _handleMessage(dynamic data) {
    try {
      final Map<String, dynamic> message = jsonDecode(data);
      print('📨 WebSocket message: ${message['type']}');

      switch (message['type']) {
        case 'auth_success':
          _isConnected = true; // Only set connected after successful auth
          print('✅ WebSocket authentication successful - Now ONLINE');
          _startPingTimer(); // Start ping timer after successful auth
          _loadFriendsStatus(); // Load friends status after successful auth
          break;

        case 'friend_status_change':
          _handleFriendStatusChange(message);
          break;

        case 'pong':
          print('🏓 Pong received');
          break;

        case 'error':
          print('❌ WebSocket error: ${message['message']}');
          break;

        default:
          print('🔔 Unknown message type: ${message['type']}');
      }

      // Forward message to listeners
      _messageController?.add(message);

    } catch (e) {
      print('❌ Error parsing WebSocket message: $e');
    }
  }

  void _handleFriendStatusChange(Map<String, dynamic> message) {
    final userId = message['userId']?.toString();
    final status = message['status']?.toString();
    final username = message['username']?.toString();

    if (userId != null && status != null) {
      _userStatuses[userId] = status;
      print('👤 Friend status: $username ($userId) is now $status');
      
      // Notify listeners
      _statusController.add(Map.from(_userStatuses));
    }
  }

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (_isConnected && _channel != null) {
        _sendPing();
      } else {
        timer.cancel();
      }
    });
  }

  void _sendPing() {
    if (_isConnected && _channel != null) {
      final pingMessage = {'type': 'ping'};
      _channel?.sink.add(jsonEncode(pingMessage));
      print('🏓 Ping sent');
    }
  }

  void _handleError(error) {
    print('❌ WebSocket error: $error');
    _handleDisconnect();
  }

  void _handleDisconnect() {
    print('🔌 WebSocket disconnected');
    _isConnected = false;
    _pingTimer?.cancel();
    _channel = null;
    
    // Try to reconnect after 5 seconds
    Timer(const Duration(seconds: 5), () {
      if (!_isConnected) {
        print('🔄 Attempting to reconnect WebSocket...');
        connect();
      }
    });
  }

  void disconnect() {
    print('🔌 Disconnecting WebSocket...');
    _isConnected = false;
    _pingTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
    _messageController?.close();
    _messageController = null;
  }

  String? getUserStatus(String userId) {
    return _userStatuses[userId];
  }

  bool isUserOnline(String userId) {
    return _userStatuses[userId] == 'online';
  }

  // Manually refresh friends status
  Future<void> refreshFriendsStatus() async {
    if (_isConnected) {
      await _loadFriendsStatus();
    }
  }

  void dispose() {
    disconnect();
    _statusController.close();
  }

  Future<void> _loadFriendsStatus() async {
    try {
      print('👥 Loading friends status on app start...');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) {
        print('❌ No auth token for loading friends status');
        return;
      }

      // Try to get friends list first
      final friendsResponse = await Api.get('/user/friends', headers: Api.authHeaders(token));
      print('👥 Friends response status: ${friendsResponse.statusCode}');
      
      if (friendsResponse.statusCode == 200) {
        final friendsData = jsonDecode(friendsResponse.body);
        List<dynamic> friends = [];
        
        // Handle different response formats
        if (friendsData is List) {
          friends = friendsData;
        } else if (friendsData is Map && friendsData['friends'] != null) {
          friends = friendsData['friends'];
        }
        
        print('👥 Found ${friends.length} friends, checking their status...');
        
        // Load status for each friend
        for (final friend in friends) {
          final friendId = friend['id']?.toString() ?? friend['friend_id']?.toString();
          if (friendId != null) {
            await _loadUserStatus(friendId);
          }
        }
        
        // Notify listeners about status updates
        _statusController.add(Map.from(_userStatuses));
        
      } else if (friendsResponse.statusCode == 404) {
        print('👥 No friends endpoint available, trying alternative approach...');
        // Alternative: load from chat participants
        await _loadStatusFromChats();
      } else {
        print('❌ Failed to load friends: ${friendsResponse.statusCode}');
      }
      
    } catch (e) {
      print('❌ Error loading friends status: $e');
      // Try alternative approach if main method fails
      await _loadStatusFromChats();
    }
  }

  Future<void> _loadUserStatus(String userId) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) return;
      
      final response = await Api.get('/user/$userId', headers: Api.authHeaders(token));
      if (response.statusCode == 200) {
        final userData = jsonDecode(response.body);
        final status = userData['status']?.toString() ?? 'offline';
        _userStatuses[userId] = status;
        print('👤 User $userId status: $status');
      }
    } catch (e) {
      print('❌ Error loading status for user $userId: $e');
    }
  }

  Future<void> _loadStatusFromChats() async {
    try {
      print('💬 Loading status from chat participants...');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) return;
      
      final chatsResponse = await Api.get('/chat/', headers: Api.authHeaders(token));
      if (chatsResponse.statusCode == 200) {
        final responseData = jsonDecode(chatsResponse.body);
        List<dynamic> chatsData = [];
        
        if (responseData is List) {
          chatsData = responseData;
        } else if (responseData is Map && responseData['chats'] != null) {
          chatsData = responseData['chats'];
        }
        
        // Extract unique user IDs from chats
        Set<String> userIds = {};
        for (final chat in chatsData) {
          String usersString = chat['users'] ?? '[]';
          try {
            usersString = usersString.replaceAll(r'\', '');
            List<dynamic> chatUserIds = jsonDecode(usersString);
            for (final userId in chatUserIds) {
              userIds.add(userId.toString());
            }
          } catch (e) {
            print('❌ Error parsing chat users: $e');
          }
        }
        
        print('👥 Found ${userIds.length} unique users in chats, loading their status...');
        
        // Load status for each user
        for (final userId in userIds) {
          await _loadUserStatus(userId);
        }
        
        // Notify listeners
        _statusController.add(Map.from(_userStatuses));
      }
    } catch (e) {
      print('❌ Error loading status from chats: $e');
    }
  }
}
