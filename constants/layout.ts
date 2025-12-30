import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const Layout = {
  // Screen dimensions
  window: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  // Border radius
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  
  // Font sizes
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    title: 28,
    largeTitle: 34,
  },
  
  // Font weights (as string literals for React Native)
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  
  // Common component heights
  heights: {
    input: 48,
    button: 50,
    tabBar: Platform.OS === 'ios' ? 83 : 64,
    header: Platform.OS === 'ios' ? 96 : 56,
    avatar: {
      xs: 24,
      sm: 32,
      md: 40,
      lg: 56,
      xl: 80,
    },
    messageBubble: {
      minHeight: 36,
    },
  },
  
  // Message bubbles
  message: {
    maxWidth: SCREEN_WIDTH * 0.75,
    padding: {
      horizontal: 12,
      vertical: 8,
    },
    borderRadius: 18,
  },
  
  // Chat input
  chatInput: {
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
  },
  
  // Animation durations
  animation: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  
  // Shadows
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
  
  // Platform specific
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
} as const;
