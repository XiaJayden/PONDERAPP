import { useEventTracking } from "@/hooks/useEventTracking";
import { supabase } from "@/lib/supabase";
import { getTodayPacificIsoDate } from "@/lib/timezone";
import { useAuth } from "@/providers/auth-provider";
import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type PromptPopupPrompt = {
  id: string;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string; // YYYY-MM-DD
  theme: string | null;
  display_order: number | null;
};

/**
 * Calculate optimal font size based on question length.
 */
function getQuestionFontSize(text: string): { fontSize: number; lineHeight: number } {
  const length = text.length;
  if (length < 50) return { fontSize: 36, lineHeight: 44 }; // Short - large and bold
  if (length < 100) return { fontSize: 30, lineHeight: 38 }; // Medium
  if (length < 180) return { fontSize: 24, lineHeight: 32 }; // Longer
  return { fontSize: 20, lineHeight: 28 }; // Very long - prioritize fit
}

/**
 * Full-screen prompt popup.
 *
 * Minimal, calm, typography-forward (design.md).
 */
export function PromptPopup({
  isVisible,
  prompt,
  onClose,
  onRespond,
}: {
  isVisible: boolean;
  prompt: PromptPopupPrompt;
  onClose: () => void;
  onRespond: () => void;
}) {
  const { user } = useAuth();
  const { trackEvent } = useEventTracking();
  const [screen, setScreen] = useState<"description" | "question">("description");
  const questionFontSize = getQuestionFontSize(prompt.prompt_text);
  
  // Feedback state
  const [rating, setRating] = useState<number | null>(null);
  const [wouldShare, setWouldShare] = useState<boolean | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Reset to description screen when popup opens
  useEffect(() => {
    if (isVisible) {
      setScreen("description");
      setRating(null);
      setWouldShare(null);
      setFeedbackSubmitted(false);
    }
  }, [isVisible]);

  // Submit feedback when rating or share intent changes
  useEffect(() => {
    if (!user || feedbackSubmitted) return;
    if (rating !== null || wouldShare !== null) {
      void submitFeedback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating, wouldShare]);

  async function submitFeedback() {
    if (!user || feedbackSubmitted) return;
    if (rating === null && wouldShare === null) return;

    try {
      const feedbackDate = getTodayPacificIsoDate();
      
      // Upsert feedback with prompt_id
      const { error } = await supabase.from("user_feedback").upsert(
        {
          user_id: user.id,
          feedback_date: feedbackDate,
          rating: rating ?? null,
          prompt_id: prompt.id,
          would_share: wouldShare ?? null,
          responses: {
            prompt_id: prompt.id,
            prompt_date: prompt.prompt_date,
          },
        },
        { onConflict: "user_id,feedback_date" }
      );

      if (error) {
        console.warn("[PromptPopup] feedback submit failed", error);
        return;
      }

      setFeedbackSubmitted(true);

      await trackEvent({
        event_type: "feedback_submit",
        event_name: "prompt_feedback_submit",
        metadata: {
          prompt_id: prompt.id,
          rating,
          would_share: wouldShare,
        },
      });
    } catch (error) {
      console.warn("[PromptPopup] feedback submit error", error);
    }
  }

  const renderScreen1 = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Today&apos;s Ponder</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeButton}
          hitSlop={10}
        >
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
      </View>
      <View style={styles.headerDivider} />
      <View style={styles.headerAccent} />

      {/* Content */}
      <View style={styles.content}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContentScreen1}
          showsVerticalScrollIndicator={false}
        >
          {/* Description text */}
          {!!prompt.explanation_text ? (
            <Text style={styles.explainer}>{prompt.explanation_text}</Text>
          ) : (
            <Text style={styles.explainer}>Take a moment. Read slowly. Then answer honestly.</Text>
          )}
        </ScrollView>
      </View>

      {/* Fixed bottom button */}
      <View style={styles.buttonContainer}>
        <Pressable
          onPress={() => setScreen("question")}
          accessibilityRole="button"
          style={styles.nextButton}
        >
          <Text style={styles.nextText}>Next</Text>
        </Pressable>
      </View>
    </>
  );

  const renderScreen2 = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Question</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.closeButton}
          hitSlop={10}
        >
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
      </View>
      <View style={styles.headerDivider} />
      <View style={styles.headerAccent} />

      {/* Back link */}
      <View style={styles.backContainer}>
        <Pressable
          onPress={() => setScreen("description")}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      {/* Centered content */}
      <View style={styles.content}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContentScreen2}
          showsVerticalScrollIndicator={false}
        >
          {/* Question text - centered */}
          <Text style={[styles.question, { fontSize: questionFontSize.fontSize, lineHeight: questionFontSize.lineHeight }]}>
            {prompt.prompt_text}
          </Text>

          {/* Feedback section */}
          <View style={styles.feedbackSection}>
            {/* Star rating */}
            <View style={styles.feedbackItem}>
              <Text style={styles.feedbackLabel}>Rate this question</Text>
              <View style={styles.starContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    accessibilityRole="button"
                    accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`}
                    style={styles.starButton}
                  >
                    <Text style={[styles.star, rating && star <= rating ? styles.starFilled : null]}>
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Share intent */}
            <View style={styles.feedbackItem}>
              <Text style={styles.feedbackLabel}>Would you share this with a friend?</Text>
              <View style={styles.thumbsContainer}>
                <Pressable
                  onPress={() => setWouldShare(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Yes, would share"
                  style={[styles.thumbButton, wouldShare === true && styles.thumbButtonActive]}
                >
                  <Text style={[styles.thumbIcon, wouldShare === true && styles.thumbIconActive]}>👍</Text>
                </Pressable>
                <Pressable
                  onPress={() => setWouldShare(false)}
                  accessibilityRole="button"
                  accessibilityLabel="No, would not share"
                  style={[styles.thumbButton, wouldShare === false && styles.thumbButtonActive]}
                >
                  <Text style={[styles.thumbIcon, wouldShare === false && styles.thumbIconActive]}>👎</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Fixed bottom button */}
      <View style={styles.buttonContainer}>
        <Pressable onPress={onRespond} accessibilityRole="button" style={styles.respondButton}>
          <Text style={styles.respondText}>Respond</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      // Match ExpandedPostModal behavior.
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        {screen === "description" ? renderScreen1() : renderScreen2()}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "hsl(0 0% 4%)" },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontFamily: "BebasNeue",
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.95)",
  },
  closeButton: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    fontSize: 22,
    lineHeight: 22,
    color: "rgba(255,255,255,0.55)",
  },
  headerDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginHorizontal: 24,
    marginTop: 8,
  },
  headerAccent: {
    height: 2,
    width: 56,
    marginLeft: 24,
    marginTop: 8,
    backgroundColor: "hsl(82 85% 55%)",
    borderRadius: 999,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContentScreen1: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 16,
  },
  scrollContentScreen2: {
    flexGrow: 1,
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 32,
  },
  explainer: {
    fontSize: 22,
    lineHeight: 32,
    color: "rgba(255,255,255,0.82)",
    fontFamily: "PlayfairDisplay",
    textAlign: "left",
  },
  backContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.70)",
    fontFamily: "SpaceMono",
  },
  question: {
    color: "rgba(255,255,255,0.95)",
    fontFamily: "PlayfairDisplay",
    textAlign: "center",
    maxWidth: 360,
    alignSelf: "center",
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  respondButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "hsl(82 85% 55%)",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  respondText: {
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(0,0,0,0.90)",
    fontFamily: "SpaceMono",
  },
  nextButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "hsl(82 85% 55%)",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  nextText: {
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(0,0,0,0.90)",
    fontFamily: "SpaceMono",
  },
  feedbackSection: {
    marginTop: 32,
    gap: 24,
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
  feedbackItem: {
    alignItems: "center",
    gap: 12,
  },
  feedbackLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.70)",
    fontFamily: "SpaceMono",
    textAlign: "center",
  },
  starContainer: {
    flexDirection: "row",
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 28,
    color: "rgba(255,255,255,0.30)",
  },
  starFilled: {
    color: "hsl(82 85% 55%)",
  },
  thumbsContainer: {
    flexDirection: "row",
    gap: 16,
  },
  thumbButton: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  thumbButtonActive: {
    borderColor: "hsl(82 85% 55%)",
    backgroundColor: "rgba(82, 85%, 55%, 0.15)",
  },
  thumbIcon: {
    fontSize: 24,
    opacity: 0.5,
  },
  thumbIconActive: {
    opacity: 1,
  },
});






