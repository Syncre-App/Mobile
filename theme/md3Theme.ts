/**
 * Material Design 3 (Material You) Theme for Android
 * Based on the official MD3 color system and components
 * 
 * Reference: https://m3.material.io/
 */

/**
 * MD3 Dark Theme Color Palette
 * Using a neutral dark scheme with subtle surface tones
 */
export const md3Colors = {
  // Primary colors
  primary: '#D0BCFF',
  onPrimary: '#381E72',
  primaryContainer: '#4F378B',
  onPrimaryContainer: '#EADDFF',

  // Secondary colors
  secondary: '#CCC2DC',
  onSecondary: '#332D41',
  secondaryContainer: '#4A4458',
  onSecondaryContainer: '#E8DEF8',

  // Tertiary colors
  tertiary: '#EFB8C8',
  onTertiary: '#492532',
  tertiaryContainer: '#633B48',
  onTertiaryContainer: '#FFD8E4',

  // Error colors
  error: '#F2B8B5',
  onError: '#601410',
  errorContainer: '#8C1D18',
  onErrorContainer: '#F9DEDC',

  // Surface colors (key for cards/containers)
  surface: '#141218',
  surfaceDim: '#141218',
  surfaceBright: '#3B383E',
  surfaceContainerLowest: '#0F0D13',
  surfaceContainerLow: '#1D1B20',
  surfaceContainer: '#211F26',
  surfaceContainerHigh: '#2B2930',
  surfaceContainerHighest: '#36343B',

  // On surface
  onSurface: '#E6E1E5',
  onSurfaceVariant: '#CAC4D0',

  // Outline
  outline: '#938F99',
  outlineVariant: '#49454F',

  // Background
  background: '#141218',
  onBackground: '#E6E1E5',

  // Inverse
  inverseSurface: '#E6E1E5',
  inverseOnSurface: '#313033',
  inversePrimary: '#6750A4',

  // Scrim
  scrim: '#000000',

  // Shadow
  shadow: '#000000',
};

/**
 * MD3 Elevation levels
 * In MD3, elevation uses tonal color overlays instead of shadows
 */
export const md3Elevation = {
  level0: {
    backgroundColor: md3Colors.surface,
    elevation: 0,
  },
  level1: {
    backgroundColor: md3Colors.surfaceContainerLow,
    elevation: 1,
  },
  level2: {
    backgroundColor: md3Colors.surfaceContainer,
    elevation: 3,
  },
  level3: {
    backgroundColor: md3Colors.surfaceContainerHigh,
    elevation: 6,
  },
  level4: {
    backgroundColor: md3Colors.surfaceContainerHigh,
    elevation: 8,
  },
  level5: {
    backgroundColor: md3Colors.surfaceContainerHighest,
    elevation: 12,
  },
};

/**
 * MD3 Shape tokens (corner radii)
 */
export const md3Shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 9999,
};

/**
 * MD3 Typography scale
 */
export const md3Typography = {
  displayLarge: { fontSize: 57, lineHeight: 64, letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, lineHeight: 52 },
  displaySmall: { fontSize: 36, lineHeight: 44 },
  headlineLarge: { fontSize: 32, lineHeight: 40 },
  headlineMedium: { fontSize: 28, lineHeight: 36 },
  headlineSmall: { fontSize: 24, lineHeight: 32 },
  titleLarge: { fontSize: 22, lineHeight: 28 },
  titleMedium: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, letterSpacing: 0.5 },
};

/**
 * MD3 State layer opacities
 */
export const md3StateLayer = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
};

/**
 * MD3 Card styles
 * Cards in MD3 use surface container colors with subtle elevation
 */
export const md3Card = {
  elevated: {
    backgroundColor: md3Colors.surfaceContainerLow,
    borderRadius: md3Shape.medium,
    elevation: 1,
    shadowColor: md3Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  filled: {
    backgroundColor: md3Colors.surfaceContainerHighest,
    borderRadius: md3Shape.medium,
    elevation: 0,
  },
  outlined: {
    backgroundColor: md3Colors.surface,
    borderRadius: md3Shape.medium,
    borderWidth: 1,
    borderColor: md3Colors.outlineVariant,
    elevation: 0,
  },
};

/**
 * Convert a card variant to MD3 card style
 */
export type CardVariant = 'default' | 'hero' | 'subtle';

export const getMd3CardStyle = (variant: CardVariant) => {
  switch (variant) {
    case 'hero':
      return {
        ...md3Card.elevated,
        backgroundColor: md3Colors.surfaceContainerHigh,
        elevation: 3,
        shadowOpacity: 0.4,
        shadowRadius: 4,
      };
    case 'subtle':
      return md3Card.filled;
    default:
      return md3Card.elevated;
  }
};
