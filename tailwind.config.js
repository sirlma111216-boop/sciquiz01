/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0b1020',
          800: '#111936',
          700: '#18224a',
          600: '#212e60',
          500: '#2c3c78',
        },
        beam: {
          400: '#5eead4',
          500: '#22d3ee',
          600: '#0ea5e9',
        },
        real: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        fake: {
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        spark: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          'Pretendard Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Malgun Gothic',
          'Apple SD Gothic Neo',
          'sans-serif',
        ],
      },
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.8) translateY(12px)' },
          '60%': { opacity: '1', transform: 'scale(1.04) translateY(0)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '0.85' },
        },
        'grow-bar': {
          '0%': { width: '0%' },
        },
      },
      animation: {
        'pop-in': 'pop-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-up': 'fade-up 320ms ease-out both',
        'soft-pulse': 'soft-pulse 900ms ease-in-out infinite',
        'grow-bar': 'grow-bar 700ms ease-out both',
      },
    },
  },
  plugins: [],
};
