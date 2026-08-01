import { useCallback, useEffect, useMemo, useState } from 'react'
import PreferencesContext from './preferencesStore'
import { THEMES, applyTheme, readTheme, resolveTheme } from '../lib/theme'

// Client-side user preferences, persisted to localStorage (not synced across
// devices). Single reader for the AWS-region default and the UI theme so the
// Settings page, the project wizard, and the theme layer all agree.

const REGION_KEY = 'clyro_preferred_region' // pre-existing key — kept for migration
const DEFAULT_REGION = 'ap-south-1'

function readRegion() {
  try {
    return localStorage.getItem(REGION_KEY) || DEFAULT_REGION
  } catch {
    return DEFAULT_REGION
  }
}

export function PreferencesProvider({ children }) {
  const [preferredRegion, setPreferredRegionState] = useState(readRegion)
  const [theme, setThemeState] = useState(readTheme)

  const setPreferredRegion = useCallback((region) => {
    setPreferredRegionState(region)
    try {
      localStorage.setItem(REGION_KEY, region)
    } catch {
      /* ignore write failures */
    }
  }, [])

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) return
    setThemeState(next)
    try {
      localStorage.setItem('clyro_theme', next)
    } catch {
      /* ignore write failures */
    }
  }, [])

  // Apply on mount and whenever the theme changes.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // While on 'system', react to OS light/dark switches live.
  useEffect(() => {
    if (theme !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo(
    () => ({
      preferredRegion,
      setPreferredRegion,
      theme,
      setTheme,
      resolvedTheme: resolveTheme(theme),
    }),
    [preferredRegion, setPreferredRegion, theme, setTheme],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
