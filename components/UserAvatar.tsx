import React, { useMemo } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type Presence = 'online' | 'offline' | 'busy' | 'away' | null | undefined;
type PresencePlacement = 'overlay' | 'left';

interface UserAvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle;
  presence?: Presence;
  presenceColor?: string;
  presencePlacement?: PresencePlacement;
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
  presencePlacement = 'overlay',
}) => {
  const initials = useMemo(() => getInitials(name), [name]);
  const statusColor = getPresenceColor(presence, presenceColor);
  const showPresence = Boolean(presence);
  const dotSize = Math.max(8, Math.round(size * 0.28));
  const offset = Math.max(2, Math.round(size * 0.12));

  return (
    <View style={[styles.wrapper, style]}>
      {showPresence && presencePlacement === 'left' ? (
        <View
          style={[
            styles.leadingPresence,
            {
              backgroundColor: statusColor,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              marginRight: Math.max(4, Math.round(size * 0.12)),
            },
          ]}
        />
      ) : null}

      <View style={[styles.avatarFrame, { width: size, height: size }]}>
        <View style={[styles.imageWrap, { borderRadius: size / 2 }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
            <View style={[styles.placeholder, { borderRadius: size / 2 }]}>
              <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.35) }]}>{initials}</Text>
            </View>
          )}
        </View>

        {showPresence && presencePlacement === 'overlay' ? (
          <View
            style={[
              styles.overlayPresence,
              {
                backgroundColor: statusColor,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                right: -offset / 2,
                bottom: -offset / 2,
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
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
  overlayPresence: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#0B1630',
    zIndex: 2,
  },
  leadingPresence: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0B1630',
  },
});
