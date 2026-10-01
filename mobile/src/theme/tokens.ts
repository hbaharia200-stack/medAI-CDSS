// Global design tokens — mobile (Expo / React Native)
// Color tokens: primary (trust blue), confidence colors, emergency/danger, neutral grays.
import { Platform, type TextStyle } from 'react-native';

// Kills the browser-native focus outline on react-native-web TextInputs.
// Cast needed: RN's TextStyle enum doesn't include web-only `outlineStyle: 'none'`.
export const noOutline: TextStyle =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle)
    : {};

export type ThemeScheme = 'light' | 'dark';

type Palette = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent?: string; // subtle medical-blue / cyan accent for AI-related components
  surfaceElevated?: string; // cards/panels richer than the base surface
  input?: string; // input field background
  confidenceHigh: string;
  confidenceHighBg: string;
  confidenceMedium: string;
  confidenceMediumBg: string;
  confidenceLow: string;
  confidenceLowBg: string;
  danger: string;
  dangerDark: string;
  dangerBg: string;
  warningBg: string;
  infoBg: string;
  /**
   * The AI assistant response card. Deliberately the SAME visual family as the
   * web hero/brand panel (`--color-panel`), so the assistant reads as part of
   * MedAI rather than as a foreign accent. Navy/rich blue in both schemes with
   * white text (contrast >= 7:1).
   */
  aiCard: {
    background: string;
    border: string;
    accent: string;
    text: string;
    textMuted: string;
    /** Fill for controls that sit on the card (the 1-5 rating buttons). */
    control: string;
  };
  neutral: {
    background: string;
    surface: string;
    border: string;
    text: string;
    textMuted: string;
    textOnPrimary: string;
  };
  overlay: string;
};

export const lightColors: Palette = {
  primary: '#0A5CB8', // trust blue
  primaryDark: '#08468C',
  primaryLight: '#E3EEFA',
  accent: '#1E88E5', // medical blue accent for AI highlights on light bg
  surfaceElevated: '#FFFFFF',
  input: '#FFFFFF',
  confidenceHigh: '#1E7E34', // green
  confidenceHighBg: '#E5F4E9',
  confidenceMedium: '#B26A00', // amber
  confidenceMediumBg: '#FDF1DE',
  confidenceLow: '#5C6670', // gray
  confidenceLowBg: '#EAEDF0',
  danger: '#C5221F', // emergency red
  dangerDark: '#9E1B19',
  dangerBg: '#FDE9E8',
  warningBg: '#FDF1DE',
  infoBg: '#E3EEFA',
  // --- AI assistant response card -----------------------------------------
  // The AI reply card follows the MedAI hero/brand panel (the web
  // `--color-panel` value) rather than introducing its own hue, so the
  // assistant reads as part of the brand. Both schemes use a deep navy /
  // rich blue with white text (contrast >= 7:1), which keeps a premium,
  // clinical feel in light mode without turning pale.
  aiCard: {
    // Exactly the web hero panel in light mode (--color-panel: #08468C), which
    // is also this palette's own `primaryDark` — same MedAI blue block.
    background: '#08468C',
    border: 'rgba(255, 255, 255, 0.18)',
    accent: '#93C5FD', // sky blue "MedAI" sender label on the navy block
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.82)',
    control: '#0A5CB8',
  },
  neutral: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    border: '#D9E0E8',
    text: '#1B1F24',
    textMuted: '#5C6670',
    textOnPrimary: '#FFFFFF',
  },
  overlay: 'rgba(27, 31, 36, 0.45)',
};

export const darkColors: Palette = {
  primary: '#3B8FF3',
  primaryDark: '#2D72C8',
  primaryLight: '#12304A',
  accent: '#58BFEF',
  surfaceElevated: '#132F46',
  input: '#0C2134',
  confidenceHigh: '#22C55E', // professional green
  confidenceHighBg: '#0F3322',
  confidenceMedium: '#F59E0B', // amber
  confidenceMediumBg: '#3A2A10',
  confidenceLow: '#B8C7D9', // muted blue-gray
  confidenceLowBg: '#1D3A52',
  danger: '#EF4444', // emergency red
  dangerDark: '#DC2626',
  dangerBg: '#3A1420',
  warningBg: '#3A2A10',
  infoBg: '#0B2239', // blends into the navy card system
  aiCard: {
    // Exactly the web hero panel in dark mode (--color-panel: #0D2048), the
    // deep indigo/navy the MedAI brand uses for large surfaces.
    background: '#0D2048',
    border: 'rgba(95, 120, 180, 0.28)', // web --color-line, blue-tinted
    accent: '#60A5FA', // web dark accent
    text: '#FFFFFF',
    textMuted: 'rgba(200, 212, 230, 0.85)',
    control: '#16305C',
  },
  neutral: {
    background: '#06111F',
    surface: '#0C2134',
    border: 'rgba(103, 145, 177, 0.28)',
    text: '#F4F8FB',
    textMuted: '#91A7BA',
    textOnPrimary: '#FFFFFF',
  },
  overlay: 'rgba(7, 26, 47, 0.65)',
};

export const colors: Palette = { ...lightColors };

export function applyThemeColors(scheme: ThemeScheme) {
  const source = scheme === 'dark' ? darkColors : lightColors;
  Object.assign(colors, source);
  colors.neutral = { ...source.neutral };
  return colors;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

// Large base font (min 16px), generous line-height for low-literacy readability.
export const fonts = {
  h1: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, lineHeight: 36, fontWeight: '800' as const },
  h2: { fontFamily: 'Inter_700Bold', fontSize: 22, lineHeight: 30, fontWeight: '700' as const },
  h3: { fontFamily: 'Inter_700Bold', fontSize: 18, lineHeight: 26, fontWeight: '700' as const },
  body: { fontFamily: 'Inter_400Regular', fontSize: 17, lineHeight: 26, fontWeight: '400' as const },
  bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 26, fontWeight: '600' as const },
  bodyLarge: { fontFamily: 'Inter_400Regular', fontSize: 19, lineHeight: 28, fontWeight: '400' as const },
  caption: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  captionStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
} as const;

// Accessibility: minimum touch target for critical actions.
export const touchTarget = 52;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;