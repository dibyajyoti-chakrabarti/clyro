import { Loader2 } from 'lucide-react'
import clyroLogo from '../../assets/logos/Clyro_logo.png'

export default function CheckingServerStatus() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#030609] text-text-primary">
      <img src={clyroLogo} alt="Clyro" className="h-9 w-auto opacity-80" />
      <div className="flex items-center gap-2.5 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-amber-300" strokeWidth={2} />
        Checking server status…
      </div>
    </div>
  )
}
