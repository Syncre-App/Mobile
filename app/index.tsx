import { router } from 'expo-router';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppBackground } from '../components/AppBackground';
import { useTheme } from '../theme/designSystem';
import { ApiService } from '../services/ApiService';
import { StorageService } from '../services/StorageService';
import { UpdateService } from '../services/UpdateService';
import { IdentityService } from '../services/IdentityService';
import { CryptoService } from '../services/CryptoService';

const isMaintenanceEnabled = (): boolean => {
  const raw = Constants.expoConfig?.extra?.maintenance;
  return raw === true || raw === 'true';
};

export default function Index() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      if (isMaintenanceEnabled()) {
        router.replace('/maintenance');
        return;
      }

      const apiStatus = await ApiService.get('/health');
      if (!apiStatus.success) {
        router.replace('/maintenance');
        return;
      }

      const updateStatus = await UpdateService.checkForMandatoryUpdate();
      if (updateStatus.requiresUpdate) {
        router.replace('/update');
        return;
      }

      const token = await StorageService.getAuthToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      const me = await ApiService.get('/user/me', token);
      if (!me.success || !me.data) {
        await StorageService.removeAuthToken();
        await StorageService.removeItem('user_data');
        router.replace('/login');
        return;
      }

      await StorageService.setObject('user_data', me.data);
      if (me.data?.requires_terms_acceptance || !me.data?.terms_accepted_at) {
        router.replace('/terms');
        return;
      }

      const [needsSetup, localIdentity] = await Promise.all([
        IdentityService.requiresBootstrap(token),
        CryptoService.getStoredIdentity(),
      ]);

      if (needsSetup) {
        router.replace('/identity?mode=setup');
        return;
      }

      if (!localIdentity) {
        router.replace('/identity?mode=unlock');
        return;
      }

      router.replace('/home');
    };

    bootstrap().catch(() => {
      if (mounted) {
        setStatus('error');
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <AppBackground />
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.palette.accent} />
        {status === 'error' ? <Text style={styles.error}>Unable to start the app.</Text> : null}
      </View>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.palette.background,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    error: {
      color: theme.palette.textMuted,
      fontSize: 14,
    },
  });
