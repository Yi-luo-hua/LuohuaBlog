/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        zentry: ['"General Sans"', "system-ui", "sans-serif"],
        general: ['"General Sans"', "system-ui", "sans-serif"],
        "circular-web": ['"General Sans"', "system-ui", "sans-serif"],
        "robert-medium": ['"General Sans"', "system-ui", "sans-serif"],
        "robert-regular": ['"General Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        blue: {
          50: "#DFDFF0",
          75: "#dfdff2",
          100: "#F0F2FA",
          200: "#010101",
          300: "#4FB7DD",
        },
        violet: {
          300: "#5724ff",
        },
        yellow: {
          100: "#8e983f",
          300: "#edff66",
        },
      },
    },
  },
  plugins: [],
};
