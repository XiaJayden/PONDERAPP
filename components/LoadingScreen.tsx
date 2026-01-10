import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

export function LoadingScreen({
  children,
  isDataReady = true,
  minDisplayMs = 2000,
  maxWaitMs = 3000,
}: {
  children: React.ReactNode;
  isDataReady?: boolean;
  minDisplayMs?: number;
  maxWaitMs?: number;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isMinElapsed, setIsMinElapsed] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const timeouts = useRef<{
    min?: ReturnType<typeof setTimeout>;
    max?: ReturnType<typeof setTimeout>;
    done?: ReturnType<typeof setTimeout>;
  }>({});
  const hasStartedFade = useRef(false);

  const spinInterpolate = useMemo(
    () =>
      spin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [spin]
  );

  function startFadeOut() {
    if (hasStartedFade.current) return;
    hasStartedFade.current = true;

    Animated.timing(opacity, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start();

    timeouts.current.done = setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }

  useEffect(() => {
    // Rotating "cube" animation (simple 3D-ish square)
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    // Minimum time the overlay must be visible.
    timeouts.current.min = setTimeout(() => {
      setIsMinElapsed(true);
    }, minDisplayMs);

    // Best-effort cap: never block longer than maxWaitMs.
    timeouts.current.max = setTimeout(() => {
      startFadeOut();
    }, maxWaitMs);

    return () => {
      if (timeouts.current.min) clearTimeout(timeouts.current.min);
      if (timeouts.current.max) clearTimeout(timeouts.current.max);
      if (timeouts.current.done) clearTimeout(timeouts.current.done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    if (!isMinElapsed) return;
    if (!isDataReady) return;
    startFadeOut();
  }, [isDataReady, isLoading, isMinElapsed]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {isLoading ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.overlay, { opacity }]}
        >
          <View style={styles.logoWrap}>
            <Image
              source={require("../assets/vibes/PONDER logo.png")}
              accessibilityLabel="PONDER"
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Animated.View
            style={[
              styles.cube,
              {
                transform: [
                  { perspective: 600 },
                  { rotateY: spinInterpolate },
                  { rotateX: "18deg" },
                ],
              },
            ]}
          >
            <View style={styles.cubeInner} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    // design.md: avoid pure black.
    backgroundColor: "hsl(0 0% 4%)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  logoWrap: {
    marginBottom: 32,
  },
  logo: {
    height: 96,
    width: 220,
  },
  cube: {
    height: 48,
    width: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  cubeInner: {
    height: 18,
    width: 18,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});









