import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AdminLogin from '../pages/AdminLogin'
import AdminDashboard from '../pages/AdminDashboard'
import { getAdminToken } from '../api/admin'

function ProtectedRoute() {
  if (!getAdminToken()) return <Navigate to='/login' replace />

  return <Outlet />
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path='/login' element={<AdminLogin />} />
      <Route element={<ProtectedRoute />}>
        <Route path='/' element={<AdminDashboard />} />
      </Route>
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}
