import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hub } from 'aws-amplify/utils'
import { fetchAuthSession } from 'aws-amplify/auth'

export default function OAuthCallback() {
  const navigate = useNavigate()
  const handled = useRef(false)

  useEffect(() => {
    // Amplify automatically exchanges the authorization code on mount.
    // Listen for the signIn event, then redirect.
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect' || payload.event === 'signedIn') {
        if (handled.current) return
        handled.current = true
        navigate('/app/dashboard', { replace: true })
      }
      if (payload.event === 'signInWithRedirect_failure') {
        navigate('/login?error=oauth_failed', { replace: true })
      }
    })

    // In case the Hub event already fired before this effect ran,
    // check session directly.
    fetchAuthSession()
      .then((session) => {
        if (session?.tokens?.idToken && !handled.current) {
          handled.current = true
          navigate('/app/dashboard', { replace: true })
        }
      })
      .catch(() => {})

    return unsubscribe
  }, [navigate])

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-[#030609]'>
      <div className='flex flex-col items-center gap-4'>
        <div className='h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]' />
        <p className='text-sm text-text-muted'>Signing you in…</p>
      </div>
    </div>
  )
}
