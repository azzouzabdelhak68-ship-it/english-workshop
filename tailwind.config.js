/** @type {import('tailwindcss').Config} */
const petrol = { 50:'#F4F8FB',100:'#E6F0F5',200:'#CDE2EF',300:'#A9CCDD',400:'#7FAEC4',500:'#5B92AC',600:'#3D7591',700:'#2C5B73',800:'#1F4557',900:'#0E2A3A',950:'#0A1E29' }
const mist = { 50:'#F6F8F8',100:'#EBEFEE',200:'#D5DEDC',300:'#B4C9CA',400:'#8FADAE',500:'#7FA6A8',600:'#5F888B',700:'#4A6C70',800:'#375257',900:'#26393E',950:'#151E1E' }
const brass = { 50:'#FAF8F5',100:'#F2ECE2',200:'#E5D8C4',300:'#D4BC9D',400:'#C4A278',500:'#B08A57',600:'#96713F',700:'#785833',800:'#5C4429',900:'#40301E',950:'#231B10' }

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        petrol, mist, brass,
        indigo: petrol,
        violet: mist,
        purple: brass
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        arabic: ['Tajawal', 'Segoe UI', 'Tahoma', 'sans-serif']
      },
      borderRadius: { sm: '0.375rem', DEFAULT: '0.75rem', lg: '1rem', xl: '1.25rem', '2xl': '1.5rem' },
      boxShadow: {
        sm: '0 1px 2px rgba(14,42,58,.06)',
        DEFAULT: '0 2px 8px -2px rgba(14,42,58,.12)',
        lg: '0 8px 24px -6px rgba(14,42,58,.16)',
        dark: '0 2px 8px -2px rgba(0,0,0,.4)',
        'dark-lg': '0 8px 24px -6px rgba(0,0,0,.5)'
      },
      keyframes: {
        bounceIn: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } }
      },
      animation: { bounceIn: 'bounceIn .35s ease-out', pulseSoft: 'pulseSoft 1.6s ease-in-out infinite' }
    }
  },
  plugins: []
}
