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
  darkMode: "media",
};

export default config;
