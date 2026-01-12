import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

// Preload the logo image so it's ready immediately
const logoSource = require("../assets/vibes/ponder-logo.png");
Image.prefetch && Image.resolveAssetSource && Image.prefetch(Image.resolveAssetSource(logoSource).uri).catch(() => {});

// Tesseract / Hypercube - 3D line art
function Tesseract() {
  const outer = 52;
  const inner = 28;
  const stroke = 1;
  const offset = (outer - inner) / 2;
  
  // Colors for depth effect
  const outerColor = "rgba(255, 255, 255, 0.9)";
  const innerColor = "rgba(255, 255, 255, 0.5)";
  const lineColor = "rgba(255, 255, 255, 0.35)";
  
  // Diagonal line length for connecting edges
  const diagLength = Math.sqrt(offset * offset + offset * offset);
  
  return (
    <View style={{ width: outer, height: outer }}>
      {/* Outer cube (front) */}
      <View
        style={{
          position: "absolute",
          width: outer,
          height: outer,
          borderWidth: stroke,
          borderColor: outerColor,
        }}
      />
      
      {/* Inner cube (back/nested) */}
      <View
        style={{
          position: "absolute",
          width: inner,
          height: inner,
          borderWidth: stroke,
          borderColor: innerColor,
          top: offset,
          left: offset,
        }}
      />
      
      {/* Connecting edges - top-left */}
      <View
        style={{
          position: "absolute",
          width: diagLength,
          height: stroke,
          backgroundColor: lineColor,
          top: offset / 2,
          left: offset / 2,
          transform: [{ rotate: "45deg" }],
          transformOrigin: "left center",
        }}
      />
      
      {/* Connecting edges - top-right */}
      <View
        style={{
          position: "absolute",
          width: diagLength,
          height: stroke,
          backgroundColor: lineColor,
          top: offset / 2,
          right: offset / 2,
          transform: [{ rotate: "-45deg" }],
          transformOrigin: "right center",
        }}
      />
      
      {/* Connecting edges - bottom-left */}
      <View
        style={{
          position: "absolute",
          width: diagLength,
          height: stroke,
          backgroundColor: lineColor,
          bottom: offset / 2,
          left: offset / 2,
          transform: [{ rotate: "-45deg" }],
          transformOrigin: "left center",
        }}
      />
      
      {/* Connecting edges - bottom-right */}
      <View
        style={{
          position: "absolute",
          width: diagLength,
          height: stroke,
          backgroundColor: lineColor,
          bottom: offset / 2,
          right: offset / 2,
          transform: [{ rotate: "45deg" }],
          transformOrigin: "right center",
        }}
      />
      
      {/* Cross diagonals through center for tesseract depth */}
      <View
        style={{
          position: "absolute",
          width: outer * 1.1,
          height: stroke * 0.5,
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          top: outer / 2,
          left: -outer * 0.05,
          transform: [{ rotate: "45deg" }],
          transformOrigin: "center center",
        }}
      />
      <View
        style={{
          position: "absolute",
          width: outer * 1.1,
          height: stroke * 0.5,
          backgroundColor: "rgba(255, 255, 255, 0.15)",
          top: outer / 2,
          left: -outer * 0.05,
          transform: [{ rotate: "-45deg" }],
          transformOrigin: "center center",
        }}
      />
    </View>
  );
}

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

  // useLayoutEffect ensures animation starts before first paint
  useLayoutEffect(() => {
    // Rotating tesseract animation
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4000,
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
              source={logoSource}
              accessibilityLabel="PONDER"
              style={styles.logo}
              resizeMode="contain"
              fadeDuration={0}
            />
          </View>

          <Animated.View
            style={[
              styles.cubeContainer,
              {
                transform: [
                  { perspective: 1000 },
                  { rotateY: spinInterpolate },
                  { rotateX: "20deg" },
                  { rotateZ: "5deg" },
                ],
              },
            ]}
          >
            <Tesseract />
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
    marginBottom: 40,
  },
  logo: {
    height: 96,
    width: 220,
  },
  cubeContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});









