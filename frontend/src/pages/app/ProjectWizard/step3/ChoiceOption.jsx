function ChoiceOption({ option, selected, onClick }) {
  const optionCardClass = (selectedValue, recommended) => {
    if (selectedValue) {
      return 'border-2 border-[rgba(255,196,0,0.65)] bg-[linear-gradient(180deg,rgba(255,196,0,0.15),rgba(255,196,0,0.08))] shadow-[0_0_20px_rgba(255,196,0,0.15)] -translate-y-0.5'
    }
    if (recommended) {
      return 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,196,0,0.35)] hover:bg-[rgba(255,196,0,0.05)] hover:-translate-y-0.5'
    }
    return 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,196,0,0.35)] hover:bg-[rgba(255,196,0,0.05)] hover:-translate-y-0.5'
  }

  return (
    <button
      type='button'
      onClick={onClick}
      className={`w-full rounded-[18px] p-4 text-left transition-all duration-200 ${optionCardClass(selected, option.recommended)}`}
    >
      <div className='flex items-center gap-2'>
        <p className={`text-sm font-medium ${selected ? 'text-white' : 'text-white/72'}`}>{option.label}</p>
        {option.recommended && (
          <span className='rounded-full border border-[rgba(255,196,0,0.24)] bg-[rgba(255,196,0,0.08)] px-2 py-0.5 text-[10px] font-medium text-[#E8B84B]'>
            Recommended
          </span>
        )}
      </div>
      {option.note ? <p className='mt-1 text-xs font-normal text-white/52'>{option.note}</p> : null}
    </button>
  )
}

export default ChoiceOption
