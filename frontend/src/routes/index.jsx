import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from '../layouts/AppLayout'
import PublicLayout from '../layouts/PublicLayout'
import { useAuth } from '../context/AuthContext'
import Landing from '../pages/Landing'
import Pricing from '../pages/Pricing'
import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import Dashboard from '../pages/app/Dashboard'
import Profile from '../pages/app/Profile'
import Projects from '../pages/app/Projects'
import ProjectWizard from '../pages/app/ProjectWizard'
import Settings from '../pages/app/Settings'

function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />
  }

  return <Outlet />
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to='/app/dashboard' replace />
  }

  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          path='/'
          element={
            <PublicOnlyRoute>
              <Landing />
            </PublicOnlyRoute>
          }
        />
        <Route path='/pricing' element={<Pricing />} />
        <Route
          path='/login'
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path='/signup'
          element={
            <PublicOnlyRoute>
              <Signup />
            </PublicOnlyRoute>
          }
        />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path='/app/dashboard' element={<Dashboard />} />
          <Route path='/app/profile' element={<Profile />} />
          <Route path='/app/projects' element={<Projects />} />
          <Route path='/app/projects/:id' element={<ProjectWizard />} />
          <Route path='/app/settings' element={<Settings />} />
        </Route>
      </Route>

      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}
