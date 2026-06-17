export default function CanvasSurface({
  surfaceRef,
  startPan,
  movePan,
  endPan,
  setSelectedNode,
  setChatInput,
  step3ShowBanner,
  onDismissStep3Banner,
  surfaceBounds,
  canvasNodes,
  canvasConnections,
  nodePositions,
  accentByType,
  iconByType,
  selectedNode,
  selected,
  chatInputRef,
  CanvasNode,
  NodePopup,
}) {
  return (
    <div
      ref={surfaceRef}
      className='relative flex-[1.9] min-w-0 cursor-grab select-none overflow-auto rounded-xl border border-border/70 bg-background active:cursor-grabbing'
      onMouseDown={startPan}
      onMouseMove={movePan}
      onMouseUp={endPan}
      onMouseLeave={endPan}
      onClick={() => setSelectedNode(null)}
    >
      {step3ShowBanner ? (
        <div className='sticky top-0 z-20 border-b border-green-500/20 bg-green-500/10 px-4 py-3'>
          <div className='flex items-center justify-between'>
            <p className='text-sm font-medium text-green-300'>Architecture finalized</p>
            <button
              type='button'
              className='text-xs text-green-300/80 hover:text-green-200'
              onClick={(event) => {
                event.stopPropagation()
                onDismissStep3Banner()
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div
        className='relative min-h-[520px]'
        style={{
          minWidth: `${surfaceBounds.width}px`,
          minHeight: `${surfaceBounds.height}px`,
          backgroundColor: 'transparent',
          backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        <svg className='pointer-events-none absolute inset-0 h-full w-full'>
          <defs>
            <marker id='arrow-head' markerWidth='8' markerHeight='8' refX='6.5' refY='4' orient='auto'>
              <path d='M 0 0 L 8 4 L 0 8 z' className='fill-slate-500/70' />
            </marker>
          </defs>
          {(() => {
            const W = 176
            const H = 74
            const nodeRects = canvasNodes
              .map((n) => {
                const p = nodePositions[n.id]
                return p ? { id: n.id, x: p.x, y: p.y } : null
              })
              .filter(Boolean)

            const obstacleFor = (ax, ay, bx, by, skip) => {
              const margin = 6
              for (const r of nodeRects) {
                if (skip.includes(r.id)) continue
                const minX = r.x - margin
                const maxX = r.x + W + margin
                const minY = r.y - margin
                const maxY = r.y + H + margin
                for (let i = 0; i <= 24; i++) {
                  const t = i / 24
                  const px = ax + (bx - ax) * t
                  const py = ay + (by - ay) * t
                  if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
                    return { cx: r.x + W / 2, cy: r.y + H / 2 }
                  }
                }
              }
              return null
            }

            return canvasConnections.map((connection) => {
              const fromPos = nodePositions[connection.from]
              const toPos = nodePositions[connection.to]
              if (!fromPos || !toPos) return null
              const cx1 = fromPos.x + W / 2
              const cy1 = fromPos.y + H / 2
              const cx2 = toPos.x + W / 2
              const cy2 = toPos.y + H / 2
              const edge = (cx, cy, tx, ty) => {
                const dx = tx - cx
                const dy = ty - cy
                if (!dx && !dy) return [cx, cy]
                const scale = Math.min(
                  dx ? W / 2 / Math.abs(dx) : Infinity,
                  dy ? H / 2 / Math.abs(dy) : Infinity,
                )
                return [cx + dx * scale, cy + dy * scale]
              }
              const [x1, y1] = edge(cx1, cy1, cx2, cy2)
              const [x2, y2] = edge(cx2, cy2, cx1, cy1)
              const midX = (x1 + x2) / 2
              const midY = (y1 + y2) / 2

              let cpx = midX
              let cpy = midY
              const obstacle = obstacleFor(x1, y1, x2, y2, [connection.from, connection.to])
              if (obstacle) {
                const len = Math.hypot(x2 - x1, y2 - y1) || 1
                const perpX = -(y2 - y1) / len
                const perpY = (x2 - x1) / len
                const side = (obstacle.cx - midX) * perpX + (obstacle.cy - midY) * perpY
                const sign = side > 0 ? -1 : 1
                cpx = midX + sign * 240 * perpX
                cpy = midY + sign * 240 * perpY
              }
              const lx = 0.25 * x1 + 0.5 * cpx + 0.25 * x2
              const ly = 0.25 * y1 + 0.5 * cpy + 0.25 * y2

              return (
                <g key={`${connection.from}-${connection.to}`}>
                  <path
                    d={`M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`}
                    fill='none'
                    stroke='rgba(148, 163, 184, 0.75)'
                    strokeWidth='1.5'
                    markerEnd='url(#arrow-head)'
                  />
                  <text
                    x={lx}
                    y={ly - 4}
                    textAnchor='middle'
                    fontSize='10'
                    fill='rgba(148, 163, 184, 0.9)'
                  >
                    {connection.label}
                  </text>
                </g>
              )
            })
          })()}
        </svg>

        {canvasNodes.map((node) => {
          const pos = nodePositions[node.id]
          if (!pos) return null
          const isSelected = selectedNode === node.id

          return (
            <CanvasNode
              key={node.id}
              node={node}
              isSelected={isSelected}
              position={pos}
              accentByType={accentByType}
              iconByType={iconByType}
              onClick={(event) => {
                event.stopPropagation()
                setSelectedNode(node.id)
              }}
            />
          )
        })}

        {selected && nodePositions[selected.id] ? (
          <NodePopup
            selected={selected}
            position={{ x: nodePositions[selected.id].x, y: nodePositions[selected.id].y + 68 }}
            chatInputRef={chatInputRef}
            setChatInput={setChatInput}
          />
        ) : null}
      </div>
    </div>
  )
}
