import 'dart:convert';
import 'package:http/http.dart' as http;
import 'dart:io';

class Api {
  static const String baseUrl = 'http://localhost:3000/';

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
