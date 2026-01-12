import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { ImageBackground, Pressable, Text, TextInput, View, type ImageSourcePropType } from "react-native";

export type FontStyle = "bebas" | "playfair" | "archivo" | "marker" | "caveat" | "canela";
export type FontColor = "black" | "white";
export type FontSize = "small" | "medium" | "large" | "xlarge";
export type TextHighlight = "white" | "black";

export type BackgroundType =
  | "lime"
  | "pink"
  | "sunset"
  | "cyber"
  | "dark"
  | "golden"
  | "dreamy"
  | "cloudy"
  | "collage"
  | "floral"
  | "ocean"
  | "cotton"
  | "photo";

export interface Post {
  id: string;
  quote: string;
  attribution?: string;
  date: string;
  background: BackgroundType;
  font?: FontStyle;
  fontColor?: FontColor;
  fontSize?: FontSize;
  textHighlight?: TextHighlight;
  photoBackgroundUrl?: string; // Storage signed URL or public URL
  expandedText?: string;
  authorId?: string;
  authorLabel?: string;
  authorUsername?: string;
  authorAvatarUrl?: string; // signed URL
  promptId?: string;
  promptDate?: string; // YYYY-MM-DD (Pacific prompt/cycle date)
}

interface YimPostProps {
  post: Post;
  size?: "sm" | "md" | "lg";
  previewMode?: boolean;
  hideFooter?: boolean;
  onPress?: () => void;
  quotePlaceholder?: string;
  editableQuote?: boolean;
  onChangeQuote?: (value: string) => void;
  maxQuoteLength?: number;
  borderRadiusOverride?: number;
}

const IMAGE_BACKGROUNDS: Record<Exclude<BackgroundType, "photo">, ImageSourcePropType | null> = {
  lime: null,
  pink: null,
  sunset: null,
  cyber: null,
  dark: null,
  golden: require("../../assets/vibes/golden.jpg"),
  dreamy: require("../../assets/vibes/dreamy.jpg"),
  cloudy: require("../../assets/vibes/cloudy.jpg"),
  collage: require("../../assets/vibes/collage.jpg"),
  floral: require("../../assets/vibes/floral.jpg"),
  ocean: require("../../assets/vibes/ocean.jpg"),
  cotton: require("../../assets/vibes/cotton.jpg"),
};

// Design-matched gradients (see `/Users/goats/Desktop/ponderapp/yim app/src/index.css`).
const GRADIENTS: Record<
  Exclude<BackgroundType, "photo" | keyof typeof IMAGE_BACKGROUNDS>,
  readonly [string, string]
> = {
  // design.md: keep the lime hue consistent across the app.
  lime: ["hsl(82 85% 55%)", "hsl(82 85% 45%)"],
  pink: ["hsl(330 85% 60%)", "hsl(280 70% 50%)"],
  sunset: ["hsl(25 95% 55%)", "hsl(330 85% 60%)"],
  cyber: ["hsl(185 85% 55%)", "hsl(270 85% 65%)"],
  dark: ["hsl(0 0% 8%)", "hsl(0 0% 4%)"],
};

function getFontFamily(font: FontStyle) {
  switch (font) {
    case "playfair":
      return "PlayfairDisplay";
    case "archivo":
      return "ArchivoBlack";
    case "marker":
      return "PermanentMarker";
    case "caveat":
      return "Caveat";
    case "canela":
      return "Canela";
    case "bebas":
    default:
      return "BebasNeue";
  }
}

function getTextColor(fontColor: FontColor) {
  return fontColor === "black" ? "hsl(0 0% 4%)" : "hsl(60 9% 98%)";
}

function getBaseFontSize(size: "sm" | "md" | "lg") {
  return size === "sm" ? 16 : size === "lg" ? 32 : 28;
}

function getMinFontSize(size: "sm" | "md" | "lg") {
  return size === "sm" ? 10 : size === "lg" ? 18 : 14;
}

export function YimPost({
  post,
  size = "md",
  previewMode = false,
  hideFooter,
  onPress,
  quotePlaceholder,
  editableQuote,
  onChangeQuote,
  maxQuoteLength,
  borderRadiusOverride,
}: YimPostProps) {
  const fontFamily = getFontFamily(post.font ?? "bebas");
  const textColor = getTextColor(post.fontColor ?? "white");
  const shouldHideFooter = hideFooter ?? previewMode;
  const isQuoteEmpty = !post.quote?.trim?.();
  const displayQuote = isQuoteEmpty ? (quotePlaceholder ?? "") : post.quote;
  const isPlaceholder = isQuoteEmpty && !!quotePlaceholder;

  const background = useMemo(() => {
    if (post.background === "photo" && post.photoBackgroundUrl) {
      return { kind: "photo" as const, source: { uri: post.photoBackgroundUrl } as ImageSourcePropType };
    }

    const maybeImage = IMAGE_BACKGROUNDS[post.background as Exclude<BackgroundType, "photo">];
    if (maybeImage) return { kind: "image" as const, source: maybeImage };

    const gradient = GRADIENTS[post.background as keyof typeof GRADIENTS];
    return { kind: "gradient" as const, colors: gradient ?? GRADIENTS.dark };
  }, [post.background, post.photoBackgroundUrl]);

  const effectiveQuote = displayQuote ?? "";

  const maxFontSize = useMemo(() => getBaseFontSize(size), [size]);
  const minFontSize = useMemo(() => getMinFontSize(size), [size]);
  const [quoteSize, setQuoteSize] = useState<number>(() => getBaseFontSize(size));
  const [quoteBox, setQuoteBox] = useState<{ width: number; height: number } | null>(null);

  // Recalculate sizing when font changes (or size variant changes).
  useEffect(() => {
    setQuoteSize(getBaseFontSize(size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontFamily, size]);

  const quoteLineHeight = Math.round(quoteSize * 1.15);

  const cardPadding = size === "sm" ? 12 : size === "lg" ? 24 : 20;
  const borderRadius = borderRadiusOverride ?? (previewMode ? 16 : 51); // signature radius for posts

  const content = (
    <View
      style={{ borderRadius, padding: cardPadding }}
      className="relative aspect-square w-full overflow-hidden"
    >
      {/* Background */}
      {background.kind === "gradient" ? (
        <LinearGradient
          colors={[background.colors[0], background.colors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", inset: 0 }}
        />
      ) : (
        <ImageBackground
          source={background.source}
          style={{ position: "absolute", inset: 0 }}
          resizeMode="cover"
        >
          {/* Dark overlay for legibility */}
          <View style={{ position: "absolute", inset: 0 }} className="bg-black/20" />
        </ImageBackground>
      )}

      {/* Foreground */}
      <View className="flex-1">
        <View
          className="flex-1 items-center justify-center px-1"
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) setQuoteBox({ width, height });
          }}
        >
          {/* Optional highlight behind the quote */}
          {post.textHighlight ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                zIndex: 0,
                // Approximate “inline highlight” as a subtle rounded block behind the text.
                // We’ll refine highlight rendering once we implement the CreatePost editor.
                left: 12,
                right: 12,
                height: 48,
                borderRadius: 14,
                backgroundColor: post.textHighlight === "white" ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)",
              }}
            />
          ) : null}

          {/* Hidden measuring text to drive auto font-size (accounts for font changes + wrapping). */}
          <Text
            style={{
              position: "absolute",
              opacity: 0,
              zIndex: -1,
              width: "100%",
              paddingHorizontal: 0,
              fontFamily,
              fontSize: quoteSize,
              lineHeight: quoteLineHeight,
              textAlign: "center",
            }}
            onTextLayout={(e) => {
              if (!quoteBox) return;
              const totalHeight = (e.nativeEvent.lines ?? []).reduce((sum, line) => sum + (line.height ?? 0), 0);

              // Hysteresis thresholds to avoid oscillation.
              const shrinkThreshold = quoteBox.height * 0.92;
              const growThreshold = quoteBox.height * 0.55;

              if (totalHeight > shrinkThreshold && quoteSize > minFontSize) {
                setQuoteSize((prev) => Math.max(minFontSize, prev - 1));
                return;
              }

              if (totalHeight < growThreshold && quoteSize < maxFontSize) {
                setQuoteSize((prev) => Math.min(maxFontSize, prev + 1));
              }
            }}
          >
            {effectiveQuote}
          </Text>

          {editableQuote && onChangeQuote ? (
            <TextInput
              value={post.quote}
              onChangeText={(t) => {
                const next = maxQuoteLength ? t.slice(0, maxQuoteLength) : t;
                onChangeQuote(next);
              }}
              placeholder={quotePlaceholder}
              placeholderTextColor="rgba(255,255,255,0.65)"
              multiline
              scrollEnabled={false}
              textAlign="center"
              textAlignVertical="center"
              style={{
                zIndex: 1,
                width: "100%",
                fontFamily,
                fontSize: quoteSize,
                lineHeight: quoteLineHeight,
                color: textColor,
                opacity: isPlaceholder ? 0.55 : 1,
              }}
            />
          ) : (
            <Text
              style={{
                zIndex: 1,
                fontFamily,
                fontSize: quoteSize,
                lineHeight: quoteLineHeight,
                color: textColor,
                textAlign: "center",
                opacity: isPlaceholder ? 0.55 : 1,
              }}
            >
              {displayQuote}
            </Text>
          )}
        </View>

        {!shouldHideFooter ? (
          <View style={{ marginTop: 10 }} className="flex-row items-end justify-between">
            <View className="gap-1">
              {!!post.attribution ? (
                <Text style={{ fontFamily: "SpaceMono", color: textColor, fontSize: 12 }}>
                  — {post.attribution}
                </Text>
              ) : null}
              <Text style={{ fontFamily: "SpaceMono", color: textColor, fontSize: 10 }}>{post.date}</Text>
            </View>

            <Text style={{ fontFamily: "BebasNeue", color: textColor, fontSize: 16, letterSpacing: 2 }}>
              PONDER
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} className="w-full" accessibilityRole="button">
      {content}
    </Pressable>
  );
}


