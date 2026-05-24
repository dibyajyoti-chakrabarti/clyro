import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BitbucketIcon, GitHubIcon, GitLabIcon } from '../../components/ui/BrandIcons'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

const steps = ['Use case', 'Source', 'Architecture', 'Mapping', 'Clarify']

function Chip({ selected, children, icon }) {
  return (
    <button
      type='button'
      className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-primary hover:border-accent'
      }`}
    >
      <span className='inline-flex items-center gap-2'>
        {icon}
        {children}
      </span>
    </button>
  )
}

export default function ProjectWizard() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-semibold tracking-tight'>Project {id || 'ABC'} Wizard</h1>

      <Card>
        <div className='flex flex-wrap gap-2'>
          {steps.map((label, index) => (
            <div key={label} className='flex items-center gap-2'>
              {index < step ? <Badge variant='success'>{index + 1}</Badge> : index === step ? <Badge variant='warning'>{index + 1}</Badge> : <Badge variant='neutral'>{index + 1}</Badge>}
              <span className='text-xs font-normal text-text-muted'>{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className='text-xl font-semibold'>Step {step}: {steps[step]}</h2>

        {step === 0 ? (
          <div className='mt-4 space-y-4'>
            <p className='text-sm font-normal text-text-muted'>What are you building?</p>
            <div className='grid gap-3 md:grid-cols-3'>
              {['API backend', 'Full-stack web app', 'Microservices', 'Data pipeline', 'ML inference', 'Internal tool'].map((item, i) => (
                <Chip key={item} selected={i === 0}>{item}</Chip>
              ))}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className='mt-4 space-y-4'>
            <p className='text-sm font-normal text-text-muted'>Connect your source repository.</p>
            <div className='flex flex-wrap gap-3'>
              <Chip icon={<GitHubIcon />} selected>GitHub</Chip>
              <Chip icon={<GitLabIcon />}>GitLab</Chip>
              <Chip icon={<BitbucketIcon />}>Bitbucket</Chip>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className='mt-4 space-y-4'>
            <p className='text-sm font-normal text-text-muted'>Choose how to provide architecture context.</p>
            <div className='flex flex-wrap gap-3'>
              <Chip>Existing canvas</Chip>
              <Chip>Upload image</Chip>
              <Chip selected>Draw on canvas</Chip>
            </div>
            <Button variant='secondary' onClick={() => navigate(`/app/projects/${id}/canvas`)}>
              Open Canvas
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className='mt-4 space-y-4'>
            <p className='text-sm font-normal text-text-muted'>Review auto-mapped modules.</p>
            <div className='grid gap-3 md:grid-cols-2'>
              <Card className='p-4'>
                <h3 className='text-base font-semibold'>Architecture Nodes</h3>
                <div className='mt-3 space-y-2'>
                  <div className='flex items-center justify-between'><p className='text-sm font-normal'>API Gateway</p><Badge variant='success'>Mapped</Badge></div>
                  <div className='flex items-center justify-between'><p className='text-sm font-normal'>Worker</p><Badge variant='success'>Mapped</Badge></div>
                  <div className='flex items-center justify-between'><p className='text-sm font-normal'>Data Pipeline</p><Badge variant='danger'>Unresolved</Badge></div>
                </div>
              </Card>
              <Card className='p-4'>
                <h3 className='text-base font-semibold'>Code Modules</h3>
                <div className='mt-3 space-y-2 text-sm font-normal text-text-muted'>
                  <p>/cmd/api</p>
                  <p>/cmd/worker</p>
                  <p>/apps/web</p>
                </div>
              </Card>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className='mt-4 space-y-4'>
            <p className='text-sm font-normal text-text-muted'>Answer final clarifications before provisioning.</p>
            <Card className='p-4'>
              <h3 className='text-base font-semibold'>Provision Summary</h3>
              <div className='mt-3 grid gap-3 md:grid-cols-3'>
                <p className='text-sm font-normal'>Resources: 12</p>
                <p className='text-sm font-normal'>Est. Cost: $34/mo</p>
                <p className='text-sm font-normal'>Region: ap-south-1</p>
              </div>
            </Card>
          </div>
        ) : null}

        <div className='mt-6 flex items-center justify-between'>
          <Button variant='ghost' disabled={step === 0} onClick={() => setStep((prev) => Math.max(0, prev - 1))}>
            Back
          </Button>
          <Button variant='primary' onClick={() => setStep((prev) => Math.min(4, prev + 1))}>
            {step === 4 ? 'Provision' : 'Next'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
