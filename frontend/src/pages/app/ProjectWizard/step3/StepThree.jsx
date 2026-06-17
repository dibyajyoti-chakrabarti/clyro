import { useRef } from 'react'
import {
  Database,
  Globe,
  Layers,
  Server,
  Settings2,
  Zap,
} from 'lucide-react'
import CanvasSurface from './canvas/CanvasSurface'
import CanvasNode from './canvas/CanvasNode'
import NodePopup from './canvas/NodePopup'
import ChatSidebar from './chat/ChatSidebar'
import ChatBubble from './chat/ChatBubble'
import CostPanel from './sidebar/CostPanel'
import useCanvasAgent from '../hooks/useCanvasAgent'

function StepThreePanel({ projectId, setStep3InputPrefill, step3InputPrefill, step3ShowBanner, onDismissStep3Banner }) {
  const surfaceRef = useRef(null)
  const panState = useRef(null)

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

  return (
    <div className='mt-6 flex h-[calc(100vh-19rem)] min-h-[440px] gap-4'>
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

      <CostPanel canvasCost={canvasCost} totalCost={totalCost} />
    </div>
  )
}

export default StepThreePanel
