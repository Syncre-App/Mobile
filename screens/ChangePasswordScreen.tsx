import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotificationService } from '../services/NotificationService';
import { StorageService } from '../services/StorageService';
import { ApiService } from '../services/ApiService';
import { CryptoService } from '../services/CryptoService';
import { AppBackground } from '../components/AppBackground';
import { TransparentField } from '../components/TransparentField';
import { font, palette, radii, spacing } from '../theme/designSystem';

const HEADER_BUTTON_DIMENSION = spacing.sm * 2 + 24;

export const ChangePasswordScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const minTopPadding = spacing.lg;
  const extraTopPadding = Math.max(minTopPadding - insets.top, 0);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBack = () => {
    router.back();
  };

  const validatePasswords = (): string | null => {
    if (!currentPassword.trim()) {
      return 'Current password is required';
    }
    if (!newPassword.trim()) {
      return 'New password is required';
    }
    if (newPassword.length < 8) {
      return 'New password must be at least 8 characters';
    }
    if (newPassword !== confirmPassword) {
      return 'New passwords do not match';
    }
    if (currentPassword === newPassword) {
      return 'New password must be different from current password';
    }
    return null;
  };

  const handleChangePassword = async () => {
    const validationError = validatePasswords();
    if (validationError) {
      NotificationService.show('error', validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        NotificationService.show('error', 'Please log in again');
        router.replace('/');
        return;
      }

      // Re-encrypt identity key with new password
      const newIdentityKey = await CryptoService.reencryptIdentityForPasswordChange({
        oldPassword: currentPassword,
        newPassword: newPassword,
        token: token,
      });

      // Send to backend
      const response = await ApiService.post(
        '/auth/change-password',
        {
          currentPassword: currentPassword,
          newPassword: newPassword,
          newIdentityKey: newIdentityKey,
        },
        token
      );

      if (response.success) {
        NotificationService.show('success', 'Password changed successfully');
        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        router.back();
      } else {
        NotificationService.show('error', response.error || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Failed to change password:', error);
      const message = error?.message || 'Failed to change password';
      
      if (/decrypt/i.test(message) || /wrong password/i.test(message)) {
        NotificationService.show('error', 'Current password is incorrect');
      } else {
        NotificationService.show('error', message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { paddingTop: extraTopPadding }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppBackground />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCentered} pointerEvents="none">
          <Text style={styles.headerTitle}>Change Password</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formCard}>
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={palette.accent} />
              <Text style={styles.infoText}>
                Changing your password will also re-encrypt your secure messaging keys. Make sure to remember your new password.
              </Text>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <TransparentField
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
                prefixIcon={<Ionicons name="lock-closed" size={18} color={palette.textSubtle} />}
                suffixIcon={
                  <Ionicons
                    name={showCurrentPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color={palette.textSubtle}
                  />
                }
                onSuffixPress={() => setShowCurrentPassword(!showCurrentPassword)}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <TransparentField
                placeholder="Enter new password (min 8 characters)"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
                prefixIcon={<Ionicons name="key" size={18} color={palette.textSubtle} />}
                suffixIcon={
                  <Ionicons
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color={palette.textSubtle}
                  />
                }
                onSuffixPress={() => setShowNewPassword(!showNewPassword)}
                editable={!isSubmitting}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <TransparentField
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                prefixIcon={<Ionicons name="key" size={18} color={palette.textSubtle} />}
                suffixIcon={
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color={palette.textSubtle}
                  />
                }
                onSuffixPress={() => setShowConfirmPassword(!showConfirmPassword)}
                editable={!isSubmitting}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleChangePassword}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    position: 'relative',
  },
  headerButton: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
    padding: spacing.sm,
    borderRadius: radii.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: {
    width: HEADER_BUTTON_DIMENSION,
    height: HEADER_BUTTON_DIMENSION,
  },
  headerTitle: {
    color: palette.text,
    fontSize: 20,
    ...font('display'),
  },
  headerCentered: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'stretch',
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.lg,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(44, 130, 255, 0.1)',
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldContainer: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: palette.text,
    fontSize: 14,
    ...font('semibold'),
  },
  submitButton: {
    backgroundColor: palette.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    ...font('semibold'),
  },
});
