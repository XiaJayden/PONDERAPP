import React from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormattedText } from "./formatted-text";

export type PromptPopupPrompt = {
  id: string;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string; // YYYY-MM-DD
  theme: string | null;
  display_order: number | null;
};

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
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      // Match ExpandedPostModal behavior.
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
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
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Description text */}
            {!!prompt.explanation_text ? (
              <FormattedText style={styles.explainer} boldStyle={styles.boldText}>{prompt.explanation_text}</FormattedText>
            ) : (
              <Text style={styles.explainer}>Take a moment. Read slowly. Then answer honestly.</Text>
            )}
          </ScrollView>
        </View>

        {/* Fixed bottom button */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={onRespond}
            accessibilityRole="button"
            style={styles.nextButton}
          >
            <Text style={styles.nextText}>Next</Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 16,
  },
  explainer: {
    fontSize: 22,
    lineHeight: 32,
    color: "rgba(255,255,255,0.82)",
    fontFamily: "PlayfairDisplay",
    textAlign: "left",
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
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
  boldText: {
    fontFamily: "PlayfairDisplaySemiBold",
  },
});






