import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  LogOut,
  MailCheck,
  Plus,
  Rocket,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { adminApi } from '../api/admin'
import clyroLogo from '../assets/Clyro_logo.png'

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className='rounded-xl border border-white/[0.1] bg-white/[0.03] p-5'>
      <div className='flex items-center gap-2 text-text-muted'>
        <Icon className='h-4 w-4 text-amber-300' />
        <span className='text-xs font-medium uppercase tracking-[0.14em]'>{label}</span>
      </div>
      <p className='mt-3 text-3xl font-semibold text-white'>{value ?? '—'}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [me, setMe] = useState(null)
  const [overview, setOverview] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState(null)

  const [newEmail, setNewEmail] = useState('')
  const [newNote, setNewNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  const bounceToLogin = useCallback(() => {
    adminApi.logout()
    navigate('/login', { replace: true })
  }, [navigate])

  const refresh = useCallback(async () => {
    try {
      const [meData, overviewData, whitelist] = await Promise.all([
        adminApi.me(),
        adminApi.overview(),
        adminApi.listWhitelist(),
      ])
      setMe(meData)
      setOverview(overviewData)
      setEntries(whitelist)
      setPageError(null)
    } catch (err) {
      if (err.status === 401) return bounceToLogin()
      setPageError(err.message)
    } finally {
      setLoading(false)
    }
  }, [bounceToLogin])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleAdd = async (e) => {
    e.preventDefault()
    const email = newEmail.trim()
    if (!email) return
    setAdding(true)
    setAddError(null)
    try {
      const entry = await adminApi.addWhitelist(email, newNote.trim() || undefined)
      setEntries((prev) => [entry, ...prev])
      setOverview((prev) =>
        prev ? { ...prev, whitelisted_emails: prev.whitelisted_emails + 1 } : prev,
      )
      setNewEmail('')
      setNewNote('')
    } catch (err) {
      if (err.status === 401) return bounceToLogin()
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (id) => {
    setRemovingId(id)
    try {
      await adminApi.removeWhitelist(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
      setOverview((prev) =>
        prev ? { ...prev, whitelisted_emails: prev.whitelisted_emails - 1 } : prev,
      )
    } catch (err) {
      if (err.status === 401) return bounceToLogin()
      setPageError(err.message)
    } finally {
      setRemovingId(null)
    }
  }

  const handleLogout = () => {
    adminApi.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className='min-h-screen bg-[#030609] text-text-primary'>
      <header className='sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.1] bg-[#030609]/90 px-6 backdrop-blur-xl sm:px-10'>
        <div className='flex items-center gap-3'>
          <img src={clyroLogo} alt='Clyro' className='h-8 w-auto' />
          <span className='text-lg font-semibold tracking-tight text-white'>Clyro</span>
          <span className='ml-2 flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300'>
            <ShieldCheck className='h-3.5 w-3.5' />
            Admin
          </span>
        </div>
        <div className='flex items-center gap-4'>
          {me ? <span className='hidden text-sm text-text-muted sm:block'>{me.username}</span> : null}
          <Button variant='ghost' size='sm' onClick={handleLogout}>
            <LogOut className='h-4 w-4' />
            Log out
          </Button>
        </div>
      </header>

      <main className='mx-auto w-full max-w-5xl px-6 py-10 sm:px-10'>
        {pageError ? (
          <p className='mb-6 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger'>
            {pageError}
          </p>
        ) : null}

        <section>
          <h2 className='text-sm font-semibold uppercase tracking-[0.16em] text-text-muted'>
            Overview
          </h2>
          <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard icon={Users} label='Users' value={overview?.total_users} />
            <StatCard icon={FolderKanban} label='Projects' value={overview?.total_projects} />
            <StatCard icon={Rocket} label='Live projects' value={overview?.live_projects} />
            <StatCard icon={MailCheck} label='Whitelisted' value={overview?.whitelisted_emails} />
          </div>
        </section>

        <section className='mt-12'>
          <h2 className='text-sm font-semibold uppercase tracking-[0.16em] text-text-muted'>
            Email whitelist
          </h2>
          <p className='mt-2 text-sm text-text-muted'>
            Only these emails can create new projects. Existing projects are unaffected.
          </p>

          <form
            onSubmit={handleAdd}
            className='mt-5 flex flex-col gap-3 rounded-xl border border-white/[0.1] bg-white/[0.03] p-5 sm:flex-row sm:items-end'
          >
            <Input
              label='Email'
              type='email'
              placeholder='someone@example.com'
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className='flex-1'
            />
            <Input
              label='Note (optional)'
              placeholder='e.g. beta tester'
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              className='flex-1'
            />
            <Button type='submit' variant='primary' disabled={adding || !newEmail.trim()}>
              <Plus className='h-4 w-4' />
              {adding ? 'Adding…' : 'Add'}
            </Button>
          </form>
          {addError ? (
            <p className='mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger'>
              {addError}
            </p>
          ) : null}

          <div className='mt-5 overflow-x-auto rounded-xl border border-white/[0.1]'>
            <table className='w-full min-w-[560px] text-left text-sm'>
              <thead>
                <tr className='border-b border-white/[0.1] bg-white/[0.03] text-xs uppercase tracking-wider text-text-muted'>
                  <th className='px-5 py-3 font-medium'>Email</th>
                  <th className='px-5 py-3 font-medium'>Note</th>
                  <th className='px-5 py-3 font-medium'>Added by</th>
                  <th className='px-5 py-3 font-medium'>Added</th>
                  <th className='px-5 py-3' />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className='px-5 py-8 text-center text-text-muted'>
                      Loading…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='px-5 py-8 text-center text-text-muted'>
                      No whitelisted emails yet — nobody can create projects.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className='border-b border-white/[0.06] last:border-0'>
                      <td className='px-5 py-3 text-white'>{entry.email}</td>
                      <td className='px-5 py-3 text-text-muted'>{entry.note || '—'}</td>
                      <td className='px-5 py-3 text-text-muted'>{entry.added_by || '—'}</td>
                      <td className='px-5 py-3 text-text-muted'>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td className='px-5 py-3 text-right'>
                        <Button
                          variant='danger'
                          size='sm'
                          onClick={() => handleRemove(entry.id)}
                          disabled={removingId === entry.id}
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                          {removingId === entry.id ? 'Removing…' : 'Remove'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
