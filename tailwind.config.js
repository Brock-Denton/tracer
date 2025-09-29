/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#11131a',
        'dark-card': '#161925',
        'dark-border': '#1f2337',
        'dark-input': '#0f1117',
        'dark-secondary': '#2a2f45',
        'dark-hover': '#1a1f2e',
      }
    },
  },
  plugins: [],
}
