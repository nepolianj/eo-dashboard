import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4fb",
          100: "#d9e6f6",
          500: "#1f4e8c",
          600: "#173e72",
          700: "#123158",
        },
      },
    },
  },
  plugins: [],
};
export default config;
