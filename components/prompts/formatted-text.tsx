import React from "react";
import { Text, TextStyle, StyleProp } from "react-native";

type TextSegment = {
  text: string;
  bold: boolean;
};

/**
 * Parse text with **bold** markers into segments.
 * Handles nested/multiple bold sections.
 */
function parseFormattedText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match (if any)
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        bold: false,
      });
    }
    // Add the bold text (without the ** markers)
    segments.push({
      text: match[1],
      bold: true,
    });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      bold: false,
    });
  }

  return segments;
}

type FormattedTextProps = {
  children: string;
  /** Base style applied to all text */
  style?: StyleProp<TextStyle>;
  /** Additional style applied only to bold segments */
  boldStyle?: StyleProp<TextStyle>;
  /** NativeWind className for base text */
  className?: string;
  /** NativeWind className for bold segments */
  boldClassName?: string;
};

/**
 * Renders text with **bold** markdown-style formatting.
 * 
 * Supports both StyleSheet styles and NativeWind classes.
 * 
 * Usage:
 * ```tsx
 * <FormattedText style={styles.text}>
 *   What makes **you** feel alive?
 * </FormattedText>
 * 
 * <FormattedText className="text-lg text-white" boldClassName="font-bold">
 *   Think about **your purpose** in life.
 * </FormattedText>
 * ```
 */
export function FormattedText({
  children,
  style,
  boldStyle,
  className,
  boldClassName,
}: FormattedTextProps) {
  const segments = parseFormattedText(children);

  // If no bold segments, just render plain text
  if (segments.length === 1 && !segments[0].bold) {
    return (
      <Text style={style} className={className}>
        {children}
      </Text>
    );
  }

  return (
    <Text style={style} className={className}>
      {segments.map((segment, index) =>
        segment.bold ? (
          <Text
            key={index}
            style={boldStyle ?? { fontWeight: "700" }}
            className={boldClassName}
          >
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </Text>
  );
}
