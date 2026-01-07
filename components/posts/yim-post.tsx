import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { ImageBackground, Pressable, Text, View, type ImageSourcePropType } from "react-native";

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
}

interface YimPostProps {
  post: Post;
  size?: "sm" | "md" | "lg";
  previewMode?: boolean;
  hideFooter?: boolean;
  onPress?: () => void;
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
  lime: ["hsl(82 85% 55%)", "hsl(120 70% 45%)"],
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

function getFontSize(fontSize: FontSize, size: "sm" | "md" | "lg") {
  // Approximate web sizing (not pixel-identical, but keeps hierarchy).
  const bySize = {
    sm: { small: 12, medium: 14, large: 16, xlarge: 16 },
    md: { small: 16, medium: 22, large: 28, xlarge: 28 },
    lg: { small: 18, medium: 26, large: 32, xlarge: 32 },
  } as const;

  return bySize[size][fontSize];
}

export function YimPost({
  post,
  size = "md",
  previewMode = false,
  hideFooter,
  onPress,
}: YimPostProps) {
  const fontFamily = getFontFamily(post.font ?? "bebas");
  const textColor = getTextColor(post.fontColor ?? "white");
  const quoteSize = getFontSize(post.fontSize ?? "medium", size);
  const shouldHideFooter = hideFooter ?? previewMode;

  const background = useMemo(() => {
    if (post.background === "photo" && post.photoBackgroundUrl) {
      return { kind: "photo" as const, source: { uri: post.photoBackgroundUrl } as ImageSourcePropType };
    }

    const maybeImage = IMAGE_BACKGROUNDS[post.background as Exclude<BackgroundType, "photo">];
    if (maybeImage) return { kind: "image" as const, source: maybeImage };

    const gradient = GRADIENTS[post.background as keyof typeof GRADIENTS];
    return { kind: "gradient" as const, colors: gradient ?? GRADIENTS.dark };
  }, [post.background, post.photoBackgroundUrl]);

  const cardPadding = size === "sm" ? 12 : size === "lg" ? 24 : 20;
  const borderRadius = previewMode ? 16 : 51; // signature radius for posts

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
        <View className="flex-1 items-center justify-center px-1">
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

          <Text
            style={{
              zIndex: 1,
              fontFamily,
              fontSize: quoteSize,
              lineHeight: Math.round(quoteSize * 1.15),
              color: textColor,
              textAlign: "center",
            }}
          >
            {post.quote}
          </Text>
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
              PONDR
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


