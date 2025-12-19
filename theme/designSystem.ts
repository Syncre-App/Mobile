import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, Platform, StyleSheet } from 'react-native';
import { StorageService } from '../services/StorageService';

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

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 34,
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
  mega: 56,
};

export const layout = {
  maxContentWidth: 440,
};

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';
export type ThemeVariant = 'ios26' | 'ios18';

export type ThemePalette = {
  background: string;
  backgroundMuted: string;
  surface: string;
  surfaceStrong: string;
  surfaceSoft: string;
  surfaceInverse: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  accentSecondary: string;
  accentTertiary: string;
  success: string;
  warning: string;
  error: string;
  bubbleOutgoing: string;
  bubbleIncoming: string;
  bubbleIncomingBorder: string;
  divider: string;
};

export type ThemeGradients = {
  background: [string, string, ...string[]];
  surface: [string, string, ...string[]];
  accent: [string, string, ...string[]];
  glassStroke: [string, string, ...string[]];
  glassHighlight: [string, string, ...string[]];
  bubbleOutgoing: [string, string, ...string[]];
};

export type ThemeShadows = {
  card: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
  floating: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

export type ThemeTokens = {
  blur: {
    card: number;
    nav: number;
    sheet: number;
    toast: number;
  };
  glass: {
    borderWidth: number;
  };
};

export type Theme = {
  mode: ResolvedThemeMode;
  variant: ThemeVariant;
  isDark: boolean;
  palette: ThemePalette;
  gradients: ThemeGradients;
  shadows: ThemeShadows;
  tokens: ThemeTokens;
  typography: ReturnType<typeof createTypography>;
  radii: typeof radii;
  spacing: typeof spacing;
  layout: typeof layout;
  isIOS: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
  isReady: boolean;
};

const THEME_STORAGE_KEY = 'theme_mode';

const resolvePlatformVariant = (): ThemeVariant => {
  if (Platform.OS !== 'ios') {
    return 'ios18';
  }

  const version = typeof Platform.Version === 'number'
    ? Platform.Version
    : Number.parseFloat(String(Platform.Version)) || 0;
  return version >= 26 ? 'ios26' : 'ios18';
};

const resolveColorScheme = (mode: ThemeMode, systemScheme: ColorSchemeName): ResolvedThemeMode => {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return systemScheme === 'light' ? 'light' : 'dark';
};

const buildPalette = (mode: ResolvedThemeMode, variant: ThemeVariant): ThemePalette => {
  const isDark = mode === 'dark';
  if (isDark) {
    return {
      background: variant === 'ios26' ? '#07090D' : '#0B0E14',
      backgroundMuted: variant === 'ios26' ? '#0C1017' : '#0E1219',
      surface: 'rgba(255, 255, 255, 0.08)',
      surfaceStrong: 'rgba(255, 255, 255, 0.16)',
      surfaceSoft: 'rgba(255, 255, 255, 0.05)',
      surfaceInverse: 'rgba(7, 9, 13, 0.7)',
      border: 'rgba(255, 255, 255, 0.18)',
      borderStrong: 'rgba(255, 255, 255, 0.32)',
      text: '#F5F7FB',
      textMuted: 'rgba(245, 247, 251, 0.74)',
      textSubtle: 'rgba(245, 247, 251, 0.48)',
      accent: '#0A84FF',
      accentSoft: 'rgba(10, 132, 255, 0.2)',
      accentStrong: '#5AC8FA',
      accentSecondary: '#5AC8FA',
      accentTertiary: '#5E5CE6',
      success: '#30D158',
      warning: '#FFD60A',
      error: '#FF453A',
      bubbleOutgoing: '#0A84FF',
      bubbleIncoming: 'rgba(255, 255, 255, 0.12)',
      bubbleIncomingBorder: 'rgba(255, 255, 255, 0.2)',
      divider: 'rgba(255, 255, 255, 0.08)',
    };
  }

  return {
    background: '#F5F6FA',
    backgroundMuted: '#E9ECF2',
    surface: 'rgba(255, 255, 255, 0.66)',
    surfaceStrong: 'rgba(255, 255, 255, 0.82)',
    surfaceSoft: 'rgba(255, 255, 255, 0.5)',
    surfaceInverse: 'rgba(12, 16, 24, 0.88)',
    border: 'rgba(15, 23, 42, 0.08)',
    borderStrong: 'rgba(15, 23, 42, 0.16)',
    text: '#0B0E14',
    textMuted: 'rgba(11, 14, 20, 0.7)',
    textSubtle: 'rgba(11, 14, 20, 0.5)',
    accent: '#007AFF',
    accentSoft: 'rgba(0, 122, 255, 0.18)',
    accentStrong: '#5AC8FA',
    accentSecondary: '#5AC8FA',
    accentTertiary: '#5856D6',
    success: '#28CD41',
    warning: '#FF9F0A',
    error: '#FF453A',
    bubbleOutgoing: '#007AFF',
    bubbleIncoming: 'rgba(255, 255, 255, 0.9)',
    bubbleIncomingBorder: 'rgba(15, 23, 42, 0.08)',
    divider: 'rgba(15, 23, 42, 0.08)',
  };
};

const buildGradients = (mode: ResolvedThemeMode, variant: ThemeVariant): ThemeGradients => {
  const isDark = mode === 'dark';
  if (isDark) {
    return {
      background: variant === 'ios26'
        ? ['#0B0F17', '#07090D', '#0B121E']
        : ['#0E1117', '#0B0E14', '#070A0F'],
      surface: ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.04)'],
      accent: ['rgba(10, 132, 255, 0.9)', 'rgba(94, 92, 230, 0.9)'],
      glassStroke: ['rgba(255, 255, 255, 0.38)', 'rgba(255, 255, 255, 0.08)'],
      glassHighlight: ['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0)'],
      bubbleOutgoing: ['#0A84FF', '#5AC8FA'],
    };
  }

  return {
    background: ['#EEF1F7', '#F8FAFF', '#E7EBF3'],
    surface: ['rgba(255, 255, 255, 0.92)', 'rgba(255, 255, 255, 0.6)'],
    accent: ['#007AFF', '#5AC8FA'],
    glassStroke: ['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.2)'],
    glassHighlight: ['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0)'],
    bubbleOutgoing: ['#007AFF', '#4CC3FF'],
  };
};

const buildShadows = (mode: ResolvedThemeMode): ThemeShadows => {
  if (mode === 'dark') {
    return {
      card: {
        shadowColor: '#05070B',
        shadowOpacity: 0.38,
        shadowRadius: 26,
        shadowOffset: { width: 0, height: 16 },
        elevation: 20,
      },
      floating: {
        shadowColor: '#05070B',
        shadowOpacity: 0.42,
        shadowRadius: 34,
        shadowOffset: { width: 0, height: 22 },
        elevation: 14,
      },
    };
  }

  return {
    card: {
      shadowColor: '#93A0B3',
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
    floating: {
      shadowColor: '#93A0B3',
      shadowOpacity: 0.26,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 18 },
      elevation: 16,
    },
  };
};

const buildTokens = (variant: ThemeVariant): ThemeTokens => ({
  blur: {
    card: variant === 'ios26' ? 28 : 22,
    nav: variant === 'ios26' ? 34 : 26,
    sheet: variant === 'ios26' ? 48 : 36,
    toast: variant === 'ios26' ? 40 : 32,
  },
  glass: {
    borderWidth: variant === 'ios26' ? 1.2 : 1,
  },
});

const createTypography = (palette: ThemePalette) => StyleSheet.create({
  display: {
    fontSize: 36,
    letterSpacing: -0.6,
    color: palette.text,
    ...font('display'),
  },
  title: {
    fontSize: 22,
    letterSpacing: -0.25,
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
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: palette.textSubtle,
    ...font('displayMedium'),
  },
});

const createTheme = (mode: ResolvedThemeMode, variant: ThemeVariant): Theme => {
  const palette = buildPalette(mode, variant);
  return {
    mode,
    variant,
    isDark: mode === 'dark',
    palette,
    gradients: buildGradients(mode, variant),
    shadows: buildShadows(mode),
    tokens: buildTokens(variant),
    typography: createTypography(palette),
    radii,
    spacing,
    layout,
    isIOS: Platform.OS === 'ios',
  };
};

const defaultTheme = createTheme('dark', resolvePlatformVariant());

const ThemeContext = createContext<ThemeContextValue>({
  theme: defaultTheme,
  mode: 'system',
  setMode: () => {},
  isReady: false,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    StorageService.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!mounted) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const resolvedMode = resolveColorScheme(mode, systemScheme);
  const theme = useMemo(
    () => createTheme(resolvedMode, resolvePlatformVariant()),
    [resolvedMode]
  );

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    StorageService.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo(
    () => ({
      theme,
      mode,
      setMode,
      isReady: ready,
    }),
    [theme, mode, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  return useContext(ThemeContext);
};

export const fallbackTheme = defaultTheme;
export const palette = fallbackTheme.palette;
export const gradients = fallbackTheme.gradients;
export const shadows = fallbackTheme.shadows;
export const tokens = fallbackTheme.tokens;
