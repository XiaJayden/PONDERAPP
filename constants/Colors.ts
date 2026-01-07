/**
 * Theme colors for the legacy `components/Themed.tsx` helpers.
 *
 * Most of the app uses NativeWind (`className`) with tokens in `tailwind.config.js`.
 * This file is kept for compatibility with any remaining template components.
 *
 * Source of truth: `/Users/goats/Desktop/ponderapp/design.md`
 * - Dark foundation: background/card/secondary/muted are lightness steps (never pure black).
 * - Accents: lime = primary action, pink = secondary, red = destructive.
 */

export default {
  // Light theme is intentionally still usable (system setting), but stays “restrained”.
  light: {
    text: "hsl(0 0% 10%)",
    background: "hsl(0 0% 98%)",
    tint: "hsl(82 85% 45%)",
    tabIconDefault: "hsl(0 0% 55%)",
    tabIconSelected: "hsl(82 85% 45%)",
  },
  dark: {
    text: "hsl(60 9% 98%)", // --foreground
    background: "hsl(0 0% 4%)", // --background (not pure black)
    tint: "hsl(82 85% 55%)", // --primary
    tabIconDefault: "hsl(0 0% 55%)", // --muted-foreground
    tabIconSelected: "hsl(82 85% 55%)",
  },
};
