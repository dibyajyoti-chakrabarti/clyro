import { AlertTriangle, Check, Copy, FileWarning, Loader2, RefreshCw, Terminal } from 'lucide-react'
import { useState } from 'react'

// Step 1's setup screen: the repo has no usable CLYRO.md, so tell the user how to
// produce one. Covers both "no contract at all" and "contract is malformed" —
// the remedy is the same command, and the only difference is whether we can show
// them what specifically is wrong.
const CARD_CLASS =
  'w-full rounded-[22px] border border-white/[0.06] bg-[rgba(255,255,255,0.015)] px-7 py-6'

// Absolute, because the user pastes this into their own terminal — a relative
// path would be useless there. Same default as the api client.
const SKILL_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/skill/clyro-scan`

const INSTALL_COMMAND = `mkdir -p ~/.claude/skills/clyro-scan && curl -sL ${SKILL_URL} -o ~/.claude/skills/clyro-scan/SKILL.md`

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — the text is selectable either way */
    }
  }

  return (
    <button
      type='button'
      onClick={handleCopy}
      className='inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/75 transition-colors hover:bg-white/[0.08]'
    >
      {copied ? <Check className='h-3.5 w-3.5' strokeWidth={2.2} /> : <Copy className='h-3.5 w-3.5' strokeWidth={2} />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function CommandBlock({ command, caption }) {
  return (
    <div>
      {caption && (
        <p className='mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/25'>{caption}</p>
      )}
      <div className='flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/40 px-4 py-3'>
        <Terminal className='mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E8B84B]' strokeWidth={2.2} />
        <code className='min-w-0 flex-1 break-all font-mono text-[12.5px] leading-relaxed text-white/75'>
          {command}
        </code>
        <CopyButton value={command} />
      </div>
    </div>
  )
}

function Step({ index, title, children }) {
  return (
    <div className='flex gap-4'>
      <div className='grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#E8B84B]/35 bg-[#E8B84B]/10 text-[12px] font-bold text-[#E8B84B]'>
        {index}
      </div>
      <div className='min-w-0 flex-1 pt-0.5'>
        <p className='text-[14.5px] font-semibold text-white/85'>{title}</p>
        <div className='mt-2.5 space-y-3'>{children}</div>
      </div>
    </div>
  )
}

export default function ContractSetup({
  mode = 'missing',
  errors = [],
  selectedRepo,
  selectedBranch,
  onRecheck,
  rechecking = false,
}) {
  const isInvalid = mode === 'invalid'

  return (
    <div
      className='h-full min-h-0 w-full overflow-y-auto'
      style={{
        background:
          'radial-gradient(ellipse 65% 50% at 50% -5%, rgba(245,185,66,0.07) 0%, transparent 60%)',
      }}
    >
      <style>{`
        @keyframes contractIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className='mx-auto flex w-full max-w-[820px] flex-col gap-5 px-5 py-8 sm:px-9 sm:py-10'>
        <div className='flex flex-col items-center gap-3 text-center'>
          <div
            className={`grid h-11 w-11 place-items-center rounded-full border ${
              isInvalid
                ? 'border-red-400/30 bg-red-400/10 text-red-300'
                : 'border-[#E8B84B]/30 bg-[#E8B84B]/10 text-[#E8B84B]'
            }`}
            style={{ animation: 'contractIn 360ms ease-out both' }}
          >
            {isInvalid ? <FileWarning className='h-5 w-5' /> : <Terminal className='h-5 w-5' />}
          </div>

          <h2
            className='font-extrabold leading-[1.05] tracking-[-0.05em] text-white'
            style={{ fontSize: 'clamp(30px, 4.2vw, 46px)', animation: 'contractIn 380ms ease-out 60ms both' }}
          >
            {isInvalid ? (
              <>
                Your{' '}
                <span className='bg-[linear-gradient(90deg,#FFF2C4_0%,#FFD35C_30%,#E8B84B_62%,#C49000_100%)] bg-clip-text text-transparent'>
                  CLYRO.md
                </span>{' '}
                needs a fix.
              </>
            ) : (
              <>
                Scan your repo{' '}
                <span className='bg-[linear-gradient(90deg,#FFF2C4_0%,#FFD35C_30%,#E8B84B_62%,#C49000_100%)] bg-clip-text text-transparent'>
                  locally
                </span>
                .
              </>
            )}
          </h2>

          <p
            className='max-w-[600px] text-[15px] leading-[1.6] text-white/48'
            style={{ animation: 'contractIn 380ms ease-out 120ms both' }}
          >
            {isInvalid ? (
              <>
                Clyro found a <span className='font-mono text-white/70'>CLYRO.md</span> on{' '}
                <span className='text-white/70'>{selectedBranch}</span>, but couldn't read it. Regenerate it
                and push again.
              </>
            ) : (
              <>
                Clyro reads a <span className='font-mono text-white/70'>CLYRO.md</span> contract from your
                repo instead of scanning it in the cloud. Your own coding agent writes it, and fixes
                anything that would break the deploy first.
              </>
            )}
          </p>
        </div>

        {isInvalid && errors.length > 0 && (
          <div
            className='w-full rounded-[22px] border border-red-400/20 bg-red-400/[0.04] px-7 py-6'
            style={{ animation: 'contractIn 360ms ease-out 180ms both' }}
          >
            <div className='mb-3 flex items-center gap-2'>
              <AlertTriangle className='h-4 w-4 text-red-300' strokeWidth={2.2} />
              <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-red-300/80'>
                {errors.length} problem{errors.length === 1 ? '' : 's'} in CLYRO.md
              </p>
            </div>
            <ul className='space-y-2'>
              {errors.map((error) => (
                <li key={error} className='flex gap-2.5 text-[13px] leading-snug text-white/60'>
                  <span className='mt-[7px] h-1 w-1 shrink-0 rounded-full bg-red-400/60' />
                  <span className='min-w-0 font-mono'>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={CARD_CLASS} style={{ animation: 'contractIn 360ms ease-out 220ms both' }}>
          <p className='mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/28'>
            {isInvalid ? 'Regenerate the contract' : 'Three commands in your terminal'}
          </p>

          <div className='space-y-6'>
            <Step index={1} title='Install the skill into Claude Code'>
              <CommandBlock command={INSTALL_COMMAND} />
              <p className='text-[12.5px] leading-snug text-white/40'>
                Using Cursor, Aider, or another agent? Copy the skill and paste it as your prompt
                instead.
                <span className='ml-2 inline-flex align-middle'>
                  <a
                    href={SKILL_URL}
                    target='_blank'
                    rel='noreferrer'
                    className='text-[#E8B84B]/85 underline decoration-[#E8B84B]/30 underline-offset-2 hover:text-[#E8B84B]'
                  >
                    View the skill
                  </a>
                </span>
              </p>
            </Step>

            <Step index={2} title='Run it in your repo'>
              <CommandBlock command='/clyro-scan --fix' />
              <p className='text-[12.5px] leading-snug text-white/40'>
                It detects your stack and env vars, fixes what isn't cloud compliant, commits each fix,
                and pushes to{' '}
                <span className='font-mono text-white/60'>{selectedBranch || 'your branch'}</span> after
                asking you. Use <span className='font-mono text-white/60'>/clyro-scan</span> alone to
                write the contract without touching your git history.
              </p>
            </Step>

            <Step index={3} title='Come back and check'>
              <p className='text-[12.5px] leading-snug text-white/40'>
                Clyro looks for <span className='font-mono text-white/60'>CLYRO.md</span> at the root of{' '}
                <span className='font-mono text-white/60'>{selectedRepo}</span> on{' '}
                <span className='font-mono text-white/60'>{selectedBranch}</span>. Make sure the push
                landed on that branch.
              </p>
            </Step>
          </div>
        </div>

        <div
          className='flex flex-wrap items-center justify-end gap-3'
          style={{ animation: 'contractIn 360ms ease-out 300ms both' }}
        >
          <button
            type='button'
            onClick={onRecheck}
            disabled={rechecking}
            className='inline-flex items-center gap-2 rounded-[16px] border border-[#F2D57B]/60 bg-[linear-gradient(180deg,#FFD54A,#F6B700)] px-6 py-3 text-[15px] font-semibold text-black shadow-[0_0_24px_rgba(232,184,75,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'
          >
            {rechecking ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Checking {selectedBranch}…
              </>
            ) : (
              <>
                <RefreshCw className='h-4 w-4' />
                I've pushed CLYRO.md, check again
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
