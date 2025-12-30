export const Colors = {
  light: {
    // Backgrounds
    background: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceSecondary: '#EBEBEB',
    
    // Text
    text: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    
    // Borders
    border: '#E0E0E0',
    borderLight: '#F0F0F0',
    
    // Messages
    messageSent: '#007AFF',
    messageSentText: '#FFFFFF',
    messageReceived: '#E9E9EB',
    messageReceivedText: '#000000',
    
    // Accent & Status
    accent: '#007AFF',
    accentLight: '#E3F2FD',
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',
    
    // Online status
    online: '#34C759',
    offline: '#8E8E93',
    
    // Tab bar
    tabBar: '#FFFFFF',
    tabBarBorder: '#E0E0E0',
    tabActive: '#007AFF',
    tabInactive: '#8E8E93',
    
    // Input
    inputBackground: '#F5F5F5',
    inputBorder: '#E0E0E0',
    inputPlaceholder: '#999999',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
    
    // Card
    card: '#FFFFFF',
    cardShadow: 'rgba(0, 0, 0, 0.1)',
  },
  
  dark: {
    // Backgrounds
    background: '#000000',
    surface: '#1C1C1E',
    surfaceSecondary: '#2C2C2E',
    
    // Text
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    textTertiary: '#636366',
    
    // Borders
    border: '#38383A',
    borderLight: '#2C2C2E',
    
    // Messages
    messageSent: '#0A84FF',
    messageSentText: '#FFFFFF',
    messageReceived: '#2C2C2E',
    messageReceivedText: '#FFFFFF',
    
    // Accent & Status
    accent: '#0A84FF',
    accentLight: '#1C3A5E',
    success: '#30D158',
    warning: '#FF9F0A',
    error: '#FF453A',
    
    // Online status
    online: '#30D158',
    offline: '#636366',
    
    // Tab bar
    tabBar: '#1C1C1E',
    tabBarBorder: '#38383A',
    tabActive: '#0A84FF',
    tabInactive: '#636366',
    
    // Input
    inputBackground: '#1C1C1E',
    inputBorder: '#38383A',
    inputPlaceholder: '#636366',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.7)',
    
    // Card
    card: '#1C1C1E',
    cardShadow: 'rgba(0, 0, 0, 0.3)',
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = typeof Colors.light;
