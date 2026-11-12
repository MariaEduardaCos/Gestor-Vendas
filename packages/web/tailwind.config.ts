import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-base': '#FBF9F6',
        'surface-raised': '#FFFFFF',
        'surface-sunken': '#F3EFEA',
        'surface-accent': '#FDF2EC',
        'ink-primary': '#1F1E1C',
        'ink-secondary': '#5C5852',
        'ink-muted': '#8C867E',
        'ink-inverse': '#FFFFFF',
        'brand-primary': '#BD5338',
        'brand-hover': '#A4442C',
        'brand-subtle': '#FCEEE8',
        'status-available': '#1B7340',
        'status-available-bg': '#EAF6EE',
        'status-reserved': '#B26200',
        'status-reserved-bg': '#FEF6E8',
        'status-waiting': '#2C5E8A',
        'status-waiting-bg': '#EDF4FA',
        'status-alert': '#A32224',
        'status-alert-bg': '#FCEBEB',
        'border-hairline': '#E7E2DA',
        'border-strong': '#C9C2B7',

        // Apelidos usados por componentes antigos (antes ficavam sem cor e as telas saíam transparentes)
        surface: '#FFFFFF',
        'surface-subtle': '#FBF9F6',
        'surface-hover': '#F3EFEA',
        border: '#E7E2DA',
        primary: '#BD5338',
        'primary-dark': '#A4442C',
        'text-primary': '#1F1E1C',
        'text-secondary': '#5C5852',
        'text-muted': '#8C867E',
        'status-danger': '#A32224',
        'status-danger-bg': '#FCEBEB'
      },
      zIndex: {
        '60': '60',
        '70': '70'
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'system-ui', '-apple-system', 'sans-serif']
      },
      fontSize: {
        display: ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'title-lg': ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'title-md': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['17px', { lineHeight: '26px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'label-strong': ['15px', { lineHeight: '20px', fontWeight: '600' }],
        meta: ['13px', { lineHeight: '18px', fontWeight: '500' }]
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '16px',
        full: '9999px'
      },
      spacing: {
        'touch-target': '48px'
      },
      minHeight: {
        'touch-target': '48px'
      },
      minWidth: {
        'touch-target': '48px'
      }
    }
  },
  plugins: []
} satisfies Config;
