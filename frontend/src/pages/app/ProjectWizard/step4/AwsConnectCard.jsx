import { ArrowRight, Box, Check, Clock, Link2, Lock, ShieldCheck } from 'lucide-react'
import { WizardPanel } from '../../../../components/wizard/WizardPanel'
import Button from '../../../../components/ui/Button'

const GOLD = '#D4A017'
const GOLD_10 = 'rgba(212, 160, 23, 0.1)'
const GOLD_25 = 'rgba(212, 160, 23, 0.25)'
const GOLD_30 = 'rgba(212, 160, 23, 0.3)'
const GOLD_50 = 'rgba(212, 160, 23, 0.5)'
const WHITE_03 = 'rgba(255, 255, 255, 0.03)'
const WHITE_05 = 'rgba(255, 255, 255, 0.05)'
const WHITE_08 = 'rgba(255, 255, 255, 0.08)'
const WHITE_55 = 'rgba(255, 255, 255, 0.55)'
const WHITE_60 = 'rgba(255, 255, 255, 0.6)'
const WHITE_70 = 'rgba(255, 255, 255, 0.7)'
const WHITE_90 = 'rgba(255, 255, 255, 0.9)'
const WHITE_40 = 'rgba(255, 255, 255, 0.4)'
const WHITE_09 = 'rgba(255, 255, 255, 0.09)'
const WHITE_15 = 'rgba(255, 255, 255, 0.15)'

const featureRows = [
  { Icon: ShieldCheck, label: 'No access keys or secret keys required' },
  { Icon: Clock,       label: 'Role can be deleted to immediately revoke access' },
  { Icon: Box,         label: 'Same pattern used by Terraform Cloud and Pulumi' },
  { Icon: Lock,        label: 'Secure, temporary, and least-privilege access' },
]

function AwsConnectCard({
  cfnConsoleUrl,
  urlLoading,
  stackOpened,
  arnInput,
  setArnInput,
  verifying,
  verifyError,
  roleConnected,
  onOpenStack,
  onVerify,
  onContinue,
}) {
  return (
    <WizardPanel>
      <div style={{ width: '100%' }}>

        {/* Step badge */}
        <div style={{
          display: 'inline-flex',
          padding: '5px 12px',
          borderRadius: 6,
          background: GOLD_10,
          border: `1px solid ${GOLD_30}`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: GOLD,
        }}>
          Step 4 of 5
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.1, marginTop: 16, marginBottom: 0 }}>
          <span style={{ color: '#ffffff' }}>Connect your </span>
          <span style={{ color: GOLD }}>AWS</span>
          <span style={{ color: '#ffffff' }}> account</span>
        </h1>

        {/* Subtext */}
        <p style={{
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.55,
          color: WHITE_60,
          marginTop: 10,
          maxWidth: 560,
        }}>
          Clyro never stores your credentials. It uses a temporary IAM role that you can revoke at any time.
        </p>

        {/* Feature rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 28 }}>
          {featureRows.map(({ Icon, label }) => (
            <div key={label} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: WHITE_03,
              border: `1px solid ${WHITE_08}`,
              borderRadius: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                <span style={{ fontSize: 14, fontWeight: 500, color: WHITE_90 }}>{label}</span>
              </div>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: `1px solid ${GOLD_50}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: GOLD,
                flexShrink: 0,
              }}>
                <Check size={14} />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA bar */}
        <div style={{
          marginTop: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 28px',
          background: WHITE_03,
          border: `1px solid ${GOLD_25}`,
          borderRadius: 12,
          flexWrap: 'wrap',
          gap: 20,
        }}>
          {/* Left: icon + text */}
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
              <div style={{ fontSize: 16, fontWeight: 700, color: GOLD }}>
                You're one step away
              </div>
              <div style={{ fontSize: 13, fontWeight: 400, color: WHITE_55, marginTop: 4, maxWidth: 380 }}>
                Securely connect your AWS account using a temporary IAM role — no long-term credentials needed.
              </div>
            </div>
          </div>

          {/* Right: button + helper */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <button
              onClick={onOpenStack}
              disabled={urlLoading || !cfnConsoleUrl || roleConnected}
              style={{
                padding: '13px 24px',
                borderRadius: 8,
                background: urlLoading || !cfnConsoleUrl || roleConnected ? 'rgba(212, 160, 23, 0.4)' : GOLD,
                color: '#1a1200',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: urlLoading || !cfnConsoleUrl || roleConnected ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
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
            <div style={{ fontSize: 11, color: WHITE_40, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lock size={11} />
              You'll be redirected to AWS to continue securely.
            </div>
          </div>
        </div>

        {/* ARN input section — shown after stack is opened */}
        {stackOpened && !roleConnected ? (
          <div style={{ marginTop: 28 }}>
            <ol style={{ marginBottom: 12, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                <>Wait for the stack status to show <strong style={{ color: '#fff' }}>CREATE_COMPLETE</strong> (≈30s)</>,
                <>Click the <strong style={{ color: '#fff' }}>Outputs</strong> tab in the CloudFormation console</>,
                <>Copy the value next to <strong style={{ color: '#fff' }}>RoleArn</strong> — it starts with <code style={{ fontSize: 11, background: WHITE_05, padding: '1px 4px', borderRadius: 3 }}>arn:aws:iam::</code></>,
              ].map((text, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: WHITE_60 }}>
                  <span style={{ flexShrink: 0, fontWeight: 700, color: GOLD }}>{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type='text'
                placeholder='arn:aws:iam::123456789012:role/clyro-provisioning-…'
                value={arnInput}
                onChange={(e) => setArnInput(e.target.value)}
                style={{
                  flex: 1,
                  borderRadius: 8,
                  border: `1px solid ${WHITE_09}`,
                  background: 'var(--color-background, #0f0f0f)',
                  padding: '10px 14px',
                  fontSize: 14,
                  color: '#fff',
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = GOLD_50; e.target.style.boxShadow = `0 0 0 2px ${GOLD_10}` }}
                onBlur={(e) => { e.target.style.borderColor = WHITE_09; e.target.style.boxShadow = 'none' }}
              />
              <Button
                variant='secondary'
                disabled={!arnInput.trim() || verifying}
                onClick={onVerify}
              >
                {verifying ? (
                  <span className='h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin' />
                ) : 'Verify'}
              </Button>
            </div>
            {verifyError ? (
              <p style={{ marginTop: 8, fontSize: 12, color: '#f87171' }}>{verifyError}</p>
            ) : null}
          </div>
        ) : null}

        {/* Role connected confirmation */}
        {roleConnected ? (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#4ade80', margin: 0 }}>
              <Check size={16} strokeWidth={3} />
              IAM role connected
            </p>
            <Button variant='secondary' onClick={onContinue}>
              Continue
              <ArrowRight className='h-4 w-4' />
            </Button>
          </div>
        ) : null}

      </div>
    </WizardPanel>
  )
}

export default AwsConnectCard
