import './lib/cognito.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import HealthGate from './components/common/HealthGate'
import AppRoutes from './routes'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <HealthGate>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </HealthGate>
    </BrowserRouter>
  </StrictMode>,
)
