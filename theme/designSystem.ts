import { Platform, StyleSheet } from 'react-native';

const IOS_FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  display: '700',
  displayMedium: '600',
} as const;

const FONT_FAMILIES = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  display: 'SpaceGrotesk-SemiBold',
  displayMedium: 'SpaceGrotesk-Medium',
} as const;

export const font = (variant: keyof typeof FONT_FAMILIES) => {
  if (Platform.OS === 'ios') {
    return {
      fontFamily: 'System',
      fontWeight: IOS_FONT_WEIGHTS[variant],
    } as const;
  }

  return {
    fontFamily: FONT_FAMILIES[variant],
  } as const;
};

const isIOS = Platform.OS === 'ios';

const iosPalette = {
  background: '#0B0E14',
  backgroundMuted: '#0E1219',
  surface: 'rgba(255, 255, 255, 0.14)',
  surfaceStrong: 'rgba(255, 255, 255, 0.2)',
  surfaceSoft: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.18)',
  borderStrong: 'rgba(255, 255, 255, 0.28)',
  text: '#F8FAFC',
  textMuted: 'rgba(248, 250, 252, 0.72)',
  textSubtle: 'rgba(248, 250, 252, 0.52)',
  accent: '#0A84FF',
  accentSecondary: '#5AC8FA',
  accentTertiary: '#5E5CE6',
  success: '#34C759',
  warning: '#FF9F0A',
  error: '#FF453A',
};

// Material Design 3 color palette for Android
const androidPalette = {
  background: '#141218',           // MD3 surface
  backgroundMuted: '#1D1B20',      // MD3 surfaceContainerLow
  surface: '#211F26',              // MD3 surfaceContainer
  surfaceStrong: '#2B2930',        // MD3 surfaceContainerHigh
  surfaceSoft: '#0F0D13',          // MD3 surfaceContainerLowest
  border: '#49454F',               // MD3 outlineVariant
  borderStrong: '#938F99',         // MD3 outline
  text: '#E6E1E5',                 // MD3 onSurface
  textMuted: '#CAC4D0',            // MD3 onSurfaceVariant
  textSubtle: '#938F99',           // MD3 outline (used for subtle text)
  accent: '#D0BCFF',               // MD3 primary
  accentSecondary: '#CCC2DC',      // MD3 secondary
  accentTertiary: '#EFB8C8',       // MD3 tertiary
  success: '#4CAF50',              // Material green
  warning: '#FF9800',              // Material amber
  error: '#F2B8B5',                // MD3 error
};

export const palette = isIOS ? iosPalette : androidPalette;

const iosGradients = {
  backgroundBase: ['#0E1117', '#0B0E14', '#070A0F'],
  buttonPrimary: ['rgba(10, 132, 255, 0.9)', 'rgba(94, 92, 230, 0.9)'],
  buttonMuted: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)'],
  cardStroke: ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.1)'],
  avatarRing: ['#FFFFFF', '#D7DBE4', '#B0B7C3'],
};

// Material Design 3 gradients for Android (more subtle)
const androidGradients = {
  backgroundBase: ['#141218', '#1D1B20', '#141218'],
  buttonPrimary: ['#4F378B', '#381E72'],       // MD3 primaryContainer to onPrimary
  buttonMuted: ['#2B2930', '#211F26'],         // MD3 surface variations
  cardStroke: ['rgba(202, 196, 208, 0.15)', 'rgba(202, 196, 208, 0.05)'], // MD3 onSurfaceVariant
  avatarRing: ['#E6E1E5', '#CAC4D0', '#938F99'], // MD3 surface to outline
};

export const gradients = isIOS ? iosGradients : androidGradients;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
  full: 999,
  pill: 999,
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
};

const iosShadows = {
  card: {
    shadowColor: '#0B0E14',
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  floating: {
    shadowColor: '#0B0E14',
    shadowOpacity: 0.4,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 22 },
    elevation: 14,
  },
};

// Material Design 3 shadows for Android (more subtle, lower elevation)
const androidShadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
};

export const shadows = isIOS ? iosShadows : androidShadows;

export const typography = StyleSheet.create({
  display: {
    fontSize: 36,
    letterSpacing: -0.5,
    color: palette.text,
    ...font('display'),
  },
  title: {
    fontSize: 22,
    letterSpacing: -0.2,
    color: palette.text,
    ...font('semibold'),
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: palette.textMuted,
    ...font('regular'),
  },
  label: {
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: palette.textSubtle,
    ...font('displayMedium'),
  },
});

export const layout = {
  maxContentWidth: 440,
};

const iosTokens = {
  blur: {
    card: 26,
  },
};

const androidTokens = {
  blur: {
    card: 34,
  },
};

export const tokens = isIOS ? iosTokens : androidTokens;
