import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { adminApi, getAdminToken } from '../api/admin'
import clyroLogo from '../assets/Clyro_logo.png'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  if (getAdminToken()) {
    return <Navigate to='/' replace />
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await adminApi.login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#030609] px-6 text-text-primary'>
      <div className='w-full max-w-md rounded-2xl border border-white/[0.1] bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.08),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-8 sm:p-10'>
        <div className='flex items-center gap-3'>
          <img src={clyroLogo} alt='Clyro' className='h-9 w-auto' />
          <span className='text-xl font-semibold tracking-tight text-white'>Clyro</span>
        </div>

        <div className='mt-8 flex items-center gap-2 text-amber-300'>
          <ShieldCheck className='h-5 w-5' />
          <span className='text-xs font-semibold uppercase tracking-[0.18em]'>Admin panel</span>
        </div>
        <h1 className='mt-3 text-3xl font-semibold text-white'>Sign in</h1>
        <p className='mt-2 text-sm text-text-muted'>Restricted area. Admin credentials required.</p>

        <form className='mt-8 space-y-4' onSubmit={handleLogin}>
          <Input
            label='Username'
            placeholder='admin'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <Input
            label='Password'
            type='password'
            placeholder='Enter password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? (
            <p className='rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger'>
              {error}
            </p>
          ) : null}
          <Button
            type='submit'
            variant='primary'
            size='lg'
            className='mt-2 w-full'
            disabled={loading || !username.trim() || !password}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
