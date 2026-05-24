import { useAuth } from '../../context/AuthContext'

export default function Signup() {
  const { login } = useAuth()

  return (
    <div className='mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6'>
      <h1 className='mb-6 text-2xl font-bold'>Create Account</h1>
      <form className='space-y-4'>
        <div>
          <label className='mb-1 block text-sm font-medium'>Name</label>
          <input type='text' className='w-full rounded-md border border-slate-300 px-3 py-2' placeholder='Your name' />
        </div>
        <div>
          <label className='mb-1 block text-sm font-medium'>Email</label>
          <input type='email' className='w-full rounded-md border border-slate-300 px-3 py-2' placeholder='you@company.com' />
        </div>
        <div>
          <label className='mb-1 block text-sm font-medium'>Password</label>
          <input type='password' className='w-full rounded-md border border-slate-300 px-3 py-2' placeholder='••••••••' />
        </div>
        <div>
          <label className='mb-1 block text-sm font-medium'>Confirm Password</label>
          <input type='password' className='w-full rounded-md border border-slate-300 px-3 py-2' placeholder='••••••••' />
        </div>

        <button
          type='button'
          onClick={login}
          className='w-full rounded-md bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700'
        >
          Sign Up (Mock)
        </button>
      </form>

      <div className='mt-5 space-y-2'>
        <button type='button' className='w-full rounded-md border border-slate-300 px-4 py-2'>
          Continue with Google
        </button>
        <button type='button' className='w-full rounded-md border border-slate-300 px-4 py-2'>
          Continue with GitHub
        </button>
      </div>
    </div>
  )
}
