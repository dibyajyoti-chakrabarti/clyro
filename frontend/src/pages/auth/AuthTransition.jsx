import { Navigate, useLocation } from 'react-router-dom'
import useAuth from '../../context/useAuth'
import Login from './Login'
import Signup from './Signup'

// Keeps Login and Signup mounted side by side inside a single sliding track so
// switching between /login and /signup animates instead of hard-swapping.
const SLIDE_DURATION_MS = 700
const SLIDE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)'

export default function AuthTransition() {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()

  const isSignup = location.pathname === '/signup'

  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/app/dashboard" replace />

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#030609]">
      <div
        className="flex h-full w-[200%]"
        style={{
          transform: `translateX(${isSignup ? '-50%' : '0%'})`,
          transition: `transform ${SLIDE_DURATION_MS}ms ${SLIDE_EASING}`,
          willChange: 'transform',
        }}
      >
        <div className="h-full w-1/2 shrink-0">
          <Login />
        </div>
        <div className="h-full w-1/2 shrink-0">
          <Signup />
        </div>
      </div>
    </div>
  )
}
