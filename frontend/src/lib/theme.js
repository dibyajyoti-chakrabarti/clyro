// Theme helpers, kept out of the context component file so PreferencesContext
// only exports components (react-refresh) and so main.jsx can stamp the theme
// before first paint.

export const THEME_KEY = 'clyro_theme'
export const DEFAULT_THEME = 'dark' // app was dark-only; keep that as the baseline
export const THEMES = ['system', 'light', 'dark']

export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v && THEMES.includes(v)) return v
  } catch {
    /* localStorage unavailable — fall through */
  }
  return DEFAULT_THEME
}

// Resolve 'system' to the OS preference; 'light'/'dark' pass through.
export function resolveTheme(theme) {
  if (theme === 'system') {
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
    return dark ? 'dark' : 'light'
  }
  return theme
}

// Stamp the resolved theme on <html> so CSS `[data-theme="…"]` overrides apply.
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', resolveTheme(theme))
}

// Call once, synchronously, before React renders — avoids a light-theme user
// seeing a dark flash while the provider mounts.
export function initThemeFromStorage() {
  applyTheme(readTheme())
}
