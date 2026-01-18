import React, { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PromptRatingForm } from "./prompt-rating-form";
import { useEventTracking } from "@/hooks/useEventTracking";
import { useAuth } from "@/providers/auth-provider";
import { getTodayPacificIsoDate } from "@/lib/timezone";
import { supabase } from "@/lib/supabase";

export interface PostResponseRatingProps {
  isVisible: boolean;
  prompt: { id: string; prompt_text: string; prompt_date: string };
  onClose: () => void;
}

/**
 * Post-response rating modal shown after a user submits their answer.
 */
export function PostResponseRating({ isVisible, prompt, onClose }: PostResponseRatingProps) {
  const { user } = useAuth();
  const { trackEvent } = useEventTracking();

  const [rating, setRating] = useState<number | null>(null);
  const [wouldShare, setWouldShare] = useState<boolean | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Reset when opened
  useEffect(() => {
    if (isVisible) {
      setRating(null);
      setWouldShare(null);
      setFeedbackSubmitted(false);
    }
  }, [isVisible]);

  // Auto-submit when a choice is made
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
        console.warn("[PostResponseRating] feedback submit failed", error);
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
      console.warn("[PostResponseRating] feedback submit error", error);
    }
  }

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Thanks for responding</Text>
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
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.promptLabel}>Yesterday&apos;s Ponder</Text>
            <Text style={styles.question}>{prompt.prompt_text}</Text>

            <PromptRatingForm
              rating={rating}
              onChangeRating={setRating}
              wouldShare={wouldShare}
              onChangeWouldShare={setWouldShare}
            />
          </ScrollView>
        </View>

        {/* Footer */}
        <View style={styles.buttonContainer}>
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.primaryButton}>
            <Text style={styles.primaryText}>Finish</Text>
          </Pressable>
        </View>
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
    fontSize: 28,
    lineHeight: 32,
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
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 16,
  },
  promptLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.60)",
    fontFamily: "SpaceMono",
  },
  question: {
    fontSize: 22,
    lineHeight: 30,
    color: "rgba(255,255,255,0.92)",
    fontFamily: "PlayfairDisplay",
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "hsl(82 85% 55%)",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  primaryText: {
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(0,0,0,0.90)",
    fontFamily: "SpaceMono",
  },
});

