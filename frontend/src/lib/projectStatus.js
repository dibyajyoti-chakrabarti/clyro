// Single source of truth for how a project's backend `status` maps to a label,
// a badge style, a lifecycle group, and a wizard-progress step. Mirrors the
// backend enum `Project.Status` (core/models.py:136-166) — keep the two in sync.
//
// Before this module the Dashboard, ProjectStatusBadge and ProjectCard each kept
// their own partial map, so any status they didn't list rendered as "Unknown".

// Shared badge palettes (Tailwind utility strings) reused across statuses.
const BADGE = {
  neutral: 'border-white/[0.08] bg-white/[0.04] text-text-muted',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  green: 'border-green-500/30 bg-green-500/10 text-green-400',
  live: 'border-green-500/40 bg-green-500/10 text-green-400 shadow-[0_0_8px_rgba(34,197,94,0.15)]',
  red: 'border-red-500/30 bg-red-500/10 text-red-400',
}

// group: coarse lifecycle bucket used for counts + gating.
//   idle        — nothing provisioned, not being worked on
//   in_progress — somewhere in the 7-step wizard
//   live        — infrastructure is up
//   paused      — infrastructure exists but scaled to 0
//   failed      — a step failed / needs attention
//   deleting    — teardown / purge in flight
//   deleted     — terminal, resources gone
// step: 1-based position in the 7-step wizard (null when not applicable).
const META = {
  created:            { label: 'Not started',        badge: BADGE.neutral, group: 'idle',        step: 0 },
  repo_connected:     { label: 'Repo connected',     badge: BADGE.blue,    group: 'in_progress', step: 1 },
  secrets_staged:     { label: 'Secrets staged',     badge: BADGE.blue,    group: 'in_progress', step: 1 },
  scanning:           { label: 'Analysing…',         badge: BADGE.accent,  group: 'in_progress', step: 1 },
  scan_complete:      { label: 'Scan complete',      badge: BADGE.green,   group: 'in_progress', step: 1 },
  intent_collected:   { label: 'Intent collected',   badge: BADGE.green,   group: 'in_progress', step: 2 },
  canvas_draft:       { label: 'Designing…',         badge: BADGE.amber,   group: 'in_progress', step: 3 },
  canvas_finalized:   { label: 'Architecture ready', badge: BADGE.green,   group: 'in_progress', step: 3 },
  aws_connect_pending:{ label: 'Connecting AWS…',    badge: BADGE.accent,  group: 'in_progress', step: 4 },
  aws_connected:      { label: 'AWS connected',      badge: BADGE.green,   group: 'in_progress', step: 4 },
  aws_verified:       { label: 'AWS verified',       badge: BADGE.green,   group: 'in_progress', step: 4 },
  aws_mismatch:       { label: 'AWS mismatch',       badge: BADGE.amber,   group: 'in_progress', step: 4 },
  iac_generated:      { label: 'IaC generated',      badge: BADGE.green,   group: 'in_progress', step: 5 },
  iac_validated:      { label: 'IaC validated',      badge: BADGE.green,   group: 'in_progress', step: 5 },
  provisioning:       { label: 'Provisioning…',      badge: BADGE.accent,  group: 'in_progress', step: 6 },
  live:               { label: 'Live',               badge: BADGE.live,    group: 'live',        step: 7 },
  paused:             { label: 'Paused',             badge: BADGE.amber,   group: 'paused',      step: 7 },
  failed:             { label: 'Failed',             badge: BADGE.red,     group: 'failed',      step: null },
  deleting:           { label: 'Deleting…',          badge: BADGE.red,     group: 'deleting',    step: null },
  deleted:            { label: 'Deleted',            badge: BADGE.neutral, group: 'deleted',     step: null },
}

const FALLBACK = { label: 'Unknown', badge: BADGE.neutral, group: 'idle', step: null }

export const WIZARD_TOTAL_STEPS = 7

// Full metadata for a status. Never returns undefined — unknown values degrade
// to a neutral fallback (which should now be unreachable for real statuses).
export function statusMeta(status) {
  return META[String(status ?? '').toLowerCase()] ?? FALLBACK
}

export const statusLabel = (status) => statusMeta(status).label
export const statusBadge = (status) => statusMeta(status).badge
export const statusGroup = (status) => statusMeta(status).group

export const isLive = (status) => statusGroup(status) === 'live'
export const isFailed = (status) => statusGroup(status) === 'failed'
export const isInProgress = (status) => statusGroup(status) === 'in_progress'
export const isDeleting = (status) => statusGroup(status) === 'deleting'

// A project has real (billable) infrastructure that can be managed / torn down.
export const hasInfra = (status) => ['live', 'paused'].includes(statusGroup(status))

// { step, total } for a wizard progress indicator, or null when not applicable
// (idle / failed / deleting / deleted).
export function wizardStep(status) {
  const { step } = statusMeta(status)
  if (step === null || step === 0) return null
  return { step, total: WIZARD_TOTAL_STEPS }
}

// CTA verb for a project row, given its status.
export function statusCta(status) {
  const group = statusGroup(status)
  if (group === 'live' || group === 'paused' || group === 'deleted') return 'Open'
  if (group === 'failed') return 'Retry'
  if (statusMeta(status).step === 0) return 'Start'
  return 'Continue'
}
