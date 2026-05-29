import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from 'aws-amplify/auth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { GitHubIcon, GoogleIcon } from '../../components/ui/BrandIcons'

const featureItems = [
  {
    title: 'Visual Design',
    description: 'Drag, drop, and connect AWS services.',
    icon: (
      <path d='M9 3v7.5L14.5 8 12 13.5l4 1.5-1.4 3.7-4-1.5L8 22 5.5 20l2.4-4.4L4 14V4.5L9 3Z' />
    ),
  },
  {
    title: 'Built-in Validation',
    description: 'Catch issues early with best practices and cost insights.',
    icon: <path d='M12 3 5 6v5.5c0 4.4 2.9 8.4 7 9.5 4.1-1.1 7-5.1 7-9.5V6l-7-3Zm-3 9 2 2 4-4' />,
  },
  {
    title: 'Instant Deployment',
    description: 'Go from design to AWS in minutes.',
    icon: <path d='M14 4c3.2.5 5.5 2.8 6 6l-5 5-4-4 3-7Zm-6.5 8.5 4 4L8 20H4l3.5-7.5Zm8.5-6.5 2 2M6 18l-2 2' />,
  },
]

function FeatureIcon({ children }) {
  return (
    <svg viewBox='0 0 24 24' className='mx-auto h-8 w-8 text-amber-300' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
      {children}
    </svg>
  )
}

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
    <div className='fixed inset-0 z-50 overflow-y-auto bg-[#030609] px-4 py-5 text-text-primary sm:px-6 lg:px-8'>
      <div className='mx-auto flex min-h-full w-full max-w-[1460px] items-center'>
        <div className='grid w-full overflow-hidden rounded-2xl border border-white/[0.12] bg-[#060a0e] shadow-[0_24px_90px_rgba(0,0,0,0.58)] lg:min-h-[820px] lg:grid-cols-[1.08fr_1fr]'>
          <section className='order-2 flex flex-col border-t border-white/[0.1] bg-[radial-gradient(circle_at_70%_35%,rgba(251,191,36,0.16),transparent_24%),linear-gradient(145deg,rgba(7,14,22,0.98),rgba(8,10,13,0.98))] px-6 py-8 sm:px-10 sm:py-10 lg:order-1 lg:border-r lg:border-t-0 lg:px-11 lg:py-11'>
            <div className='flex items-center justify-between gap-4'>
              <Link to='/' className='flex w-fit items-center gap-3'>
                <span className='grid h-10 w-10 place-items-center rounded-lg border border-amber-300/70 bg-amber-400/10 text-base font-bold text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.18)]'>
                  C
                </span>
                <span className='text-2xl font-semibold tracking-tight text-white'>Clyro</span>
              </Link>
              <Link to='/' className='hidden rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-sm text-text-muted hover:border-amber-300/45 hover:text-amber-200 sm:inline-flex'>
                Back to website
              </Link>
            </div>

            <div className='mt-12 max-w-xl'>
              <h1 className='text-4xl font-semibold leading-tight tracking-normal text-white sm:text-5xl'>
                From idea to infrastructure.
                <br />
                <span className='text-amber-300'>Visually.</span>
              </h1>
              <p className='mt-6 max-w-md text-base leading-7 text-text-muted'>
                Design, validate, and deploy production-ready AWS architectures, all in a visual canvas.
              </p>
            </div>

            <div className='relative mt-8 min-h-[300px] flex-1 overflow-hidden rounded-xl border border-white/[0.12] bg-[radial-gradient(circle_at_62%_48%,rgba(251,191,36,0.32),transparent_22%),linear-gradient(180deg,rgba(19,28,43,0.82),rgba(10,13,18,0.94)_62%,rgba(5,8,11,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'>
              <div className='absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] opacity-35' />
              <div className='absolute left-1/2 top-[42%] h-24 w-56 -translate-x-1/2 rounded-full border border-amber-300/55 bg-black/35 shadow-[0_0_60px_rgba(251,191,36,0.35)]' />
              <div className='absolute left-1/2 top-1/2 w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-300/35 bg-[#080d12]/85 px-6 py-8 text-center shadow-[0_0_80px_rgba(251,191,36,0.16)] backdrop-blur'>
                <div className='mx-auto h-14 w-14 rounded-xl border border-amber-300/45 bg-amber-300/10 shadow-[0_0_35px_rgba(251,191,36,0.22)]' />
                <p className='mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200'>Illustration Placeholder</p>
                <p className='mt-3 text-sm leading-6 text-text-muted'>Premium architecture artwork will sit here.</p>
              </div>
              <div className='absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060a0e] to-transparent' />
            </div>

            <div className='mt-6 grid overflow-hidden rounded-xl border border-white/[0.12] bg-black/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:grid-cols-3'>
              {featureItems.map((feature) => (
                <div key={feature.title} className='border-white/[0.1] px-5 py-6 text-center sm:border-r sm:last:border-r-0'>
                  <FeatureIcon>{feature.icon}</FeatureIcon>
                  <h2 className='mt-4 text-sm font-semibold text-white'>{feature.title}</h2>
                  <p className='mt-2 text-xs leading-5 text-text-muted'>{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className='order-1 flex items-center bg-[radial-gradient(circle_at_78%_16%,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] px-6 py-8 sm:px-10 sm:py-10 lg:order-2 lg:px-16'>
            <div className='mx-auto w-full max-w-xl'>
              <h2 className='text-4xl font-semibold tracking-normal text-white sm:text-5xl'>Create your account</h2>
              <p className='mt-5 text-base text-text-muted'>
                Already have an account?{' '}
                <Link to='/login' className='font-semibold text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline'>
                  Log in
                </Link>
              </p>

              <form className='mt-9 space-y-4'>
                <Input
                  label='Full Name'
                  placeholder='Your full name'
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Input
                  label='Work Email'
                  type='email'
                  placeholder='you@company.com'
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Input
                  label='Create Password'
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
                <label className='flex items-start gap-3 pt-1 text-sm leading-6 text-text-muted'>
                  <input
                    type='checkbox'
                    defaultChecked
                    className='mt-1 h-4 w-4 rounded border-white/[0.2] bg-white/[0.04] accent-amber-400'
                  />
                  <span>
                    I agree to the{' '}
                    <Link to='/' className='font-semibold text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline'>
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to='/' className='font-semibold text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline'>
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {error ? <p className='rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger'>{error}</p> : null}
                <Button type='button' variant='primary' size='lg' className='mt-2 w-full text-base' onClick={handleSignUp} disabled={loading}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Button>
              </form>

              <div className='my-8 flex items-center gap-4 text-sm text-text-muted'>
                <span className='h-px flex-1 bg-white/[0.12]' />
                <span>Or sign up with</span>
                <span className='h-px flex-1 bg-white/[0.12]' />
              </div>

              <div className='grid gap-3 sm:grid-cols-2'>
                <Button variant='secondary' className='min-h-12 w-full gap-3 border-white/[0.14] bg-white/[0.035] text-base'>
                  <GoogleIcon className='h-5 w-5' />
                  Google
                </Button>
                <Button variant='secondary' className='min-h-12 w-full gap-3 border-white/[0.14] bg-white/[0.035] text-base'>
                  <GitHubIcon className='h-5 w-5' />
                  GitHub
                </Button>
              </div>

              <p className='mt-9 flex items-center gap-3 text-sm text-text-muted'>
                <span className='grid h-7 w-7 place-items-center rounded-md border border-white/[0.12] bg-white/[0.035] text-amber-300'>
                  <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                    <path d='M7 11V8a5 5 0 0 1 10 0v3' />
                    <path d='M6 11h12v9H6z' />
                  </svg>
                </span>
                Your data is secure. We never share your information.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
