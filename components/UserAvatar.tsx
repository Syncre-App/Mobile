import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type Presence = 'online' | 'offline' | 'busy' | 'away' | null | undefined;

interface UserAvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
  presence?: Presence;
  presenceColor?: string;
}

const getPresenceColor = (presence: Presence, override?: string) => {
  if (override) return override;
  switch (presence) {
    case 'online':
      return '#4CAF50';
    case 'busy':
      return '#FF6B6B';
    case 'away':
      return '#FFC107';
    default:
      return '#757575';
  }
};

const getInitials = (name?: string | null) => {
  if (!name) {
    return 'U';
  }

  const trimmed = name.trim();
  if (!trimmed) return 'U';

  if (trimmed.startsWith('User ') && trimmed.length > 5) {
    return `U${trimmed.slice(-1)}`.toUpperCase();
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  uri,
  name,
  size = 56,
  style,
  presence,
  presenceColor,
}) => {
  const initials = useMemo(() => getInitials(name), [name]);
  const statusColor = getPresenceColor(presence, presenceColor);
  const showPresence = Boolean(presence);
  const dotSize = Math.max(8, Math.round(size * 0.28));

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.placeholder, { borderRadius: size / 2 }]}>
          <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.35) }]}>{initials}</Text>
        </View>
      )}

      {showPresence && (
        <View
          style={[
            styles.presenceDot,
            {
              backgroundColor: statusColor,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              right: Math.max(2, dotSize * 0.1),
              bottom: Math.max(2, dotSize * 0.1),
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  presenceDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#0B1630',
  },
});

