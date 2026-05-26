/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'khula': ['Khula', 'Helvetica', 'sans-serif'],
        'black-ops-one': ['Black Ops One', 'Helvetica', 'cursive'],
        'pretendard': ['Pretendard', 'Helvetica', 'sans-serif'],
        'cafe24': ['Cafe24 Ohsquare', 'Helvetica', 'sans-serif'],
        'dm-sans': ['DM Sans', 'Helvetica', 'sans-serif'],
        'azeret-mono': ['Azeret Mono', 'Helvetica', 'monospace'],
        'manrope': ['Manrope', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
