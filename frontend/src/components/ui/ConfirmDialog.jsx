import { useEffect, useState } from 'react'
import Button from './Button'

// Shared destructive-confirm modal. Backwards compatible with the original
// {open,title,description,onCancel,onConfirm,confirmText} API; adds:
//   consequences  — string[] rendered as a bullet list of what will be destroyed
//   loading       — disables buttons + shows the confirm in a busy state
//   requireTyped   — a string the user must type to enable Confirm (e.g. the
//                    project name), for irreversible actions on live resources
export default function ConfirmDialog({
  open,
  title,
  description,
  consequences,
  onCancel,
  onConfirm,
  confirmText = 'Confirm',
  loading = false,
  requireTyped,
}) {
  const [typed, setTyped] = useState('')

  // Reset the typed value each time the dialog opens.
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  // Escape cancels (unless mid-action).
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, loading, onCancel])

  if (!open) return null

  const typedOk = !requireTyped || typed.trim() === requireTyped.trim()
  const confirmDisabled = loading || !typedOk

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm'
      onClick={() => { if (!loading) onCancel?.() }}
    >
      <div
        className='w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)]'
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className='text-base font-semibold text-text-primary'>{title}</h3>
        {description && (
          <p className='mt-2 text-sm font-normal text-text-muted'>{description}</p>
        )}

        {consequences?.length > 0 && (
          <ul className='mt-3 space-y-1.5 rounded-lg border border-danger/20 bg-danger/[0.06] p-3'>
            {consequences.map((item) => (
              <li key={item} className='flex gap-2 text-xs text-text-muted'>
                <span className='mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger/70' />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {requireTyped && (
          <div className='mt-4'>
            <label className='block text-xs text-text-muted'>
              Type <span className='font-semibold text-text-primary'>{requireTyped}</span> to confirm
            </label>
            <input
              autoFocus
              value={typed}
              disabled={loading}
              onChange={(e) => setTyped(e.target.value)}
              className='mt-1.5 w-full rounded-lg border border-white/[0.09] bg-background px-3 py-2 text-sm text-text-primary caret-accent outline-none transition-colors focus-visible:border-danger/50 focus-visible:ring-2 focus-visible:ring-danger/20 disabled:opacity-50'
            />
          </div>
        )}

        <div className='mt-5 flex justify-end gap-3'>
          <Button variant='ghost' onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant='danger' onClick={onConfirm} disabled={confirmDisabled}>
            {loading && (
              <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
            )}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
