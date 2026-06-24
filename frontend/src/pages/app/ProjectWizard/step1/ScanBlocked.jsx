import { AlertTriangle } from 'lucide-react'
import Button from '../../../../components/ui/Button'
import { WizardCard, WizardPanel } from '../../../../components/wizard/WizardPanel'

function ScanBlocked({ blockReason, setPhase }) {
  return (
    <WizardPanel>
      <WizardCard className='border-danger/30 text-center'>
        <div className='mx-auto grid h-11 w-11 place-items-center rounded-full border border-danger/30 bg-danger/10 text-danger'>
          <AlertTriangle className='h-5 w-5' />
        </div>
        <h3 className='mt-4 text-xl font-semibold'>Connection failed</h3>
        <p className='mx-auto mt-2 max-w-sm text-sm font-normal text-text-muted'>{blockReason}</p>
        <Button variant='secondary' className='mt-5' onClick={() => setPhase('select')}>
          Try again
        </Button>
      </WizardCard>
    </WizardPanel>
  )
}

export default ScanBlocked
