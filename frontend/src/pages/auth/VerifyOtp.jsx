import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'

export default function VerifyOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location.state?.email

  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState(null)

  if (!email) {
    navigate('/signup', { replace: true })
    return null
  }

  const handleVerify = async () => {
    setLoading(true)
    setError(null)

    try {
      await confirmSignUp({
        username: email,
        confirmationCode: code,
      })

      navigate('/login', { state: { verified: true } })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    setResendMessage(null)
    setError(null)

    try {
      await resendSignUpCode({ username: email })
      setResendMessage('Verification code resent to your email.')
    } catch (err) {
      setError(err.message)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <Card className='mx-auto max-w-md'>
      <h1 className='text-2xl font-semibold tracking-tight'>Verify your email</h1>
      <p className='mt-2 text-sm font-normal text-text-muted'>
        Enter the verification code sent to <span className='text-text-primary'>{email}</span>.
      </p>

      <form
        className='mt-6 space-y-4'
        onSubmit={(event) => {
          event.preventDefault()
          handleVerify()
        }}
      >
        <Input
          label='Verification code'
          placeholder='Enter OTP code'
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />

        <Button type='submit' variant='primary' className='w-full' disabled={loading || !code.trim()}>
          {loading ? 'Verifying...' : 'Verify'}
        </Button>
      </form>

      <Button
        type='button'
        variant='link'
        className='mt-4'
        onClick={handleResend}
        disabled={resendLoading}
      >
        {resendLoading ? 'Resending...' : 'Resend code'}
      </Button>

      {error ? <p className='mt-3 text-sm text-danger'>{error}</p> : null}
      {resendMessage ? <p className='mt-3 text-sm text-green-400'>{resendMessage}</p> : null}
    </Card>
  )
}
