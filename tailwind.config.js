/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./app/**/*.{js,ts,jsx,tsx}",
      "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          'cornerstone': ['Cornerstone', 'sans-serif'],
          'bebas': ['Bebas Neue', 'sans-serif'],
        },
      },
    },
    plugins: [],
  }