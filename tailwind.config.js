/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  // NativeWind scans these files for className usage.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Matches `/Users/goats/Desktop/ponderapp/design.md`
        display: ["BebasNeue"],
        body: ["Inter"],
        mono: ["SpaceMono"],

        // Post-only fonts
        playfair: ["PlayfairDisplay"],
        archivo: ["ArchivoBlack"],
        marker: ["PermanentMarker"],
        caveat: ["Caveat"],
        canela: ["Canela"],
      },
      colors: {
        // Design tokens from `/Users/goats/Desktop/ponderapp/design.md`
        background: "hsl(0 0% 4%)",
        card: "hsl(0 0% 8%)",
        secondary: "hsl(0 0% 14%)",
        muted: "hsl(0 0% 18%)",

        foreground: "hsl(60 9% 98%)",
        "muted-foreground": "hsl(0 0% 55%)",

        // Accent colors (UI only) — see design.md rules.
        primary: "hsl(82 85% 55%)",
        accent: "hsl(330 85% 60%)",
        destructive: "hsl(0 62% 50%)",

        ring: "hsl(82 85% 55%)",
      },

      borderRadius: {
        // Signature radius for posts (required) — design.md.
        post: "51px",
      },

      boxShadow: {
        // Web uses rgba shadows; on native we'll approximate with elevation/opacity later.
        // Still keep the semantic token for parity.
        "card-soft": "0 4px 24px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};


