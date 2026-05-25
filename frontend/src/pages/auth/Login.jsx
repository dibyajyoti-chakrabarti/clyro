import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signIn } from 'aws-amplify/auth'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { GitHubIcon, GoogleIcon } from '../../components/ui/BrandIcons'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const location = useLocation()
  const navigate = useNavigate()
  const { refreshAuth } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    setError(null)

    try {
      await signIn({ username: email, password })
      await refreshAuth()
      navigate('/app/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className='mx-auto max-w-md'>
      <h1 className='text-2xl font-semibold tracking-tight'>Sign In</h1>
      <p className='mt-2 text-sm font-normal text-text-muted'>Access your Clyro workspace.</p>
      {location.state?.verified ? (
        <p className='mt-4 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400'>
          Email verified! You can now sign in.
        </p>
      ) : null}

      <form className='mt-6 space-y-4'>
        <Input
          label='Email'
          type='email'
          placeholder='you@company.com'
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label='Password'
          type='password'
          placeholder='Enter your password'
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Link to='/' className='inline-block text-xs font-normal text-text-muted hover:text-accent'>
          Forgot password?
        </Link>
        {error ? <p className='text-sm text-danger'>{error}</p> : null}
        <Button type='button' variant='primary' className='w-full' onClick={handleSignIn} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className='mt-5 space-y-2'>
        <Button variant='secondary' className='w-full gap-2'>
          <GoogleIcon />
          Continue with Google
        </Button>
        <Button variant='secondary' className='w-full gap-2'>
          <GitHubIcon />
          Continue with GitHub
        </Button>
      </div>
    </Card>
  )
}
