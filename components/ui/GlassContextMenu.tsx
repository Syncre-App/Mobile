import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Layout } from '../../constants/layout';

interface ContextMenuItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface GlassContextMenuProps {
  visible: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  anchorPosition?: { x: number; y: number };
}

export function GlassContextMenu({
  visible,
  onClose,
  items,
  anchorPosition,
}: GlassContextMenuProps) {
  const { colors, isDark } = useTheme();
  const useGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  if (!visible) return null;

  const menuContent = (
    <View style={styles.menuContainer}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              item.onPress();
              onClose();
            }}
          >
            <Text
              style={[
                styles.menuItemText,
                { color: item.destructive ? colors.error : colors.text },
              ]}
            >
              {item.label}
            </Text>
            <Ionicons
              name={item.icon}
              size={20}
              color={item.destructive ? colors.error : colors.textSecondary}
            />
          </TouchableOpacity>
          {index < items.length - 1 && (
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <View
            style={[
              styles.menuWrapper,
              anchorPosition && {
                position: 'absolute',
                top: anchorPosition.y,
                left: Math.max(Layout.spacing.md, Math.min(anchorPosition.x - 100, Layout.window.width - 220)),
              },
            ]}
          >
            {useGlass ? (
              <GlassView style={styles.glassEffect} glassEffectStyle="regular">
                {menuContent}
              </GlassView>
            ) : Platform.OS === 'ios' ? (
              <BlurView
                style={styles.blurEffect}
                tint={isDark ? 'dark' : 'light'}
                intensity={80}
              >
                {menuContent}
              </BlurView>
            ) : (
              <View style={[styles.androidContainer, { backgroundColor: colors.surface }]}>
                {menuContent}
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuWrapper: {
    width: 200,
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  glassEffect: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  blurEffect: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  androidContainer: {
    borderRadius: Layout.radius.lg,
    overflow: 'hidden',
  },
  menuContainer: {
    paddingVertical: Layout.spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.md,
  },
  menuItemText: {
    fontSize: Layout.fontSize.md,
    fontWeight: Layout.fontWeight.medium,
  },
  divider: {
    height: 0.5,
    marginHorizontal: Layout.spacing.md,
  },
});
