import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        'ink-soft': '#475569',
        canvas: '#F6F8FB',
        surface: '#FFFFFF',
        'surface-muted': '#F1F5F9',
        line: '#DCE3EC',
        accent: '#6D5EF7',
        'accent-strong': '#5848E8',
        'accent-soft': '#EEEAFE',
        success: '#0F9D72',
        'success-soft': '#E6F7F1',
        warning: '#C27A12',
        'warning-soft': '#FFF4DF',
        danger: '#C53D4B',
        'danger-soft': '#FDECEF',
        info: '#2878C8',
        'info-soft': '#E9F3FF',
        'on-accent': '#FFFFFF',
      },
      borderRadius: { sm: '6px', md: '10px', lg: '14px', xl: '18px' },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      maxWidth: { app: '1440px' },
    },
  },
  plugins: [],
} satisfies Config;
