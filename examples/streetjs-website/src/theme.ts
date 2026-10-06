import { signal, effect } from 'streetui';
import { ds } from './design-system.js';

// Theme types
export type Theme = 'light' | 'dark';

// Theme signal
export const currentTheme = signal<Theme>('light');

// Initialize theme from localStorage or system preference
export function initializeTheme() {
  if (typeof window === 'undefined') return;
  
  const stored = localStorage.getItem('streetjs-theme') as Theme | null;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const initialTheme = stored || (prefersDark ? 'dark' : 'light');
  currentTheme.set(initialTheme);
  applyTheme(initialTheme);
  
  // Watch for changes
  effect(() => {
    const theme = currentTheme.get();
    applyTheme(theme);
    localStorage.setItem('streetjs-theme', theme);
  });
}

// Toggle between themes
export function toggleTheme() {
  const current = currentTheme.get();
  currentTheme.set(current === 'light' ? 'dark' : 'light');
}

// Apply theme to document
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  
  document.documentElement.setAttribute('data-theme', theme);
}

// Dark mode color palette
export const darkColors = {
  bg: '#0f172a',           // slate-900
  bgAlt: '#1e293b',        // slate-800
  text: '#f1f5f9',         // slate-100
  textMuted: '#cbd5e1',    // slate-300
  border: '#334155',       // slate-700
  primary: '#3b82f6',      // blue-500 (brighter for dark)
  primaryLight: '#60a5fa', // blue-400
  accent: '#22d3ee',       // cyan-400 (brighter)
  success: '#22c55e',      // green-500
  error: '#ef4444',        // red-500
};

// Theme-aware colors helper
export function getThemedColors(theme: Theme = 'light') {
  if (theme === 'dark') {
    return darkColors;
  }
  return {
    bg: ds.colors.bg,
    bgAlt: ds.colors.bgAlt,
    text: ds.colors.text,
    textMuted: ds.colors.textMuted,
    border: ds.colors.border,
    primary: ds.colors.primary,
    primaryLight: ds.colors.primaryLight,
    accent: ds.colors.accent,
    success: ds.colors.success,
    error: ds.colors.error,
  };
}

// CSS custom properties for theming
export const themeCSSVariables = `
:root {
  --color-bg: ${ds.colors.bg};
  --color-bg-alt: ${ds.colors.bgAlt};
  --color-text: ${ds.colors.text};
  --color-text-muted: ${ds.colors.textMuted};
  --color-border: ${ds.colors.border};
  --color-primary: ${ds.colors.primary};
  --color-primary-light: ${ds.colors.primaryLight};
  --color-accent: ${ds.colors.accent};
  --color-success: ${ds.colors.success};
  --color-error: ${ds.colors.error};
}

[data-theme="dark"] {
  --color-bg: ${darkColors.bg};
  --color-bg-alt: ${darkColors.bgAlt};
  --color-text: ${darkColors.text};
  --color-text-muted: ${darkColors.textMuted};
  --color-border: ${darkColors.border};
  --color-primary: ${darkColors.primary};
  --color-primary-light: ${darkColors.primaryLight};
  --color-accent: ${darkColors.accent};
  --color-success: ${darkColors.success};
  --color-error: ${darkColors.error};
}
`;
