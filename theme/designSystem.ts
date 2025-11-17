import { StyleSheet } from 'react-native';

export const palette = {
  background: '#F8FAFC',
  backgroundMuted: '#EEF2FF',
  surface: 'rgba(255, 255, 255, 0.92)',
  surfaceStrong: 'rgba(248, 250, 252, 0.9)',
  surfaceSoft: 'rgba(226, 232, 240, 0.35)',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.14)',
  text: '#0F172A',
  textMuted: 'rgba(15, 23, 42, 0.65)',
  textSubtle: 'rgba(15, 23, 42, 0.45)',
  accent: '#2563EB',
  accentSecondary: '#0EA5E9',
  accentTertiary: '#7C3AED',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#FB7185',
};

export const gradients = {
  backgroundBase: ['#FFFFFF', '#F8FAFC', '#EEF2FF'],
  buttonPrimary: ['#2563EB', '#0EA5E9', '#8B5CF6'],
  buttonMuted: ['rgba(15,23,42,0.05)', 'rgba(15,23,42,0.02)'],
  cardStroke: ['rgba(148,163,184,0.35)', 'rgba(148,163,184,0.05)'],
  avatarRing: ['#2563EB', '#0EA5E9', '#8B5CF6'],
};

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
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

export const shadows = {
  card: {
    shadowColor: '#010103',
    shadowOpacity: 0.65,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 30,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.45,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 30 },
    elevation: 16,
  },
};

export const typography = StyleSheet.create({
  display: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 36,
    letterSpacing: -0.5,
    color: palette.text,
  },
  title: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 22,
    letterSpacing: -0.2,
    color: palette.text,
  },
  body: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 15,
    lineHeight: 22,
    color: palette.textMuted,
  },
  label: {
    fontFamily: 'SpaceGrotesk-Medium',
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: palette.textSubtle,
  },
});

export const layout = {
  maxContentWidth: 440,
};

export const tokens = {
  blur: {
    card: 24,
  },
};
