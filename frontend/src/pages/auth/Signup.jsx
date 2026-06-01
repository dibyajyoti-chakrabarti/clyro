import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from 'aws-amplify/auth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { GitHubIcon, GoogleIcon } from '../../components/ui/BrandIcons'
import signUpArt from '../../assets/login_art6.jpg'
import clyroLogo from "../../assets/logos/Clyro_logo.png";

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030609] px-4 py-5 text-text-primary sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-full w-full max-w-[1460px] items-center">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#060a0e] shadow-[0_24px_90px_rgba(0,0,0,0.58)] lg:min-h-[820px] lg:grid-cols-[1.6fr_1.1fr] xl:grid-cols-[2fr_1fr]">
          <section className="relative order-2 hidden min-h-[420px] flex-col overflow-hidden border-t border-white/[0.1] bg-[#060a0e] px-6 py-8 sm:min-h-[560px] sm:px-10 sm:py-10 lg:order-1 lg:flex lg:min-h-full lg:border-r lg:border-t-0 lg:px-11 lg:py-11">
            <img
              src={signUpArt}
              alt="Sign up illustration"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </section>

          <section className="order-1 flex items-center bg-[radial-gradient(circle_at_78%_16%,rgba(255,255,255,0.06),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] px-6 py-8 sm:px-10 sm:py-10 lg:order-2 lg:px-16">
            <div className="mx-auto w-full max-w-xl">
              <div className="mb-10 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-3">
                  <img
                    src={clyroLogo}
                    alt="Clyro Logo"
                    className="h-10 w-auto"
                  />
                  <span className="text-2xl font-semibold tracking-tight text-white">
                    Clyro
                  </span>
                </Link>

                <Link
                  to="/"
                  className="rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-sm text-text-muted transition hover:border-amber-300/45 hover:text-amber-200"
                >
                  Back to website
                </Link>
              </div>
              <h2 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Create your account
              </h2>
              <p className="mt-5 text-base text-text-muted">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline"
                >
                  Log in
                </Link>
              </p>

              <form className="mt-9 space-y-4">
                <Input
                  label="Full Name"
                  placeholder="Your full name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <Input
                  label="Work Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Input
                  label="Create Password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <label className="flex items-start gap-3 pt-1 text-sm leading-6 text-text-muted">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="mt-1 h-4 w-4 rounded border-white/[0.2] bg-white/[0.04] accent-amber-400"
                  />
                  <span>
                    I agree to the{" "}
                    <Link
                      to="/"
                      className="font-semibold text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline"
                    >
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/"
                      className="font-semibold text-amber-300 underline-offset-4 hover:text-amber-200 hover:underline"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                {error ? (
                  <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="mt-2 w-full text-base"
                  onClick={handleSignUp}
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>

              <div className="my-8 flex items-center gap-4 text-sm text-text-muted">
                <span className="h-px flex-1 bg-white/[0.12]" />
                <span>Or sign up with</span>
                <span className="h-px flex-1 bg-white/[0.12]" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  className="min-h-12 w-full gap-3 border-white/[0.14] bg-white/[0.035] text-base"
                >
                  <GoogleIcon className="h-5 w-5" />
                  Google
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-12 w-full gap-3 border-white/[0.14] bg-white/[0.035] text-base"
                >
                  <GitHubIcon className="h-5 w-5" />
                  GitHub
                </Button>
              </div>

              <p className="mt-9 flex items-center gap-3 text-sm text-text-muted">
                <span className="grid h-7 w-7 place-items-center rounded-md border border-white/[0.12] bg-white/[0.035] text-amber-300">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                    <path d="M6 11h12v9H6z" />
                  </svg>
                </span>
                Your data is secure. We never share your information.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
