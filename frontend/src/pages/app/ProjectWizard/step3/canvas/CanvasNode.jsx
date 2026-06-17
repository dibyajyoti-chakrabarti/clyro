export default function CanvasNode({ node, isSelected, position, accentByType, iconByType, onClick }) {
  const NodeIcon = iconByType[node.type] || iconByType.service

  return (
    <button
      type='button'
      className={`absolute w-44 rounded-lg border border-border bg-surface px-3 py-2 text-left shadow-sm transition hover:ring-1 hover:ring-accent ${accentByType[node.type]} border-l-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={onClick}
    >
      <div className='flex items-center gap-2'>
        <NodeIcon className='h-4 w-4 shrink-0 text-text-muted' />
        <p className='truncate text-sm font-medium text-text-primary'>{node.label}</p>
      </div>
      <div className='mt-3'>
        <span className='rounded-full border border-border bg-background px-2 py-1 text-xs text-text-muted'>{node.aws}</span>
      </div>
    </button>
  )
}
