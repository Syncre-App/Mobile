import { useColorScheme } from 'react-native';
import { Colors } from '../constants/colors';
import { useThemeStore, ThemeMode } from '../stores/themeStore';

export type Theme = 'light' | 'dark';
export type ThemeColors = typeof Colors.light | typeof Colors.dark;

export interface UseThemeReturn {
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export function useTheme(): UseThemeReturn {
  const systemColorScheme = useColorScheme();
  const { mode, setMode } = useThemeStore();

  // Determine actual theme based on mode
  let theme: Theme;
  if (mode === 'system') {
    theme = systemColorScheme === 'dark' ? 'dark' : 'light';
  } else {
    theme = mode;
  }

  const colors = Colors[theme] as ThemeColors;
  const isDark = theme === 'dark';

  return {
    theme,
    colors,
    isDark,
    mode,
    setMode,
  };
}
