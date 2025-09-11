/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // use the `dark` class on <html>
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '346px'
      }
    }
  },
  plugins: []
};
