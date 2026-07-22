import { AlertTriangle, ArrowLeft, ArrowRight, Box, CheckCircle2, Clock, Link2, Lock, ShieldCheck } from 'lucide-react'
import { WizardPanel } from '../../../../components/wizard/WizardPanel'
import connectAwsImg from '../../../../assets/steps/connectAws.webp'

const GOLD = '#D4A017'
const GOLD_08 = 'rgba(212, 160, 23, 0.08)'
const GOLD_10 = 'rgba(212, 160, 23, 0.1)'
const GOLD_15 = 'rgba(212, 160, 23, 0.15)'
const GOLD_25 = 'rgba(212, 160, 23, 0.25)'
const GOLD_30 = 'rgba(212, 160, 23, 0.3)'
const GOLD_50 = 'rgba(212, 160, 23, 0.5)'
const GOLD_60 = 'rgba(212, 160, 23, 0.6)'
const WHITE_03 = 'rgba(255, 255, 255, 0.03)'
const WHITE_05 = 'rgba(255, 255, 255, 0.05)'
const WHITE_06 = 'rgba(255, 255, 255, 0.06)'
const WHITE_08 = 'rgba(255, 255, 255, 0.08)'
const WHITE_55 = 'rgba(255, 255, 255, 0.55)'
const WHITE_60 = 'rgba(255, 255, 255, 0.6)'
const WHITE_70 = 'rgba(255, 255, 255, 0.7)'
const WHITE_90 = 'rgba(255, 255, 255, 0.9)'
const WHITE_40 = 'rgba(255, 255, 255, 0.4)'
const WHITE_09 = 'rgba(255, 255, 255, 0.09)'
const WHITE_15 = 'rgba(255, 255, 255, 0.15)'

// Card shell shared by the two Section 2 cards and the bottom CTA — dark
// charcoal, barely-there border, no shadow/glow (premium/minimal per design brief).
const cardStyle = {
  background: '#121212',
  border: `1px solid ${WHITE_08}`,
  borderRadius: 20,
  padding: 32,
}

const trustPoints = [
  { Icon: ShieldCheck, heading: 'No access keys or secret keys required', description: 'Avoid long-term credentials and reduce security risks.' },
  { Icon: Clock, heading: 'Role can be deleted to immediately revoke access', description: 'You\'re always in control of your access.' },
  { Icon: Box, heading: 'Same pattern used by Terraform Cloud and Pulumi', description: 'Industry-standard, secure, and trusted by leading tools.' },
  { Icon: Lock, heading: 'Secure, temporary, and least-privilege access', description: 'Access is scoped down to only what\'s needed.' },
]

function AwsConnectCard({
  accountType,
  onAccountTypeChange,
  cfnConsoleUrl,
  urlLoading,
  stackOpened,
  arnInput,
  setArnInput,
  verifying,
  verifyError,
  roleConnected,
  accountTypeMismatch,
  onOpenStack,
  onVerify,
  onBack,
  onContinue,
}) {
  return (
    <WizardPanel>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 28, marginTop: -24 }}>

        {/* Section 1: Hero */}
        <div className='flex flex-col-reverse items-center gap-8 lg:flex-row lg:items-center lg:justify-between'>
          <h1
            className='w-full text-[44px] sm:text-[56px] lg:w-[48%] lg:flex-none lg:text-[72px]'
            style={{ fontWeight: 800, lineHeight: 1.05, margin: 0 }}
          >
            <span style={{ color: '#ffffff' }}>Connect your</span>
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #FFFFFF 0%, #F3E2B8 32%, #E3B341 66%, #A97C1E 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AWS account
            </span>
          </h1>
          <div className='flex w-full items-center justify-center lg:w-auto lg:flex-1 lg:justify-end'>
            <img
              src={connectAwsImg}
              alt=''
              style={{ maxHeight: 320, width: 'auto', maxWidth: '100%', objectFit: 'contain', flexShrink: 0 }}
            />
          </div>
        </div>

        {/* Section 2: main content — two equal cards */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          {/* Left: why temporary IAM role */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Why we use a temporary IAM role</h2>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column' }}>
              {trustPoints.map(({ Icon, heading, description }, index) => (
                <div key={heading}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 0' }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: GOLD_10,
                      border: `1px solid ${GOLD_25}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: GOLD,
                    }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: WHITE_90, margin: 0 }}>{heading}</p>
                      <p style={{ fontSize: 13, color: WHITE_55, margin: '4px 0 0' }}>{description}</p>
                    </div>
                  </div>
                  {index < trustPoints.length - 1 ? <div style={{ height: 1, background: WHITE_06 }} /> : null}
                </div>
              ))}
            </div>
          </div>

          {/* Right: AWS account selection */}
          <div style={cardStyle}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>What type of AWS account is this?</h2>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Paid account */}
              <button
                type='button'
                onClick={() => onAccountTypeChange('paid')}
                style={{
                  textAlign: 'left',
                  borderRadius: 16,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'border-color 150ms, background 150ms',
                  border: accountType === 'paid' ? `1.5px solid ${GOLD_60}` : `1px solid ${WHITE_08}`,
                  background: accountType === 'paid' ? GOLD_08 : WHITE_03,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldCheck size={16} color={accountType === 'paid' ? GOLD : WHITE_60} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: WHITE_90 }}>Paid account</span>
                    <span style={{
                      borderRadius: 999,
                      border: `1px solid ${GOLD_30}`,
                      background: GOLD_10,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 600,
                      color: GOLD,
                    }}>
                      Recommended
                    </span>
                  </div>
                  <span style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `1.5px solid ${accountType === 'paid' ? GOLD : WHITE_15}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}>
                    {accountType === 'paid' ? <span style={{ width: 9, height: 9, borderRadius: '50%', background: GOLD }} /> : null}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: WHITE_55, margin: '6px 0 0 26px' }}>I'm fine paying for the right resources.</p>
                <p style={{ fontSize: 13, color: WHITE_70, margin: '12px 0 0 26px' }}>You'll be billed for AWS resources you use.</p>
                <p style={{ fontSize: 12, color: WHITE_55, margin: '4px 0 0 26px' }}>Clyro helps you build securely and cost-effectively.</p>
              </button>

              {/* Free tier */}
              <button
                type='button'
                onClick={() => onAccountTypeChange('free_tier')}
                style={{
                  textAlign: 'left',
                  borderRadius: 16,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'border-color 150ms, background 150ms',
                  border: accountType === 'free_tier' ? `1.5px solid ${GOLD_60}` : `1px solid ${WHITE_08}`,
                  background: accountType === 'free_tier' ? GOLD_08 : WHITE_03,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: accountType === 'free_tier' ? WHITE_90 : WHITE_60 }}>Free Tier</span>
                  <span style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: `1.5px solid ${accountType === 'free_tier' ? GOLD : WHITE_15}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {accountType === 'free_tier' ? <span style={{ width: 9, height: 9, borderRadius: '50%', background: GOLD }} /> : null}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: WHITE_55, margin: '6px 0 0' }}>I want to stay within free limits.</p>
                <p style={{ fontSize: 12, color: WHITE_40, margin: '8px 0 0' }}>NAT Gateway and some services will be excluded to avoid charges.</p>
              </button>
            </div>

            {/* Trust message */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 20 }}>
              <ShieldCheck size={14} color={WHITE_55} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: WHITE_55, margin: 0, lineHeight: 1.5 }}>
                Clyro never stores your credentials. It uses a temporary IAM role that you can{' '}
                <span style={{ color: GOLD }}>revoke at any time</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: bottom CTA */}
        <div style={{ ...cardStyle, padding: '24px 28px' }} className='flex flex-col items-stretch gap-5 lg:flex-row lg:items-center lg:justify-between'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: WHITE_05,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: WHITE_70,
              flexShrink: 0,
            }}>
              <Link2 size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>You're one step away</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: WHITE_55, marginTop: 4, maxWidth: 380 }}>
                Securely connect your AWS account using a temporary IAM role — no long-term credentials needed.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }} className='items-stretch lg:items-end'>
            <button
              onClick={onOpenStack}
              disabled={urlLoading || !cfnConsoleUrl || roleConnected}
              style={{
                padding: '13px 24px',
                borderRadius: 10,
                background: urlLoading || !cfnConsoleUrl || roleConnected ? 'rgba(212, 160, 23, 0.4)' : GOLD,
                color: '#1a1200',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: urlLoading || !cfnConsoleUrl || roleConnected ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'filter 150ms, transform 150ms',
              }}
              onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.filter = 'brightness(1.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none' }}
            >
              {urlLoading ? (
                <>
                  <span className='animate-spin' style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    display: 'inline-block',
                  }} />
                  Preparing…
                </>
              ) : (
                <>
                  Open AWS CloudFormation console
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <div style={{ fontSize: 11, color: WHITE_40, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
              <Lock size={11} />
              You'll be redirected to AWS to continue securely.
            </div>
          </div>
        </div>

        {/* ARN input section — shown after stack is opened */}
        {stackOpened && !roleConnected ? (
          <div style={{
            border: `1px solid ${GOLD_15}`,
            borderRadius: 20,
            padding: '28px 28px 24px',
            background: 'rgba(255, 255, 255, 0.015)',
          }}>
            {/* Top section: heading + 3-step explainer */}
            <div style={{ fontSize: 20, fontWeight: 700, color: GOLD, marginBottom: 40, textAlign: 'center' }}>
              How it works
            </div>

            <div className='grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6'>
              {[
                <>Wait for the stack status to show <strong style={{ color: '#fff' }}>CREATE_COMPLETE</strong> (≈30s)</>,
                <>Click the <strong style={{ color: '#fff' }}>Outputs</strong> tab in the CloudFormation console</>,
                <>Copy the value next to <strong style={{ color: '#fff' }}>RoleArn</strong> — it starts with <code style={{ fontSize: 11, background: WHITE_05, padding: '1px 4px', borderRadius: 3 }}>arn:aws:iam::</code></>,
              ].map((text, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: GOLD_10,
                    border: '1px solid rgba(212, 160, 23, 0.4)',
                    color: GOLD,
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <span style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.75)', maxWidth: 220 }}>{text}</span>
                </div>
              ))}
            </div>

            {/* Open vertical spacing before the ARN input — no divider */}
            <div style={{ height: 44 }} />

            {/* Bottom section: Input + Verify row */}
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <input
                type='text'
                placeholder='arn:aws:iam::123456789012:role/clyro-provisioning-…'
                value={arnInput}
                onChange={(e) => setArnInput(e.target.value)}
                className='w-full sm:flex-1'
                style={{
                  padding: '12px 16px',
                  background: WHITE_03,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  color: WHITE_60,
                  fontSize: 13,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = GOLD_50; e.target.style.boxShadow = `0 0 0 2px ${GOLD_10}` }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.target.style.boxShadow = 'none' }}
              />
              <button
                disabled={!arnInput.trim() || verifying}
                onClick={onVerify}
                className='w-full sm:w-auto'
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  background: WHITE_05,
                  border: `1px solid ${WHITE_15}`,
                  color: WHITE_70,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: !arnInput.trim() || verifying ? 'not-allowed' : 'pointer',
                  opacity: !arnInput.trim() || verifying ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                {verifying ? (
                  <span className='animate-spin' style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '2px solid currentColor',
                    borderTopColor: 'transparent',
                    display: 'inline-block',
                  }} />
                ) : 'Verify'}
              </button>
            </div>
            {verifyError ? (
              <p style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>{verifyError}</p>
            ) : null}
          </div>
        ) : null}

        {/* Role connected confirmation — a single premium success bar carrying
            both the confirmation and the Back/Continue nav (the shared wizard
            footer steps aside for step 2 once connected, see ProjectWizard.jsx). */}
        {roleConnected ? (
          <div
            className='flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:justify-between'
            style={{
              background: '#121212',
              border: `1px solid ${WHITE_08}`,
              borderRadius: 18,
              padding: '20px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <CheckCircle2 size={20} color='#4ade80' />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#4ade80', margin: 0 }}>IAM role connected</p>
                <p style={{ fontSize: 13, color: WHITE_55, margin: '2px 0 0' }}>
                  You're securely connected using a temporary IAM role.
                </p>
              </div>
            </div>

            <div className='flex flex-col items-stretch gap-4 sm:flex-row sm:items-center'>
              <button
                type='button'
                onClick={onBack}
                className='w-full sm:w-[176px]'
                style={{
                  height: 52,
                  borderRadius: 18,
                  padding: '0 24px',
                  background: WHITE_05,
                  border: `1px solid ${WHITE_15}`,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'border-color 180ms, background 180ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = WHITE_15.replace('0.15', '0.3'); e.currentTarget.style.background = WHITE_08 }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = WHITE_15; e.currentTarget.style.background = WHITE_05 }}
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                type='button'
                onClick={onContinue}
                className='w-full sm:w-[176px]'
                style={{
                  height: 52,
                  borderRadius: 18,
                  padding: '0 24px',
                  background: GOLD,
                  border: `1px solid ${GOLD_60}`,
                  color: '#1a1200',
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  transition: 'filter 180ms, transform 180ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; e.currentTarget.style.transform = 'none' }}
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : null}

        {/* Best-effort: the backend compares the account's actual verified plan
            type (queried live from AWS) against what the user picked above and
            can flag account_type_mismatch on the verify response. Renders only
            if/when the backend sends it. */}
        {roleConnected && accountTypeMismatch ? (
          <p className='mx-auto flex max-w-md items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm text-amber-300'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            This AWS account looks like a {accountType === 'free_tier' ? 'paid' : 'free-tier'} account,
            not what you selected above. Infrastructure will be generated for what we detected — you
            can continue, or re-verify with the correct account.
          </p>
        ) : null}
      </div>
    </WizardPanel>
  )
}

export default AwsConnectCard
