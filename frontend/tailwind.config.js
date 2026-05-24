/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#111318',
        surface: '#1C1E26',
        border: '#2C2E38',
        accent: '#F97316',
        'accent-soft': '#431407',
        'text-primary': '#EEEEF0',
        'text-muted': '#6B7080',
        success: '#22C55E',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
}
