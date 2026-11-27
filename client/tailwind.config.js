/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background tokens
        bg: {
          DEFAULT: '#050805',
          elevated: '#0B110C',
        },
        // Surface tokens
        surface: 'rgba(255,255,255,0.04)',
        'surface-strong': 'rgba(255,255,255,0.07)',
        // Border
        border: 'rgba(255,255,255,0.08)',
        // Primary (neon lime)
        primary: {
          DEFAULT: '#B6F23B',
          glow: '#7CFF1F',
          ink: '#0A0F05',
        },
        // Text
        text: {
          DEFAULT: '#F4F7F1',
        },
        muted: '#9BA79A',
        // Semantic
        warning: '#F59E0B',
        caution: '#FACC15',
        danger: '#EF4444',
        success: '#22C55E',
        purple: '#A855F7',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        btn: '14px',
        chip: '9999px',
      },
      boxShadow: {
        neon: '0 0 20px -3px rgba(182, 242, 59, 0.25)',
        'neon-strong': '0 0 30px rgba(182, 242, 59, 0.4)',
        glass: '0 8px 32px 0 rgba(0,0,0,0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
