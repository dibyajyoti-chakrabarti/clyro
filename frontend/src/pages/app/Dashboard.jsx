import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  FolderKanban,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react'
import { api } from '../../api'
import useProjectDeletion from '../../hooks/useProjectDeletion'
import { statusMeta, statusCta, isLive, isInProgress, hasInfra, wizardStep } from '../../lib/projectStatus'
import Button from '../../components/ui/Button'
import InfraManageModal from '../../components/projects/InfraManageModal'

function StatCard({ icon: Icon, label, value, glow }) {
  return (
    <div className={`group relative overflow-hidden rounded-xl border bg-surface p-5 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.04] transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 ${glow ? 'border-accent/20 shadow-[0_0_30px_rgba(249,115,22,0.06)]' : 'border-white/[0.07]'}`}>
      <div className='flex items-center justify-between'>
        <p className='text-xs font-medium uppercase tracking-widest text-text-muted'>{label}</p>
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${glow ? 'bg-accent/12 text-accent' : 'bg-white/[0.05] text-text-muted'}`}>
          <Icon className='h-4 w-4' />
        </div>
      </div>
      <p className='mt-4 text-3xl font-semibold tracking-tight'>{value}</p>
    </div>
  )
}

function RecentProjectRow({ project, onDelete, onManage, deleting }) {
  const status = deleting ? 'deleting' : project.status
  const meta = statusMeta(status)
  const step = wizardStep(status)
  const cta = statusCta(status)
  const canManage = hasInfra(status) && !deleting

  return (
    <Link
      to={`/app/projects/${project.id}`}
      onClick={(e) => { if (deleting) e.preventDefault() }}
      className={`group flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-surface px-4 py-3.5 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.04] transition-all duration-150 hover:border-accent/20 hover:shadow-md hover:shadow-black/20 ${deleting ? 'opacity-60' : ''}`}
    >
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-semibold text-text-primary group-hover:text-accent transition-colors duration-150'>{project.name}</p>
        <p className='mt-0.5 truncate text-xs text-text-muted'>
          {project.repo_full_name ? `${project.repo_full_name} · ${project.repo_branch}` : 'No repository connected'}
          {step && <span className='ml-2 text-text-muted/70'>· Step {step.step}/{step.total}</span>}
        </p>
      </div>
      <div className='flex shrink-0 items-center gap-3'>
        <span className={`hidden rounded-full border px-2.5 py-0.5 text-xs font-medium sm:inline-block ${meta.badge}`}>
          {meta.label}
        </span>

        {canManage && (
          <button
            type='button'
            aria-label='Manage infrastructure'
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onManage?.(project) }}
            className='hidden items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-accent/40 hover:text-text-primary sm:flex'
          >
            <Settings2 className='h-3.5 w-3.5' />
            Manage
          </button>
        )}

        {!deleting && (
          <div className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-100 ${meta.group === 'idle' || meta.group === 'live' || meta.group === 'paused' || meta.group === 'failed' ? 'border-white/[0.09] bg-white/[0.03] text-text-muted group-hover:text-text-primary' : 'border-accent/40 bg-accent/10 text-accent group-hover:bg-accent/15'}`}>
            {cta === 'Continue' || cta === 'Start' ? `${cta} →` : cta}
          </div>
        )}

        <button
          type='button'
          aria-label={deleting ? 'Deleting project' : 'Delete project'}
          disabled={deleting}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(project) }}
          className='grid h-8 w-8 place-items-center rounded-lg text-text-muted transition-colors duration-150 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed'
        >
          {deleting ? (
            <Loader2 className='h-4 w-4 animate-spin text-red-400' />
          ) : (
            <Trash2 className='h-4 w-4' />
          )}
        </button>
      </div>
    </Link>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [manageProject, setManageProject] = useState(null)
  const { deletingIds, confirmDelete, resumeDeletions, dialog } = useProjectDeletion(setProjects)

  const loadProjects = () =>
    api.listProjects().then((list) => { setProjects(list); return list })

  useEffect(() => {
    api.getMe().then(setProfile).catch(() => {})
    loadProjects()
      .then((list) => resumeDeletions(list))
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = projects.length
  const live = projects.filter((p) => isLive(p.status)).length
  const inProgress = projects.filter((p) => isInProgress(p.status)).length
  const recent = projects.slice(0, 4)

  return (
    <div className='space-y-7'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold tracking-tight'>
            {profile?.name ? `${greeting()}, ${profile.name.split(' ')[0]}.` : 'Dashboard'}
          </h1>
          <p className='mt-0.5 text-sm text-text-muted'>Your infrastructure at a glance.</p>
        </div>
        <Link to='/app/projects/new'>
          <Button variant='primary'>
            <Plus className='h-4 w-4' />
            New Project
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className='grid gap-3 sm:grid-cols-3'>
        <StatCard icon={FolderKanban} label='Total Projects' value={loading ? '-' : total} />
        <StatCard icon={RefreshCw} label='In Progress' value={loading ? '-' : inProgress} glow={inProgress > 0} />
        <StatCard icon={Activity} label='Live' value={loading ? '-' : live} glow={live > 0} />
      </div>

      {/* Recent projects */}
      <div>
        <div className='mb-3 flex items-center justify-between'>
          <h2 className='text-sm font-semibold uppercase tracking-widest text-text-muted'>Recent Projects</h2>
          <Link to='/app/projects' className='text-xs text-accent/80 transition-colors hover:text-accent'>
            View all →
          </Link>
        </div>

        {loading ? (
          <div className='flex h-48 items-center justify-center rounded-xl border border-white/[0.07] bg-surface'>
            <Loader2 className='h-5 w-5 animate-spin text-accent drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]' />
          </div>
        ) : projects.length === 0 ? (
          <div className='flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-gradient-to-b from-white/[0.015] to-transparent py-16 text-center'>
            <div className='grid h-16 w-16 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]'>
              <FolderOpen className='h-7 w-7 text-text-muted' />
            </div>
            <p className='mt-4 text-sm font-semibold'>No projects yet</p>
            <p className='mt-1.5 max-w-[280px] text-xs leading-relaxed text-text-muted'>
              Create your first project to start scanning your repo and deploying to AWS.
            </p>
            <Link to='/app/projects/new'>
              <Button variant='primary' className='mt-5'>Create your first project</Button>
            </Link>
          </div>
        ) : (
          <div className='space-y-2'>
            {recent.map((p) => (
              <RecentProjectRow
                key={p.id}
                project={p}
                onDelete={confirmDelete}
                onManage={setManageProject}
                deleting={deletingIds.has(p.id) || p.status === 'deleting'}
              />
            ))}
          </div>
        )}
      </div>

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
