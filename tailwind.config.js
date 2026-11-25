/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: '#131722', panel: '#1e222d', line: '#2a2e39', txt: '#d1d4dc', mute: '#787b86', up: '#26a69a', down: '#ef5350', acc: '#2962ff' },
    },
  },
  plugins: [],
}
