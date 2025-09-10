import 'dart:convert';
import 'package:http/http.dart' as http;
import 'dart:io';
import 'dart:async';
import 'package:flutter/foundation.dart';

class Api {
  static String _overrideBaseUrl = 'https://api.syncre.xyz/v1';

  static String get baseUrl {
    if (_overrideBaseUrl.isNotEmpty) return _overrideBaseUrl;
    return 'https://api.syncre.xyz/v1';
  }

  static void setBaseUrl(String url) => _overrideBaseUrl = url;

  static Future<http.Response> post(String path, Map<String, dynamic> body, {Map<String, String>? headers}) async {
    final normalizedBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$normalizedBase$normalizedPath');
    if (kDebugMode) {
      print('🚀 Api.post -> URL: $uri');
      print('📤 Request body: ${jsonEncode(body)}');
      print('📋 Headers: ${{'Content-Type': 'application/json', if (headers != null) ...headers}}');
    }
    final h = {'Content-Type': 'application/json', if (headers != null) ...headers};
    try {
      final res = await http.post(uri, headers: h, body: jsonEncode(body)).timeout(const Duration(seconds: 8));
      if (kDebugMode) {
        print('📥 Response status: ${res.statusCode}');
        print('📥 Response body: ${res.body}');
        print('📥 Response headers: ${res.headers}');
      }
      return res;
    } on TimeoutException {
      if (kDebugMode) {
        print('⏰ Network timeout after 8 seconds');
      }
      throw Exception('Network timeout - please check your internet connection');
    } on SocketException {
      if (kDebugMode) {
        print('🔌 Connection refused - backend not reachable');
      }
      throw Exception('Connection refused (is backend running at $baseUrl)?');
    } catch (e) {
      if (kDebugMode) {
        print('❌ Unexpected API error: $e');
      }
      throw Exception('Network error: $e');
    }
  }

  static Future<http.Response> get(String path, {Map<String, String>? headers}) async {
    final normalizedBase = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    final uri = Uri.parse('$normalizedBase$normalizedPath');
    if (kDebugMode) {
      print('🚀 Api.get -> URL: $uri');
      print('📋 Headers: ${{'Content-Type': 'application/json', if (headers != null) ...headers}}');
    }
    final h = {'Content-Type': 'application/json', if (headers != null) ...headers};
    try {
      final res = await http.get(uri, headers: h).timeout(const Duration(seconds: 8));
      if (kDebugMode) {
        print('📥 Response status: ${res.statusCode}');
        print('📥 Response body: ${res.body}');
        print('📥 Response headers: ${res.headers}');
      }
      return res;
    } on TimeoutException {
      if (kDebugMode) {
        print('⏰ Network timeout after 8 seconds');
      }
      throw Exception('Network timeout - please check your internet connection');
    } on SocketException {
      if (kDebugMode) {
        print('🔌 Connection refused - backend not reachable');
      }
      throw Exception('Connection refused (is backend running at $baseUrl)?');
    } catch (e) {
      if (kDebugMode) {
        print('❌ Unexpected API error: $e');
      }
      throw Exception('Network error: $e');
    }
  }

  static Map<String, String> authHeaders(String token) => {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
}
