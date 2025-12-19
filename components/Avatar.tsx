import React, { useMemo } from 'react';
import { Image, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { font, useTheme } from '../theme/designSystem';

type Presence = 'online' | 'offline' | 'away' | 'idle' | null | undefined;

type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  presence?: Presence;
};

const getInitials = (name?: string | null) => {
  if (!name) return 'U';
  const trimmed = name.trim();
  if (!trimmed) return 'U';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const getPresenceColor = (presence: Presence) => {
  switch (presence) {
    case 'online':
      return '#34C759';
    case 'away':
    case 'idle':
      return '#FF9F0A';
    default:
      return '#8E8E93';
  }
};

export const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 48, style, presence }) => {
  const { theme } = useTheme();
  const initials = useMemo(() => getInitials(name), [name]);
  const ring = Math.max(2, Math.round(size * 0.08));
  const innerSize = size - ring * 2;
  const presenceSize = Math.max(8, Math.round(size * 0.25));

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={theme.gradients.glassStroke}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.ring, { width: size, height: size, borderRadius: size / 2, padding: ring }]}
      >
        <View
          style={[
            styles.inner,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
              backgroundColor: theme.palette.surfaceSoft,
            },
          ]}
        >
          {uri ? (
            <Image source={{ uri }} style={styles.image} />
          ) : (
            <Text style={[styles.initials, { color: theme.palette.text, fontSize: innerSize * 0.38 }]}>
              {initials}
            </Text>
          )}
        </View>
      </LinearGradient>
      {presence ? (
        <View
          style={[
            styles.presence,
            {
              width: presenceSize,
              height: presenceSize,
              borderRadius: presenceSize / 2,
              backgroundColor: getPresenceColor(presence),
              borderColor: theme.palette.background,
            },
          ]}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    ...font('display'),
  },
  presence: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderWidth: 2,
  },
});

export default Avatar;
