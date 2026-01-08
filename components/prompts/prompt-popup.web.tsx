import React from "react";
import { Pressable, Text, View } from "react-native-web";

import type { PromptPopupPrompt } from "./prompt-popup";

/**
 * Web-only version used by the dev dashboard preview.
 * We intentionally avoid importing `react-native` here so Next/Vercel doesn't need a RN shim.
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
  if (!isVisible) return null;

  return (
    <View style={styles.backdrop} /* acts like Modal */>
      <View style={styles.backdropPad}>
        <View style={styles.sheetWrap}>
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={styles.kicker}>Today’s PONDR</Text>
              <Pressable
                onPress={onClose}
                style={styles.closeButton}
              >
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
            </View>

            {!!prompt.explanation_text ? (
              <Text style={styles.explainer}>{prompt.explanation_text}</Text>
            ) : (
              <Text style={styles.explainer}>Take a moment. Read slowly. Then answer honestly.</Text>
            )}

            <View style={styles.questionWrap}>
              <Text style={styles.question}>{prompt.prompt_text}</Text>

              <Pressable onPress={onRespond} style={styles.respondButton}>
                <Text style={styles.respondText}>Respond</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles: Record<string, any> = {
  // Overlay
  backdrop: {
    position: "fixed" as any,
    inset: 0 as any,
    display: "flex",
    backgroundColor: "rgba(0,0,0,0.70)",
    zIndex: 9999,
  },
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
};


