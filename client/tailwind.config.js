/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fantasy: {
          dark: '#0d0f12',
          panel: '#151921',
          card: '#1c222d',
          border: '#2a3444',
          accent: '#d97706', // amber-600
          gold: '#f59e0b',
          crimson: '#ef4444',
          mana: '#3b82f6',
          emerald: '#10b981',
          parchment: '#f4ede4',
        }
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 15px rgba(245, 158, 11, 0.25)',
        'glow-crimson': '0 0 15px rgba(239, 68, 68, 0.3)',
      }
    },
  },
  plugins: [],
}
