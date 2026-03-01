import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { base: 'var(--bg-base)', surface1: 'var(--bg-surface1)', surface2: 'var(--bg-surface2)', surface3: 'var(--bg-surface3)' },
        border: { default: 'var(--border-default)', subtle: 'var(--border-subtle)' },
        text: { primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', tertiary: 'var(--text-tertiary)', muted: 'var(--text-muted)' },
        solar: '#F5A623',
        wind: '#50E3C2',
        mains: '#888888',
        battery: '#4ADE80',
        load: '#3291FF',
        accent: '#0070F3',
        error: '#EE0000',
        warning: '#F5A623',
        ai: '#7928CA',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', '"Cascadia Code"', '"Consolas"', '"Liberation Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
