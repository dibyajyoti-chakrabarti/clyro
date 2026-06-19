import { Sparkles, Send } from 'lucide-react'
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
  return (
    <div className='flex flex-[1.1] min-w-0 flex-col overflow-hidden rounded-[24px] border-2 border-[rgba(255,196,0,0.35)] bg-surface shadow-[0_0_0_1px_rgba(255,196,0,0.08),0_0_18px_rgba(255,196,0,0.06)]'>
      <div className='flex min-h-0 flex-1 flex-col'>
        <div className='flex items-center gap-2 border-b border-[rgba(255,196,0,0.14)] px-4 py-3'>
          <Sparkles className='h-4 w-4 text-accent' />
          <p className='text-sm font-semibold text-text-primary'>Canvas agent</p>
          <button
            type='button'
            onClick={clearConversation}
            disabled={agentLoading}
            title='Clear conversation'
            className='ml-auto text-xs text-text-muted transition hover:text-text-primary disabled:opacity-50'
          >
            Clear
          </button>
        </div>

        <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3'>
          {chatHistory.map((message, index) => (
            <ChatBubble key={`${message.role}-${index}`} message={message} />
          ))}
          {agentLoading ? (
            <div className='flex justify-start'>
              <div className='rounded-2xl bg-background px-3 py-2 text-sm text-text-muted'>â€¦</div>
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        {pendingOp ? (
          <div className='border-t border-[rgba(255,196,0,0.14)] bg-background/40 px-4 py-3'>
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

        <div className='border-t border-[rgba(255,196,0,0.14)] p-3'>
          <div className='flex items-center gap-2'>
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
              className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              placeholder='Ask about this architecture...'
            />
            <button
              type='button'
              onClick={handleSend}
              disabled={agentLoading}
              className='grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-background text-text-primary transition hover:border-accent hover:text-accent disabled:opacity-50'
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
