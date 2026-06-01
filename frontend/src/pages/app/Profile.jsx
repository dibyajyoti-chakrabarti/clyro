import { useState } from 'react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

// TODO: fetch user profile from GET /api/users/me/

function ToggleRow({ label, enabled }) {
  return (
    <div className='flex items-center justify-between rounded-md border border-border bg-background px-3 py-2'>
      <p className='text-sm font-normal text-text-primary'>{label}</p>
      <Badge variant={enabled ? 'success' : 'neutral'}>{enabled ? 'ON' : 'OFF'}</Badge>
    </div>
  )
}

export default function Profile() {
  const [confirmAction, setConfirmAction] = useState('')
  const githubRepos = [] // TODO: fetch from GET /api/github/repos/

  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-semibold tracking-tight'>Profile</h1>

      <Card>
        <div className='flex items-center justify-between'>
          <h2 className='text-xl font-semibold'>General</h2>
          <Button variant='link'>Edit</Button>
        </div>
        <div className='mt-4 grid gap-3 text-sm font-normal md:grid-cols-2'>
          <p className='text-text-muted'>Name</p><p>—</p>
          <p className='text-text-muted'>Email</p><p>—</p>
          <p className='text-text-muted'>Phone</p><p>—</p>
          <p className='text-text-muted'>Subscription</p><p>—</p>
        </div>
      </Card>

      <Card>
        <h2 className='text-xl font-semibold'>Account & Security</h2>
        <div className='mt-4 space-y-3'>
          {/* TODO: wire to user settings API */}
          <ToggleRow label='2FA' enabled />
          <ToggleRow label='Session Alerts' enabled={false} />
          <div className='flex gap-3'>
            <Button variant='secondary'>Change Password</Button>
            <Button variant='ghost'>Manage Sessions</Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className='text-xl font-semibold'>GitHub Integration</h2>
        <div className='mt-4 space-y-2'>
          {githubRepos.map((repo) => (
            <div key={repo} className='flex items-center justify-between rounded-md border border-border bg-background px-3 py-2'>
              <p className='text-sm font-normal'>{repo}</p>
              <Button variant='link'>Edit</Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className='text-xl font-semibold'>Billing & Payments</h2>
        <div className='mt-4 grid gap-3 text-sm font-normal md:grid-cols-2'>
          <p className='text-text-muted'>Current plan</p>
          <div className='flex items-center gap-3'>
            <p>—</p>
            <Button variant='link'>Upgrade</Button>
          </div>
          <p className='text-text-muted'>Next billing</p><p>—</p>
          <p className='text-text-muted'>Payment method</p><p>—</p>
        </div>
      </Card>

      <Card>
        <h2 className='text-xl font-semibold'>Danger Zone</h2>
        <p className='mt-2 text-sm font-normal text-text-muted'>Destructive actions are permanent.</p>
        <div className='mt-4 flex gap-3'>
          <Button variant='danger' onClick={() => setConfirmAction('Export Data')}>
            Export Data
          </Button>
          <Button variant='danger' onClick={() => setConfirmAction('Delete Account')}>
            Delete Account
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction}
        description='This is a mock confirmation. No backend action will run.'
        confirmText='Confirm'
        onCancel={() => setConfirmAction('')}
        onConfirm={() => setConfirmAction('')}
      />
    </div>
  )
}
