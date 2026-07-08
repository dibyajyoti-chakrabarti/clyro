import {
  CheckCircle2,
  Copy,
  XCircle,
  GitBranch,
  Layers3,
  Globe,
  Server,
  Cpu,
  Database,
  Zap,
  HardDrive,
  MessageSquare,
} from 'lucide-react'
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
    <span
      style={{
        display: 'inline-flex',
        padding: '6px 14px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '12px',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
        margin: '4px 6px 4px 0',
      }}
    >
      {children}
    </span>
  )
}

function SummaryCard({ icon: Icon, title, subtitle }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          background: 'rgba(212,160,23,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon style={{ width: '18px', height: '18px', color: '#D4A017' }} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#ffffff',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '2px 0 0 0' }}>
          {subtitle}
        </p>
      </div>
    </div>
  )
}

function StatusBadge({ label, color }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: `${color}1f`,
        color: color,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: 'currentColor',
          flexShrink: 0,
        }}
      />
      {label}
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
}) {
  const stackSummary = useMemo(() => {
    const inferred = [...detectedServices, ...detectedInfra].slice(0, 7)
    return inferred.length > 0 ? inferred : ['Django', 'React', 'Celery', 'PostgreSQL']
  }, [detectedInfra, detectedServices])

  const repoShort = selectedRepo ? selectedRepo.split('/').pop() : 'repository'

  const tableRows = useMemo(() => {
    const rows = []
    if (detectedServices.some((s) => s.toLowerCase().includes('react')))
      rows.push({ layer: 'Frontend', tech: 'React', Icon: Globe, role: 'Web interface', statusLabel: 'Detected', color: '#5eead4' })
    if (detectedServices.some((s) => s.toLowerCase().includes('django')))
      rows.push({ layer: 'Backend', tech: 'Django', Icon: Server, role: 'Application server', statusLabel: 'Detected', color: '#86efac' })
    if (detectedServices.some((s) => s.toLowerCase().includes('celery')))
      rows.push({ layer: 'Workers', tech: 'Celery', Icon: Cpu, role: 'Background processing', statusLabel: 'Detected', color: '#fdba74' })
    if (detectedInfra.some((s) => s.toLowerCase().includes('postgres')))
      rows.push({ layer: 'Database', tech: 'PostgreSQL', Icon: Database, role: 'Primary database', statusLabel: 'Detected', color: '#93c5fd' })
    if (detectedInfra.some((s) => s.toLowerCase().includes('redis')))
      rows.push({ layer: 'Cache', tech: 'Redis', Icon: Zap, role: 'Caching layer', statusLabel: 'Detected', color: '#fca5a5' })
    if (detectedInfra.some((s) => s.toLowerCase().includes('s3')))
      rows.push({ layer: 'Storage', tech: 'S3', Icon: HardDrive, role: 'Object storage', statusLabel: 'Detected', color: '#fde68a' })
    if (detectedInfra.some((s) => s.toLowerCase().includes('sqs')))
      rows.push({ layer: 'Queue', tech: 'SQS', Icon: MessageSquare, role: 'Message queue', statusLabel: 'Detected', color: '#c4b5fd' })
    return rows.length
      ? rows
      : [
          { layer: 'Frontend', tech: 'React', Icon: Globe, role: 'Web interface', statusLabel: 'Detected', color: '#5eead4' },
          { layer: 'Backend', tech: 'Django', Icon: Server, role: 'Application server', statusLabel: 'Detected', color: '#86efac' },
        ]
  }, [detectedServices, detectedInfra])

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        padding: '40px 32px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
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
      `}</style>

      {/* Section A + B — top two-column row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '40px',
          alignItems: 'start',
        }}
      >
        {/* Section A — Status badge + headline + summary */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '999px',
              background: 'rgba(212,160,23,0.12)',
              border: '1px solid rgba(212,160,23,0.3)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#D4A017',
              alignSelf: 'flex-start',
              animation: 'badgePop 280ms ease-out both',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#D4A017',
                flexShrink: 0,
              }}
            />
            Step 1 Complete
          </span>

          <h2
            style={{
              fontSize: '40px',
              fontWeight: 800,
              lineHeight: 1.05,
              margin: 0,
              animation: 'titleIn 380ms ease-out 80ms both',
            }}
          >
            <span style={{ color: '#ffffff', display: 'block' }}>Repository</span>
            <span
              style={{
                display: 'block',
                background: 'linear-gradient(90deg,#FFF2C4 0%,#FFD35C 30%,#E8B84B 62%,#C49000 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Analyzed.
            </span>
          </h2>

          <p
            style={{
              fontSize: '15px',
              fontWeight: 400,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.6)',
              margin: 0,
              maxWidth: '520px',
              animation: 'titleIn 380ms ease-out 140ms both',
            }}
          >
            Your application stack has been identified and a production-ready
            infrastructure blueprint is ready for configuration.
          </p>
        </div>

        {/* Section B — Two summary cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            alignSelf: 'center',
            animation: 'cardIn 360ms ease-out 210ms both',
          }}
        >
          <SummaryCard
            icon={GitHubLogo}
            title={repoShort}
            subtitle="Source repository"
          />
          <SummaryCard
            icon={Layers3}
            title="Blueprint ready"
            subtitle="Infrastructure draft"
          />
        </div>
      </div>

      {/* Section C — Repo metadata + tech badge pills */}
      <div
        style={{
          padding: '20px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          animation: 'cardIn 360ms ease-out 300ms both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <GitHubLogo style={{ width: '20px', height: '20px' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#ffffff',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedRepo || 'repository'}
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.42)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <GitBranch style={{ width: '13px', height: '13px', color: '#E8B84B' }} strokeWidth={2.4} />
                {selectedBranch || 'main'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
              <span>{isMonorepo ? 'monorepo' : 'single-service'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {stackSummary.map((item) => (
            <StackPill key={item}>{item}</StackPill>
          ))}
        </div>
      </div>

      {/* Section D — Detected Architecture table */}
      <div style={{ animation: 'cardIn 360ms ease-out 380ms both' }}>
        <p
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
            margin: '0 0 10px 0',
          }}
        >
          Detected Architecture
        </p>
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Layer', 'Technology', 'Role', 'Status'].map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.4)',
                      padding: '12px 20px',
                      background: 'rgba(255,255,255,0.02)',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr key={row.layer}>
                  <td
                    style={{
                      padding: '14px 20px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.85)',
                      borderBottom: idx < tableRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    {row.layer}
                  </td>
                  <td
                    style={{
                      padding: '14px 20px',
                      borderBottom: idx < tableRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <row.Icon
                          style={{ width: '14px', height: '14px', color: row.color }}
                          strokeWidth={2}
                        />
                      </div>
                      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                        {row.tech}
                      </span>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '14px 20px',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.85)',
                      borderBottom: idx < tableRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    {row.role}
                  </td>
                  <td
                    style={{
                      padding: '14px 20px',
                      borderBottom: idx < tableRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    }}
                  >
                    <StatusBadge label={row.statusLabel} color={row.color} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section E — Cloud Compliance Checklist */}
      <CompliancePanel complianceFindings={complianceFindings} compliancePrompt={compliancePrompt} />
    </div>
  )
}
