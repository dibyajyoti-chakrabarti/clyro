import Button from './Button'

export default function ConfirmDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmText = 'Confirm',
}) {
  if (!open) return null

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6'>
      <div className='w-full max-w-md rounded-xl border border-border bg-surface p-5'>
        <h3 className='text-base font-semibold text-text-primary'>{title}</h3>
        <p className='mt-2 text-sm font-normal text-text-muted'>{description}</p>
        <div className='mt-5 flex justify-end gap-3'>
          <Button variant='ghost' onClick={onCancel}>
            Cancel
          </Button>
          <Button variant='danger' onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
