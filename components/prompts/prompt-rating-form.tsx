import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface PromptRatingFormProps {
  rating: number | null;
  onChangeRating: (value: number | null) => void;
  wouldShare: boolean | null;
  onChangeWouldShare: (value: boolean | null) => void;
}

/**
 * Shared rating + share-intent UI for prompt feedback.
 */
export function PromptRatingForm({ rating, onChangeRating, wouldShare, onChangeWouldShare }: PromptRatingFormProps) {
  return (
    <View style={styles.feedbackSection}>
      {/* Star rating */}
      <View style={styles.feedbackItem}>
        <Text style={styles.feedbackLabel}>Rate this question</Text>
        <View style={styles.starContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => onChangeRating(star)}
              accessibilityRole="button"
              accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`}
              style={styles.starButton}
            >
              <Text style={[styles.star, rating && star <= rating ? styles.starFilled : null]}>★</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Share intent */}
      <View style={styles.feedbackItem}>
        <Text style={styles.feedbackLabel}>Would you share this with a friend?</Text>
        <View style={styles.thumbsContainer}>
          <Pressable
            onPress={() => onChangeWouldShare(true)}
            accessibilityRole="button"
            accessibilityLabel="Yes, would share"
            style={[styles.thumbButton, wouldShare === true && styles.thumbButtonActive]}
          >
            <Text style={[styles.thumbIcon, wouldShare === true && styles.thumbIconActive]}>👍</Text>
          </Pressable>
          <Pressable
            onPress={() => onChangeWouldShare(false)}
            accessibilityRole="button"
            accessibilityLabel="No, would not share"
            style={[styles.thumbButton, wouldShare === false && styles.thumbButtonActive]}
          >
            <Text style={[styles.thumbIcon, wouldShare === false && styles.thumbIconActive]}>👎</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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

