import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signIn } from 'aws-amplify/auth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { GitHubIcon, GoogleIcon } from '../../components/ui/BrandIcons'
import useAuth from '../../context/useAuth'
import loginArt from '../../assets/login_art6.jpg'
import clyroLogo from "../../assets/logos/Clyro_logo.png";

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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030609] px-4 py-5 text-text-primary sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-full w-full max-w-[1480px] items-center">
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#070b0f] shadow-[0_24px_90px_rgba(0,0,0,0.55)] lg:min-h-[820px] lg:grid-cols-[1.1fr_1.6fr] xl:grid-cols-[1fr_2fr]">
          <section className="order-1 flex flex-col border-white/[0.1] bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-6 py-7 sm:px-9 sm:py-10 lg:border-r lg:px-12 lg:py-12">
            <div className="mx-auto flex w-full max-w-xl flex-1 flex-col lg:max-w-none">
              <div className="flex items-center justify-between gap-4">
                <Link to="/" className="flex w-fit items-center gap-3">
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
                  className="hidden rounded-full border border-white/[0.12] bg-white/[0.035] px-4 py-2 text-sm text-text-muted hover:border-amber-300/45 hover:text-amber-200 sm:inline-flex"
                >
                  Back to website
                </Link>
              </div>

              <div className="mt-12 sm:mt-16">
                <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                  Welcome back
                </h1>
                <p className="mt-3 text-base font-normal text-text-muted">
                  Log in to your account
                </p>
                <p className="mt-7 text-sm font-normal text-text-muted">
                  Don't have an account?{" "}
                  <Link
                    to="/signup"
                    className="font-semibold text-amber-300 hover:text-amber-200"
                  >
                    Sign up
                  </Link>
                </p>
              </div>

              {location.state?.verified ? (
                <p className="mt-6 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
                  Email verified! You can now sign in.
                </p>
              ) : null}

              <div className="mt-9 space-y-3">
                <Button
                  variant="secondary"
                  className="min-h-12 w-full justify-center gap-3 border-white/[0.14] bg-white/[0.035] text-base"
                >
                  <GoogleIcon className="h-5 w-5" />
                  Continue with Google
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-12 w-full justify-center gap-3 border-white/[0.14] bg-white/[0.035] text-base"
                >
                  <GitHubIcon className="h-5 w-5" />
                  Continue with GitHub
                </Button>
              </div>

              <div className="my-8 flex items-center gap-4 text-xs text-text-muted">
                <span className="h-px flex-1 bg-white/[0.12]" />
                <span>Or continue with email</span>
                <span className="h-px flex-1 bg-white/[0.12]" />
              </div>

              <form className="space-y-4">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Input
                  label="Password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div className="flex justify-end">
                  <Link
                    to="/"
                    className="text-xs font-normal text-text-muted hover:text-accent"
                  >
                    Forgot password?
                  </Link>
                </div>
                {error ? (
                  <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="mt-2 w-full"
                  onClick={handleSignIn}
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <p className="mt-10 text-xs leading-6 text-text-muted lg:mt-auto lg:pt-10">
                Secure. Private. Built for builders.
                <br />
                By continuing, you agree to our{" "}
                <Link to="/" className="text-amber-300 hover:text-amber-200">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/" className="text-amber-300 hover:text-amber-200">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </section>

          <section className="relative order-2 hidden min-h-[460px] overflow-hidden border-t border-white/[0.1] bg-[#04080c] lg:flex lg:min-h-full lg:border-l lg:border-t-0">
            <img
              src={loginArt}
              alt="Login illustration"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
