import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface CallButtonProps {
  onPress: () => void;
  isVideo?: boolean;
  disabled?: boolean;
  size?: number;
}

export const CallButton: React.FC<CallButtonProps> = ({
  onPress,
  isVideo = false,
  disabled = false,
  size = 44,
}) => {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons
        name={isVideo ? 'videocam' : 'call'}
        size={size * 0.5}
        color="#FFFFFF"
      />
    </Pressable>
  );
};

interface CallActionButtonsProps {
  onCall: () => void;
  onVideoCall: () => void;
  disabled?: boolean;
}

export const CallActionButtons: React.FC<CallActionButtonsProps> = ({
  onCall,
  onVideoCall,
  disabled = false,
}) => {
  return (
    <View style={styles.actionButtons}>
      <CallButton onPress={onCall} isVideo={false} disabled={disabled} />
      <CallButton onPress={onVideoCall} isVideo={true} disabled={disabled} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E84FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  disabled: {
    backgroundColor: 'rgba(30, 132, 255, 0.4)',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default CallButton;
