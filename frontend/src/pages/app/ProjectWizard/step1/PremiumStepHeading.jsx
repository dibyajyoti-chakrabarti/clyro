function PremiumStepHeading({ prefix, highlight, className = '' }) {
  return (
    <h2
      className={`mt-5 text-[clamp(44px,5.8vw,64px)] font-bold leading-[1.05] tracking-[-0.04em] text-white ${className}`.trim()}
    >
      {prefix}{' '}
      <span className='bg-[linear-gradient(180deg,#FFE98A_0%,#FFD95C_30%,#FFC107_65%,#C99200_100%)] bg-clip-text text-transparent [-webkit-background-clip:text]'>
        {highlight}
      </span>
    </h2>
  )
}

export default PremiumStepHeading
