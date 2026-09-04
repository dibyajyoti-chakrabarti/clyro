import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import FullscreenLayout from '../layouts/FullscreenLayout'
import PublicLayout from '../layouts/PublicLayout'
import useAuth from '../context/useAuth'
import Landing from '../pages/marketing/Landing'
import Pricing from '../pages/marketing/Pricing'
import AuthTransition from '../pages/auth/AuthTransition'
import VerifyOtp from '../pages/auth/VerifyOtp'
import OAuthCallback from '../pages/auth/OAuthCallback'
import Dashboard from '../pages/app/Dashboard'
import Profile from '../pages/app/Profile'
import Projects from '../pages/app/Projects'
import ProjectWizard from '../pages/app/ProjectWizard'
import ArchitectureCanvas from '../pages/app/ArchitectureCanvas'
import GithubCallback from '../pages/app/GithubCallback'

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  if (!isAuthenticated) return <Navigate to='/login' replace />

  return <Outlet />
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return null

  if (isAuthenticated) return <Navigate to='/app/dashboard' replace />

  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Landing renders its own navbar/footer, so it sits outside PublicLayout to avoid
          duplicate chrome. Auth gating is unchanged. */}
      <Route
        path='/'
        element={
          <PublicOnlyRoute>
            <Landing />
          </PublicOnlyRoute>
        }
      />

      <Route element={<PublicLayout />}>
        <Route path='/pricing' element={<Pricing />} />
        <Route path='/login' element={<AuthTransition />} />
        <Route path='/signup' element={<AuthTransition />} />
        <Route path='/verify-otp' element={<VerifyOtp />} />
        <Route path='/auth/callback' element={<OAuthCallback />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        {/* Settings page was deprecated and its features redistributed (region → Projects,
            theme → sidebar toggle) — stale bookmarks/links land on the dashboard instead
            of dead-ending. */}
        <Route path='/app/settings' element={<Navigate to='/app/dashboard' replace />} />

        <Route element={<AppLayout />}>
          <Route path='/app/dashboard' element={<Dashboard />} />
          <Route path='/app/profile' element={<Profile />} />
          <Route path='/app/projects' element={<Projects />} />
          <Route path='/app/github/callback' element={<GithubCallback />} />
        </Route>

        <Route element={<FullscreenLayout />}>
          <Route path='/app/projects/:id' element={<ProjectWizard />} />
          <Route path='/app/projects/:id/canvas' element={<ArchitectureCanvas />} />
        </Route>
      </Route>

      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}
