import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Titillium Web"', 'sans-serif'],
        mono: ['"Rajdhani"', 'sans-serif'],
      },
      colors: {
        ft: {
          bg: '#0a0a0c',
          panel: '#151518',
          panel2: '#1e1e22',
          carbon: '#232326',
          red: '#e10600', // rouge F1 officiel
          red2: '#ff3b30',
          gold: '#ffd60a',
          silver: '#c7c7cc',
        },
      },
      backgroundImage: {
        checkered:
          'repeating-conic-gradient(#1a1a1d 0% 25%, transparent 0% 50%) 50% / 20px 20px',
      },
    },
  },
  plugins: [],
}
export default config
