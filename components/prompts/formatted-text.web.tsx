import React from "react";
import { Text } from "react-native-web";

type TextSegment = {
  text: string;
  bold: boolean;
};

/**
 * Parse text with **bold** markers into segments.
 */
function parseFormattedText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        bold: false,
      });
    }
    segments.push({
      text: match[1],
      bold: true,
    });
    lastIndex = regex.lastIndex;
  }

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
  style?: any;
  boldStyle?: any;
};

// Default bold style uses the semibold variant of Playfair
const defaultBoldStyle = { fontFamily: "PlayfairDisplaySemiBold" };

/**
 * Web version of FormattedText using react-native-web.
 */
export function FormattedText({
  children,
  style,
  boldStyle,
}: FormattedTextProps) {
  const segments = parseFormattedText(children);

  if (segments.length === 1 && !segments[0].bold) {
    return <Text style={style}>{children}</Text>;
  }

  return (
    <Text style={style}>
      {segments.map((segment, index) =>
        segment.bold ? (
          <Text key={index} style={boldStyle ?? defaultBoldStyle}>
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </Text>
  );
}
