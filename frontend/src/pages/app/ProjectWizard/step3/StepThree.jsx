import { useEffect, useRef, useState } from 'react'
import { X, Database, Globe, Layers, Server, Settings2, Zap } from 'lucide-react'
import CanvasSurface from './canvas/CanvasSurface'
import CanvasNode from './canvas/CanvasNode'
import NodePopup from './canvas/NodePopup'
import ChatSidebar from './chat/ChatSidebar'
import ChatBubble from './chat/ChatBubble'
import CostPanel from './sidebar/CostPanel'
import useCanvasAgent from '../hooks/useCanvasAgent'

function StepThreePanel({
  projectId,
  setStep3InputPrefill,
  step3InputPrefill,
  step3ShowBanner,
  onDismissStep3Banner,
  onMetricsChange,
}) {
  const surfaceRef = useRef(null)
  const panState = useRef(null)
  const [activeDrawer, setActiveDrawer] = useState(null)

  const {
    canvasNodes,
    canvasConnections,
    canvasCost,
    totalCost,
    selectedNode,
    setSelectedNode,
    selected,
    surfaceBounds,
    nodePositions,
    setNodePositions,
    chatHistory,
    agentLoading,
    pendingOp,
    chatInput,
    setChatInput,
    chatInputRef,
    chatEndRef,
    clearConversation,
    confirmProposal,
    dismissProposal,
    handleSend,
  } = useCanvasAgent({ projectId, setStep3InputPrefill, step3InputPrefill })

  const iconByType = {
    service: Server,
    static: Globe,
    database: Database,
    cache: Zap,
    worker: Settings2,
    queue: Layers,
  }

  const accentByType = {
    service: 'border-l-blue-500',
    static: 'border-l-purple-500',
    database: 'border-l-green-500',
    cache: 'border-l-red-500',
    worker: 'border-l-orange-500',
    queue: 'border-l-yellow-500',
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setActiveDrawer(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!onMetricsChange) return
    onMetricsChange({ serviceCount: canvasNodes.length, estimatedMonthlyCost: totalCost })
  }, [canvasNodes.length, onMetricsChange, totalCost])

  const startPan = (event) => {
    if (event.target.closest('button')) return
    const el = surfaceRef.current
    if (!el) return
    panState.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop }
  }

  const movePan = (event) => {
    const el = surfaceRef.current
    if (!panState.current || !el) return
    el.scrollLeft = panState.current.left - (event.clientX - panState.current.x)
    el.scrollTop = panState.current.top - (event.clientY - panState.current.y)
  }

  const endPan = () => {
    panState.current = null
  }

  const openDrawer = (drawer) => {
    setActiveDrawer((current) => (current === drawer ? null : drawer))
  }

  const drawerMotion = (drawer) => {
    const isOpen = activeDrawer === drawer
    return isOpen
      ? 'translate-x-0 opacity-100 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]'
      : 'pointer-events-none translate-x-6 opacity-0 transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]'
  }

  const suggestedActions = [
    'Reduce monthly cost',
    'Explain this architecture',
    'Scale for 100k users',
    'Replace Redis with SQS',
    'Compare Redis vs SQS',
  ]

  const closeDrawerButtonClass =
    'grid h-9 w-9 place-items-center rounded-full border border-border bg-background/70 text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-accent hover:text-text-primary'

  return (
    <div className='relative flex h-full min-h-0 w-full flex-col gap-8'>
      <div className='relative min-h-[520px] min-w-0 flex-1 overflow-hidden rounded-[28px] border border-[rgba(255,196,0,0.22)] bg-background shadow-[0_0_0_1px_rgba(255,196,0,0.05),0_0_18px_rgba(255,196,0,0.04)]'>
        <CanvasSurface
          surfaceRef={surfaceRef}
          startPan={startPan}
          movePan={movePan}
          endPan={endPan}
          setSelectedNode={setSelectedNode}
          step3ShowBanner={step3ShowBanner}
          onDismissStep3Banner={onDismissStep3Banner}
          surfaceBounds={surfaceBounds}
          canvasNodes={canvasNodes}
          canvasConnections={canvasConnections}
          nodePositions={nodePositions}
          accentByType={accentByType}
          iconByType={iconByType}
          selectedNode={selectedNode}
          selected={selected}
          chatInputRef={chatInputRef}
          CanvasNode={CanvasNode}
          NodePopup={NodePopup}
          setChatInput={setChatInput}
        />

        <div className='pointer-events-none absolute bottom-8 right-8 z-30 flex flex-col items-end'>
          <div className='pointer-events-auto overflow-hidden rounded-[22px] border border-border bg-surface/90 shadow-[0_20px_40px_rgba(0,0,0,0.28)] backdrop-blur-md transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-accent hover:shadow-[0_24px_48px_rgba(0,0,0,0.32)]'>
            <button
              type='button'
              className='grid h-12 w-12 place-items-center border-b border-border text-xl text-text-primary transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:bg-white/[0.04] hover:text-accent'
              onClick={() => openDrawer('chat')}
              aria-label='Open chat drawer'
            >
              ✨
            </button>
            <button
              type='button'
              className='grid h-12 w-12 place-items-center text-sm font-semibold text-text-primary transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:bg-white/[0.04] hover:text-accent'
              onClick={() => openDrawer('cost')}
              aria-label='Open cost drawer'
            >
              $
            </button>
          </div>
        </div>

        {activeDrawer ? (
          <button
            type='button'
            aria-label='Close drawer backdrop'
            className='absolute inset-0 z-30 cursor-default bg-black/35 backdrop-blur-[4px]'
            onClick={() => setActiveDrawer(null)}
          />
        ) : null}

        <div
          className={`absolute inset-y-0 right-0 z-40 flex h-full min-h-0 w-full max-w-[420px] flex-col gap-8 border-l border-border bg-surface/98 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md ${drawerMotion('chat')}`}
          aria-hidden={activeDrawer !== 'chat'}
        >
          <div className='flex items-center justify-end px-4 pt-4'>
            <button
              type='button'
              className={closeDrawerButtonClass}
              onClick={() => setActiveDrawer(null)}
              aria-label='Close chat drawer'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
          <div className='min-h-0 flex-1 overflow-hidden px-4 pb-4'>
            {chatHistory.length === 0 ? (
              <div className='mb-4 rounded-[20px] border border-border bg-background/60 p-4'>
                <p className='text-sm font-medium text-text-primary'>Suggested Actions</p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {suggestedActions.map((action) => (
                    <button
                      key={action}
                      type='button'
                      className='rounded-full border border-border bg-surface px-3 py-2 text-xs text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-accent hover:text-text-primary'
                      onClick={() => {
                        setChatInput(action)
                        if (chatInputRef.current) chatInputRef.current.focus()
                      }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <ChatSidebar
              chatHistory={chatHistory}
              agentLoading={agentLoading}
              pendingOp={pendingOp}
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatInputRef={chatInputRef}
              chatEndRef={chatEndRef}
              clearConversation={clearConversation}
              confirmProposal={confirmProposal}
              dismissProposal={dismissProposal}
              handleSend={handleSend}
              ChatBubble={ChatBubble}
            />
          </div>
        </div>

        <div
          className={`absolute inset-y-0 right-0 z-40 flex h-full min-h-0 w-full max-w-[380px] flex-col gap-8 border-l border-border bg-surface/98 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md ${drawerMotion('cost')}`}
          aria-hidden={activeDrawer !== 'cost'}
        >
          <div className='flex items-center justify-end px-4 pt-4'>
            <button
              type='button'
              className={closeDrawerButtonClass}
              onClick={() => setActiveDrawer(null)}
              aria-label='Close cost drawer'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
          <div className='min-h-0 flex-1 overflow-hidden px-4 pb-4'>
            <CostPanel canvasCost={canvasCost} totalCost={totalCost} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default StepThreePanel
