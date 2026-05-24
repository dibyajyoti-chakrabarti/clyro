import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function Landing() {
  return (
    <div className='space-y-8'>
      <section className='space-y-4'>
        <h1 className='text-4xl font-bold tracking-tight'>Build and ship reliable systems faster with Clyro.</h1>
        <p className='max-w-2xl text-sm font-normal text-text-muted'>
          Provisioning, architecture mapping, and deployment orchestration in one developer-first workspace.
        </p>
        <div className='flex flex-wrap gap-4'>
          <Link to='/signup'>
            <Button variant='primary' size='lg'>Start Free</Button>
          </Link>
          <Link to='/pricing'>
            <Button variant='ghost' size='lg'>See Pricing</Button>
          </Link>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-3'>
        {[
          ['Map Your Stack', 'Connect repos and map code to architecture in minutes.'],
          ['Provision Safely', 'Apply guardrails with guided AI clarifications.'],
          ['Operate Confidently', 'Track deployments, cost and system health from one place.'],
        ].map(([title, description]) => (
          <Card key={title}>
            <h3 className='text-base font-semibold'>{title}</h3>
            <p className='mt-2 text-sm font-normal text-text-muted'>{description}</p>
          </Card>
        ))}
      </section>
    </div>
  )
}
