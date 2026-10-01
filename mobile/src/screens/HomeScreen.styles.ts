import { Platform, StyleSheet } from 'react-native';
import type { ThemeColors } from '../theme/ThemeProvider';

/**
 * Home screen palette, derived entirely from the active theme (light/dark).
 * `homeStyles` is called with the provider's `colors` at render time, so the
 * values always reflect the current scheme — never frozen at import time.
 * This is what makes the Light/Dark toggle actually re-theme the home screen:
 * every token below maps to `colors.neutral.*` / `colors.primary`, which are
 * scheme-aware, instead of a hardcoded dark fallback.
 */
export function homeStyles(colors: ThemeColors) {
  // Flatten the theme palette into the token names this screen already uses,
  // so the existing style rules below keep working untouched.
  const c: ThemeColors & {
    background: string;
    surface: string;
    border: string;
    borderStrong: string;
    accent: string;
    onPrimary: string;
    neutral: {
      background: string;
      surface: string;
      border: string;
      text: string;
      textMuted: string;
      textSecondary: string;
      textOnPrimary: string;
    };
  } = {
    ...colors,
    background: colors.neutral.background,
    surface: colors.neutral.surface,
    border: colors.neutral.border,
    borderStrong: colors.primary,
    accent: colors.primary,
    onPrimary: colors.neutral.textOnPrimary,
    neutral: {
      ...colors.neutral,
      // Theme palette has no separate "textSecondary" token; reuse textMuted
      // so secondary copy stays readable in both light and dark mode.
      textSecondary: colors.neutral.textMuted,
    },
  };

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.background,
    },

    // ---------- Header ----------
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 10,
    },
        accountBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: 'rgba(255,255,255,0.02)',
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    accountIcon: {
      fontSize: 14,
      color: c.neutral.text,
    },
    accountText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.neutral.text,
    },
    chevron: {
      fontSize: 16,
      color: c.neutral.textMuted,
      marginLeft: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
        langSegPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surface,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: 'transparent',
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    langSegActive: {
      borderColor: c.borderStrong,
    },
    langSegLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: c.neutral.textMuted,
    },
    langSegActiveText: {
      color: c.neutral.text,
    },
        themeSegPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: 'transparent',
      borderRadius: 20,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 10,
      elevation: 0,
    },
    themeSegLabel: {
      fontSize: 15,
      textAlign: 'center',
      width: 28,
      height: 28,
      lineHeight: 28,
      borderRadius: 14,
      color: c.neutral.textMuted,
      overflow: 'hidden',
    },
    themeSegActiveText: {
      backgroundColor: c.primary,
      color: c.onPrimary,
    },

    // ---------- Scroll content ----------
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 28,
    },

    // ---------- Brand ----------
    brand: {
      alignItems: 'center',
      marginTop: 14,
      marginBottom: 4,
    },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      backgroundColor: 'transparent',
      ...Platform.select({
        ios: {
          shadowColor: c.accent,
          shadowOpacity: 0.55,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
        },
        android: { elevation: 6 },
      }),
    },
    logoIcon: {
      fontSize: 32,
    },
    appName: {
      flexDirection: 'row',
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    tagline: {
      fontSize: 13,
      color: c.neutral.textSecondary,
      marginTop: 2,
      marginBottom: 18,
    },

    // ---------- Hero heading + subtitle (was "clinical card") ----------
    clinicalCard: {
      alignItems: 'center',
      marginBottom: 18,
      paddingHorizontal: 4,
    },
    clinicalTitle: {
      fontSize: 26,
      lineHeight: 32,
      fontWeight: '800',
      color: c.neutral.text,
      textAlign: 'center',
    },
    clinicalTitleHighlight: {
      color: c.accent,
    },
    clinicalSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: c.neutral.textSecondary,
      textAlign: 'center',
      marginTop: 10,
      paddingHorizontal: 6,
    },

    // ---------- Actions ----------
    actions: {
      marginTop: 22,
      gap: 12,
    },
        linkBtn: {
      alignItems: 'center',
      marginTop: 10,
          paddingVertical: 12,
          paddingHorizontal: 12,
    },
    linkText: {
      fontSize: 12,
      color: c.neutral.textMuted,
    },

    footerTagline: {
      fontSize: 12,
      color: c.neutral.textMuted,
      textAlign: 'center',
      marginTop: 20,
    },
  });
}

export default homeStyles;