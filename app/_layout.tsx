import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from "expo-status-bar";

import { useColorScheme } from '@/components/useColorScheme';
import { AuthProvider } from '@/providers/auth-provider';
import { LoadingScreen } from '@/components/LoadingScreen';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { PlayfairDisplay_400Regular, PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { Caveat_400Regular, Caveat_600SemiBold } from '@expo-google-fonts/caveat';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Debug-friendly defaults: less “random” refetching while we build.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // UI fonts (design.md)
    BebasNeue: BebasNeue_400Regular,
    Inter: Inter_400Regular,
    InterMedium: Inter_500Medium,
    InterBold: Inter_700Bold,
    SpaceMono: SpaceMono_400Regular,
    SpaceMonoBold: SpaceMono_700Bold,

    // Post-only fonts (design.md)
    PlayfairDisplay: PlayfairDisplay_400Regular,
    PlayfairDisplaySemiBold: PlayfairDisplay_600SemiBold,
    ArchivoBlack: ArchivoBlack_400Regular,
    PermanentMarker: PermanentMarker_400Regular,
    Caveat: Caveat_400Regular,
    CaveatSemiBold: Caveat_600SemiBold,
    Canela: require('../assets/fonts/Canela-Regular-Trial.otf'),

    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Intentionally not awaited: we only need to trigger hide after fonts load.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <LoadingScreen>
      <RootLayoutNav />
    </LoadingScreen>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="light" />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="activity" options={{ headerShown: false, animation: "slide_from_right" }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
