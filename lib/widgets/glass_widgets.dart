import 'dart:ui';

import 'package:flutter/material.dart';

class GlassCard extends StatelessWidget {
  final double width;
  final Widget child;

  const GlassCard({super.key, required this.width, required this.child});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          width: width,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(colors: [Color.fromARGB((0.04 * 255).round(), 255, 255, 255), Color.fromARGB((0.02 * 255).round(), 255, 255, 255)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            border: Border.all(color: Color.fromARGB((0.06 * 255).round(), 255, 255, 255)),
            boxShadow: [BoxShadow(color: Color.fromARGB((0.4 * 255).round(), 0, 0, 0), blurRadius: 20, offset: const Offset(0, 8))],
          ),
          child: child,
        ),
      ),
    );
  }
}

class TransparentField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final Widget? prefix;
  final Widget? suffix;
  final bool obscure;

  const TransparentField({required this.controller, required this.hint, this.prefix, this.suffix, this.obscure = false, super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
  color: Color.fromARGB((0.02 * 255).round(), 255, 255, 255),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: TextField(
        controller: controller,
        obscureText: obscure,
        style: const TextStyle(color: Colors.white),
        cursorColor: const Color(0xFF2C82FF),
        decoration: InputDecoration(
          prefixIcon: prefix == null ? null : Padding(padding: const EdgeInsets.only(right: 8), child: prefix),
          suffixIcon: suffix,
          hintText: hint,
          hintStyle: const TextStyle(color: Colors.white54),
          border: InputBorder.none,
          focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: const Color(0xFF2C82FF).withAlpha((0.9 * 255).round()))),
        ),
      ),
    );
  }
}
