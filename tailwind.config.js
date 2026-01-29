/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stitch: '#6EC1E4',
        donald: '#FFD966',
        navy: '#1F3C88',
        cream: '#F8F9F5',
        paper: '#FFFFFF',
        accent: '#E0E5D5'
      },
      fontFamily: {
        sans: ['Quicksand', 'sans-serif'],
      },
      borderRadius: {
        'xl-sticker': '1.25rem',
        '2xl-sticker': '1.5rem',
        '3xl-sticker': '2rem',
      }
    },
  },
  plugins: [],
}