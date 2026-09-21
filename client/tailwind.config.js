/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brante: {
          bg: '#0c0d11',
          panel: '#13161d',
          card: '#181c25',
          cardHover: '#1f2430',
          border: '#2a303d',
          borderGold: '#4a3e26',
          borderGoldBright: '#c5a059',
          gold: '#c5a059',
          goldLight: '#e2c26a',
          goldDark: '#8c6d36',
          text: '#ded7c8',
          textMuted: '#968e7f',
          crimson: '#6b1d22',
          crimsonBorder: '#8b262a',
          crimsonText: '#f87171',
          emerald: '#163829',
          emeraldBorder: '#235941',
          emeraldText: '#4ade80',
          sapphire: '#16233b',
          sapphireBorder: '#233961',
          sapphireText: '#93c5fd',
        },
        fantasy: {
          dark: '#0c0d11',
          panel: '#13161d',
          card: '#181c25',
          border: '#2a303d',
          accent: '#c5a059',
          gold: '#c5a059',
          crimson: '#8b262a',
          mana: '#2563eb',
          emerald: '#16a34a',
          parchment: '#ded7c8',
        }
      },
      fontFamily: {
        cinzel: ['Cinzel', '"Cormorant Garamond"', 'serif'],
        rpg: ['"Cormorant Garamond"', '"EB Garamond"', 'Georgia', 'serif'],
        book: ['"Cormorant Garamond"', '"EB Garamond"', 'Georgia', 'serif'],
        serif: ['"Cormorant Garamond"', '"EB Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 15px rgba(197, 160, 89, 0.2)',
        'glow-crimson': '0 0 15px rgba(139, 38, 42, 0.25)',
        'brante-card': '0 2px 8px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'brante-gold': '0 0 12px rgba(197, 160, 89, 0.15)',
      }
    },
  },
  plugins: [],
}
