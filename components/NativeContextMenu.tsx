import React from 'react';
import { Platform, View, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { canUseSwiftUI } from '../utils/swiftUi';

// SwiftUI imports for iOS
let Host: any = null;
let ContextMenu: any = null;
let Button: any = null;

// Try to import SwiftUI components (iOS only)
if (Platform.OS === 'ios') {
  try {
    const swiftUI = require('@expo/ui/swift-ui');
    Host = swiftUI.Host;
    ContextMenu = swiftUI.ContextMenu;
    Button = swiftUI.Button;
  } catch (e) {
    console.warn('SwiftUI components not available:', e);
  }
}

// Fallback for Android - use react-native-context-menu-view
let LegacyContextMenu: any = null;
try {
  LegacyContextMenu = require('react-native-context-menu-view').default;
} catch (e) {
  console.warn('react-native-context-menu-view not available:', e);
}

export interface ContextMenuAction {
  title: string;
  subtitle?: string;
  systemIcon?: string;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

interface NativeContextMenuProps {
  children: React.ReactNode;
  title?: string;
  actions: ContextMenuAction[];
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  activationMethod?: 'singlePress' | 'longPress';
  /** Preview component shown when context menu is active (iOS only) */
  preview?: React.ReactNode;
  /** Called when the menu is activated */
  onMenuWillShow?: () => void;
  /** Called when the menu is dismissed */
  onMenuWillHide?: () => void;
}

/**
 * Native Context Menu component
 * Uses SwiftUI ContextMenu for native Liquid Glass context menus on iOS 26+
 * Falls back to react-native-context-menu-view on Android
 */
export const NativeContextMenu: React.FC<NativeContextMenuProps> = ({
  children,
  title,
  actions,
  style,
  disabled = false,
  activationMethod = 'longPress',
  preview,
  onMenuWillShow,
  onMenuWillHide,
}) => {
  const shouldUseSwiftUI = canUseSwiftUI();
  if (disabled) {
    return <View style={style}>{children}</View>;
  }

  // ═══════════════════════════════════════════════════════════════
  // iOS: SwiftUI ContextMenu
  // ═══════════════════════════════════════════════════════════════
  if (shouldUseSwiftUI && Host && ContextMenu && Button) {
    const handleActionPress = (action: ContextMenuAction) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      action.onPress();
    };

    return (
      <View style={style}>
        <Host matchContents>
          <ContextMenu activationMethod={activationMethod}>
            <ContextMenu.Items>
              {actions.map((action, index) => (
                <Button
                  key={`${action.title}-${index}`}
                  systemImage={action.systemIcon || getSystemIcon(action.title)}
                  onPress={() => handleActionPress(action)}
                  disabled={action.disabled}
                  role={action.destructive ? 'destructive' : undefined}
                >
                  {action.title}
                </Button>
              ))}
            </ContextMenu.Items>
            <ContextMenu.Trigger>
              {children}
            </ContextMenu.Trigger>
          </ContextMenu>
        </Host>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Android: Legacy react-native-context-menu-view
  // ═══════════════════════════════════════════════════════════════
  if (LegacyContextMenu) {
    const contextMenuActions = actions.map((action) => ({
      title: action.title,
      subtitle: action.subtitle,
      systemIcon: action.systemIcon || getSystemIcon(action.title),
      destructive: action.destructive,
      disabled: action.disabled,
    }));
    const dropdownMenuMode = activationMethod === 'singlePress';

    const handlePress = (event: { nativeEvent: { index: number; name: string } }) => {
      const actionIndex = event.nativeEvent.index;
      if (actionIndex >= 0 && actionIndex < actions.length) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        actions[actionIndex].onPress();
      }
    };

    return (
      <LegacyContextMenu
        title={title}
        actions={contextMenuActions}
        onPress={handlePress}
        previewBackgroundColor="transparent"
        dropdownMenuMode={dropdownMenuMode}
        style={style}
      >
        {children}
      </LegacyContextMenu>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Fallback: Just render children without context menu
  // ═══════════════════════════════════════════════════════════════
  return <View style={style}>{children}</View>;
};

/**
 * Map action labels to iOS SF Symbols
 */
function getSystemIcon(label: string): string {
  const iconMap: Record<string, string> = {
    // Common actions
    'Reply': 'arrowshape.turn.up.left',
    'Copy': 'doc.on.doc',
    'Copy link': 'link',
    'Edit': 'pencil',
    'Delete': 'trash',
    'Cancel': 'xmark',
    'Share': 'square.and.arrow.up',
    'Report': 'flag',
    'Save': 'square.and.arrow.down',
    'Forward': 'arrowshape.turn.up.right',
    'Pin': 'pin',
    'Unpin': 'pin.slash',
    'Mute': 'bell.slash',
    'Unmute': 'bell',
    'Block': 'hand.raised',
    'Unblock': 'hand.raised.slash',
    'Remove friend': 'person.badge.minus',
    'Add friend': 'person.badge.plus',
    
    // File actions
    'Download': 'arrow.down.circle',
    'Open': 'arrow.up.right.square',
    'Preview': 'eye',
    
    // Message specific
    'React': 'face.smiling',
    'Translate': 'globe',
    'Select': 'checkmark.circle',
  };

  return iconMap[label] || 'ellipsis.circle';
}

export default NativeContextMenu;
