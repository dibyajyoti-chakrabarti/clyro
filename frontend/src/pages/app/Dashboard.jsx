import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

export default function Dashboard() {
  const hasActivity = false // TODO: replace with API call — GET /api/dashboard/activity/

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-semibold tracking-tight'>Dashboard</h1>
        <Button variant='primary'>Create System</Button>
      </div>

      <Card>
        <h2 className='text-xl font-semibold'>Get started with popular templates for your system</h2>
        <p className='mt-2 text-sm font-normal text-text-muted'>Pick a template and provision your first architecture.</p>
        <div className='mt-4 flex flex-wrap gap-4'>
          {['Distributed', 'Microservice', 'Monolithic'].map((item) => (
            <Button key={item} variant='secondary'>
              {item}
            </Button>
          ))}
        </div>
      </Card>

      {/* TODO: replace with API call — GET /api/dashboard/stats/ */}
      <div className='grid gap-4 md:grid-cols-3'>
        {[
          ['Active Projects', '—'],
          ['Deployments This Week', '—'],
          ['Estimated Monthly Cost', '—'],
        ].map(([title, value]) => (
          <Card key={title}>
            <p className='text-xs font-normal text-text-muted'>{title}</p>
            <p className='mt-2 text-2xl font-semibold tracking-tight'>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className='flex items-center justify-between'>
          <h2 className='text-xl font-semibold'>Recent Activity</h2>
          <Button variant='ghost'>View all</Button>
        </div>
        {hasActivity ? (
          <p className='mt-4 text-sm font-normal'>Deployment events will appear here.</p>
        ) : (
          <div className='mt-4 rounded-md border border-border bg-background p-5 text-center'>
            <p className='text-base font-semibold'>No recent activity</p>
            <p className='mt-2 text-sm font-normal text-text-muted'>Run your first workflow to populate this feed.</p>
            <Button variant='primary' className='mt-4'>
              Provision a System
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
