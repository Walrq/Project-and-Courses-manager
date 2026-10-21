/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        linear: {
          bg: '#08090a',
          sidebar: '#0c0d12',
          surface: '#111318',
          'surface-hover': '#161922',
          card: '#13151c',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-subtle': 'rgba(255, 255, 255, 0.04)',
          text: '#f7f8f8',
          'text-secondary': '#8a8f98',
          'text-tertiary': '#62666d',
          accent: '#5e6ad2',
          'accent-hover': '#6f7ce8',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#5e6ad2',
          600: '#4f5bba',
          700: '#434ea4',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'linear-glow': '0 0 25px rgba(94, 106, 210, 0.25)',
        'linear-glow-emerald': '0 0 25px rgba(16, 185, 129, 0.25)',
        'linear-card': '0 1px 1px rgba(0, 0, 0, 0.2), 0 4px 14px rgba(0, 0, 0, 0.35)',
        'linear-input': 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
}
