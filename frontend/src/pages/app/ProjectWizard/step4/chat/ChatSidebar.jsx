import Lottie from 'lottie-react'
import { ArrowUp, ChevronDown, Layers, Shield, Sparkles, Trash2, TrendingDown, Users, X } from 'lucide-react'
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
  onClose,
  ChatBubble,
}) {
  const suggestedActions = [
    { label: 'Explain Architecture', icon: Layers },
    { label: 'Reduce Cost', icon: TrendingDown },
    { label: 'Review Security', icon: Shield },
    { label: 'Scale to 100k Users', icon: Users },
  ]

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-[rgba(255,193,7,0.10)] bg-[rgba(10,10,10,0.42)] shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_60px_rgba(255,193,7,0.05)] backdrop-blur-[20px]'>
      <div className='flex h-full min-h-0 flex-1 flex-col'>
        <div className='shrink-0 px-4 pt-4'>
          <div className='flex items-start justify-between gap-3 pb-3'>
            <div className='min-w-0'>
              <div className='flex items-center gap-3'>
                <span className='grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[rgba(255,193,7,0.14)] bg-[rgba(255,193,7,0.08)] text-accent shadow-[0_4px_14px_rgba(0,0,0,0.18)]'>
                  <Sparkles className='h-5 w-5' />
                </span>
                <div className='min-w-0'>
                  <p className='text-[16px] font-semibold leading-5 tracking-tight text-text-primary'>Canvas Agent</p>
                  <p className='mt-0.5 text-[12px] text-text-muted'>Architecture Assistant</p>
                </div>
              </div>
            </div>

            {onClose ? (
              <button
                type='button'
                onClick={onClose}
                title='Close chat drawer'
                aria-label='Close chat drawer'
                className='grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-[rgba(255,193,7,0.18)] hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary'
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
            {chatHistory.length === 1 && (
              <div className='grid grid-cols-2 gap-2 pt-1'>
                {suggestedActions.map((action) => (
                  <button
                    key={action.label}
                    type='button'
                    className='inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] bg-white/[0.03] px-3 py-2 text-xs font-medium text-text-primary transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-[rgba(255,193,7,0.28)] hover:bg-[rgba(255,193,7,0.08)] hover:shadow-[0_0_0_1px_rgba(255,193,7,0.08)]'
                    onClick={() => {
                      setChatInput(action.label)
                      if (chatInputRef.current) chatInputRef.current.focus()
                    }}
                  >
                    <action.icon className='h-3.5 w-3.5 shrink-0 text-[#FFC107]' />
                    <span className='truncate'>{action.label}</span>
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
          <div className='overflow-hidden rounded-[20px] border border-[rgba(255,193,7,0.12)] bg-gradient-to-b from-[rgba(255,255,255,0.04)] to-[rgba(255,255,255,0.015)] shadow-[0_10px_30px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-[14px] transition-all duration-200 ease-out focus-within:border-[rgba(255,193,7,0.38)] focus-within:shadow-[0_0_0_4px_rgba(255,193,7,0.10),0_10px_30px_rgba(0,0,0,0.2)]'>
            <div className='flex h-20 items-center px-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)]'>
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
                className='w-full bg-transparent text-sm text-text-primary placeholder:font-medium placeholder:tracking-wide placeholder:text-text-muted focus-visible:outline-none'
                placeholder='Ask about this architecture...'
              />
            </div>

            <div className='flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] px-4 py-3'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <button
                  type='button'
                  onClick={clearConversation}
                  disabled={agentLoading}
                  title='Clear conversation'
                  className='inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.14] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-text-muted transition-all duration-200 ease-out hover:border-[rgba(255,193,7,0.28)] hover:bg-white/[0.06] hover:text-text-primary active:scale-[0.97] disabled:opacity-50'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                  Clear
                </button>

                {/* Placeholder only — no model-selection state/handler exists yet. Wire this up to real logic when multi-model support is added. */}
                <button
                  type='button'
                  disabled
                  title='Select model (coming soon)'
                  className='group inline-flex min-w-0 shrink items-center gap-1 truncate rounded-full border border-white/[0.14] bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-text-muted opacity-60 transition-all duration-200 ease-out hover:border-[rgba(255,193,7,0.24)] hover:bg-white/[0.05]'
                >
                  <span className='truncate'>Select model</span>
                  <ChevronDown className='h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out group-hover:rotate-180' />
                </button>
              </div>

              <button
                type='button'
                onClick={handleSend}
                disabled={agentLoading}
                className='grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(255,193,7,0.18)] bg-gradient-to-b from-[#FFD54A] to-[#FFC107] text-black shadow-[0_8px_18px_rgba(0,0,0,0.16)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-105 hover:shadow-[0_10px_24px_rgba(255,193,7,0.35)] hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0'
                aria-label='Send message'
              >
                <ArrowUp className='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
