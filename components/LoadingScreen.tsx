import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

export function LoadingScreen({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const timeouts = useRef<{ fade?: ReturnType<typeof setTimeout>; done?: ReturnType<typeof setTimeout> }>({});

  const spinInterpolate = useMemo(
    () =>
      spin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [spin]
  );

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
    // Always show loading screen for at least 2 seconds, then fade out over 500ms.
    const minDisplayTime = 2000;
    const startTime = Date.now();
    const remaining = Math.max(0, minDisplayTime - (Date.now() - startTime));

    timeouts.current.fade = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();

      timeouts.current.done = setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }, remaining);

    return () => {
      if (timeouts.current.fade) clearTimeout(timeouts.current.fade);
      if (timeouts.current.done) clearTimeout(timeouts.current.done);
    };
  }, [opacity]);

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
              source={require("../assets/vibes/pondr logo.png")}
              accessibilityLabel="pondr"
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
    backgroundColor: "#000",
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









