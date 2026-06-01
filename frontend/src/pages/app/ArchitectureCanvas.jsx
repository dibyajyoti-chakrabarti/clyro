// TODO: this page is the standalone canvas view post-provisioning. Wire to GET /api/projects/{id}/canvas/latest/
import { Link, useParams } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'

export default function ArchitectureCanvas() {
  const { id } = useParams()
  const componentPalette = [] // TODO: derive from supported node types constant

  return (
    <div className='space-y-4'>
      <Card className='p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h1 className='text-2xl font-semibold tracking-tight'>Architectural Canvas</h1>
          <div className='flex gap-2'>
            <Button variant='secondary' size='sm'>Save State</Button>
            <Button variant='ghost' size='sm'>Share</Button>
            <Button variant='primary' size='sm'>Validate</Button>
          </div>
        </div>
      </Card>

      <div className='grid gap-4 lg:grid-cols-[180px_1fr_280px]'>
        <Card className='p-4'>
          <h2 className='text-base font-semibold'>Components</h2>
          <div className='mt-3 space-y-2'>
            {componentPalette.map((item) => (
              <Button key={item} variant='secondary' className='w-full justify-start'>
                {item}
              </Button>
            ))}
          </div>
        </Card>

        <Card className='min-h-[460px] p-4'>
          <h2 className='text-base font-semibold'>Design Surface</h2>
          <div className='mt-4 grid min-h-[380px] place-items-center rounded-md border border-border bg-background'>
            <p className='text-sm font-normal text-text-muted'>No canvas loaded. Open a project to view its architecture.</p>
          </div>
        </Card>

        <Card className='p-4'>
          <h2 className='text-base font-semibold'>AI Assistant</h2>
          <p className='mt-2 text-sm font-normal text-text-muted'>Prompt suggestions appear here.</p>
          <Input label='Ask assistant' placeholder='Ask about this architecture...' className='mt-4' />
        </Card>
      </div>

      <div className='flex items-center justify-between'>
        <div className='flex gap-2'>
          <Button variant='ghost' size='sm'>Undo</Button>
          <Button variant='ghost' size='sm'>Redo</Button>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='secondary' size='sm'>-</Button>
          <p className='text-xs font-normal text-text-muted'>100%</p>
          <Button variant='secondary' size='sm'>+</Button>
        </div>
      </div>

      <Link to={`/app/projects/${id}`}>
        <Button variant='ghost'>Back to Wizard</Button>
      </Link>
    </div>
  )
}
