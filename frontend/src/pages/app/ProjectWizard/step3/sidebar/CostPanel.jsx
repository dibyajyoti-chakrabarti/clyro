export default function CostPanel({ canvasCost, totalCost }) {
  return (
    <div className='flex-[0.55] min-w-[220px] border-t border-border px-4 py-3'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-semibold text-text-primary'>Estimated cost</p>
        <p className='text-lg font-semibold text-text-primary'>${totalCost} / month</p>
      </div>
      <div className='mt-3 space-y-1.5'>
        {canvasCost.map((item) => (
          <div key={item.label} className='flex items-center justify-between text-xs'>
            <p className='text-text-muted'>{item.label}</p>
            <p className='text-text-primary'>${item.monthly}/mo</p>
          </div>
        ))}
      </div>
      <p className='mt-3 text-xs text-text-muted'>us-east-1 Â· 730 hrs/month Â· excl. data transfer</p>
    </div>
  )
}
