import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

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
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.backdropPad}>
          {/* Taller, bottom-sheet style container */}
          <View style={styles.sheetWrap}>
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <Text style={styles.kicker}>Today’s PONDR</Text>
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

              {/* Intro / context */}
              {!!prompt.explanation_text ? (
                <Text style={styles.explainer}>{prompt.explanation_text}</Text>
              ) : (
                <Text style={styles.explainer}>Take a moment. Read slowly. Then answer honestly.</Text>
              )}

              {/* Punchline question anchored toward the bottom */}
              <View style={styles.questionWrap}>
                <Text style={styles.question}>{prompt.prompt_text}</Text>

                <Pressable onPress={onRespond} accessibilityRole="button" style={styles.respondButton}>
                  <Text style={styles.respondText}>Respond</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.70)" },
  backdropPad: { flex: 1, paddingHorizontal: 16 },
  sheetWrap: { flex: 1, justifyContent: "flex-end", paddingBottom: 40 },
  card: {
    minHeight: 420,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(18,18,18,0.96)",
    padding: 24,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.80)",
  },
  closeButton: { height: 40, width: 40, alignItems: "center", justifyContent: "center" },
  closeIcon: { fontSize: 22, lineHeight: 22, color: "rgba(255,255,255,0.55)" },
  explainer: { marginTop: 20, fontSize: 16, lineHeight: 24, color: "rgba(255,255,255,0.65)" },
  questionWrap: { marginTop: 24, flex: 1, justifyContent: "flex-end" },
  question: { fontSize: 30, lineHeight: 36, color: "rgba(255,255,255,0.95)" },
  respondButton: {
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  respondText: { fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(0,0,0,0.90)" },
});




