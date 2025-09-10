import 'dart:convert';
import 'dart:async';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:shared_preferences/shared_preferences.dart';

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

      _isConnected = true;
      print('🌐 WebSocket connected, authenticating...');

      // Authenticate within 5 seconds
      _authenticate();

      // Start ping timer (every 30 seconds)
      _startPingTimer();

    } catch (e) {
      print('❌ WebSocket connection error: $e');
      _handleDisconnect();
    }
  }

  void _authenticate() {
    if (_currentToken != null && _isConnected) {
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
          print('✅ WebSocket authentication successful');
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
      if (_isConnected) {
        _sendPing();
      } else {
        timer.cancel();
      }
    });
  }

  void _sendPing() {
    if (_isConnected) {
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

  void dispose() {
    disconnect();
    _statusController.close();
  }
}
