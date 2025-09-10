import 'dart:convert';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'package:flutter/foundation.dart';

class Api {
  static String _overrideBaseUrl = 'https://api.syncre.xyz';

  static String get baseUrl {
    if (_overrideBaseUrl.isNotEmpty) return _overrideBaseUrl;
    return 'https://api.syncre.xyz';
  }

  static void setBaseUrl(String url) => _overrideBaseUrl = url;

  static Future<http.Response> post(String path, Map<String, dynamic> body, {Map<String, String>? headers}) async {
    final normalizedBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$normalizedBase$normalizedPath');
    if (kDebugMode) {
      print('Api.post -> base: $baseUrl, path: $path -> uri: $uri');
    }
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
    final normalizedBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$normalizedBase$normalizedPath');
    if (kDebugMode) {
      print('Api.get  -> base: $baseUrl, path: $path -> uri: $uri');
    }
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
