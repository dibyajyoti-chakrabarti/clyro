import { useEffect, useRef, useState } from 'react'
import { api } from '../../../../api'

const CHAT_WELCOME = {
  role: 'agent',
  text: 'Your architecture has been generated from your repository scan. You can ask me to explain any component, compare services, or suggest changes.',
}

export default function useCanvasAgent({ projectId, setStep3InputPrefill, step3InputPrefill }) {
  const [canvas, setCanvas] = useState(null)
  const [nodePositions, setNodePositions] = useState({})
  const [selectedNode, setSelectedNode] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState([CHAT_WELCOME])
  const [agentLoading, setAgentLoading] = useState(false)
  const [pendingOp, setPendingOp] = useState(null)
  const chatEndRef = useRef(null)
  const chatInputRef = useRef(null)

  useEffect(() => {
    if (!step3InputPrefill) {
      return
    }

    setChatInput(step3InputPrefill)
    if (chatInputRef.current) {
      chatInputRef.current.focus()
    }
    setStep3InputPrefill('')
  }, [step3InputPrefill, setStep3InputPrefill])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatHistory])

  useEffect(() => {
    if (!projectId) return
    let active = true
    api.getCanvas(projectId)
      .then((res) => {
        if (!active) return
        setCanvas(res.canvas)
        setNodePositions(res.positions || {})
      })
      .catch(() => {})
    api.getCanvasChat(projectId)
      .then((res) => {
        if (!active) return
        if (res.messages && res.messages.length > 0) {
          setChatHistory([CHAT_WELCOME, ...res.messages])
        }
        if (res.pending_operation) {
          setPendingOp(res.pending_operation)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [projectId])

  const appendAgent = (text) => setChatHistory((prev) => [...prev, { role: 'agent', text }])

  const applyResult = (res) => {
    if (res.outcome === 'applied' && res.version) {
      setCanvas(res.version.canvas)
      setNodePositions(res.version.positions || {})
      setPendingOp(null)
      appendAgent(res.message || 'Done Ã¢â‚¬â€ I updated the canvas.')
    } else if (res.outcome === 'proposal') {
      setPendingOp(res.operation || null)
      appendAgent(res.message)
    } else {
      setPendingOp(null)
      appendAgent(res.message)
    }
  }

  const handleSend = async () => {
    const message = chatInput.trim()
    if (!message || agentLoading) {
      return
    }

    const priorTurns = chatHistory.slice(-8)
    setChatHistory((prev) => [...prev, { role: 'user', text: message }])
    setChatInput('')
    setAgentLoading(true)
    try {
      const res = await api.canvasAgent(projectId, { prompt: message, history: priorTurns })
      applyResult(res)
    } catch {
      appendAgent('Something went wrong talking to the canvas agent.')
    } finally {
      setAgentLoading(false)
    }
  }

  const confirmProposal = async () => {
    if (!pendingOp || agentLoading) {
      return
    }
    setAgentLoading(true)
    try {
      const res = await api.canvasAgent(projectId, { confirm: true, pending_operation: pendingOp })
      applyResult(res)
    } catch {
      appendAgent('Could not apply the change.')
    } finally {
      setAgentLoading(false)
    }
  }

  const dismissProposal = () => {
    setPendingOp(null)
    appendAgent('Okay, leaving it as is.')
    api.dismissCanvasProposal(projectId).catch(() => {})
  }

  const clearConversation = () => {
    setChatHistory([CHAT_WELCOME])
    setPendingOp(null)
    setSelectedNode(null)
    api.flushCanvasChat(projectId).catch(() => {})
  }

  const canvasNodes = canvas?.nodes || []
  const canvasConnections = canvas?.connections || []
  const canvasCost = canvas?.cost || []
  const totalCost = canvasCost.reduce((sum, item) => sum + item.monthly, 0)
  const selected = canvasNodes.find((node) => node.id === selectedNode) || null

  const surfaceBounds = canvasNodes.reduce(
    (acc, node) => {
      const pos = nodePositions[node.id]
      if (!pos) return acc
      return { width: Math.max(acc.width, pos.x + 220), height: Math.max(acc.height, pos.y + 180) }
    },
    { width: 0, height: 520 },
  )

  return {
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
  }
}
