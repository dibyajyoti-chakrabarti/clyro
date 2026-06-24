import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import clyroLogo from '../../assets/logos/Clyro_logo.png'

export default function WizardNavbar({ projectName, showBackButton = true }) {
  const navigate = useNavigate()
  const title = projectName?.trim() || ''

  const goToDashboard = () => navigate('/app/dashboard')

  return (
    <header className='w-full'>
      <div className='flex h-[72px] w-full items-center justify-between rounded-[24px] border border-[rgba(255,196,0,0.35)] bg-[rgba(10,15,25,0.55)] px-4 shadow-[0_10px_40px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,196,0,0.08),0_0_18px_rgba(255,196,0,0.06)] backdrop-blur-[20px] transition-all duration-[200ms] sm:px-6'>
        <button
          type='button'
          onClick={goToDashboard}
          className='flex items-center gap-3 transition-opacity duration-[200ms] hover:opacity-85'
          aria-label='Clyro home'
        >
          <img src={clyroLogo} alt='' aria-hidden='true' className='h-9 w-9 shrink-0 object-contain' />
          <span className='text-[18px] font-bold text-white'>Clyro</span>
        </button>

        <div className='min-w-0 flex-1 px-3 text-center sm:px-6'>
          <p className='mx-auto max-w-[420px] truncate text-[18px] font-semibold text-white'>{title}</p>
        </div>

        {showBackButton ? (
          <button
            type='button'
            onClick={goToDashboard}
            className='flex h-[42px] shrink-0 items-center gap-2 rounded-[14px] border border-[rgba(255,196,0,0.35)] bg-[rgba(255,255,255,0.04)] px-[18px] text-sm font-medium text-white transition-all duration-[250ms] hover:-translate-y-0.5 hover:bg-[rgba(232,184,75,0.08)]'
          >
            <ArrowLeft className='h-4 w-4' />
            <span className='hidden md:inline'>Back to Dashboard</span>
          </button>
        ) : (
          <div className='h-[42px] w-[42px]' />
        )}
      </div>
    </header>
  )
}
