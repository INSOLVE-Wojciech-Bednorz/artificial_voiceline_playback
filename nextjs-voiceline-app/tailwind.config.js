/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        borderGlowGreen: "borderGlowGreen 2s ease-in-out infinite",
        borderGlowRed: "borderGlowRed 2s ease-in-out infinite",
        fadeIn: "fadeIn 0.3s ease-in-out",
        "fade-in": "fadeIn 0.2s ease-in-out",
      },
      keyframes: {
        borderGlowGreen: {
          '0%, 100%': {
            background: 'linear-gradient(90deg, rgba(74, 222, 128, 0.7) 0%, rgba(34, 197, 94, 1) 25%, rgba(34, 197, 94, 1) 75%, rgba(74, 222, 128, 0.7) 100%)',
            backgroundSize: '200% 200%',
            boxShadow: '0 0 10px 3px rgba(74, 222, 128, 0.4)',
            backgroundPosition: '0% 50%'
          },
          '50%': {
            background: 'linear-gradient(90deg, rgba(34, 197, 94, 1) 0%, rgba(74, 222, 128, 0.7) 25%, rgba(74, 222, 128, 0.7) 75%, rgba(34, 197, 94, 1) 100%)',
            backgroundSize: '200% 200%',
            boxShadow: '0 0 15px 5px rgba(74, 222, 128, 0.6)',
            backgroundPosition: '100% 50%'
          }
        },
        borderGlowRed: {
          '0%, 100%': {
            background: 'linear-gradient(90deg, rgba(248, 113, 113, 0.7) 0%, rgba(239, 68, 68, 1) 25%, rgba(239, 68, 68, 1) 75%, rgba(248, 113, 113, 0.7) 100%)',
            backgroundSize: '200% 200%',
            boxShadow: '0 0 10px 3px rgba(248, 113, 113, 0.4)',
            backgroundPosition: '0% 50%'
          },
          '50%': {
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 1) 0%, rgba(248, 113, 113, 0.7) 25%, rgba(248, 113, 113, 0.7) 75%, rgba(239, 68, 68, 1) 100%)',
            backgroundSize: '200% 200%',
            boxShadow: '0 0 15px 5px rgba(248, 113, 113, 0.6)',
            backgroundPosition: '100% 50%'
          }
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'scale(0.95)' },
          '100%': { opacity: 1, transform: 'scale(1)' }
        }
      },
    },
  },
  plugins: [],
};