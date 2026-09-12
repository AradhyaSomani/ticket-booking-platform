import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#14121A',
        surface: '#1F1B26',
        'surface-raised': '#262130',
        gold: '#E8A33D',
        'gold-dim': '#B87F2E',
        danger: '#C0392B',
        available: '#4C9A6A',
        ink: '#F2EEE6',
        muted: '#9C93A8',
        hairline: '#362F42',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        seat: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config