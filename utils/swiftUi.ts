import { Platform } from 'react-native';

export const isNewArchitectureEnabled = (): boolean => {
  return Boolean((globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager);
};

export const canUseSwiftUI = (): boolean => {
  return Platform.OS === 'ios' && isNewArchitectureEnabled();
};
