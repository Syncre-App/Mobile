import 'dart:convert';
import 'package:http/http.dart' as http;
import 'dart:io';

class Api {
  // Default base - can be overridden at runtime.
  // On Android emulators, use 10.0.2.2 to reach the host machine. On iOS simulators
  // and real devices that can reach the host via localhost/proxy, use localhost.
  static String _overrideBaseUrl = '';

  static String get baseUrl {
    if (_overrideBaseUrl.isNotEmpty) return _overrideBaseUrl;
    if (Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  /// Call this at runtime to force a specific base URL (useful for physical devices)
  static void setBaseUrl(String url) => _overrideBaseUrl = url;

  static Future<http.Response> post(String path, Map<String, dynamic> body, {Map<String, String>? headers}) async {
    final uri = Uri.parse('$baseUrl$path');
    final h = {'Content-Type': 'application/json', if (headers != null) ...headers};
    try {
      final res = await http.post(uri, headers: h, body: jsonEncode(body)).timeout(const Duration(seconds: 8));
      return res;
    } catch (e) {
      if (e is SocketException) {
        throw Exception('Connection refused (is backend running at $baseUrl)?');
      }
      throw Exception('Network error: $e');
    }
  }

  static Future<http.Response> get(String path, {Map<String, String>? headers}) async {
    final uri = Uri.parse('$baseUrl$path');
    final h = {'Content-Type': 'application/json', if (headers != null) ...headers};
    try {
      final res = await http.get(uri, headers: h).timeout(const Duration(seconds: 8));
      return res;
    } catch (e) {
      if (e is SocketException) {
        throw Exception('Connection refused (is backend running at $baseUrl)?');
      }
      throw Exception('Network error: $e');
    }
  }

  static Map<String, String> authHeaders(String token) => {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
}
