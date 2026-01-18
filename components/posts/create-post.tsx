import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { router, useNavigation } from "expo-router";
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
import { useQueryClient } from "@tanstack/react-query";

import { YimPost, type BackgroundType, type FontColor, type FontSize, type FontStyle, type Post } from "@/components/posts/yim-post";
import { FormattedText } from "@/components/prompts/formatted-text";
import { PostResponseRating } from "@/components/prompts/post-response-rating";
import { didRespondQueryKey, useDailyPrompt } from "@/hooks/useDailyPrompt";
import { createYimPost } from "@/hooks/useYimFeed";
import { deletePostDraft, getPostDraft, setPostDraft } from "@/lib/post-draft";
import { clearDevHasRespondedOverride } from "@/lib/prompt-store";
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
  existingPost?: Post;
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

export function CreatePost({ promptId, promptText, promptDate, existingPost, onPosted }: CreatePostProps) {
  const { user } = useAuth();
  const dailyPrompt = useDailyPrompt();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [step, setStep] = useState<Step>("content");
  const [quote, setQuote] = useState("");
  const [expandedText, setExpandedText] = useState("");

  const [background, setBackground] = useState<BackgroundType>("dark");
  const [font, setFont] = useState<FontStyle>("playfair");
  const [fontColor, setFontColor] = useState<FontColor>("white");
  const [fontSize] = useState<FontSize>("large");

  // Local preview URI for photo background. We upload on submit.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingPrompt, setRatingPrompt] = useState<{ id: string; prompt_text: string; prompt_date: string } | null>(null);

  function handleNavBack() {
    // Always return to feed and re-open the prompt popup so user lands on the question.
    router.replace({ pathname: "/(tabs)", params: { showPrompt: "1" } });
  }

  const isValid = useMemo(() => getIsValidQuote(quote), [quote]);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const saveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitInFlightRef = useRef(false);
  const contentScrollRef = useRef<ScrollView>(null);
  const [textInputHeight, setTextInputHeight] = useState(0);

  // Interactive swipe-back (Style -> Content)
  const swipeX = useRef(new Animated.Value(0)).current;
  const [isSwipingBack, setIsSwipingBack] = useState(false);
  // Animation for content -> style transition (swipe left)
  // Start style screen off-screen to the right (screenWidth)
  const styleSlideX = useRef(new Animated.Value(0)).current;
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
  
  // Track if we're transitioning to style (to keep content visible during transition)
  const [isTransitioningToStyle, setIsTransitioningToStyle] = useState(false);
  
  // Track if the step change came from user action (vs draft load)
  const isUserStepChange = useRef(false);
  
  // Initialize style screen position when step changes
  useEffect(() => {
    if (step === "style") {
      // Only animate if this was a user-initiated step change (not draft load)
      if (isUserStepChange.current) {
        setIsTransitioningToStyle(true);
        styleSlideX.setValue(screenWidth);
        Animated.timing(styleSlideX, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsTransitioningToStyle(false);
          styleSlideX.setValue(0); // Ensure value is synced after animation
        });
      } else {
        // Coming from draft - no animation, just show directly
        styleSlideX.setValue(0);
        setIsTransitioningToStyle(false);
      }
      isUserStepChange.current = false;
    } else {
      // Reset when going back to content
      setIsTransitioningToStyle(false);
      styleSlideX.setValue(0);
    }
  }, [step, screenWidth, styleSlideX]);

  // Only prompt responses are gated by duplicate prevention (no time windows).
  // When editing, we skip duplicate check since we delete the old post first.
  const canCreate = useMemo(() => {
    if (!promptId) return true;
    if (existingPost) return true; // Editing: will delete old post first
    // Prevent duplicate prompt responses (DB enforces this via unique constraint).
    return !dailyPrompt.hasResponded;
  }, [dailyPrompt.hasResponded, promptId, existingPost]);

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
      photoBackgroundUrl: photoUri ?? undefined,
      expandedText: expandedText.trim() ? expandedText : undefined,
      promptId: promptId ?? undefined,
    }),
    [background, expandedText, font, fontColor, fontSize, photoUri, promptId, quote]
  );

  // Used for background swatches: render ONLY the background (no caption letters).
  const swatchPostBase: Post = useMemo(
    () => ({
      ...previewPost,
      quote: "",
    }),
    [previewPost]
  );

  // Load existing post data or draft (best-effort) per user + promptId.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) {
      setIsDraftLoaded(true);
      return;
    }
    const ensuredUserId = userId;

    let cancelled = false;
    async function load() {
      // If editing, load existing post data first
      if (existingPost) {
        if (cancelled) return;
        setQuote(existingPost.quote ?? "");
        setExpandedText(existingPost.expandedText ?? "");
        setBackground(existingPost.background ?? "dark");
        setFont(existingPost.font ?? "playfair");
        setFontColor(existingPost.fontColor ?? "white");
        if (existingPost.photoBackgroundUrl) {
          setPhotoUri(existingPost.photoBackgroundUrl);
        }
        setStep("content"); // Start at content step when editing
        setIsDraftLoaded(true);
        return;
      }

      // Otherwise load draft
      const draft = await getPostDraft({ userId: ensuredUserId, promptId });
      if (cancelled) return;
      if (draft) {
        // Always start at content step, regardless of where draft was saved
        setStep("content");
        setQuote(draft.quote ?? "");
        setExpandedText(draft.expandedText ?? "");
        setBackground(draft.background ?? "dark");
        setFont(draft.font ?? "playfair");
        setFontColor(draft.fontColor ?? "white");
        setPhotoUri(draft.photoUri ?? null);
      }
      setIsDraftLoaded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [promptId, user?.id, existingPost]);

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
          photoUri,
          promptId,
          promptDate,
        },
      });
    }, 250);

    return () => {
      if (saveDraftTimerRef.current) clearTimeout(saveDraftTimerRef.current);
    };
  }, [background, expandedText, font, fontColor, isDraftLoaded, photoUri, promptDate, promptId, quote, step, user?.id]);

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
  }

  function renderContentBody(params?: { pointerEvents?: "none" | "auto" }) {
    return (
      <ScrollView 
        ref={contentScrollRef}
        className="flex-1" 
        contentContainerClassName="px-4 pb-24" 
        pointerEvents={params?.pointerEvents}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ paddingTop: insets.top + 16 }}
      >
        <View className="flex-1 gap-6">
          {/* Header with back button */}
          <View className="flex-row items-center">
            <Pressable
              onPress={handleNavBack}
              className="h-11 w-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ArrowLeft color="hsl(60 9% 98%)" size={22} />
            </Pressable>

            <View className="flex-1 items-center">
              <Text className="text-center font-display text-4xl text-foreground">Respond</Text>
            </View>

            {/* spacer to balance layout */}
            <View style={{ width: 44 }} />
          </View>

          {promptText ? (
            <View className="gap-3">
              <Text className="font-mono text-sm uppercase tracking-wider text-primary">Today's PONDER</Text>
              <FormattedText className="font-playfair text-3xl leading-tight text-foreground" boldClassName="font-playfair-semibold">{promptText}</FormattedText>
            </View>
          ) : null}

          <View className="flex-1">
            <TextInput
              value={expandedText}
              onChangeText={setExpandedText}
              onContentSizeChange={(e) => {
                const newHeight = e.nativeEvent.contentSize.height;
                if (newHeight > textInputHeight) {
                  // Content grew (new line added), scroll to bottom
                  contentScrollRef.current?.scrollToEnd({ animated: true });
                }
                setTextInputHeight(newHeight);
              }}
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
              You've already responded to this prompt.
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
    // When editing, skip duplicate check since we'll delete the old post
    if (!existingPost && promptId && dailyPrompt.hasResponded) {
      setErrorMessage("You already responded to today's prompt.");
      submitInFlightRef.current = false;
      return;
    }
    if (!existingPost && !canCreate) {
      setErrorMessage("You've already responded to this prompt.");
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
      // If editing, delete the old post first
      if (existingPost?.id) {
        const { error: deleteError } = await supabase.from("yim_posts").delete().eq("id", existingPost.id);
        if (deleteError) {
          console.error("[create-post] delete old post failed", deleteError);
          setErrorMessage("Failed to update post. Please try again.");
          setIsBusy(false);
          submitInFlightRef.current = false;
          return;
        }
      }

      let photoPath: string | undefined;
      if (photoUri) {
        // Upload photo (works for local files, data URIs, and signed URLs)
        // Note: When editing with existing photo (signed URL), this re-uploads it
        // Could be optimized to reuse storage path, but functional for now
        photoPath = await uploadPostPhoto({ userId: user.id, uri: photoUri });
      }

      const created = await createYimPost({
        quote: quote.trim(),
        attribution: "",
        background: photoPath ? "photo" : background,
        font,
        fontColor,
        fontSize,
        photoBackgroundPath: photoPath,
        expandedText: expandedText.trim() ? expandedText : undefined,
        promptId: promptId ?? undefined,
        promptDate: promptDate ?? undefined,
      });

      if (__DEV__) console.log("[create-post] created", { id: created.id });

      // Track post submission event
      try {
        await supabase.from("user_events").insert({
          user_id: user.id,
          event_type: "post_submit",
          event_name: "post_submit",
          metadata: {
            post_id: created.id,
            prompt_id: promptId ?? null,
          },
        });
      } catch (error) {
        // Non-critical
        if (__DEV__) console.warn("[create-post] post_submit event tracking failed", error);
      }

      // Dev reset-cycle sets a "has responded" override to false; once we successfully create
      // the response, clear that override so gating reflects the DB state.
      if (__DEV__ && user && promptId) {
        const dateKey = promptDate ?? dailyPrompt.prompt?.prompt_date;
        if (dateKey) {
          await clearDevHasRespondedOverride({ userId: user.id, promptId, promptDate: dateKey });
          await queryClient.invalidateQueries({ queryKey: ["devHasRespondedOverride"] });
        }
      }

      // Ensure the feed ungates immediately after posting.
      if (user && promptId) {
        await queryClient.invalidateQueries({ queryKey: didRespondQueryKey(user.id, promptId) });
      }
      await queryClient.invalidateQueries({ queryKey: ["dailyPrompt"] });

      onPosted?.(created);

      // Show rating modal after successful post
      const promptDateForRating =
        promptDate ?? dailyPrompt.prompt?.prompt_date ?? dailyPrompt.cycleDateKey ?? "";
      const promptTextForRating =
        promptText ?? dailyPrompt.prompt?.prompt_text ?? "Today's PONDER";
      setRatingPrompt({
        id: promptId ?? created.promptId ?? created.id,
        prompt_text: promptTextForRating,
        prompt_date: promptDateForRating,
      });
      setShowRatingModal(true);
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

  // Don't wait for draft to load - render immediately with default content
  // The draft will be applied once loaded
  return (
    <>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <View className="flex-1 bg-background" style={{ overflow: "hidden" }}>
        {/* Content step - always rendered when on content or transitioning to style */}
        {(step === "content" || isTransitioningToStyle) && (
          <View className="absolute inset-0 bg-background">
              {renderContentBody()}

            {/* Bottom action bar (Content step only) */}
            {step === "content" && (
              <View
                className="absolute bottom-0 left-0 right-0 border-t border-muted bg-background px-4 pt-4"
                style={{ paddingBottom: Math.max(16, insets.bottom + 12) }}
              >
                <Pressable
                  onPress={() => {
                    setErrorMessage(null);
                    isUserStepChange.current = true;
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
            )}
          </View>
        )}

        {/* Content step revealed during swipe back */}
        {step === "style" && isSwipingBack && (
          <Animated.View
            className="absolute inset-0"
            pointerEvents="none"
            style={{ 
              opacity: contentRevealOpacity,
              transform: [{ translateX: Animated.subtract(swipeX, screenWidth) }],
            }}
          >
            {renderContentBody({ pointerEvents: "none" })}
          </Animated.View>
        )}

        {/* Style step - render when step is style (including during transition for animation) */}
        {step === "style" && (
          <Animated.View
            className="flex-1 bg-background"
            style={{ 
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#0a0a0a",
              transform: [{ translateX: Animated.add(styleSlideX, swipeX) }]
            }}
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
                  // Immediately change step to hide style screen and show content
                  setStep("content");
                  Animated.parallel([
                    Animated.timing(swipeX, { toValue: screenWidth, duration: 140, useNativeDriver: true }),
                    Animated.timing(styleSlideX, { toValue: screenWidth, duration: 140, useNativeDriver: true }),
                  ]).start(() => {
                    swipeX.setValue(0);
                    styleSlideX.setValue(0);
                    setIsSwipingBack(false);
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
              onPanResponderGrant: () => {
                // Reset style slide position when starting swipe back
                styleSlideX.setValue(0);
              },
            }).panHandlers}
          >
            {/* Top bar (Style step) */}
            <View className="px-4 pb-4" style={{ paddingTop: insets.top + 10 }}>
              <View className="flex-row items-center">
                <Pressable
                    onPress={() => {
                      // Immediately change step to hide style screen
                      setStep("content");
                      // Animate back to content with swipe right
                      Animated.parallel([
                        Animated.timing(swipeX, { toValue: screenWidth, duration: 300, useNativeDriver: true }),
                        Animated.timing(styleSlideX, { toValue: screenWidth, duration: 300, useNativeDriver: true }),
                      ]).start(() => {
                        swipeX.setValue(0);
                        styleSlideX.setValue(0);
                      });
                    }}
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

            <ScrollView
              className="flex-1"
              style={{ flex: 1 }}
              contentContainerClassName="px-4 pb-28"
              keyboardDismissMode="on-drag"
            >
            <YimPost
              post={previewPost}
              editableQuote
              onChangeQuote={(t) => setQuote(t.slice(0, POST_MAX_CHARS))}
              quotePlaceholder="Preview text of your PONDER"
              maxQuoteLength={POST_MAX_CHARS}
            />

            {/* Background */}
            <View className="mt-6 gap-3">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Background</Text>

              {/* First row: Image backgrounds (7 items) */}
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
              </View>

              {/* Second row: Gradients + Add Picture button at bottom right */}
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
                
                {/* Add Picture button at bottom right */}
                <Pressable
                  onPress={() => void handlePickPhoto()}
                  disabled={isBusy}
                  className="h-12 w-12 items-center justify-center rounded-xl border border-white bg-card"
                  style={{ borderStyle: "dotted" }}
                >
                  {/* Larger plus icon for the “Upload your own photo” button */}
                  <Text
                    className="font-mono text-foreground"
                    // Explicit font metrics keep the "+" centered on iOS + Android.
                    style={{
                      fontSize: 32,
                      lineHeight: 32,
                      includeFontPadding: false,
                      textAlignVertical: "center" as const,
                        // Small nudge for consistent optical centering.
                        transform: [{ translateY: 2 }],
                    }}
                  >
                    +
                  </Text>
                </Pressable>
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
              {isBusy ? <ActivityIndicator /> : <Text className="font-mono text-xs uppercase tracking-wider text-background">Save</Text>}
            </Pressable>
          </View>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>

    {ratingPrompt ? (
      <PostResponseRating
        isVisible={showRatingModal}
        prompt={ratingPrompt}
        onClose={() => {
          setShowRatingModal(false);
          // Go back to feed without re-opening the prompt popup after rating
          router.replace("/(tabs)");
        }}
      />
    ) : null}
    </>
  );
}






