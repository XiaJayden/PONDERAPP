import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { YimPost, type BackgroundType, type FontColor, type FontSize, type FontStyle, type Post, type TextHighlight } from "@/components/posts/yim-post";
import { supabase } from "@/lib/supabase";
import { useDailyPrompt } from "@/hooks/useDailyPrompt";
import { createYimPost } from "@/hooks/useYimFeed";
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

const FONT_OPTIONS: Array<{ key: FontStyle; label: string }> = [
  { key: "playfair", label: "Elegant" },
  { key: "bebas", label: "BOLD" },
  { key: "archivo", label: "HEAVY" },
  { key: "marker", label: "Handwritten" },
  { key: "caveat", label: "Casual" },
  { key: "canela", label: "Canela" },
];

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

  // Only prompt responses are gated by time windows (matches web behavior).
  const canCreate = useMemo(() => {
    if (!promptId) return true;
    return dailyPrompt.isPromptAvailable && dailyPrompt.isInResponseWindow && dailyPrompt.isResponseWindowOpen;
  }, [dailyPrompt.isInResponseWindow, dailyPrompt.isPromptAvailable, dailyPrompt.isResponseWindowOpen, promptId]);

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
    if (!user) {
      setErrorMessage("Please log in.");
      return;
    }
    if (!isValid) {
      setErrorMessage("Your caption must be 1–120 characters.");
      return;
    }
    if (!canCreate) {
      setErrorMessage("Posting is currently closed for today’s prompt.");
      return;
    }
    if (isBusy) return;

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
      setErrorMessage(error instanceof Error ? error.message : "Failed to create post");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="px-4 pt-8 pb-24">
        {step === "content" ? (
          <View className="flex-1 gap-6">
            {promptText ? (
              <View className="gap-3">
                <Text className="font-mono text-xs uppercase tracking-wider text-primary">Today’s PONDR</Text>
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
                className="flex-1 p-4 text-base text-foreground"
                style={{ fontFamily: "SpaceMono", backgroundColor: "transparent" }}
              />
            </View>

            {!canCreate && promptId ? (
              <Text className="text-center font-mono text-xs text-muted-foreground">
                Prompt posting is closed (or not yet opened).
              </Text>
            ) : null}

            {!!errorMessage ? <Text className="font-mono text-xs text-destructive">{errorMessage}</Text> : null}
          </View>
        ) : (
          <View className="gap-6">
            <Text className="font-display text-3xl text-foreground">Style</Text>

            <YimPost
              post={previewPost}
              editableQuote
              onChangeQuote={(t) => setQuote(t.slice(0, POST_MAX_CHARS))}
              quotePlaceholder="Enter a caption here"
              maxQuoteLength={POST_MAX_CHARS}
            />

            {/* Background */}
            <View className="gap-3">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Vibe</Text>

              <View className="flex-row flex-wrap gap-2">
                {GRADIENT_BACKGROUNDS.map((bg) => (
                  <Pressable
                    key={bg}
                    onPress={() => {
                      setPhotoUri(null);
                      setBackground(bg);
                    }}
                    className={[
                      "h-10 w-10 rounded-xl border",
                      background === bg && !photoUri ? "border-foreground" : "border-muted",
                    ].join(" ")}
                  >
                    <View className="h-full w-full overflow-hidden rounded-xl">
                      <YimPost
                        post={{
                          ...previewPost,
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

              <View className="flex-row flex-wrap gap-2">
                {IMAGE_BACKGROUNDS.map(({ key }) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setPhotoUri(null);
                      setBackground(key);
                    }}
                    className={[
                      "h-10 w-10 rounded-xl border",
                      background === key && !photoUri ? "border-foreground" : "border-muted",
                    ].join(" ")}
                  >
                    <View className="h-full w-full overflow-hidden rounded-xl">
                      <YimPost
                        post={{
                          ...previewPost,
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
                  className="h-10 w-10 items-center justify-center rounded-xl border border-muted bg-card"
                >
                  <Text className="font-mono text-xs text-foreground">+</Text>
                </Pressable>
              </View>
            </View>

            {/* Font */}
            <View className="gap-3">
              <Text className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Font</Text>
              <View className="flex-row flex-wrap gap-2">
                {FONT_OPTIONS.map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => setFont(f.key)}
                    className={[
                      "rounded-xl border px-3 py-2",
                      font === f.key ? "border-primary bg-primary" : "border-muted bg-card",
                    ].join(" ")}
                  >
                    <Text
                      className={font === f.key ? "text-background" : "text-foreground"}
                      style={{ fontFamily: f.key === "bebas" ? "BebasNeue" : undefined }}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Font color */}
            <View className="gap-3">
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
            <View className="gap-3">
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

            {!!errorMessage ? <Text className="font-mono text-xs text-destructive">{errorMessage}</Text> : null}
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      <View className="absolute bottom-0 left-0 right-0 border-t border-muted bg-background px-4 py-4">
        {step === "content" ? (
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
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setStep("content")}
              className="flex-1 items-center justify-center rounded-xl border border-muted bg-background px-4 py-3"
            >
              <Text className="font-mono text-xs uppercase tracking-wider text-foreground">Back</Text>
            </Pressable>

            <Pressable
              onPress={() => void handleSubmit()}
              disabled={isBusy || !isValid || !canCreate}
              className={[
                "flex-1 items-center justify-center rounded-xl px-4 py-3",
                isBusy || !isValid || !canCreate ? "bg-muted" : "bg-primary",
              ].join(" ")}
            >
              {isBusy ? <ActivityIndicator /> : <Text className="font-mono text-xs uppercase tracking-wider text-background">Post</Text>}
            </Pressable>
          </View>
        )}
      </View>

    </KeyboardAvoidingView>
  );
}




