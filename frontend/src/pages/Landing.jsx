import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className='space-y-6'>
      <h1 className='text-4xl font-bold'>Build and Ship with Clyro</h1>
      <p className='max-w-2xl text-slate-600'>
        Clyro helps teams launch projects with less setup and better workflows.
      </p>
      <div className='flex gap-3'>
        <Link
          to='/signup'
          className='rounded-md bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700'
        >
          Start Free
        </Link>
        <Link to='/pricing' className='rounded-md border border-slate-300 px-4 py-2 font-semibold'>
          View Pricing
        </Link>
      </div>
    </div>
  )
}
