import { Link } from 'react-router-dom'

export default function Projects() {
  const recentProjects = [
    { name: 'Project 1', type: 'Monolithic', modified: '54 mins ago' },
    { name: 'Project 2', type: 'Monolithic', modified: '1 day ago' },
    { name: 'Project 3', type: 'Microservice', modified: '2 day ago' },
  ]

  const allProjects = [
    { name: 'Project 1', type: 'Monolithic', modified: '54 mins ago' },
    { name: 'Project 2', type: 'Monolithic', modified: '1 day ago' },
    { name: 'Project 3', type: 'Microservice', modified: '2 day ago' },
    { name: 'Project 4', type: 'Distributed', modified: '2 day ago' },
    { name: 'Project 5', type: 'Microservice', modified: '2 day ago' },
    { name: 'Project 6', type: 'Microservice', modified: '2 day ago' },
    { name: 'Project 7', type: 'Microservice', modified: '2 day ago' },
  ]

  return (
    <div className='space-y-6 text-[#F5F5F5]'>
      <div className='flex items-center justify-end'>
        <Link
          to='/app/projects/new'
          className='rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 font-semibold hover:border-orange-500 hover:text-orange-500'
        >
          + New Project
        </Link>
      </div>

      <section className='space-y-4 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-4 shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='flex flex-wrap gap-2'>
          <input
            type='text'
            placeholder='Search by project name'
            className='min-w-[260px] flex-1 rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2 text-sm text-[#F5F5F5] placeholder-[#737373] focus:outline-none focus:ring-1 focus:ring-orange-500'
          />
          <button
            type='button'
            className='rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-sm font-semibold hover:border-orange-500 hover:text-orange-500'
          >
            Filter
          </button>
          <button
            type='button'
            className='rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-4 py-2 text-sm font-semibold hover:border-orange-500 hover:text-orange-500'
          >
            Sort By
          </button>
        </div>

        <div>
          <h2 className='mb-2 text-3xl font-semibold'>Recently Visited...</h2>
          <div className='rounded-md border border-[#2A2A2A]'>
            {recentProjects.map((project, index) => (
              <div
                key={project.name}
                className={`grid grid-cols-[1.3fr_1fr_1fr_auto] items-center gap-4 px-3 py-2 ${
                  index !== recentProjects.length - 1 ? 'border-b border-[#2A2A2A]' : ''
                }`}
              >
                <p className='text-3xl font-semibold'>☆ {project.name}</p>
                <p className='text-3xl font-semibold'>{project.type}</p>
                <p className='text-3xl font-semibold'>{project.modified}</p>
                <Link
                  to={`/app/projects/${index + 1}`}
                  className='rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-[#F5F5F5] hover:bg-orange-600'
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className='grid grid-cols-[1.3fr_1fr_1fr_auto] gap-4 px-3 py-2 text-[#737373]'>
            <p className='text-lg font-semibold'>Title</p>
            <p className='text-lg font-semibold'>Type</p>
            <p className='text-lg font-semibold'>Last Modified</p>
            <p />
          </div>

          <div className='rounded-md border border-[#2A2A2A]'>
            {allProjects.map((project, index) => (
              <div
                key={`${project.name}-${index}`}
                className={`grid grid-cols-[1.3fr_1fr_1fr_auto] items-center gap-4 px-3 py-2 ${
                  index !== allProjects.length - 1 ? 'border-b border-[#2A2A2A]' : ''
                }`}
              >
                <p className='text-3xl font-semibold'>☆ {project.name}</p>
                <p className='text-3xl font-semibold'>{project.type}</p>
                <p className='text-3xl font-semibold'>{project.modified}</p>
                <Link
                  to={`/app/projects/${index + 1}`}
                  className='rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-[#F5F5F5] hover:bg-orange-600'
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
