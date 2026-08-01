import './lib/cognito.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { initThemeFromStorage } from './lib/theme'
import HealthGate from './components/common/HealthGate'
import AppRoutes from './routes'

// Stamp the persisted theme before first paint to avoid a flash of the default.
initThemeFromStorage()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <PreferencesProvider>
        <HealthGate>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </HealthGate>
      </PreferencesProvider>
    </BrowserRouter>
  </StrictMode>,
)
