import { useEffect, useState } from 'react'
import { Moon, Clock3, CheckCircle2, Info } from 'lucide-react'
import clyroLogo from '../../assets/logos/Clyro_logo.png'

// This page used to advertise a 9 AM to 9 PM IST service window and count down
// to the next one. That schedule is gone (see .github/workflows/infra-power.yml:
// the cron was removed because a box that stopped itself overnight kept ending
// demos midway). The copy outlived it, so every real outage told the user to
// come back at 9 AM and ticked down to a window that meant nothing. It now says
// only what is actually known: the backend is unreachable, and this page is
// still checking.

const formatElapsed = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

function StatusRow({ label, value, accent = false }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 last:border-b-0 sm:px-6">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
        {label}
      </span>
      <span
        className={`flex items-center gap-2 font-mono text-sm font-medium ${
          accent ? 'text-amber-300' : 'text-text-primary'
        }`}
      >
        {accent && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
        )}
        {value}
      </span>
    </div>
  )
}

export default function ServerDown() {
  const [now, setNow] = useState(() => new Date())
  const [pulseKey, setPulseKey] = useState(0)
  // Mount time, not outage start: the gate only renders this once the health
  // check has already failed, so this is "how long you have been looking at it".
  const [since] = useState(() => Date.now())

  useEffect(() => {
    const tickInterval = setInterval(() => setNow(new Date()), 1000)
    const pulseInterval = setInterval(() => setPulseKey((k) => k + 1), 15000)
    return () => {
      clearInterval(tickInterval)
      clearInterval(pulseInterval)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030609] text-text-primary">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 15% 10%, rgba(251,191,36,0.07), transparent 60%), radial-gradient(ellipse 50% 45% at 90% 90%, rgba(251,191,36,0.05), transparent 65%)',
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-16 text-center sm:px-8">
        <img src={clyroLogo} alt="Clyro" className="mb-10 h-10 w-auto opacity-90" />

        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/[0.08] px-4 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-amber-300">
            Backend status
          </span>
        </span>

        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <Moon className="h-8 w-8 text-amber-300" strokeWidth={1.5} />
        </div>

        <h1 className="text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
          Clyro is{' '}
          <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-amber-300 bg-clip-text text-transparent">
            offline
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-text-muted sm:text-lg">
          The Clyro backend is not responding right now. Nothing you did caused
          this, and nothing you have saved is lost. This page keeps checking, so
          leave it open and it will let you straight back in.
        </p>

        <div className="mt-9 w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] text-left">
          <div className="h-[3px] w-full bg-white/[0.06]">
            <div
              key={pulseKey}
              className="h-full bg-gradient-to-r from-amber-400 to-amber-200"
              style={{ animation: 'clyro-sd-progress 15s linear infinite' }}
            />
          </div>

          <StatusRow label="Status" value="Unreachable" accent />
          <StatusRow label="Checking every" value="15 seconds" />
          <StatusRow label="Waiting for" value={formatElapsed(now.getTime() - since)} />
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 text-left">
          <div className="flex items-start gap-3 text-sm text-text-muted sm:text-base">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <span>
              No action needed.{' '}
              <strong className="font-semibold text-text-primary">
                Your projects and connected accounts are untouched
              </strong>
              .
            </span>
          </div>
          <div className="flex items-start gap-3 text-sm text-text-muted sm:text-base">
            <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <span>
              Anything already provisioned in your own AWS account{' '}
              <strong className="font-semibold text-text-primary">keeps running</strong>. This
              outage only affects the Clyro control plane.
            </span>
          </div>
          <div className="flex items-start gap-3 text-sm text-text-muted sm:text-base">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <span>This page checks the backend automatically. No need to refresh.</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes clyro-sd-progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
