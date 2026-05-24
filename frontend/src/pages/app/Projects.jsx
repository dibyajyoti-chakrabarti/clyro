import { Link } from 'react-router-dom'

export default function Projects() {
  return (
    <div>
      <div className='mb-6 flex items-center justify-between'>
        <h1 className='text-3xl font-bold'>Projects</h1>
        <Link
          to='/app/projects/new'
          className='rounded-md bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700'
        >
          New Project
        </Link>
      </div>

      <article className='max-w-lg rounded-xl border border-slate-200 p-5'>
        <h2 className='text-xl font-semibold'>Clyro Starter Project</h2>
        <p className='mt-2 text-slate-600'>A sample project to help you get started.</p>
        <Link
          to='/app/projects/1'
          className='mt-4 inline-block rounded-md border border-slate-300 px-3 py-2 font-medium hover:bg-slate-100'
        >
          Open
        </Link>
      </article>
    </div>
  )
}
