/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: {
          50: "#f1f6f3",
          100: "#dceae1",
          200: "#bcd6c6",
          300: "#92b8a3",
          400: "#63947c",
          500: "#44775f",
          600: "#335f4b",
          700: "#294d3d",
          800: "#1f3d31",
          900: "#132921",
          950: "#0a1712",
        },
        gold: {
          300: "#e2cd9d",
          400: "#d4b878",
          500: "#c4a464",
          600: "#a8874a",
        },
        ivory: "#f6f4ef",
        ink: "#1b2a23",
      },
      fontFamily: {
        sans: [
          "Manrope",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(19, 41, 33, 0.06), 0 8px 24px rgba(19, 41, 33, 0.07)",
      },
    },
  },
  plugins: [],
};
