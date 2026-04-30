// RBF Works – Design System Tokens

export const Colors = {
  primary: '#1AADA0',       // RBF Turquoise
  primaryLight: '#2EC4B6',
  primaryDark: '#148A7F',
  accent: '#3D3D3D',        // RBF Charcoal
  accentLight: '#555555',
  accentDark: '#2A2A2A',
  background: '#F5F8F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EBF6F5',
  border: '#B2DDD9',
  text: '#2A2A2A',
  textSecondary: '#555F6D',
  textMuted: '#8A9BA8',
  textOnPrimary: '#FFFFFF',
  textOnAccent: '#FFFFFF',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#F57C00',
  shadow: 'rgba(26, 173, 160, 0.18)',
  overlay: 'rgba(20, 60, 58, 0.62)',
  inputBg: '#F0FAFA',
  divider: '#D4EDED',
  cardBorder: '#C2E0DD',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  body: 15,
  bodyLg: 17,
  subtitle: 19,
  title: 22,
  display: 28,
  hero: 34,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Shadow = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 10,
  },
};
