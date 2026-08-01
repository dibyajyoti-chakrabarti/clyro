import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../../api'
import useProjectDeletion from '../../hooks/useProjectDeletion'
import ProjectsHeader from '../../components/projects/ProjectsHeader'
import ProjectsToolbar from '../../components/projects/ProjectsToolbar'
import ProjectCard from '../../components/projects/ProjectCard'
import InfraManageModal from '../../components/projects/InfraManageModal'

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [sort, setSort] = useState('Newest')
  const [manageProject, setManageProject] = useState(null)
  const { deletingIds, confirmDelete, resumeDeletions, dialog } = useProjectDeletion(setProjects)

  const loadProjects = () =>
    api.listProjects().then((list) => { setProjects(list); return list })

  useEffect(() => {
    loadProjects()
      .then((list) => resumeDeletions(list))
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLowerCase()

    return projects
      .filter((project) =>
        (project.name || '').toLowerCase().includes(query) ||
        (project.repo_full_name || '').toLowerCase().includes(query)
      )
      .filter((project) => {
        if (filter === 'All') return true
        if (filter === 'Active') return !['live', 'failed'].includes(project.status)
        if (filter === 'Completed') return ['live', 'failed'].includes(project.status)
        return true
      })
      .sort((a, b) => {
        if (sort === 'Name') return (a.name || '').localeCompare(b.name || '')

        const aTime = new Date(a.updated_at || a.updatedAt || a.modified_at || 0).getTime()
        const bTime = new Date(b.updated_at || b.updatedAt || b.modified_at || 0).getTime()

        return sort === 'Oldest' ? aTime - bTime : bTime - aTime
      })
  }, [projects, search, filter, sort])

  return (
    <div className='space-y-5'>
      <ProjectsHeader count={projects.length} />

      <ProjectsToolbar
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
        onClearSearch={() => setSearch('')}
      />

      {loading ? (
        <div className='flex h-48 items-center justify-center rounded-2xl border border-white/[0.08] bg-surface/40'>
          <div className='h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent' />
        </div>
      ) : filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-surface/40 py-16 text-center'>
          <Search className='h-6 w-6 text-text-muted' />
          <p className='mt-3 text-sm text-text-muted'>
            No projects match <span className='text-text-primary'>"{search}"</span>
          </p>
        </div>
      ) : (
        <div className='space-y-3'>
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={confirmDelete}
              onManage={setManageProject}
              deleting={deletingIds.has(project.id) || project.status === 'deleting'}
            />
          ))}
        </div>
      )}

      <InfraManageModal
        open={Boolean(manageProject)}
        project={manageProject}
        onClose={() => setManageProject(null)}
        onChanged={loadProjects}
      />
      {dialog}
    </div>
  )
}
