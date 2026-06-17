export default function NodePopup({ selected, position, chatInputRef, setChatInput }) {
  return (
    <div
      className='absolute z-20 w-56 rounded-lg border border-border bg-surface p-3 shadow-lg'
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(event) => event.stopPropagation()}
    >
      <p className='text-sm font-semibold text-text-primary'>{selected.label}</p>
      <p className='mt-1 text-xs text-text-muted'>Type: {selected.type}</p>
      <p className='text-xs text-text-muted'>AWS: {selected.aws}</p>
      <button
        type='button'
        className='mt-3 text-xs font-medium text-accent hover:underline'
        onClick={() => {
          setChatInput(`Tell me about the ${selected.label}`)
          if (chatInputRef.current) {
            chatInputRef.current.focus()
          }
        }}
      >
        Ask agent about this â†’
      </button>
    </div>
  )
}
