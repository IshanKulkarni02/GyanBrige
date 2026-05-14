/**
 * GyanBrige Theme - Glassmorphism Design System
 * Converted from TemplateMo 3D Glassmorphism Dashboard CSS
 */

import { StyleSheet, Platform } from 'react-native';

// ============================================
// COLOR PALETTE
// ============================================

export const Colors = {
  // Primary Colors - Emerald & Gold Luxury
  emerald: '#059669',
  emeraldLight: '#34d399',
  gold: '#d4a574',
  goldLight: '#e8c9a0',
  amber: '#b45309',
  cream: '#fef3e2',

  // Accent Colors
  coral: '#e07a5f',
  slate: '#475569',

  // Glass Colors (Dark Mode)
  glass: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.3)',
    hover: 'rgba(255, 255, 255, 0.08)',
  },

  // Background - Deep Forest (Dark Mode)
  background: {
    dark: '#0a0f0d',
    gradient1: '#0d1a14',
    gradient2: '#132419',
    gradient3: '#1a2e23',
  },

  // Text Colors (Dark Mode)
  text: {
    primary: '#f5f5f4',
    secondary: 'rgba(245, 245, 244, 0.7)',
    muted: 'rgba(245, 245, 244, 0.4)',
  },

  // Status Colors
  success: '#22c55e',
  warning: '#eab308',
  danger: '#dc2626',
  info: '#0ea5e9',

  // Transparent helpers
  transparent: 'transparent',
  white: '#ffffff',
  black: '#000000',
};

// Light Mode Colors
export const LightColors = {
  ...Colors,
  glass: {
    background: 'rgba(255, 255, 255, 0.6)',
    border: 'rgba(0, 0, 0, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.1)',
    hover: 'rgba(255, 255, 255, 0.8)',
  },
  background: {
    dark: '#f5f5f0',
    gradient1: '#e8f5e9',
    gradient2: '#f1f8e9',
    gradient3: '#fefefe',
  },
  text: {
    primary: '#1a1a1a',
    secondary: 'rgba(26, 26, 26, 0.7)',
    muted: 'rgba(26, 26, 26, 0.5)',
  },
};

// ============================================
// SPACING & SIZING
// ============================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,

  // Component-specific
  sidebarWidth: 280,
  navbarHeight: 70,
  cardPadding: 24,
};

// ============================================
// BORDER RADIUS
// ============================================

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 9999,
};

// ============================================
// BLUR INTENSITIES (for expo-blur)
// ============================================

export const BlurIntensity = {
  light: 10,
  medium: 20,
  heavy: 80,
};

// ============================================
// SHADOWS
// ============================================

export const Shadows = {
  glass: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.3,
    shadowRadius: 50,
    elevation: 12,
  },
  glassHover: {
    shadowColor: Colors.emeraldLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 15,
  },
  emerald: {
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 8,
  },
  gold: {
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 8,
  },
  card: {
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
};

// ============================================
// TYPOGRAPHY
// ============================================

export const Typography = {
  // Font Families (use system fonts or custom)
  fontFamily: {
    primary: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
    mono: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },

  // Font Sizes
  fontSize: {
    xs: 11,
    sm: 12,
    md: 13,
    base: 14,
    lg: 15,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    display: 32,
    hero: 48,
  },

  // Font Weights
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.6,
    relaxed: 1.8,
  },

  // Letter Spacing
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1.5,
  },
};

// ============================================
// ANIMATION DURATIONS
// ============================================

export const Animation = {
  fast: 200,
  normal: 300,
  slow: 500,
};

// ============================================
// GRADIENT PRESETS (for expo-linear-gradient)
// ============================================

export const Gradients = {
  // Primary Gradient
  primary: {
    colors: [Colors.emerald, Colors.emeraldLight],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Gold Gradient
  gold: {
    colors: [Colors.gold, Colors.goldLight],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Background Gradient
  background: {
    colors: [Colors.background.gradient1, Colors.background.gradient2, Colors.background.gradient3],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Logo/Brand Gradient
  brand: {
    colors: [Colors.emerald, Colors.gold],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Text Gradient Colors (apply via masked views)
  textPrimary: {
    colors: [Colors.text.primary, Colors.text.secondary],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Progress Bars
  progressCyan: {
    colors: [Colors.emeraldLight, Colors.emerald],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  progressMagenta: {
    colors: [Colors.goldLight, Colors.gold],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  progressPurple: {
    colors: [Colors.coral, Colors.amber],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 0 },
  },
  // Chart Bars
  barEmerald: {
    colors: ['#6db897', '#3d8b6e'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  barGold: {
    colors: ['#c9b896', '#a89068'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  barCoral: {
    colors: ['#d4a090', '#b87a68'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};

// ============================================
// GLASS CARD STYLES
// ============================================

export const GlassStyles = StyleSheet.create({
  // Base Glass Card
  card: {
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.cardPadding,
    overflow: 'hidden',
    ...Shadows.card,
  },

  // Glass Card with Blur (use with BlurView wrapper)
  cardWithBlur: {
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.cardPadding,
    overflow: 'hidden',
  },

  // Sidebar Glass
  sidebar: {
    backgroundColor: Colors.glass.background,
    borderRightWidth: 1,
    borderRightColor: Colors.glass.border,
    padding: Spacing.cardPadding,
  },

  // Navbar Item Glass
  navButton: {
    width: 45,
    height: 45,
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Input Glass
  input: {
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    fontSize: Typography.fontSize.base,
  },

  // Badge Glass
  badge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },

  // Status Badge variants
  badgeSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  badgeWarning: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  badgeDanger: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  badgeInfo: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
});

// ============================================
// BUTTON STYLES
// ============================================

export const ButtonStyles = StyleSheet.create({
  primary: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  primaryText: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
  },
  secondary: {
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: {
    color: Colors.text.primary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
  },
  icon: {
    width: 45,
    height: 45,
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ============================================
// TEXT STYLES
// ============================================

export const TextStyles = StyleSheet.create({
  // Headings
  h1: {
    fontSize: Typography.fontSize.xxxl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  h2: {
    fontSize: Typography.fontSize.xxl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },
  h3: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.primary,
  },

  // Body Text
  body: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.secondary,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
  },
  bodySmall: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.muted,
  },

  // Labels
  label: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
  },
  labelUppercase: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wider,
    color: Colors.text.muted,
  },

  // Stats/Numbers
  statValue: {
    fontFamily: Typography.fontFamily.mono,
    fontSize: Typography.fontSize.display,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },

  // Links
  link: {
    fontSize: Typography.fontSize.base,
    color: Colors.emeraldLight,
  },

  // Status Text
  success: { color: Colors.success },
  warning: { color: Colors.warning },
  danger: { color: Colors.danger },
  info: { color: Colors.info },
});

// ============================================
// LAYOUT STYLES
// ============================================

export const LayoutStyles = StyleSheet.create({
  // Screen Container
  screen: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },

  // Content Container
  container: {
    flex: 1,
    padding: Spacing.xxxl,
  },

  // Centered Container
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Row Layout
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Grid Layouts
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xxl,
  },
  contentGrid: {
    gap: Spacing.xxl,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: Colors.glass.border,
    marginVertical: Spacing.xxl,
  },
});

// ============================================
// AVATAR STYLES
// ============================================

export const AvatarStyles = StyleSheet.create({
  small: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medium: {
    width: 45,
    height: 45,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  large: {
    width: 70,
    height: 70,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xlarge: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.semibold,
  },
});

// ============================================
// PROGRESS BAR STYLES
// ============================================

export const ProgressStyles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: BorderRadius.md,
  },
});

// ============================================
// STAT ICON STYLES
// ============================================

export const StatIconStyles = StyleSheet.create({
  base: {
    width: 55,
    height: 55,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cyan: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    ...Shadows.emerald,
  },
  magenta: {
    backgroundColor: 'rgba(212, 165, 116, 0.2)',
    ...Shadows.gold,
  },
  purple: {
    backgroundColor: 'rgba(224, 122, 95, 0.2)',
  },
  success: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
});

// ============================================
// THEME OBJECT (for ThemeProvider)
// ============================================

export const DarkTheme = {
  colors: Colors,
  spacing: Spacing,
  borderRadius: BorderRadius,
  blur: BlurIntensity,
  shadows: Shadows,
  typography: Typography,
  animation: Animation,
  gradients: Gradients,
};

export const LightTheme = {
  ...DarkTheme,
  colors: LightColors,
};

// Default export
export default {
  Colors,
  LightColors,
  Spacing,
  BorderRadius,
  BlurIntensity,
  Shadows,
  Typography,
  Animation,
  Gradients,
  GlassStyles,
  ButtonStyles,
  TextStyles,
  LayoutStyles,
  AvatarStyles,
  ProgressStyles,
  StatIconStyles,
  DarkTheme,
  LightTheme,
};
