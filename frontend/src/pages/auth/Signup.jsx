import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import { GitHubIcon, GoogleIcon } from '../../components/ui/BrandIcons'
import { useAuth } from '../../context/AuthContext'

export default function Signup() {
  const { login } = useAuth()

  return (
    <Card className='mx-auto max-w-md'>
      <h1 className='text-2xl font-semibold tracking-tight'>Create Account</h1>
      <p className='mt-2 text-sm font-normal text-text-muted'>Start building with Clyro.</p>

      <form className='mt-6 space-y-4'>
        <Input label='Name' placeholder='Your full name' />
        <Input label='Email' type='email' placeholder='you@company.com' />
        <Input label='Password' type='password' placeholder='Create a password' />
        <Input label='Confirm Password' type='password' placeholder='Confirm your password' />
        <Button type='button' variant='primary' className='w-full' onClick={login}>
          Sign Up
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
