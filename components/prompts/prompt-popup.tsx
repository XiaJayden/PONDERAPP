import React from "react";
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
  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      onRequestClose={onClose}
      // Match ExpandedPostModal behavior.
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
        <View style={styles.pad}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.kicker}>Today’s PONDER</Text>
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

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Intro / context */}
              {!!prompt.explanation_text ? (
                <Text style={styles.explainer}>{prompt.explanation_text}</Text>
              ) : (
                <Text style={styles.explainer}>Take a moment. Read slowly. Then answer honestly.</Text>
              )}

              <View style={styles.questionWrap}>
                <Text style={styles.question}>{prompt.prompt_text}</Text>

                <Pressable onPress={onRespond} accessibilityRole="button" style={styles.respondButton}>
                  <Text style={styles.respondText}>Respond</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "hsl(0 0% 4%)" },
  pad: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  card: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(18,18,18,0.96)",
    padding: 24,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.80)",
  },
  closeButton: { height: 40, width: 40, alignItems: "center", justifyContent: "center" },
  closeIcon: { fontSize: 22, lineHeight: 22, color: "rgba(255,255,255,0.55)" },
  explainer: { marginTop: 20, fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.65)", fontFamily: "SpaceMono" },
  questionWrap: { marginTop: 24, flex: 1, justifyContent: "flex-end" },
  question: { fontSize: 30, lineHeight: 36, color: "rgba(255,255,255,0.95)", fontFamily: "PlayfairDisplay" },
  respondButton: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    // design.md: --primary
    backgroundColor: "hsl(82 85% 55%)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  respondText: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(0,0,0,0.90)", fontFamily: "SpaceMono" },
});






