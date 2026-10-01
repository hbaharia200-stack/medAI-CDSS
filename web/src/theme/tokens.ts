// Global design tokens — web (React + Vite + Tailwind).
// Mirrors mobile/src/theme/tokens.ts. Tailwind utilities are configured in
// src/index.css via @theme; this file exports the same palette for JS chart
// colours and inline styles.

export const tokens = {
  colors: {
    // === Light mode palette (professional healthcare) ===
    primary: '#0A5CB8',
    primaryDark: '#08468C',
    primaryLight: '#E3EEFA',
    confHigh: '#1E7E34',
    confHighBg: '#E5F4E9',
    confMedium: '#B26A00',
    confMediumBg: '#FDF1DE',
    confLow: '#5C6670',
    confLowBg: '#EAEDF0',
    danger: '#C5221F',
    dangerDark: '#9E1B19',
    dangerBg: '#FDE9E8',
    warningBg: '#FDF1DE',
    infoBg: '#E3EEFA',
    canvas: '#F8FAFC',
    surface: '#FFFFFF',
    line: '#D9E0E8',
    ink: '#1B1F24',
    inkMuted: '#5C6670',
    inkOnPrimary: '#FFFFFF',
    // === Dark mode overrides (deep indigo / blue-violet navy) ===
    dark: {
      canvas: '#06111F',
      surface: '#08162A',
      elevated: '#0D2048',
      panel: '#0D2048',
      line: 'rgba(95, 120, 180, 0.20)',
      primary: '#3B82F6',
      primaryDark: '#2F78C9',
      primaryLight: '#132B59',
      confHigh: '#22C55E',
      confHighBg: '#1A3824',
      confMedium: '#F59E0B',
      confMediumBg: '#3C2D16',
      danger: '#EF4444',
      dangerDark: '#FF4D4D',
      dangerBg: '#4B1F1F',
      ink: '#F4F7FB',
      inkMuted: '#A8B3C7',
      accent: '#60A5FA',
      shadowCard: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
      shadowCardHover: '0 4px 12px rgba(0,0,0,0.4)',
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radii: { sm: 8, md: 12, lg: 16, pill: 999 },
  shadow: {
    card: '0 8px 30px rgba(0,0,0,0.04)',
    cardHover: '0 4px 12px rgba(0,0,0,0.1)',
  },
  series: {
    1: '#0A5CB8',
    2: '#0EA5E9',
    3: '#1E7E34',
    4: '#B26A00',
    dark: {
      1: '#3B82F6',
      2: '#60A5FA',
      3: '#22C55E',
      4: '#F59E0B',
    },
  },
  font: {
    base: 16,
    leading: [1.5, 'normal'] as [number, string],
  },
} as const;

export const confidenceColor = {
  High: tokens.colors.confHigh,
  Medium: tokens.colors.confMedium,
  Low: tokens.colors.confLow,
} as const;

export default tokens;