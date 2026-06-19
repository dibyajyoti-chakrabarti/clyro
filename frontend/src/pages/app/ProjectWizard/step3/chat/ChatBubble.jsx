import ReactMarkdown from 'react-markdown'

export default function ChatBubble({ message }) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
          message.role === 'user'
            ? 'bg-blue-500 text-white'
            : 'bg-background text-text-primary'
        }`}
      >
        {message.role === 'user' ? (
          message.text
        ) : (
          <div className='space-y-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-4 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_a]:underline'>
            <ReactMarkdown>{message.text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
