import ReactMarkdown from 'react-markdown'

export default function ChatBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative max-w-[85%] overflow-hidden rounded-[16px] px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-[12px] ${
          isUser
            ? 'border border-[rgba(255,193,7,0.15)] bg-[rgba(255,193,7,0.10)] text-[#F8F4E8]'
            : 'border border-white/[0.05] bg-[rgba(255,255,255,0.03)] text-text-primary'
        }`}
      >
        {isUser ? (
          message.text
        ) : (
          <div className='space-y-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_a]:underline'>
            <span className='block mb-1 text-3xl leading-none select-none text-[#FFC107] opacity-40'>❝</span>
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
