import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signIn } from 'aws-amplify/auth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { GitHubIcon, GoogleIcon } from '../../components/ui/BrandIcons'
import useAuth from '../../context/useAuth'

const features = [
  {
    title: 'Visual Architecture Canvas',
    description: 'Drag, connect, and refine production cloud services.',
  },
  {
    title: 'Built-in Validation',
    description: 'Catch security, cost, and reliability gaps before deploy.',
  },
  {
    title: 'Instant Deployment',
    description: 'Move from approved design to infrastructure in minutes.',
  },
]

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
    <div className='fixed inset-0 z-50 overflow-y-auto bg-[#030609] px-4 py-5 text-text-primary sm:px-6 lg:px-8'>
      <div className='mx-auto flex min-h-full w-full max-w-[1480px] items-center'>
        <div className='grid w-full overflow-hidden rounded-2xl border border-white/[0.12] bg-[#070b0f] shadow-[0_24px_90px_rgba(0,0,0,0.55)] lg:min-h-[820px] lg:grid-cols-[0.96fr_0.82fr_1fr]'>
          <section className='order-1 flex flex-col border-white/[0.1] bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-6 py-7 sm:px-9 sm:py-10 lg:border-r lg:px-12 lg:py-12'>
            <Link to='/' className='flex w-fit items-center gap-3'>
              <span className='grid h-10 w-10 place-items-center rounded-lg border border-amber-300/70 bg-amber-400/10 text-base font-bold text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.18)]'>
                C
              </span>
              <span className='text-2xl font-semibold tracking-tight text-white'>Clyro</span>
            </Link>

            <div className='mt-12 sm:mt-16'>
              <h1 className='text-4xl font-semibold tracking-normal text-white sm:text-5xl'>Welcome back</h1>
              <p className='mt-3 text-base font-normal text-text-muted'>Log in to your account</p>
              <p className='mt-7 text-sm font-normal text-text-muted'>
                Don't have an account?{' '}
                <Link to='/signup' className='font-semibold text-amber-300 hover:text-amber-200'>
                  Sign up
                </Link>
              </p>
            </div>

            {location.state?.verified ? (
              <p className='mt-6 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400'>
                Email verified! You can now sign in.
              </p>
            ) : null}

            <div className='mt-9 space-y-3'>
              <Button variant='secondary' className='min-h-12 w-full justify-center gap-3 border-white/[0.14] bg-white/[0.035] text-base'>
                <GoogleIcon className='h-5 w-5' />
                Continue with Google
              </Button>
              <Button variant='secondary' className='min-h-12 w-full justify-center gap-3 border-white/[0.14] bg-white/[0.035] text-base'>
                <GitHubIcon className='h-5 w-5' />
                Continue with GitHub
              </Button>
            </div>

            <div className='my-8 flex items-center gap-4 text-xs text-text-muted'>
              <span className='h-px flex-1 bg-white/[0.12]' />
              <span>Or continue with email</span>
              <span className='h-px flex-1 bg-white/[0.12]' />
            </div>

            <form className='space-y-4'>
              <Input
                label='Email address'
                type='email'
                placeholder='you@example.com'
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
              <div className='flex justify-end'>
                <Link to='/' className='text-xs font-normal text-text-muted hover:text-accent'>
                  Forgot password?
                </Link>
              </div>
              {error ? <p className='rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger'>{error}</p> : null}
              <Button type='button' variant='primary' size='lg' className='mt-2 w-full' onClick={handleSignIn} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <p className='mt-10 text-xs leading-6 text-text-muted lg:mt-auto lg:pt-10'>
              Secure. Private. Built for builders.
              <br />
              By continuing, you agree to our{' '}
              <Link to='/' className='text-amber-300 hover:text-amber-200'>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to='/' className='text-amber-300 hover:text-amber-200'>
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className='order-2 flex flex-col justify-center border-t border-white/[0.1] bg-[#05090d] px-6 py-10 sm:px-9 lg:border-t-0 lg:px-12'>
            <div className='max-w-md'>
              <p className='text-xs font-semibold uppercase tracking-[0.22em] text-amber-300/80'>Cloud delivery, visually</p>
              <h2 className='mt-5 text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl'>
                Design. Validate. Deploy with <span className='text-amber-300'>Clyro.</span>
              </h2>
              <p className='mt-7 text-base leading-7 text-text-muted'>
                Build cloud architectures visually, validate best practices, and ship production-ready infrastructure without slowing your team down.
              </p>

              <div className='mt-10 space-y-7'>
                {features.map((feature, index) => (
                  <div key={feature.title} className='flex gap-5'>
                    <span className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-amber-300/45 bg-amber-300/10 text-sm font-semibold text-amber-300'>
                      {index + 1}
                    </span>
                    <div>
                      <h3 className='text-base font-semibold text-white'>{feature.title}</h3>
                      <p className='mt-1 text-sm leading-6 text-text-muted'>{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className='mt-12 text-base leading-7 text-text-muted'>
                Start building the right way.
                <br />
                Start with <span className='text-amber-300'>Clyro.</span>
              </p>
            </div>
          </section>

          <section className='order-3 min-h-[460px] border-t border-white/[0.1] bg-[#04080c] p-5 sm:p-8 lg:min-h-full lg:border-l lg:border-t-0'>
            <div className='relative h-full min-h-[420px] overflow-hidden rounded-xl border border-white/[0.12] bg-[radial-gradient(circle_at_72%_28%,rgba(251,191,36,0.2),transparent_22%),linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015)_48%,rgba(251,191,36,0.08))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'>
              <div className='absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:44px_44px] opacity-40' />
              <div className='absolute left-8 right-8 top-8 flex items-center justify-between rounded-lg border border-white/[0.12] bg-black/25 px-4 py-3 backdrop-blur'>
                <div className='flex items-center gap-3'>
                  <span className='h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.8)]' />
                  <span className='text-sm font-semibold text-white'>Deployment Preview</span>
                </div>
                <span className='text-xs text-amber-200'>Live</span>
              </div>

              <div className='absolute left-1/2 top-1/2 w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-300/35 bg-[#0a1016]/90 p-5 shadow-[0_0_60px_rgba(251,191,36,0.16)]'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  {['API', 'Auth', 'Storage', 'Deploy'].map((label) => (
                    <div key={label} className='rounded-lg border border-white/[0.1] bg-white/[0.04] p-4'>
                      <div className='mb-5 h-9 w-9 rounded-md border border-amber-300/45 bg-amber-300/10' />
                      <p className='text-sm font-semibold text-white'>{label}</p>
                      <p className='mt-1 text-xs text-text-muted'>Ready</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className='absolute bottom-8 left-8 right-8 rounded-xl border border-white/[0.1] bg-black/30 p-4 backdrop-blur'>
                <div className='flex items-center justify-between text-xs text-text-muted'>
                  <span>Validation score</span>
                  <span className='text-amber-300'>98%</span>
                </div>
                <div className='mt-3 h-2 rounded-full bg-white/[0.08]'>
                  <div className='h-full w-[98%] rounded-full bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.45)]' />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
