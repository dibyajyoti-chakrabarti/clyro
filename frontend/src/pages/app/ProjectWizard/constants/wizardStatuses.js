export const STATUS_STEP = {
  created: 1, repo_connected: 1, scanning: 1, scan_complete: 2,
  intent_collected: 3, canvas_draft: 3, canvas_finalized: 4,
  // A failed deployment is a Step-4-scoped problem (the retry UI lives there,
  // in ProvisionLog.jsx) — bouncing all the way back to Step 1 on reload would
  // silently discard the user's repo connection, finalized architecture, AWS
  // connection, and validated template, none of which need redoing.
  provisioning: 4, live: 5, failed: 4,
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
