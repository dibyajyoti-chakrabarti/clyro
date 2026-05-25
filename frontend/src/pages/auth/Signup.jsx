import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUp } from 'aws-amplify/auth'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { GitHubIcon, GoogleIcon } from '../../components/ui/BrandIcons'

export default function Signup() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name,
          },
        },
      })

      navigate('/verify-otp', { state: { email } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className='mx-auto max-w-md'>
      <h1 className='text-2xl font-semibold tracking-tight'>Create Account</h1>
      <p className='mt-2 text-sm font-normal text-text-muted'>Start building with Clyro.</p>

      <form className='mt-6 space-y-4'>
        <Input
          label='Name'
          placeholder='Your full name'
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
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
          placeholder='Create a password'
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Input
          label='Confirm Password'
          type='password'
          placeholder='Confirm your password'
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        {error ? <p className='text-sm text-danger'>{error}</p> : null}
        <Button type='button' variant='primary' className='w-full' onClick={handleSignUp} disabled={loading}>
          {loading ? 'Creating account...' : 'Sign Up'}
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
