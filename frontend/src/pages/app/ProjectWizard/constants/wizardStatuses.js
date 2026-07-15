export const STATUS_ORDER = [
  'created', 'repo_connected', 'secrets_staged', 'scanning', 'scan_complete',
  'aws_connect_pending', 'aws_connected', 'aws_verified', 'aws_mismatch',
  'intent_collected', 'canvas_draft', 'canvas_finalized',
  'iac_generated', 'iac_validated',
  'provisioning', 'failed', 'live',
]

export const STATUS_STEP = {
  created: 1, repo_connected: 1, scanning: 1, scan_complete: 1, secrets_staged: 1,
  aws_connect_pending: 2, aws_connected: 2, aws_verified: 2, aws_mismatch: 2,
  intent_collected: 3,
  canvas_draft: 4, canvas_finalized: 4,
  iac_generated: 5, iac_validated: 5,
  provisioning: 6, failed: 6,
  live: 7,
}

// Derives completed steps from STATUS_STEP rather than a hardcoded STATUS_ORDER
// threshold: every step below the current status's step is done. Not imported
// anywhere live today (StepProgress/ProgressBar compute completedSteps from the
// current `step` number instead), but kept in this shape in case something
// starts using it.
export function getCompletedSteps(status) {
  const currentStep = STATUS_STEP[status] ?? 1
  const done = new Set()
  for (let s = 1; s < currentStep; s += 1) {
    done.add(s)
  }
  return done
}
