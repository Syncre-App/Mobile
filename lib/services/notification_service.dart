import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';

enum NotificationType { success, error, info, warning }

class NotificationEntry {
  final String id;
  final NotificationType type;
  final String message;
  final Duration duration;

  NotificationEntry({
    required this.id,
    required this.type,
    required this.message,
    required this.duration,
  });
}

class NotificationService {
  NotificationService._internal();
  static final NotificationService instance = NotificationService._internal();

  final StreamController<NotificationEntry> _controller = StreamController.broadcast();

  Stream<NotificationEntry> get stream => _controller.stream;

  String show(NotificationType type, String message, {Duration duration = const Duration(milliseconds: 4500)}) {
    final id = _makeId();
    final entry = NotificationEntry(id: id, type: type, message: message, duration: duration);
    _controller.add(entry);
    return id;
  }

  void remove(String id) {
    // send a special entry with empty message? Instead listeners can manage removal by id
    // We'll send an entry with zero-duration and empty message as a removal marker is unnecessary;
    // The provider manages removal internally.
  }

  String _makeId() {
    final r = Random();
  return "${DateTime.now().millisecondsSinceEpoch}_${r.nextInt(1 << 32)}";
  }

  void dispose() {
    _controller.close();
  }
}

/// Widget to place near the top of your widget tree (wrap your app). It listens
/// to [NotificationService.instance] and shows centered toasts.
class NotificationProvider extends StatefulWidget {
  final Widget child;

  const NotificationProvider({super.key, required this.child});

  @override
  State<NotificationProvider> createState() => _NotificationProviderState();
}

class _NotificationProviderState extends State<NotificationProvider> {
  final List<NotificationEntry> _items = [];
  final Map<String, Timer> _timers = {};
  final Map<String, GlobalKey<_ToastCardState>> _cardKeys = {};
  late final StreamSubscription<NotificationEntry> _sub;

  @override
  void initState() {
    super.initState();
    _sub = NotificationService.instance.stream.listen((entry) {
      _cardKeys[entry.id] = GlobalKey<_ToastCardState>();
      setState(() => _items.add(entry));
      if (entry.duration.inMilliseconds > 0) {
        _timers[entry.id] = Timer(entry.duration, () => _animateOutAndRemove(entry.id));
      }
    });
  }

  @override
  void dispose() {
    _sub.cancel();
    for (final t in _timers.values) {
      t.cancel();
    }
    super.dispose();
  }

  void _animateOutAndRemove(String id) {
    final key = _cardKeys[id];
    if (key?.currentState != null) {
      // Trigger animation, then remove
      key!.currentState!.animateOut().then((_) => _remove(id));
    } else {
      _remove(id);
    }
  }

  void _remove(String id) {
    if (!mounted) return;
    setState(() {
      _items.removeWhere((e) => e.id == id);
    });
    _timers.remove(id)?.cancel();
    _cardKeys.remove(id);
  }

  Color _bgColor(NotificationType t) {
    switch (t) {
      case NotificationType.success:
        return const Color.fromRGBO(16, 185, 129, 0.18); // green-500 ~ #10B981
      case NotificationType.error:
        return const Color.fromRGBO(239, 68, 68, 0.18); // red-500 ~ #EF4444
      case NotificationType.warning:
        return const Color.fromRGBO(250, 204, 21, 0.16); // yellow-400 ~ #FACC15
      case NotificationType.info:
        return const Color.fromRGBO(162, 75, 250, 0.16); // #A24BFA
    }
  }

  Color _borderColor(NotificationType t) {
    switch (t) {
      case NotificationType.success:
        return Colors.greenAccent;
      case NotificationType.error:
        return Colors.redAccent;
      case NotificationType.warning:
        return Colors.amberAccent;
      case NotificationType.info:
        return const Color(0xFFA78BFA);
    }
  }

  Icon _iconFor(NotificationType t) {
    switch (t) {
      case NotificationType.success:
        return const Icon(Icons.check_circle, color: Colors.greenAccent);
      case NotificationType.error:
        return const Icon(Icons.close, color: Colors.redAccent);
      case NotificationType.warning:
        return const Icon(Icons.info, color: Colors.amberAccent);
      case NotificationType.info:
        return const Icon(Icons.info_outline, color: Color(0xFFA78BFA));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        widget.child,
        // overlay layer: place toasts near the top, under status bar / dynamic island
        Positioned.fill(
          child: IgnorePointer(
            ignoring: _items.isEmpty,
            child: LayoutBuilder(builder: (context, _) {
              final topPad = MediaQuery.of(context).padding.top + 12.0; // under dynamic island / status bar
              return Stack(children: [
                Positioned(
                  top: topPad,
                  left: 0,
                  right: 0,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: _items.map((entry) {
                      return Padding(
                        key: ValueKey(entry.id),
                        padding: const EdgeInsets.symmetric(vertical: 6.0, horizontal: 24.0),
                        child: _ToastCard(
                          key: _cardKeys[entry.id],
                          entry: entry,
                          bgColor: _bgColor(entry.type),
                          borderColor: _borderColor(entry.type),
                          icon: _iconFor(entry.type),
                          onClose: () => _animateOutAndRemove(entry.id),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ]);
            }),
          ),
        ),
      ],
    );
  }
}

class _ToastCard extends StatefulWidget {
  final NotificationEntry entry;
  final Color bgColor;
  final Color borderColor;
  final Icon icon;
  final VoidCallback onClose;

  const _ToastCard({
    super.key,
    required this.entry,
    required this.bgColor,
    required this.borderColor,
    required this.icon,
    required this.onClose,
  });

  @override
  State<_ToastCard> createState() => _ToastCardState();
}

class _ToastCardState extends State<_ToastCard> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<Offset> _offset;
  late final Animation<double> _opacity;
  late final Animation<double> _scale;
  bool _isClosing = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 350));
    _offset = Tween(begin: const Offset(0, -0.15), end: Offset.zero)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack));
    _opacity = Tween(begin: 0.0, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _scale = Tween(begin: 0.98, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut));
    _ctrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _animateOut() async {
    if (_isClosing) return;
    setState(() => _isClosing = true);
    
    // Reverse the animation for smooth exit
    await _ctrl.reverse();
    
    // Call the actual close callback after animation completes
    if (mounted) {
      widget.onClose();
    }
  }

  Future<void> animateOut() async {
    if (_isClosing) return;
    setState(() => _isClosing = true);
    
    // Reverse the animation for smooth exit
    await _ctrl.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _offset,
      child: FadeTransition(
        opacity: _opacity,
        child: ScaleTransition(
          scale: _scale,
          child: Material(
            color: Colors.transparent,
            child: Container(
              constraints: const BoxConstraints(minWidth: 200, maxWidth: 520),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: widget.bgColor,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: widget.borderColor.withAlpha(204)),
                boxShadow: [BoxShadow(color: Colors.black.withAlpha(46), blurRadius: 16, offset: const Offset(0, 4))],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  widget.icon,
                  const SizedBox(width: 12),
                  Flexible(child: Text(widget.entry.message, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600))),
                  const SizedBox(width: 12),
                  GestureDetector(
                    onTap: _animateOut,
                    child: const Icon(Icons.close, size: 20, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
