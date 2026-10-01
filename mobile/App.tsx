import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

import { initI18n, loadStoredLanguage } from './src/i18n';
import { startConnectivityMonitor } from './src/services/connectivity';
import { bindConnectivityToStore, restoreAuthState, useCaseStore } from './src/state/useCaseStore';
import { syncManager } from './src/services/syncManager';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

/** Status bar follows the active app theme (not just the OS). */
function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const setStoreLanguage = useCaseStore((s) => s.setLanguage);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initI18n(); // i18next resources (SW/EN, default Swahili)
      await restoreAuthState(); // Restore persisted auth session
      const stored = await loadStoredLanguage();
      if (!cancelled && fontsLoaded) {
        setStoreLanguage(stored);
        setReady(true);
      }
      // Connectivity: real (NetInfo) + dev toggle, offline queue flushes on reconnect.
      startConnectivityMonitor();
      bindConnectivityToStore();
      syncManager.start();
      void syncManager.flushPendingQueue();
    })();
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, setStoreLanguage]);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedStatusBar />
        <BootGate ready={ready} />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

/** Holds a themed splash until i18n + stored language are ready. */
function BootGate({ ready }: { ready: boolean }) {
  const { colors } = useTheme();
  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.neutral.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return <RootNavigator />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
