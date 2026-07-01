import Lottie from 'lottie-react'
import { ArrowUp, ChevronDown, Layers, Shield, Sparkles, TrendingDown, Trash2, Users, X } from 'lucide-react'
import handLoadingAnimation from '../../../../../assets/loader_animation/logo_spinner_v3.json'
import Button from '../../../../../components/ui/Button'

export default function ChatSidebar({
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
  ChatBubble,
  onClose,
}) {
  const suggestedActions = [
    { label: 'Explain Architecture', Icon: Layers },
    { label: 'Reduce Cost', Icon: TrendingDown },
    { label: 'Review Security', Icon: Shield },
    { label: 'Scale to 100k Users', Icon: Users },
  ]

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-[rgba(255,193,7,0.10)] bg-[rgba(10,10,10,0.42)] shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_60px_rgba(255,193,7,0.05)] backdrop-blur-[20px]'>
      <div className='shrink-0 px-4 pt-4'>
        <div className='flex items-start justify-between gap-3 pb-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2'>
              <span className='grid h-11 w-11 place-items-center rounded-full border border-[rgba(255,193,7,0.12)] bg-[rgba(255,193,7,0.06)] text-accent'>
                <Sparkles className='h-6 w-6' />
              </span>
              <div className='min-w-0'>
                <p className='text-[16px] font-bold leading-5 tracking-tight text-text-primary'>Canvas Agent</p>
                <p className='mt-0.5 text-[12px] text-text-muted'>Architecture Assistant</p>
              </div>
            </div>
          </div>

          {onClose ? (
            <button
              type='button'
              onClick={onClose}
              title='Close panel'
              className='grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-white/[0.18] hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary'
            >
              <X className='h-4 w-4' />
            </button>
          ) : null}
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 scroll-smooth scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border'>
        <div className='space-y-4'>
          {chatHistory.map((message, index) => (
            <ChatBubble key={`${message.role}-${index}`} message={message} />
          ))}
          {chatHistory.length <= 1 && (
            <div className='flex flex-wrap gap-2 pt-1'>
              {suggestedActions.map(({ label, Icon }) => (
                <button
                  key={label}
                  type='button'
                  className='inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.03] px-3 py-2 text-xs font-medium text-text-primary transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-[rgba(255,193,7,0.18)] hover:bg-[rgba(255,193,7,0.08)] hover:shadow-[0_0_0_1px_rgba(255,193,7,0.08)]'
                  onClick={() => {
                    setChatInput(label)
                    if (chatInputRef.current) chatInputRef.current.focus()
                  }}
                >
                  <Icon className='h-3.5 w-3.5 shrink-0' />
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        {agentLoading ? (
          <div className='mt-4 flex justify-start'>
            <Lottie animationData={handLoadingAnimation} loop autoplay style={{ width: 80, height: 80 }} />
          </div>
        ) : null}
        <div ref={chatEndRef} />
      </div>

      {pendingOp ? (
        <div className='shrink-0 px-4 pb-3'>
          <div className='flex items-center gap-2'>
            <Button variant='primary' size='sm' onClick={confirmProposal} disabled={agentLoading}>
              Apply change
            </Button>
            <Button variant='ghost' size='sm' onClick={dismissProposal} disabled={agentLoading}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <div className='shrink-0 px-4 pb-4 pt-3'>
        <div className='flex flex-col rounded-[16px] border border-[rgba(255,193,7,0.10)] bg-[rgba(255,255,255,0.03)] shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-[14px] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] focus-within:border-[rgba(255,193,7,0.22)]'>
          <input
            ref={chatInputRef}
            type='text'
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleSend()
              }
            }}
            className='w-full bg-transparent px-4 pt-4 pb-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none'
            placeholder='Ask about this architecture...'
          />
          {/* Toolbar row — Select model is placeholder UI; wire real logic in a future task */}
          <div className='flex items-center gap-2 px-3 pb-3 pt-0'>
            <button
              type='button'
              onClick={clearConversation}
              disabled={agentLoading}
              className='inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs text-text-muted transition hover:border-white/[0.14] hover:text-text-primary disabled:opacity-50'
            >
              <Trash2 className='h-3.5 w-3.5' />
              Clear
            </button>
            <button
              type='button'
              className='inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs text-text-muted transition hover:border-white/[0.14] hover:text-text-primary'
            >
              Select model
              <ChevronDown className='h-3.5 w-3.5' />
            </button>
            <button
              type='button'
              onClick={handleSend}
              disabled={agentLoading}
              className='ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[rgba(255,193,7,0.18)] bg-gradient-to-b from-[#FFD54A] to-[#FFC107] text-black transition hover:-translate-y-0.5 disabled:opacity-50'
              aria-label='Send message'
            >
              <ArrowUp className='h-3.5 w-3.5' />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
