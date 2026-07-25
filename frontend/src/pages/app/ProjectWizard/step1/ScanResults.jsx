import {
  AlertTriangle,
  Boxes,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  Copy,
  GitBranch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import GitHubLogo from '../../../../components/common/GitHubLogo'
import reactLogo from '../../../../assets/logos/react-svgrepo-com.svg'
import djangoLogo from '../../../../assets/logos/django-icon-svgrepo-com.svg'
import celeryLogo from '../../../../assets/logos/celery-svgrepo-com.svg'
import postgresqlLogo from '../../../../assets/logos/postgresql-svgrepo-com.svg'
import redisLogo from '../../../../assets/logos/redis-svgrepo-com.svg'
import awsLogo from '../../../../assets/logos/AWS_Logo.svg'
import terraformLogo from '../../../../assets/logos/terraform_logo.svg'
import cloudfrontLogo from '../../../../assets/logos/cloudfront_logo.svg'
import s3Logo from '../../../../assets/logos/Simple Storage Service.svg'
import sqsLogo from '../../../../assets/logos/Simple Queue Service.svg'

const SEVERITY_META = {
  blocker: {
    label: 'Blocks deploy',
    badgeClass: 'border-red-400/25 bg-red-400/10 text-red-300',
    iconClass: 'text-red-400',
  },
  warning: {
    label: 'Will misbehave',
    badgeClass: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    iconClass: 'text-amber-400',
  },
  info: {
    label: 'Info',
    badgeClass: 'border-sky-400/25 bg-sky-400/10 text-sky-300',
    iconClass: 'text-sky-400',
  },
}

const PASSED_META = {
  label: 'Passed',
  badgeClass: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  iconClass: 'text-emerald-400',
}

const CARD_CLASS =
  'w-full rounded-[22px] border border-[rgba(255,179,0,0.15)] bg-[#111111] px-7 py-6 transition-colors duration-200 hover:border-[rgba(255,179,0,0.3)]'

const STACK_ICON_RULES = [
  { match: 'react', icon: reactLogo },
  { match: 'django', icon: djangoLogo },
  { match: 'celery', icon: celeryLogo },
  { match: 'postgres', icon: postgresqlLogo },
  { match: 'redis', icon: redisLogo },
  { match: 'terraform', icon: terraformLogo },
  { match: 'cloudfront', icon: cloudfrontLogo },
  { match: 's3', icon: s3Logo },
  { match: 'storage', icon: s3Logo },
  { match: 'sqs', icon: sqsLogo },
  { match: 'queue', icon: sqsLogo },
  { match: 'aws', icon: awsLogo },
]

function getStackIcon(name) {
  const lower = name.toLowerCase()
  return STACK_ICON_RULES.find((rule) => lower.includes(rule.match))?.icon
}

function ProgressFlow() {
  const steps = [
    { label: 'Repository Connected', Icon: GitBranch },
    { label: 'Stack Detected', Icon: Boxes },
    { label: 'Repository Analyzed', Icon: ShieldCheck, final: true },
  ]
  return (
    <div className='relative mx-auto flex w-full max-w-[620px] items-start'>
      <div
        className='absolute top-8 h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(232,184,75,0.18),rgba(232,184,75,0.6)_50%,rgba(232,184,75,0.18))]'
        style={{ left: '16.6%', right: '16.6%' }}
      />
      {steps.map((s) => (
        <div key={s.label} className='relative flex flex-1 flex-col items-center gap-3'>
          <div
            className={`relative z-10 grid h-16 w-16 shrink-0 place-items-center rounded-full border text-[#111111] ${
              s.final
                ? 'border-[#FFE9A8] bg-[linear-gradient(180deg,#FFE9A8,#E8B84B)] shadow-[0_0_26px_rgba(232,184,75,0.5)]'
                : 'border-[#E8B84B] bg-[#E8B84B]'
            }`}
          >
            <s.Icon className='h-7 w-7' strokeWidth={2.4} />
          </div>
          <p className='max-w-[130px] text-center text-[13px] font-medium leading-snug text-white/65'>{s.label}</p>
        </div>
      ))}
    </div>
  )
}

function ComplianceRow({ finding, expanded, onToggle }) {
  const meta = finding.passed ? PASSED_META : SEVERITY_META[finding.severity] || SEVERITY_META.info
  const Icon = finding.passed ? CheckCircle2 : AlertTriangle

  return (
    <div className='border-b border-white/[0.05] last:border-b-0'>
      <div className='flex items-center gap-3 py-3.5'>
        <Icon className={`h-4 w-4 shrink-0 ${meta.iconClass}`} strokeWidth={2} />
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
        <p className='min-w-0 flex-1 truncate text-[14px] font-medium text-white/85'>{finding.title}</p>
        <button
          type='button'
          onClick={onToggle}
          aria-expanded={expanded}
          className='inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11.5px] font-medium text-white/60 transition-colors hover:border-white/20 hover:text-white/85'
        >
          Details
          {expanded ? <ChevronUp className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />}
        </button>
      </div>

      <div
        className='grid transition-[grid-template-rows] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]'
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className='overflow-hidden'>
          <div className='space-y-2 pb-4 pl-7 pr-1 text-[12.5px] leading-relaxed text-white/50'>
            <p>{finding.detail}</p>
            {finding.fix_hint && (
              <p className='rounded-lg border border-[rgba(255,196,0,0.14)] bg-[rgba(255,196,0,0.04)] px-3 py-2 text-white/60'>
                <span className='font-semibold text-[#E8B84B]'>Recommendation — </span>
                {finding.fix_hint}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ComplianceChecklistCard({ complianceFindings }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  if (!complianceFindings || complianceFindings.length === 0) return null

  const failedCount = complianceFindings.filter((f) => !f.passed).length
  const hasBlockers = complianceFindings.some((f) => !f.passed && f.severity === 'blocker')

  const toggle = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={CARD_CLASS} style={{ animation: 'cardIn 360ms ease-out 380ms both' }}>
      <div className='mb-3 flex items-center justify-between'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-white/28'>
          Cloud Compliance Checklist
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            failedCount === 0 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'
          }`}
        >
          {failedCount === 0 ? 'All checks passed' : `${failedCount} issue${failedCount === 1 ? '' : 's'} found`}
        </span>
      </div>

      <div>
        {complianceFindings.map((f) => (
          <ComplianceRow key={f.id} finding={f} expanded={expandedIds.has(f.id)} onToggle={() => toggle(f.id)} />
        ))}
      </div>

      {hasBlockers && (
        <p className='mt-3 text-[12.5px] leading-snug text-red-300/80'>
          Resolve the blockers above to continue — they will fail the build.
        </p>
      )}
    </div>
  )
}

function AIPromptCard({ compliancePrompt }) {
  const [copied, setCopied] = useState(false)
  if (!compliancePrompt) return null

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
    <div className={CARD_CLASS} style={{ animation: 'cardIn 360ms ease-out 450ms both' }}>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <Sparkles className='h-4 w-4 text-[#E8B84B]' strokeWidth={2.2} />
            <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-white/28'>
              AI Generated Fix Prompt
            </p>
          </div>
          <p className='mt-1.5 text-[13px] leading-snug text-white/45'>
            Paste this into any AI coding agent (Claude Code, Cursor, etc.) to resolve every detected issue.
          </p>
        </div>
        <button
          type='button'
          onClick={handleCopy}
          className='inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12.5px] font-medium text-white/75 transition-colors hover:bg-white/[0.08]'
        >
          <Copy className='h-3.5 w-3.5' strokeWidth={2} />
          {copied ? 'Copied!' : 'Copy Prompt'}
        </button>
      </div>

      <div className='mt-4'>
        <p className='mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white/25'>
          Prompt preview
        </p>
        <pre className='max-h-[280px] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.08] bg-black/40 p-4 font-mono text-[12px] leading-relaxed text-white/70'>
          {compliancePrompt}
        </pre>
      </div>

      <div className='mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.05] pt-4 text-[12px] text-white/40'>
        <span className='inline-flex items-center gap-1.5'>
          <CheckCircle2 className='h-3.5 w-3.5 text-emerald-400' strokeWidth={2} />
          Optimized for all AI coding agents
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <CheckCircle2 className='h-3.5 w-3.5 text-emerald-400' strokeWidth={2} />
          Includes all detected issues
        </span>
        <span className='inline-flex items-center gap-1.5'>
          <CheckCircle2 className='h-3.5 w-3.5 text-emerald-400' strokeWidth={2} />
          Ready to copy
        </span>
      </div>
    </div>
  )
}

function StackPill({ children }) {
  const icon = getStackIcon(children)
  return (
    <span className='inline-flex items-center gap-2 rounded-full border border-[rgba(255,196,0,0.18)] bg-[rgba(255,255,255,0.04)] px-[18px] py-[9px] text-[13px] font-medium text-white/75'>
      {icon && <img src={icon} alt='' className='h-4 w-4 shrink-0 object-contain' draggable={false} />}
      {children}
    </span>
  )
}

export default function ScanResults({
  selectedRepo,
  selectedBranch,
  isMonorepo,
  detectedServices,
  detectedInfra,
  onContinue,
  complianceFindings,
  compliancePrompt,
  canContinue = true,
}) {
  const stackSummary = useMemo(() => {
    const inferred = [...detectedServices, ...detectedInfra].slice(0, 7)
    return inferred.length > 0 ? inferred : ['Django', 'React', 'Celery', 'PostgreSQL']
  }, [detectedInfra, detectedServices])

  return (
    <div
      className='h-full min-h-0 w-full overflow-y-auto'
      style={{
        background: [
          'radial-gradient(ellipse 65% 50% at 50% -5%, rgba(245,185,66,0.07) 0%, transparent 60%)',
          'radial-gradient(ellipse 45% 40% at 50% 62%, rgba(245,185,66,0.03) 0%, transparent 55%)',
        ].join(', '),
      }}
    >
      <style>{`
        @keyframes titleIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className='mx-auto flex w-full max-w-[900px] flex-col gap-6 px-5 py-8 sm:px-9 sm:py-10'>

        {/* ── Hero ── */}
        <div className='flex flex-col items-center gap-4 pt-1 pb-2 text-center'>
          <h2
            className='whitespace-nowrap font-extrabold leading-[0.95] tracking-[-0.065em] text-white'
            style={{
              fontSize: 'clamp(34px, 5vw, 58px)',
              animation: 'titleIn 380ms ease-out 80ms both',
            }}
          >
            Repository{' '}
            <span className='bg-[linear-gradient(90deg,#FFF2C4_0%,#FFD35C_30%,#E8B84B_62%,#C49000_100%)] bg-clip-text text-transparent'>
              Analyzed.
            </span>
          </h2>

          <p
            className='max-w-[560px] text-[15px] leading-[1.6] text-white/48'
            style={{ animation: 'titleIn 380ms ease-out 140ms both' }}
          >
            Your application stack has been identified and every file has been checked against
            Clyro's cloud compliance rules.
          </p>

          <div className='mt-1' style={{ animation: 'cardIn 360ms ease-out 210ms both' }}>
            <ProgressFlow />
          </div>
        </div>

        {/* ── Repository Summary ── */}
        <div className={CARD_CLASS} style={{ animation: 'cardIn 360ms ease-out 260ms both' }}>
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

        {/* ── Cloud Compliance Checklist ── */}
        <ComplianceChecklistCard complianceFindings={complianceFindings} />

        {/* ── Continue (sits below the checklist, right-aligned to its edge) ── */}
        <div className='flex justify-end' style={{ animation: 'cardIn 360ms ease-out 400ms both' }}>
          <button
            type='button'
            onClick={onContinue}
            disabled={!canContinue}
            className='inline-flex items-center gap-2 rounded-[16px] border border-[#F2D57B]/60 bg-[linear-gradient(180deg,#FFD54A,#F6B700)] px-6 py-3 text-[15px] font-semibold text-black shadow-[0_0_24px_rgba(232,184,75,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_0_30px_rgba(232,184,75,0.3)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0'
          >
            Continue
            <ChevronRight className='h-4 w-4' />
          </button>
        </div>

        {/* ── AI Generated Fix Prompt ── */}
        <AIPromptCard compliancePrompt={compliancePrompt} />

        {/* spacing before the wizard shell's Continue button */}
        <div className='h-3' />
      </div>
    </div>
  )
}
