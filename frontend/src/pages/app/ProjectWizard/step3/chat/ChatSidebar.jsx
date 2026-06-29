import Lottie from 'lottie-react'
import { ArrowLeft, Send, Sparkles } from 'lucide-react'
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
}) {
  const suggestedActions = ['Explain Architecture', 'Reduce Cost', 'Review Security', 'Scale to 100k Users']

  return (
    <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-[rgba(255,193,7,0.10)] bg-[rgba(10,10,10,0.42)] shadow-[0_24px_80px_rgba(0,0,0,0.28),0_0_60px_rgba(255,193,7,0.05)] backdrop-blur-[20px]'>
      <div className='flex h-full min-h-0 flex-1 flex-col'>
        <div className='shrink-0 px-4 pt-4'>
          <div className='flex items-start justify-between gap-3 pb-3'>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <span className='grid h-8 w-8 place-items-center rounded-full border border-[rgba(255,193,7,0.12)] bg-[rgba(255,193,7,0.06)] text-accent'>
                  <Sparkles className='h-4 w-4' />
                </span>
                <div className='min-w-0'>
                  <p className='text-[16px] font-semibold leading-5 tracking-tight text-text-primary'>Canvas Agent</p>
                  <p className='mt-0.5 text-[12px] text-text-muted'>Architecture Assistant</p>
                </div>
              </div>
            </div>

            <button
              type='button'
              onClick={clearConversation}
              disabled={agentLoading}
              title='Clear conversation'
              className='grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.02] text-text-muted transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:border-[rgba(255,193,7,0.18)] hover:bg-[rgba(255,255,255,0.04)] hover:text-text-primary disabled:opacity-50'
            >
              <ArrowLeft className='h-4 w-4 rotate-180' />
            </button>
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 scroll-smooth scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border'>
          <div className='space-y-4'>
            {chatHistory.map((message, index) => (
              <ChatBubble key={`${message.role}-${index}`} message={message} />
            ))}
            {chatHistory.length === 1 && (
              <div className='flex flex-wrap gap-2 pt-1'>
                {suggestedActions.map((action) => (
                  <button
                    key={action}
                    type='button'
                    className='inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-text-primary transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:border-[rgba(255,193,7,0.18)] hover:bg-[rgba(255,193,7,0.08)] hover:shadow-[0_0_0_1px_rgba(255,193,7,0.08)]'
                    onClick={() => {
                      setChatInput(action)
                      if (chatInputRef.current) chatInputRef.current.focus()
                    }}
                  >
                    {action}
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
          <div className='flex h-14 items-center gap-2 rounded-[16px] border border-[rgba(255,193,7,0.10)] bg-[rgba(255,255,255,0.03)] px-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-[14px] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] focus-within:border-[rgba(255,193,7,0.22)]'>
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
              className='w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none'
              placeholder='Ask about this architecture...'
            />
            <button
              type='button'
              onClick={handleSend}
              disabled={agentLoading}
              className='grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-[rgba(255,193,7,0.18)] bg-gradient-to-b from-[#FFD54A] to-[#FFC107] text-black shadow-[0_8px_18px_rgba(0,0,0,0.16)] transition duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(0,0,0,0.18)] disabled:opacity-50'
              aria-label='Send message'
            >
              <Send className='h-4 w-4' />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
