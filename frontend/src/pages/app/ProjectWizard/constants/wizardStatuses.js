export const STATUS_STEP = {
  created: 1, repo_connected: 1, scanning: 1, scan_complete: 2,
  intent_collected: 3, canvas_draft: 3, canvas_finalized: 4,
  provisioning: 4, live: 5, failed: 1,
}

export const STATUS_ORDER = [
  'created', 'repo_connected', 'scanning', 'scan_complete',
  'intent_collected', 'canvas_draft', 'canvas_finalized',
  'provisioning', 'live',
]

export function getCompletedSteps(status) {
  const idx = STATUS_ORDER.indexOf(status)
  const done = new Set()
  if (idx >= 3) done.add(1)
  if (idx >= 4) done.add(2)
  if (idx >= 6) done.add(3)
  if (idx >= 7) done.add(4)
  return done
}
