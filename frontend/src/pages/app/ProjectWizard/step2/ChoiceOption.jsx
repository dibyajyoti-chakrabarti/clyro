function ChoiceOption({ option, selected, onClick }) {
  const optionCardClass = (selectedValue, recommended) => {
    if (selectedValue) return 'border-accent bg-accent-soft/30 shadow-[0_0_0_1px_rgba(249,115,22,0.5),0_0_16px_rgba(249,115,22,0.1)]'
    if (recommended) return 'border-accent/40 bg-background hover:border-accent/70 ring-1 ring-accent/15 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
    return 'border-border bg-background hover:border-accent/60 hover:-translate-y-px'
  }

  return (
    <button
      type='button'
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-all duration-150 ${optionCardClass(selected, option.recommended)}`}
    >
      <div className='flex items-center gap-2'>
        <p className='text-sm font-medium text-text-primary'>{option.label}</p>
        {option.recommended && (
          <span className='rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent'>Recommended</span>
        )}
      </div>
      {option.note ? <p className='mt-1 text-xs font-normal text-text-muted'>{option.note}</p> : null}
    </button>
  )
}

export default ChoiceOption
