import { createContext } from 'react'

// Split into its own module (like authStore) so the provider file only exports
// components — keeps react-refresh happy.
const PreferencesContext = createContext(null)

export default PreferencesContext
