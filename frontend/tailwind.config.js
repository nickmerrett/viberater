/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7c3aed',
          dark: '#6d28d9',
          light: '#a78bfa',
        },
        accent: {
          DEFAULT: '#ec4899',
          light: '#f472b6',
        },
        surface: {
          DEFAULT: 'rgba(26, 26, 40, 0.8)',
          light: 'rgba(36, 36, 50, 0.9)',
        }
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        'gradient-accent': 'linear-gradient(135deg, #a78bfa, #f472b6)',
      }
    },
  },
  plugins: [],
}
