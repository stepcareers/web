import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // Step brand palette — neutral, mature, slightly warm.
        // Tweak after we have a designer or a clearer mood board.
        ink: {
          DEFAULT: "#0a0a0a",
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          900: "#18181b",
          950: "#0a0a0a",
        },
        accent: {
          DEFAULT: "#3b82f6",
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
    },
  },
  plugins: [],
  // "class" strategy: dark: variants activate when html has class="dark".
  // We force this in app/layout.tsx so the site is consistently dark on
  // every device regardless of OS theme. Was "media" before, which left
  // mobile users in light mode with unreadable gray text.
  darkMode: "class",
};

export default config;
