import { styles } from 'streetui';

// StreetJS brand design tokens
export const ds = {
  // Colors - StreetJS brand palette
  colors: {
    // Primary: deep blue (professional, trustworthy)
    primary: '#1a4d8f',
    primaryHover: '#15fundefined63f',
    primaryLight: '#2563b8',
    
    // Accent: electric cyan (modern, technical)
    accent: '#06b6d4',
    accentHover: '#0891b2',
    accentLight: '#22d3ee',
    
    // Success: green
    success: '#10b981',
    successLight: '#d1fae5',
    
    // Warning: amber
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    
    // Error: red
    error: '#ef4444',
    errorLight: '#fee2e2',
    
    // Neutrals
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',
    
    // Semantic
    bg: '#ffffff',
    bgAlt: '#f9fafb',
    border: '#e5e7eb',
    text: '#111827',
    textMuted: '#6b7280',
    
    // Dark theme
    bgDark: '#0f172a',
    bgAltDark: '#1e293b',
    borderDark: '#334155',
    textDark: '#f1f5f9',
    textMutedDark: '#94a3b8',
  },
  
  // Typography
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", Consolas, Monaco, "Courier New", monospace',
  },
  
  fontSizes: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
    '5xl': '3rem',    // 48px
    '6xl': '3.75rem', // 60px
    '7xl': '4.5rem',  // 72px
  },
  
  fontWeights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  lineHeights: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
  
  // Spacing
  spacing: {
    px: '1px',
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
    24: '6rem',    // 96px
    32: '8rem',    // 128px
  },
  
  // Borders
  radii: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  
  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  },
  
  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
  
  // Z-index
  zIndex: {
    base: '0',
    dropdown: '1000',
    sticky: '1020',
    fixed: '1030',
    modalBackdrop: '1040',
    modal: '1050',
    popover: '1060',
    tooltip: '1070',
  },
  
  // Transitions
  transitions: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// Common style patterns
export const commonStyles = {
  container: styles({
    maxWidth: ds.breakpoints['2xl'],
    marginInline: 'auto',
    paddingInline: ds.spacing[4],
    width: '100%',
  }),
  
  button: styles({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingInline: ds.spacing[6],
    paddingBlock: ds.spacing[3],
    fontSize: ds.fontSizes.base,
    fontWeight: ds.fontWeights.semibold,
    borderRadius: ds.radii.md,
    transition: ds.transitions.base,
    cursor: 'pointer',
    userSelect: 'none',
    textDecoration: 'none',
    border: 'none',
    '&:disabled': {
      opacity: '0.5',
      cursor: 'not-allowed',
    },
  }),
  
  buttonPrimary: styles({
    backgroundColor: ds.colors.primary,
    color: '#ffffff',
    '&:hover:not(:disabled)': {
      backgroundColor: ds.colors.primaryHover,
    },
  }),
  
  buttonAccent: styles({
    backgroundColor: ds.colors.accent,
    color: '#ffffff',
    '&:hover:not(:disabled)': {
      backgroundColor: ds.colors.accentHover,
    },
  }),
  
  buttonOutline: styles({
    backgroundColor: 'transparent',
    color: ds.colors.primary,
    border: `2px solid ${ds.colors.primary}`,
    '&:hover:not(:disabled)': {
      backgroundColor: ds.colors.primary,
      color: '#ffffff',
    },
  }),
  
  card: styles({
    backgroundColor: ds.colors.bg,
    borderRadius: ds.radii.lg,
    boxShadow: ds.shadows.md,
    padding: ds.spacing[6],
    transition: ds.transitions.base,
  }),
  
  codeBlock: styles({
    backgroundColor: ds.colors.gray900,
    color: ds.colors.gray100,
    fontFamily: ds.fonts.mono,
    fontSize: ds.fontSizes.sm,
    padding: ds.spacing[4],
    borderRadius: ds.radii.md,
    overflowX: 'auto',
    lineHeight: ds.lineHeights.relaxed,
  }),
  
  inlineCode: styles({
    fontFamily: ds.fonts.mono,
    fontSize: '0.9em',
    backgroundColor: ds.colors.gray100,
    color: ds.colors.gray800,
    padding: `${ds.spacing[1]} ${ds.spacing[2]}`,
    borderRadius: ds.radii.sm,
  }),
};
