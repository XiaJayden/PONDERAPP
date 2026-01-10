import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { YimPost, type BackgroundType, type FontColor, type FontSize, type FontStyle, type Post, type TextHighlight } from "@/components/posts/yim-post";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { createYimPost } from "@/hooks/useYimFeed";
import { deletePostDraft, getPostDraft, setPostDraft } from "@/lib/post-draft";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/auth-provider";

/**
 * Two-step post creator (Content → Style), modeled after the web MVP.
 *
 * Debug friendliness:
 * - We keep logs around uploads and submission for easier Supabase/RLS debugging.
 * - We prefer early returns for validation (project rule).
 */

type Step = "content" | "style";

interface CreatePostProps {
  promptId?: string;
  promptText?: string;
  promptDate?: string;
  onPosted?: (created: Post) => void;
}

const POST_MAX_CHARS = 120;

// Use short names of the actual font families (per request).
const FONT_OPTIONS: Array<{ key: FontStyle; label: string }> = [
  { key: "playfair", label: "playfair" },
  { key: "bebas", label: "bebas" },
  { key: "archivo", label: "archivo" },
  { key: "marker", label: "marker" },
  { key: "caveat", label: "caveat" },
  { key: "canela", label: "canela" },
];

function getFontButtonTextStyle(font: FontStyle) {
  // Font buttons should be vertically centered + not clipped (esp. Caveat).
  const fontSize = 16;
  const lineHeight = font === "caveat" ? 22 : 20;
  return {
    fontFamily: getFontFamilyForPreview(font),
    fontSize,
    lineHeight,
    includeFontPadding: false as const, // helps Android vertical centering/clipping
    textAlign: "center" as const,
  };
}

const GRADIENT_BACKGROUNDS: BackgroundType[] = ["dark", "lime", "pink", "sunset", "cyber"];
const IMAGE_BACKGROUNDS: Array<{ key: BackgroundType; label: string }> = [
  { key: "golden", label: "Golden" },
  { key: "dreamy", label: "Dreamy" },
  { key: "floral", label: "Floral" },
  { key: "ocean", label: "Ocean" },
  { key: "cotton", label: "Cotton" },
  { key: "cloudy", label: "Cloudy" },
  { key: "collage", label: "Collage" },
];

function getFontFamilyForPreview(font: FontStyle) {
  // Keep in sync with `components/posts/yim-post.tsx` font mapping.
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

function getIsValidQuote(quote: string) {
  const len = quote.trim().length;
  return len >= 1 && len <= POST_MAX_CHARS;
}

async function uploadPostPhoto(params: { userId: string; uri: string }) {
  // Bucket matches the web app: `post-photos`
  const filePath = `post-photos/${params.userId}/${Date.now()}.jpg`;

  if (__DEV__) console.log("[create-post] uploadPostPhoto start", { filePath });

  const response = await fetch(params.uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage.from("post-photos").upload(filePath, arrayBuffer, {
    contentType: "image/jpeg",
    upsert: true,
  });

  if (error) {
    console.error("[create-post] uploadPostPhoto failed", error);
    throw error;
  }

  if (__DEV__) console.log("[create-post] uploadPostPhoto success", { filePath });
  return filePath;
}

export function CreatePost({ promptId, promptText, promptDate, onPosted }: CreatePostProps) {
  const { user } = useAuth();
  const dailyPrompt = useDailyPrompt();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("content");
  const [quote, setQuote] = useState("");
  const [expandedText, setExpandedText] = useState("");

  const [background, setBackground] = useState<BackgroundType>("dark");
  const [font, setFont] = useState<FontStyle>("playfair");
  const [fontColor, setFontColor] = useState<FontColor>("white");
  const [fontSize] = useState<FontSize>("large");
  const [textHighlight, setTextHighlight] = useState<TextHighlight | null>(null);

  // Local preview URI for photo background. We upload on submit.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValid = useMemo(() => getIsValidQuote(quote), [quote]);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const saveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitInFlightRef = useRef(false);

  // Interactive swipe-back (Style -> Content)
  const swipeX = useRef(new Animated.Value(0)).current;
  const [isSwipingBack, setIsSwipingBack] = useState(false);
  const screenWidth = useMemo(() => Dimensions.get("window").width, []);
  const contentRevealOpacity = useMemo(
    () =>
      swipeX.interpolate({
        inputRange: [0, screenWidth * 0.35],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
    [screenWidth, swipeX]
  );

  // Only prompt responses are gated by time windows (matches web behavior).
  const canCreate = useMemo(() => {
    if (!promptId) return true;
    // Also prevent duplicate prompt responses (DB enforces this via unique constraint).
    if (dailyPrompt.hasResponded) return false;
    return dailyPrompt.isPromptAvailable && dailyPrompt.isInResponseWindow && dailyPrompt.isResponseWindowOpen;
  }, [dailyPrompt.hasResponded, dailyPrompt.isInResponseWindow, dailyPrompt.isPromptAvailable, dailyPrompt.isResponseWindowOpen, promptId]);

  const previewPost: Post = useMemo(
    () => ({
      id: "preview",
      quote,
      attribution: "",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      background: photoUri ? "photo" : background,
      font,
      fontColor,
      fontSize,
      textHighlight: textHighlight ?? undefined,
      photoBackgroundUrl: photoUri ?? undefined,
      expandedText: expandedText.trim() ? expandedText : undefined,
      promptId: promptId ?? undefined,
    }),
    [background, expandedText, font, fontColor, fontSize, photoUri, promptId, quote, textHighlight]
  );

  // Used for background swatches: render ONLY the background (no caption letters).
  const swatchPostBase: Post = useMemo(
    () => ({
      ...previewPost,
      quote: "",
      // Ensure highlight doesn’t render over swatches
      textHighlight: undefined,
    }),
    [previewPost]
  );

  // Load draft (best-effort) per user + promptId.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setIsDraftLoaded(true);
      return;
    }
    const ensuredUserId = userId;

    let cancelled = false;
    async function load() {
      const draft = await getPostDraft({ userId: ensuredUserId, promptId });
      if (cancelled) return;
      if (draft) {
        setStep(draft.step);
        setQuote(draft.quote ?? "");
        setExpandedText(draft.expandedText ?? "");
        setBackground(draft.background ?? "dark");
        setFont(draft.font ?? "playfair");
        setFontColor(draft.fontColor ?? "white");
        setTextHighlight(draft.textHighlight ?? null);
        setPhotoUri(draft.photoUri ?? null);
      }
      setIsDraftLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [promptId, user?.id]);

  // Auto-save draft (debounced). Draft persists until user deletes it.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    if (!isDraftLoaded) return;
    const ensuredUserId = userId;

    const isEmptyDraft =
      step === "content" &&
      !quote.trim() &&
      !expandedText.trim() &&
      background === "dark" &&
      font === "playfair" &&
      fontColor === "white" &&
      textHighlight == null &&
      !photoUri;

    if (isEmptyDraft) return;

    if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    saveDraftTimerRef.current = setTimeout(() => {
      void setPostDraft({
        userId: ensuredUserId,
        promptId,
        draft: {
          step,
          quote,
          expandedText,
          background,
          font,
          fontColor,
          textHighlight,
          photoUri,
          promptId,
          promptDate,
        },
      });
    }, 250);

    return () => {
      if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    };
  }, [background, expandedText, font, fontColor, isDraftLoaded, photoUri, promptDate, promptId, quote, step, textHighlight, user?.id]);

  async function handleDeleteDraft() {
    const userId = user?.id;
    if (!userId) return;
    await deletePostDraft({ userId, promptId });
    setErrorMessage(null);
    setQuote("");
    setExpandedText("");
    setPhotoUri(null);
    setBackground("dark");
    setFont("playfair");
    setFontColor("white");
    setTextHighlight(null);
  }

  function renderContentBody(params?: { pointerEvents?: "none" | "auto" }) {
    return (
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-8 pb-24" pointerEvents={params?.pointerEvents}>
        <View className="flex-1 gap-6">
          {promptText ? (
            <View className="gap-3">
              <Text className="font-mono text-sm uppercase tracking-wider text-primary">Today's PONDER</Text>
              <Text className="font-playfair text-3xl leading-tight text-foreground">{promptText}</Text>
            </View>
          ) : null}

          <View className="flex-1">
            <TextInput
              value={expandedText}
              onChangeText={setExpandedText}
              placeholder="What do you think?"
              placeholderTextColor="hsl(0 0% 55%)"
              multiline
              textAlignVertical="top"
              className="flex-1 pt-4 pr-4 pb-4 text-[17px] text-foreground"
              style={{ fontFamily: "SpaceMono", backgroundColor: "transparent", paddingLeft: 0, lineHeight: 24 }}
            />
          </View>

          {!canCreate && promptId ? (
            <Text className="text-center font-mono text-xs text-muted-foreground">
              Prompt posting is closed (or not yet opened).
            </Text>
          ) : null}

          {!!errorMessage ? <Text className="font-mono text-xs text-destructive">{errorMessage}</Text> : null}
        </View>
      </ScrollView>
    );
  }

  async function handlePickPhoto() {
    setErrorMessage(null);
    setIsBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (res.canceled) return;
      const uri = res.assets?.[0]?.uri;
      if (!uri) return;
      setPhotoUri(uri);
      setBackground("photo");
    } catch (error) {
      console.error("[create-post] pick photo failed", error);
      setErrorMessage("Failed to pick photo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSubmit() {
    // Guard against double-submit (e.g. swipe + button) before React state updates.
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    if (!user) {
      setErrorMessage("Please log in.");
      submitInFlightRef.current = false;
      return;
    }
    if (!isValid) {
      setErrorMessage("Your caption must be 1–120 characters.");
      submitInFlightRef.current = false;
      return;
    }
    if (promptId && dailyPrompt.hasResponded) {
      setErrorMessage("You already responded to today’s prompt.");
      submitInFlightRef.current = false;
      return;
    }
    if (!canCreate) {
      setErrorMessage("Posting is currently closed for today’s prompt.");
      submitInFlightRef.current = false;
      return;
    }
    if (isBusy) {
      submitInFlightRef.current = false;
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      let photoPath: string | undefined;
      if (photoUri) {
        photoPath = await uploadPostPhoto({ userId: user.id, uri: photoUri });
      }

      const created = await createYimPost({
        quote: quote.trim(),
        attribution: "",
        background: photoPath ? "photo" : background,
        font,
        fontColor,
        fontSize,
        textHighlight: textHighlight ?? undefined,
        photoBackgroundPath: photoPath,
        expandedText: expandedText.trim() ? expandedText : undefined,
        promptId: promptId ?? undefined,
        promptDate: promptDate ?? undefined,
      });

      if (__DEV__) console.log("[create-post] created", { id: created.id });
      onPosted?.(created);
    } catch (error) {
      console.error("[create-post] submit failed", error);
      const code = (error as any)?.code;
      if (code === "23505") {
        // Unique constraint violation: already posted for this prompt.
        setErrorMessage("You already responded to today’s prompt.");
      } else {
        setErrorMessage(error instanceof Error ? error.message : "Failed to create post");
      }
    } finally {
      setIsBusy(false);
      submitInFlightRef.current = false;
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      {step === "content" ? (
        <>
          {renderContentBody()}

          {/* Bottom action bar (Content step only) */}
          <View
            className="absolute bottom-0 left-0 right-0 border-t border-muted bg-background px-4 pt-4"
            style={{ paddingBottom: Math.max(16, insets.bottom + 12) }}
          >
            <Pressable
              onPress={() => {
                setErrorMessage(null);
                setStep("style");
              }}
              disabled={isBusy || (promptId ? !canCreate : false)}
              className={[
                "w-full items-center justify-center rounded-xl px-4 py-3",
                isBusy || (promptId ? !canCreate : false) ? "bg-muted" : "bg-primary",
              ].join(" ")}
            >
              <Text className="font-mono text-xs uppercase tracking-wider text-background">Next</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <View className="flex-1">
          {/* Underlay: Content step revealed during swipe */}
          <Animated.View
            className="absolute inset-0"
            pointerEvents="none"
            style={{ opacity: contentRevealOpacity }}
          >
            {renderContentBody({ pointerEvents: "none" })}
          </Animated.View>

          {/* Overlay: Style step that translates with swipe */}
          <Animated.View
            className="flex-1 bg-background"
            style={{ transform: [{ translateX: swipeX }] }}
            {...PanResponder.create({
              onMoveShouldSetPanResponder: (_evt, gesture) => {
                const dx = gesture.dx;
                const dy = gesture.dy;
                // Only start interactive back swipe when moving right.
                if (dx < 12) return false;
                if (Math.abs(dy) > 35) return false;
                return dx > Math.abs(dy) * 1.2;
              },
              onPanResponderMove: (_evt, gesture) => {
                const dx = Math.max(0, gesture.dx);
                if (dx > 0 && !isSwipingBack) setIsSwipingBack(true);
                swipeX.setValue(Math.min(dx, screenWidth));
              },
              onPanResponderRelease: (_evt, gesture) => {
                const dx = Math.max(0, gesture.dx);
                const shouldGoBack = dx > screenWidth * 0.33;
                if (shouldGoBack) {
                  Animated.timing(swipeX, { toValue: screenWidth, duration: 140, useNativeDriver: true }).start(() => {
                    swipeX.setValue(0);
                    setIsSwipingBack(false);
                    setStep("content");
                  });
                } else {
                  Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start(() => {
                    setIsSwipingBack(false);
                  });
                }
              },
              onPanResponderTerminate: () => {
                Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start(() => {
                  setIsSwipingBack(false);
                });
              },
            }).panHandlers}
          >
            {/* Top bar (Style step) */}
            <View className="px-4 pt-6 pb-4">
              <View className="flex-row items-center">
                <Pressable
                  onPress={() => setStep("content")}
                  className="h-11 w-11 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Back"
                >
                  <ArrowLeft color="hsl(60 9% 98%)" size={22} />
                </Pressable>

                <View className="flex-1 items-center justify-center">
                  <Text className="text-center font-display text-4xl text-foreground">Style</Text>
                </View>

                <Pressable
                  onPress={() => void handleDeleteDraft()}
                  className="h-11 w-11 items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Delete draft"
                >
                  <Trash2 color="hsl(0 84% 60%)" size={22} />
                </Pressable>
              </View>
            </View>

            <ScrollView className="flex-1" contentContainerClassName="px-4 pb-28">
            <YimPost
              post={previewPost}
              editableQuote
              onChangeQuote={(t) => setQuote(t.slice(0, POST_MAX_CHARS))}
              quotePlaceholder="Enter a caption here"
              maxQuoteLength={POST_MAX_CHARS}
            />

            {/* Background */}
            <View className="mt-6 gap-3">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Background</Text>

              {/* Order: left→right, top→bottom. First row should contain 8 options (7 image + photo). */}
              <View className="flex-row flex-wrap gap-2">
                {IMAGE_BACKGROUNDS.map(({ key }) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setPhotoUri(null);
                      setBackground(key);
                    }}
                    className={[
                      "h-12 w-12 rounded-xl border",
                      background === key && !photoUri ? "border-foreground" : "border-muted",
                    ].join(" ")}
                  >
                    <View className="h-full w-full overflow-hidden rounded-xl">
                      <YimPost
                        post={{
                          ...swatchPostBase,
                          id: `bg-${key}`,
                          background: key,
                          photoBackgroundUrl: undefined,
                        }}
                        size="sm"
                        previewMode
                        hideFooter
                        borderRadiusOverride={12}
                      />
                    </View>
                  </Pressable>
                ))}

                <Pressable
                  onPress={() => void handlePickPhoto()}
                  disabled={isBusy}
                  className="h-12 w-12 items-center justify-center rounded-xl border border-muted bg-card"
                >
                  <Text className="font-mono text-xs text-foreground">+</Text>
                </Pressable>
              </View>

              {/* Second row: 5 gradients */}
              <View className="flex-row flex-wrap gap-2">
                {GRADIENT_BACKGROUNDS.map((bg) => (
                  <Pressable
                    key={bg}
                    onPress={() => {
                      setPhotoUri(null);
                      setBackground(bg);
                    }}
                    className={[
                      "h-12 w-12 rounded-xl border",
                      background === bg && !photoUri ? "border-foreground" : "border-muted",
                    ].join(" ")}
                  >
                    <View className="h-full w-full overflow-hidden rounded-xl">
                      <YimPost
                        post={{
                          ...swatchPostBase,
                          id: `bg-${bg}`,
                          background: bg,
                          photoBackgroundUrl: undefined,
                        }}
                        size="sm"
                        previewMode
                        hideFooter
                        borderRadiusOverride={12}
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Font */}
            <View className="mt-6 gap-3">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Font</Text>
              <View className="flex-row flex-wrap gap-2">
                {FONT_OPTIONS.map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => setFont(f.key)}
                    className={[
                      "h-11 items-center justify-center rounded-xl border px-3",
                      font === f.key ? "border-primary bg-primary" : "border-muted bg-card",
                    ].join(" ")}
                  >
                    <Text
                      numberOfLines={1}
                      className={font === f.key ? "text-background" : "text-foreground"}
                      style={getFontButtonTextStyle(f.key)}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Font color */}
            <View className="mt-6 gap-3">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Font Color</Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setFontColor("white")}
                  className={[
                    "h-10 w-10 rounded-xl border",
                    fontColor === "white" ? "border-primary" : "border-muted",
                  ].join(" ")}
                  style={{ backgroundColor: "#ffffff" }}
                />
                <Pressable
                  onPress={() => setFontColor("black")}
                  className={[
                    "h-10 w-10 rounded-xl border",
                    fontColor === "black" ? "border-primary" : "border-muted",
                  ].join(" ")}
                  style={{ backgroundColor: "#000000" }}
                />
              </View>
            </View>

            {/* Highlight */}
            <View className="mt-6 gap-3">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Text Highlight</Text>
              <View className="flex-row gap-2">
                {(["white", "black"] as TextHighlight[]).map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => setTextHighlight((prev) => (prev === h ? null : h))}
                    className={[
                      "rounded-xl border px-3 py-2",
                      textHighlight === h ? "border-primary bg-primary" : "border-muted bg-card",
                    ].join(" ")}
                  >
                    <Text className={textHighlight === h ? "font-mono text-xs text-background" : "font-mono text-xs text-foreground"}>
                      {h}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setTextHighlight(null)}
                  className={[
                    "rounded-xl border px-3 py-2",
                    !textHighlight ? "border-primary bg-primary" : "border-muted bg-card",
                  ].join(" ")}
                >
                  <Text className={!textHighlight ? "font-mono text-xs text-background" : "font-mono text-xs text-foreground"}>
                    none
                  </Text>
                </Pressable>
              </View>
            </View>

            {!!errorMessage ? <Text className="mt-6 font-mono text-xs text-destructive">{errorMessage}</Text> : null}
          </ScrollView>

          {/* Bottom Post button (Style step). */}
          <View
            className="absolute bottom-0 left-0 right-0 border-t border-muted bg-background/95 px-4 pt-4"
            style={{ paddingBottom: Math.max(16, insets.bottom + 12) }}
          >
            <Pressable
              onPress={() => void handleSubmit()}
              disabled={isBusy || !isValid || !canCreate}
              className={[
                "w-full items-center justify-center rounded-xl px-4 py-3",
                isBusy || !isValid || !canCreate ? "bg-muted" : "bg-primary",
              ].join(" ")}
            >
              {isBusy ? <ActivityIndicator /> : <Text className="font-mono text-xs uppercase tracking-wider text-background">Post</Text>}
            </Pressable>
          </View>
          </Animated.View>
        </View>
      )}

    </KeyboardAvoidingView>
  );
}






