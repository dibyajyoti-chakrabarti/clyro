// Theme helpers, kept out of the context component file so PreferencesContext
// only exports components (react-refresh) and so main.jsx can stamp the theme
// before first paint.

export const THEME_KEY = 'clyro_theme'
export const DEFAULT_THEME = 'dark' // app was dark-only; keep that as the baseline
export const THEMES = ['light', 'dark']

function osPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

// 'system' was a valid stored value before the Settings page (and its 3-way
// System/Light/Dark control) was removed. Existing users with 'system' saved
// are migrated once, here, to whatever their OS currently reports — not
// silently reset to the DEFAULT_THEME baseline.
export function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'system') {
      const migrated = osPrefersDark() ? 'dark' : 'light'
      try {
        localStorage.setItem(THEME_KEY, migrated)
      } catch {
        /* ignore write failures */
      }
      return migrated
    }
    if (v && THEMES.includes(v)) return v
  } catch {
    /* localStorage unavailable — fall through */
  }
  return DEFAULT_THEME
}

// 'light'/'dark' are the only themes now — kept as a pass-through so callers
// that resolved a display theme before the 'system' removal don't need to change.
export function resolveTheme(theme) {
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
