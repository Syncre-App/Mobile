import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/notification_service.dart';

class ChatListWidget extends StatefulWidget {
  final bool isLoading;
  final List<Map<String, dynamic>> chats;
  final VoidCallback onRefresh;
  
  const ChatListWidget({
    super.key, 
    required this.isLoading,
    required this.chats,
    required this.onRefresh,
  });

  @override
  State<ChatListWidget> createState() => _ChatListWidgetState();
}

class _ChatListWidgetState extends State<ChatListWidget> {
  @override
  Widget build(BuildContext context) {
    if (widget.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (widget.chats.isEmpty) {
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

    return RefreshIndicator(
      onRefresh: () async {
        widget.onRefresh();
      },
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: widget.chats.length,
        itemBuilder: (context, index) {
          final chat = widget.chats[index];
          return _buildChatItem(chat);
        },
      ),
    );
  }

  Widget _buildChatItem(Map<String, dynamic> chat) {
    // Parse users from string format "[\"5573173894499053\",1763791841522611]"
    String usersString = chat['users'] ?? '[]';
    List<dynamic> userIds = [];
    
    try {
      // Clean up the string and parse as JSON
      usersString = usersString.replaceAll(r'\', '');
      userIds = jsonDecode(usersString);
    } catch (e) {
      print('❌ Error parsing user IDs: $e');
    }
    
    // For now, just show "Chat" as name - we'd need to fetch user details to get proper names
    final chatName = 'Chat ${chat['id']}';
    final chatId = chat['id'];
    
    // Format the date
    String timeText = '';
    try {
      final updatedAt = DateTime.parse(chat['updated_at']);
      final now = DateTime.now();
      final difference = now.difference(updatedAt);
      
      if (difference.inDays > 0) {
        timeText = '${difference.inDays}d ago';
      } else if (difference.inHours > 0) {
        timeText = '${difference.inHours}h ago';
      } else if (difference.inMinutes > 0) {
        timeText = '${difference.inMinutes}m ago';
      } else {
        timeText = 'now';
      }
    } catch (e) {
      timeText = '';
    }
    
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
            child: const Icon(
              Icons.chat_bubble_outline,
              color: Colors.white,
            ),
          ),
          title: Text(
            chatName,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
          ),
          subtitle: Text(
            '${userIds.length} participants', 
            style: const TextStyle(color: Colors.white54),
          ),
          trailing: Text(
            timeText,
            style: const TextStyle(color: Colors.white38, fontSize: 12),
          ),
          onTap: () => _openChat(chatId, chatName),
          onLongPress: () => _showChatOptions(context, chat),
        ),
      ),
    );
  }

  void _openChat(int chatId, String chatName) {
    // TODO: Navigate to chat screen
    NotificationService.instance.show(
      NotificationType.info, 
      'Opening chat: $chatName (ID: $chatId)',
    );
  }

  void _showChatOptions(BuildContext context, Map<String, dynamic> chat) {
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
              
              Text(
                chat['name'] ?? 'Chat',
                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w600),
              ),
              
              const SizedBox(height: 20),
              
              ListTile(
                leading: const Icon(Icons.person_remove, color: Colors.red),
                title: const Text('Remove Friend', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(context);
                  _removeFriend(chat);
                },
              ),
              
              ListTile(
                leading: const Icon(Icons.block, color: Colors.red),
                title: const Text('Block User', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(context);
                  // TODO: Block user functionality
                  NotificationService.instance.show(NotificationType.info, 'Block user coming soon!');
                },
              ),
              
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _removeFriend(Map<String, dynamic> chat) async {
    // TODO: Extract friend ID from chat users array
    // For now, show placeholder
    NotificationService.instance.show(NotificationType.info, 'Remove friend coming soon!');
    
    // Implementation would be:
    // try {
    //   final prefs = await SharedPreferences.getInstance();
    //   final token = prefs.getString('auth_token');
    //   final response = await Api.post('/user/remove', {'friendId': friendId}, headers: Api.authHeaders(token));
    //   if (response.statusCode == 200) {
    //     widget.onRefresh();
    //     NotificationService.instance.show(NotificationType.success, 'Friend removed');
    //   }
    // } catch (e) {
    //   NotificationService.instance.show(NotificationType.error, 'Error removing friend');
    // }
  }
}
