/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";

// Local type definition (same as external prompt-popup.tsx) to avoid type-checking external RN files
export type PromptPopupPrompt = {
  id: string;
  prompt_text: string;
  explanation_text: string | null;
  prompt_date: string; // YYYY-MM-DD
  theme: string | null;
  display_order: number | null;
};

/**
 * Web-only version used by the dev dashboard preview.
 * Uses standard HTML elements instead of react-native-web to avoid type compatibility issues.
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
    <div style={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.backdropPad}>
        <div style={styles.sheetWrap}>
          <div style={styles.card}>
            <div style={styles.headerRow}>
              <div style={styles.kicker}>Today's PONDR</div>
              <button
                onClick={onClose}
                style={styles.closeButton}
                type="button"
              >
                <span style={styles.closeIcon}>×</span>
              </button>
            </div>

            {!!prompt.explanation_text ? (
              <div style={styles.explainer}>{prompt.explanation_text}</div>
            ) : (
              <div style={styles.explainer}>Take a moment. Read slowly. Then answer honestly.</div>
            )}

            <div style={styles.questionWrap}>
              <div style={styles.question}>{prompt.prompt_text}</div>

              <button onClick={onRespond} style={styles.respondButton} type="button">
                <span style={styles.respondText}>Respond</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  // Overlay
  backdrop: {
    position: "fixed",
    inset: 0,
    display: "flex",
    backgroundColor: "rgba(0,0,0,0.70)",
    zIndex: 9999,
  },
  backdropPad: { flex: 1, paddingLeft: 16, paddingRight: 16 },
  sheetWrap: { flex: 1, display: "flex", justifyContent: "flex-end", paddingBottom: 40 },
  card: {
    minHeight: 420,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    backgroundColor: "rgba(18,18,18,0.96)",
    padding: 24,
  },
  headerRow: { display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: {
    fontSize: 12,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.80)",
    fontFamily: "monospace",
  },
  closeButton: { 
    height: 40, 
    width: 40, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  },
  closeIcon: { fontSize: 22, lineHeight: "22px", color: "rgba(255,255,255,0.55)" },
  explainer: { marginTop: 20, fontSize: 16, lineHeight: "24px", color: "rgba(255,255,255,0.65)" },
  questionWrap: { marginTop: 24, flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end" },
  question: { fontSize: 30, lineHeight: "36px", color: "rgba(255,255,255,0.95)", fontFamily: "serif" },
  respondButton: {
    marginTop: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
    border: "none",
    cursor: "pointer",
  },
  respondText: { fontSize: 12, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(0,0,0,0.90)", fontFamily: "monospace" },
};


