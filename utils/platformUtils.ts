import { Platform } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

/**
 * Platform detection utilities for adaptive UI
 * - iOS 26+: Native Liquid Glass (expo-glass-effect)
 * - iOS < 26: NativeBlur fallback
 * - Android: Material Design 3
 */

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

/**
 * Get the iOS version number
 * Returns 0 for non-iOS platforms
 */
export const iOSVersion = isIOS 
  ? parseInt(String(Platform.Version), 10) 
  : 0;

/**
 * Check if the device supports iOS 26+ Liquid Glass effect
 * Uses expo-glass-effect's native check which validates:
 * - System version
 * - Compiler version
 * - Info.plist settings
 */
let _liquidGlassAvailable: boolean | null = null;

export const supportsLiquidGlass = (): boolean => {
  if (_liquidGlassAvailable !== null) {
    return _liquidGlassAvailable;
  }
  
  try {
    _liquidGlassAvailable = isLiquidGlassAvailable();
  } catch {
    _liquidGlassAvailable = false;
  }
  
  return _liquidGlassAvailable;
};

/**
 * Determine which glass rendering mode to use
 */
export type GlassMode = 'liquidGlass' | 'blur' | 'material';

export const getGlassMode = (): GlassMode => {
  if (isAndroid) {
    return 'material';
  }
  
  if (supportsLiquidGlass()) {
    return 'liquidGlass';
  }
  
  return 'blur';
};

/**
 * Check if we should use Material Design 3 styling
 */
export const useMaterialDesign = (): boolean => {
  return isAndroid;
};
