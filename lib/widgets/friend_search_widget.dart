import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api.dart';
import '../services/notification_service.dart';

class FriendSearchWidget extends StatefulWidget {
  final VoidCallback onFriendAdded;
  
  const FriendSearchWidget({super.key, required this.onFriendAdded});

  @override
  State<FriendSearchWidget> createState() => _FriendSearchWidgetState();
}

class _FriendSearchWidgetState extends State<FriendSearchWidget> {
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  bool _isSearching = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Search for users/friends
  Future<void> _searchUsers(String query) async {
    if (query.trim().isEmpty) {
      if (mounted) {
        setState(() {
          _searchResults = [];
          _isSearching = false;
        });
      }
      return;
    }
    
    if (mounted) {
      setState(() => _isSearching = true);
    }
    
    try {
      print('🔍 Searching users with query: $query');
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      
      if (token == null) {
        print('❌ No auth token for search');
        if (mounted) {
          setState(() => _isSearching = false);
        }
        return;
      }
      
      final response = await Api.get('/user/search?q=${Uri.encodeComponent(query)}', headers: Api.authHeaders(token));
      print('🔍 Search response status: ${response.statusCode}');
      print('🔍 Search response body: ${response.body}');
      
      if (!mounted) return;
      
      if (response.statusCode == 200) {
        final List<dynamic> searchData = jsonDecode(response.body);
        setState(() {
          _searchResults = searchData.cast<Map<String, dynamic>>();
          _isSearching = false;
        });
        print('🔍 Found ${_searchResults.length} users');
      } else {
        print('❌ Search failed');
        setState(() => _isSearching = false);
        NotificationService.instance.show(NotificationType.error, 'Search failed');
      }
    } catch (e) {
      print('❌ Exception during search: $e');
      if (!mounted) return;
      setState(() => _isSearching = false);
      
      // Show user-friendly error message
      String errorMessage = 'Search failed';
      if (e.toString().contains('timeout')) {
        errorMessage = 'Search timeout - please try again';
      } else if (e.toString().contains('Connection refused')) {
        errorMessage = 'Server unavailable - please try again later';
      }
      
      NotificationService.instance.show(NotificationType.error, errorMessage);
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
      
      if (!mounted) return;
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        NotificationService.instance.show(NotificationType.success, 'Friend added successfully!');
        widget.onFriendAdded(); // Notify parent to reload chats
        // Clear search after adding
        _searchController.clear();
        setState(() {
          _searchResults = [];
        });
      } else {
        print('❌ Failed to add friend');
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
      
      // Show user-friendly error message
      String errorMessage = 'Failed to add friend';
      if (e.toString().contains('timeout')) {
        errorMessage = 'Connection timeout - please try again';
      } else if (e.toString().contains('Connection refused')) {
        errorMessage = 'Server unavailable - please try again later';
      }
      
      NotificationService.instance.show(NotificationType.error, errorMessage);
    }
  }

  void _handleSearchMenuAction(String action) {
    switch (action) {
      case 'clear':
        _searchController.clear();
        setState(() {
          _searchResults = [];
          _isSearching = false;
        });
        break;
      case 'refresh':
        if (_searchController.text.isNotEmpty) {
          _searchUsers(_searchController.text);
        }
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Search bar with dropdown
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white.withOpacity(0.2)),
            ),
            child: Row(
              children: [
                Expanded(
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
                // Dropdown menu for search options
                PopupMenuButton<String>(
                  icon: const Icon(Icons.more_vert, color: Colors.white54),
                  color: const Color(0xFF1A1B2E),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(color: Colors.white.withOpacity(0.2)),
                  ),
                  onSelected: (value) => _handleSearchMenuAction(value),
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'clear',
                      child: Row(
                        children: [
                          Icon(Icons.clear, color: Colors.white70, size: 20),
                          SizedBox(width: 12),
                          Text('Clear Search', style: TextStyle(color: Colors.white70)),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'refresh',
                      child: Row(
                        children: [
                          Icon(Icons.refresh, color: Colors.white70, size: 20),
                          SizedBox(width: 12),
                          Text('Refresh', style: TextStyle(color: Colors.white70)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        
        const SizedBox(height: 16),
        
        // Search results
        if (_searchController.text.isNotEmpty) 
          Container(
            height: 300, // Fixed height instead of Expanded
            child: _buildSearchResults(),
          ),
      ],
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
                onPressed: () => _addFriend(int.parse(userResult['id'].toString())),
              ),
            ),
          ),
        );
      },
    );
  }
}
