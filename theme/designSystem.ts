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

const androidPalette = {
  background: '#000000',
  backgroundMuted: '#0A0A0A',
  surface: 'rgba(255, 255, 255, 0.06)',
  surfaceStrong: 'rgba(255, 255, 255, 0.12)',
  surfaceSoft: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.65)',
  textSubtle: 'rgba(255, 255, 255, 0.4)',
  accent: '#1C1C1E',
  accentSecondary: '#FFFFFF',
  accentTertiary: '#D6D6D6',
  success: '#FFFFFF',
  warning: '#D6D6D6',
  error: '#F2F2F2',
};

export const palette = isIOS ? iosPalette : androidPalette;

const iosGradients = {
  backgroundBase: ['#0E1117', '#0B0E14', '#070A0F'],
  buttonPrimary: ['rgba(10, 132, 255, 0.9)', 'rgba(94, 92, 230, 0.9)'],
  buttonMuted: ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.06)'],
  cardStroke: ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.1)'],
  avatarRing: ['#FFFFFF', '#D7DBE4', '#B0B7C3'],
};

const androidGradients = {
  backgroundBase: ['#000000', '#050505', '#000000'],
  buttonPrimary: ['#1C1C1E', '#2C2C2E'],
  buttonMuted: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)'],
  cardStroke: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)'],
  avatarRing: ['#FFFFFF', '#DADADA', '#BFBFBF'],
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

const androidShadows = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  floating: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
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
