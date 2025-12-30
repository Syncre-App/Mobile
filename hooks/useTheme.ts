import { useColorScheme } from 'react-native';
import { Colors } from '../constants/colors';

export type Theme = 'light' | 'dark';
export type ThemeColors = typeof Colors.light | typeof Colors.dark;

export interface UseThemeReturn {
  theme: Theme;
  colors: ThemeColors;
  isDark: boolean;
}

export function useTheme(): UseThemeReturn {
  const colorScheme = useColorScheme();
  const theme: Theme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[theme] as ThemeColors;
  const isDark = theme === 'dark';

  return {
    theme,
    colors,
    isDark,
  };
}
