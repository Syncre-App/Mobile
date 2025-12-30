import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/layout';

export interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showOnlineStatus?: boolean;
  isOnline?: boolean;
  style?: ViewStyle;
}

export function Avatar({
  source,
  name = '',
  size = 'md',
  showOnlineStatus = false,
  isOnline = false,
  style,
}: AvatarProps) {
  const { colors } = useTheme();

  const getSize = () => {
    switch (size) {
      case 'xs':
        return Layout.heights.avatar.xs;
      case 'sm':
        return Layout.heights.avatar.sm;
      case 'md':
        return Layout.heights.avatar.md;
      case 'lg':
        return Layout.heights.avatar.lg;
      case 'xl':
        return Layout.heights.avatar.xl;
      default:
        return Layout.heights.avatar.md;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'xs':
        return 10;
      case 'sm':
        return 12;
      case 'md':
        return 16;
      case 'lg':
        return 22;
      case 'xl':
        return 32;
      default:
        return 16;
    }
  };

  const getStatusSize = () => {
    switch (size) {
      case 'xs':
        return 6;
      case 'sm':
        return 8;
      case 'md':
        return 10;
      case 'lg':
        return 14;
      case 'xl':
        return 18;
      default:
        return 10;
    }
  };

  const avatarSize = getSize();
  const fontSize = getFontSize();
  const statusSize = getStatusSize();

  const getInitials = () => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getBackgroundColor = () => {
    // Generate a consistent color based on the name
    if (!name) return colors.surface;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 50%, 60%)`;
  };

  return (
    <View style={[styles.container, { width: avatarSize, height: avatarSize }, style]}>
      {source ? (
        <Image
          source={{ uri: source }}
          style={[
            styles.image,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
            },
          ]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: getBackgroundColor(),
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize, color: '#FFFFFF' }]}>
            {getInitials()}
          </Text>
        </View>
      )}
      {showOnlineStatus && (
        <View
          style={[
            styles.statusIndicator,
            {
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              backgroundColor: isOnline ? colors.online : colors.offline,
              borderColor: colors.background,
              borderWidth: 2,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#E0E0E0',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});
