/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "Roboto", "Segoe UI", "sans-serif"],
        body: ["Inter", "Roboto", "Segoe UI", "sans-serif"]
      },
      colors: {
        brand: {
          50: "#CFCFCF",
          100: "#CFCFCF",
          300: "#7F49B4",
          500: "#7F49B4",
          700: "#141414"
        },
        violetBrand: {
          300: "#CFCFCF",
          500: "#7F49B4",
          700: "#141414"
        }
      },
      boxShadow: {
        glass: "0 20px 45px rgba(20, 20, 20, 0.35)"
      },
      backgroundImage: {
        "portal-gradient":
          "radial-gradient(circle at 20% 20%, rgba(127, 73, 180, 0.3), transparent 45%), radial-gradient(circle at 80% 0%, rgba(127, 73, 180, 0.2), transparent 40%), linear-gradient(130deg, #141414, #141414 60%, #141414 100%)"
      }
    }
  },
  plugins: []
};
