import { CheckCircle2, ChevronRight, Copy, GitBranch, Layers3, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import GitHubLogo from '../../../../components/common/GitHubLogo'

const SEVERITY_LABEL = { blocker: 'Blocks deploy', warning: 'Will misbehave', info: 'Info' }

function ComplianceRow({ finding }) {
  const Icon = finding.passed ? CheckCircle2 : XCircle
  return (
    <div className='flex items-start gap-3 border-b border-white/[0.05] py-3 last:border-b-0'>
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${finding.passed ? 'text-emerald-400' : 'text-red-400'}`}
        strokeWidth={2}
      />
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <p className='text-[14px] font-medium text-white/85'>{finding.title}</p>
          {!finding.passed && (
            <span className='rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300'>
              {SEVERITY_LABEL[finding.severity] || finding.severity}
            </span>
          )}
        </div>
        <p className='mt-0.5 text-[12.5px] leading-snug text-white/45'>{finding.detail}</p>
      </div>
    </div>
  )
}

function CompliancePanel({ complianceFindings, compliancePrompt }) {
  const [copied, setCopied] = useState(false)
  if (!complianceFindings || complianceFindings.length === 0) return null

  const failedCount = complianceFindings.filter((f) => !f.passed).length

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(compliancePrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — user can still select the text manually */
    }
  }

  return (
    <div
      className='w-full rounded-[22px] border border-white/[0.06] bg-[rgba(255,255,255,0.015)] px-8 py-5'
      style={{ animation: 'cardIn 360ms ease-out 380ms both' }}
    >
      <div className='mb-4 flex items-center justify-between'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-white/28'>
          Cloud Compliance Checklist
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            failedCount === 0
              ? 'bg-emerald-400/10 text-emerald-300'
              : 'bg-red-400/10 text-red-300'
          }`}
        >
          {failedCount === 0 ? 'All checks passed' : `${failedCount} issue${failedCount === 1 ? '' : 's'} found`}
        </span>
      </div>

      <div>
        {complianceFindings.map((f) => (
          <ComplianceRow key={f.id} finding={f} />
        ))}
      </div>

      {compliancePrompt && (
        <div className='mt-5'>
          <div className='mb-2 flex items-center justify-between'>
            <p className='text-[12.5px] font-medium text-white/60'>
              Paste this into an AI coding agent (Claude Code, Cursor, etc.) to fix your repo
            </p>
            <button
              type='button'
              onClick={handleCopy}
              className='inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/75 hover:bg-white/[0.08]'
            >
              <Copy className='h-3.5 w-3.5' strokeWidth={2} />
              {copied ? 'Copied!' : 'Copy prompt'}
            </button>
          </div>
          <textarea
            readOnly
            value={compliancePrompt}
            rows={6}
            className='w-full resize-none rounded-xl border border-white/[0.08] bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-white/70'
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
    </div>
  )
}

function StackPill({ children }) {
  return (
    <span className='rounded-full border border-[rgba(255,196,0,0.18)] bg-[rgba(255,255,255,0.04)] px-[18px] py-[9px] text-[13px] font-medium text-white/75'>
      {children}
    </span>
  )
}

function ArchLayer({ label, items, isLast }) {
  return (
    <div className='flex items-center gap-3'>
      <div className='flex flex-1 flex-col items-center gap-2'>
        <p className='text-[10px] uppercase tracking-[0.18em] text-white/30'>{label}</p>
        <div className='flex flex-col items-center gap-0.5'>
          {items.map((item) => (
            <p key={item} className='text-center text-[13px] font-medium leading-snug text-white/70'>
              {item}
            </p>
          ))}
        </div>
      </div>
      {!isLast && <ChevronRight className='h-4 w-4 shrink-0 text-white/15' strokeWidth={1.5} />}
    </div>
  )
}

export default function ScanResults({
  selectedRepo,
  selectedBranch,
  isMonorepo,
  detectedServices,
  detectedInfra,
  complianceFindings,
  compliancePrompt,
}) {
  const stackSummary = useMemo(() => {
    const inferred = [...detectedServices, ...detectedInfra].slice(0, 7)
    return inferred.length > 0 ? inferred : ['Django', 'React', 'Celery', 'PostgreSQL']
  }, [detectedInfra, detectedServices])

  const repoShort = selectedRepo ? selectedRepo.split('/').pop() : 'repository'

  const archLayers = useMemo(() => {
    const hasFrontend = detectedServices.some(
      (s) => s.toLowerCase().includes('react') || s.toLowerCase().includes('frontend'),
    )
    const hasBackend = detectedServices.some(
      (s) => s.toLowerCase().includes('django') || s.toLowerCase().includes('backend'),
    )
    const hasWorker = detectedServices.some(
      (s) => s.toLowerCase().includes('celery') || s.toLowerCase().includes('worker'),
    )
    const dataItems = detectedInfra
      .filter((i) =>
        ['postgres', 'mysql', 'redis', 's3', 'mongo', 'sqs'].some((k) =>
          i.toLowerCase().includes(k),
        ),
      )
      .map((i) => i.replace(' cache', '').replace(' storage', '').replace(' queue', ''))
      .slice(0, 3)

    const layers = []
    if (hasFrontend) layers.push({ label: 'Frontend', items: ['React Application'] })
    if (hasBackend) layers.push({ label: 'Backend', items: ['Django API'] })
    if (hasWorker) layers.push({ label: 'Workers', items: ['Celery'] })
    if (dataItems.length > 0) layers.push({ label: 'Data Layer', items: dataItems })

    return layers.length >= 2
      ? layers
      : [
          { label: 'Frontend', items: ['React Application'] },
          { label: 'Backend', items: ['Django API'] },
          { label: 'Workers', items: ['Celery'] },
          { label: 'Data Layer', items: ['PostgreSQL', 'Redis'] },
        ]
  }, [detectedServices, detectedInfra])

  return (
    <div
      className='flex h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden'
      style={{
        background: [
          'radial-gradient(ellipse 65% 50% at 50% -5%, rgba(245,185,66,0.07) 0%, transparent 60%)',
          'radial-gradient(ellipse 45% 40% at 50% 62%, rgba(245,185,66,0.03) 0%, transparent 55%)',
        ].join(', '),
      }}
    >
      {/* Subtle grid texture */}
      <div
        className='pointer-events-none absolute inset-0'
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <style>{`
        @keyframes badgePop {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes titleIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes travelDot {
          0%   { left: -6px; opacity: 0; }
          6%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { left: calc(100% + 6px); opacity: 0; }
        }
      `}</style>

      <div className='relative flex w-full max-w-[900px] flex-col gap-5'>

        {/* ── Section 1: Success Hero ── */}
        <div className='flex flex-col items-center gap-4 text-center'>
          <span
            className='inline-flex items-center gap-2.5 rounded-full bg-[rgba(255,196,0,0.08)] px-6 py-2 text-[12px] font-bold uppercase tracking-[0.2em] text-[#E8B84B]'
            style={{ animation: 'badgePop 280ms ease-out both' }}
          >
            <span className='h-1.5 w-1.5 rounded-full bg-[#E8B84B]' />
            Step 1 Complete
          </span>

          <h2
            className='font-extrabold leading-[0.95] tracking-[-0.065em] text-white'
            style={{
              fontSize: 'clamp(52px, 5.2vw, 80px)',
              animation: 'titleIn 380ms ease-out 80ms both',
            }}
          >
            Repository
            <br />
            <span className='bg-[linear-gradient(90deg,#FFF2C4_0%,#FFD35C_30%,#E8B84B_62%,#C49000_100%)] bg-clip-text text-transparent'>
              Analyzed.
            </span>
          </h2>

          <p
            className='max-w-[660px] text-[17px] leading-[1.65] text-white/48'
            style={{ animation: 'titleIn 380ms ease-out 140ms both' }}
          >
            Your application stack has been identified and a production-ready infrastructure
            blueprint is ready for configuration.
          </p>
        </div>

        {/* ── Section 2: Transformation Visualization ── */}
        <div
          className='flex items-center'
          style={{ animation: 'cardIn 360ms ease-out 210ms both' }}
        >
          {/* Left — GitHub source */}
          <div className='flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] px-6 py-4'>
            <div className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.07]'>
              <GitHubLogo className='h-5 w-5' />
            </div>
            <div className='min-w-0'>
              <p className='max-w-[160px] truncate text-[15px] font-semibold text-white/85'>
                {repoShort}
              </p>
              <p className='text-[11px] text-white/35'>Source repository</p>
            </div>
          </div>

          {/* Connector */}
          <div className='relative mx-5 h-px flex-1'>
            <div className='h-full bg-gradient-to-r from-white/8 via-[rgba(245,185,66,0.5)] to-white/8' />
            <div
              className='absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#E8B84B] shadow-[0_0_8px_rgba(245,185,66,0.65)]'
              style={{ animation: 'travelDot 2.6s ease-in-out infinite' }}
            />
          </div>

          {/* Right — Blueprint output */}
          <div className='flex items-center gap-4 rounded-2xl border border-[rgba(255,196,0,0.14)] bg-[rgba(255,196,0,0.04)] px-6 py-4'>
            <div className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[rgba(255,196,0,0.1)] text-[#E8B84B]'>
              <Layers3 className='h-5 w-5' strokeWidth={2.2} />
            </div>
            <div>
              <p className='text-[15px] font-semibold text-white/85'>Blueprint ready</p>
              <p className='text-[11px] text-white/35'>Infrastructure draft</p>
            </div>
          </div>
        </div>

        {/* ── Section 3: Repository Summary Card ── */}
        <div
          className='w-full rounded-[22px] border border-white/[0.08] bg-[rgba(8,8,8,0.72)] px-8 py-6'
          style={{ animation: 'cardIn 360ms ease-out 300ms both' }}
        >
          <div className='flex items-center gap-4'>
            <div className='grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.06]'>
              <GitHubLogo className='h-6 w-6' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-[17px] font-semibold tracking-[-0.02em] text-white'>
                {selectedRepo || 'bk9571/test-app'}
              </p>
              <div className='mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-white/42'>
                <span className='inline-flex items-center gap-1.5'>
                  <GitBranch className='h-3.5 w-3.5 text-[#E8B84B]' strokeWidth={2.4} />
                  {selectedBranch || 'main'}
                </span>
                <span className='text-white/20'>·</span>
                <span>{isMonorepo ? 'monorepo' : 'single-service'}</span>
              </div>
            </div>
          </div>

          <div className='mt-5 flex flex-wrap gap-2.5'>
            {stackSummary.map((item) => (
              <StackPill key={item}>{item}</StackPill>
            ))}
          </div>
        </div>

        {/* ── Section 4: Detected Architecture ── */}
        <div
          className='w-full rounded-[22px] border border-white/[0.06] bg-[rgba(255,255,255,0.015)] px-8 py-5'
          style={{ animation: 'cardIn 360ms ease-out 380ms both' }}
        >
          <p className='mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/28'>
            Detected Architecture
          </p>
          <div className='flex items-start justify-between'>
            {archLayers.map((layer, idx) => (
              <ArchLayer
                key={layer.label}
                label={layer.label}
                items={layer.items}
                isLast={idx === archLayers.length - 1}
              />
            ))}
          </div>
        </div>

        {/* ── Section 4.5: Cloud Compliance Checklist ── */}
        <CompliancePanel complianceFindings={complianceFindings} compliancePrompt={compliancePrompt} />

        {/* ── Section 5: CTA Readout ── */}
        <div
          className='flex flex-col items-center gap-1 pb-1 text-center'
          style={{ animation: 'cardIn 360ms ease-out 450ms both' }}
        >
          <p className='text-[15px] font-semibold text-white/70'>Ready to continue?</p>
          <p className='max-w-[500px] text-[13px] text-white/35'>
            Configure infrastructure preferences, scaling requirements, and deployment settings.
          </p>
        </div>

      </div>
    </div>
  )
}
