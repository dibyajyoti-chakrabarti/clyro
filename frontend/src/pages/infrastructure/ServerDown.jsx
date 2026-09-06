import { useEffect, useState } from 'react'
import { Moon, Clock3, CheckCircle2, Info } from 'lucide-react'
import clyroLogo from '../../assets/logos/Clyro_logo.png'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000 // UTC+5:30
const WINDOW_START_H = 9 // 9 AM IST
const WINDOW_END_H = 21 // 9 PM IST

const getISTHour = (now = new Date()) => {
  const istMs = now.getTime() + IST_OFFSET_MS
  return new Date(istMs).getUTCHours() + new Date(istMs).getUTCMinutes() / 60
}

const formatISTTime = (now = new Date()) => {
  const istMs = now.getTime() + IST_OFFSET_MS
  const d = new Date(istMs)
  const h = d.getUTCHours()
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  const s = String(d.getUTCSeconds()).padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m}:${s} ${ampm} IST`
}

const getCountdownToNextWindow = (now = new Date()) => {
  const istMs = now.getTime() + IST_OFFSET_MS
  const istNow = new Date(istMs)
  const nextStart = new Date(istNow)
  nextStart.setUTCHours(WINDOW_START_H, 0, 0, 0)
  if (istNow.getUTCHours() >= WINDOW_START_H) {
    nextStart.setUTCDate(nextStart.getUTCDate() + 1)
  }
  return Math.max(0, nextStart.getTime() - istNow.getTime())
}

const formatCountdown = (ms) => {
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

  useEffect(() => {
    const tickInterval = setInterval(() => setNow(new Date()), 1000)
    const pulseInterval = setInterval(() => setPulseKey((k) => k + 1), 15000)
    return () => {
      clearInterval(tickInterval)
      clearInterval(pulseInterval)
    }
  }, [])

  const istHour = getISTHour(now)
  const inActiveWindow = istHour >= WINDOW_START_H && istHour < WINDOW_END_H
  const countdownMs = getCountdownToNextWindow(now)

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
            {inActiveWindow ? 'starting up' : 'sleeping'}
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-lg text-base leading-7 text-text-muted sm:text-lg">
          Clyro runs on AWS{' '}
          <strong className="font-semibold text-text-primary">9 AM to 9 PM IST</strong>{' '}
          every day to keep cloud costs low. Come back during those hours and
          you&apos;ll be all set.
        </p>

        <div className="mt-9 w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] text-left">
          <div className="h-[3px] w-full bg-white/[0.06]">
            <div
              key={pulseKey}
              className="h-full bg-gradient-to-r from-amber-400 to-amber-200"
              style={{ animation: 'clyro-sd-progress 15s linear infinite' }}
            />
          </div>

          <StatusRow label="Service window" value="9:00 AM to 9:00 PM IST, daily" />
          <StatusRow label="Current IST time" value={formatISTTime(now)} accent />
          <StatusRow
            label="Next active window"
            value={inActiveWindow ? 'Now (starting up…)' : `in ${formatCountdown(countdownMs)}`}
          />
          <StatusRow
            label="Status"
            value={inActiveWindow ? 'Starting…' : 'Offline (outside service hours)'}
          />
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 text-left">
          <div className="flex items-start gap-3 text-sm text-text-muted sm:text-base">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <span>
              No action needed.{' '}
              <strong className="font-semibold text-text-primary">
                Come back between 9 AM and 9 PM IST
              </strong>{' '}
              and the service will be live.
            </span>
          </div>
          <div className="flex items-start gap-3 text-sm text-text-muted sm:text-base">
            <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <span>
              Service state:{' '}
              <strong className="font-semibold text-text-primary">
                Offline, resumes at 9:00 AM IST tomorrow
              </strong>
              .
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
